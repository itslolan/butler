import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { insertDocument, insertTransactions, appendMetadata, insertAccountSnapshots, getUnclarifiedTransactions, findMatchingTransfer, getAllMemories, searchTransactions, upsertMemory, markDocumentPendingAccountSelection, findAccountsByLast4, getAccountsByUserId, getOrCreateAccount } from '@/lib/db-tools';
import { uploadFile, Transaction } from '@/lib/supabase';
import { calculateMonthlySnapshots } from '@/lib/snapshot-calculator';
import { generateSuggestedActions } from '@/lib/action-generator';
import { v4 as uuidv4 } from 'uuid';
import { getBudgetCategories, syncTransactionCategoriesToBudget } from '@/lib/budget-utils';
import { normalizeCategoryNameKey, normalizeCategoryDisplayName } from '@/lib/category-normalization';
import { applyFixedExpenseDetectionToTransactions, persistFixedExpenseFlags } from '@/lib/fixed-expense-detector';
import { createLLMSession, logLLMCall } from '@/lib/llm-logger';

export const runtime = 'nodejs';

const GEMINI_MODEL = 'gemini-3-pro-preview';

const BASE_SYSTEM_PROMPT = `You are a financial document parser. Extract structured information from bank statements, credit card statements, and bank app/website screenshots.

**CRITICAL**: Return ONLY valid JSON. Do NOT wrap your response in markdown code blocks. Do NOT include any text before or after the JSON object.

Return a JSON object with this exact structure:
{
  "sourceType": "statement" | "screenshot",
  "documentType": "bank_statement" | "credit_card_statement" | "unknown",
  "issuer": string or null,
  "accountId": string or null,
  "accountName": string or null,
  "accountNumberLast4": string or null,
  "currency": string (ISO 4217 code like "USD", "EUR", "GBP", "INR", etc.),
  "statementDate": "YYYY-MM-DD" or null,
  "previousBalance": number or null,
  "newBalance": number or null,
  "creditLimit": number or null,
  "minimumPayment": number or null,
  "dueDate": "YYYY-MM-DD" or null,
  "firstTransactionDate": "YYYY-MM-DD" or null,
  "lastTransactionDate": "YYYY-MM-DD" or null,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "merchant": string,
      "amount": number,
      "transactionType": "income" | "expense" | "transfer" | "other",
      "category": string or null,
      "spendClassification": "essential" | "discretionary" | null,
      "description": string or null,
      "confidence": number (0.0 to 1.0),
      "clarificationNeeded": boolean,
      "clarificationQuestion": string or null,
      "isPending": boolean
    }
  ],
  "incomeTransactions": [
    {
      "date": "YYYY-MM-DD",
      "source": string,
      "amount": number,
      "frequency": "monthly" | "biweekly" | "weekly" | "irregular" | null,
      "confidence": number (0.0 to 1.0)
    }
  ],
  "metadataSummary": "A concise markdown-formatted summary of key information from this statement. Include: issuer, account number (last 4 digits only), statement period, balances, credit limit if applicable, notable spending patterns, and any important notices or alerts."
}

**Source Type Detection:**
- **statement**: Official bank/credit card statements (PDFs or scanned documents) that contain formal account information, statement periods, official letterheads, and structured layouts
- **screenshot**: Screenshots from bank apps or websites showing transaction history. These typically:
  - Have mobile app UI elements (status bars, navigation buttons)
  - Show partial transaction lists from scrolling
  - May NOT contain account numbers or official account names
  - Have informal/app-style layouts
  - May show "Available Balance" instead of statement balances

**Important Instructions:**
1. **sourceType**: ALWAYS detect and set this field first. If the image looks like a mobile app screenshot or web browser capture of a bank portal, set to "screenshot". If it's a formal statement document, set to "statement".
2. **accountId**: Extract the full account number or last 4 digits (e.g., "1234" or "****1234"). For screenshots, this may not be available - set to null.
3. **accountNumberLast4**: Extract ONLY the last 4 digits if visible (e.g., "1234"). This is critical for matching accounts across uploads.
4. **accountName**: Extract the account nickname or card name if visible. For screenshots, this is often NOT available - set to null if not clearly visible.
5. **issuer**: The bank or financial institution name. For screenshots, try to identify from app branding/logos.
6. **currency**: Identify the currency used from symbols ($, €, £, ¥, ₹, etc.) or text. Return ISO 4217 code. Default to "USD".
7. **firstTransactionDate**: The date of the EARLIEST transaction in the document
8. **lastTransactionDate**: The date of the LATEST transaction in the document

**CRITICAL - Pending vs Posted/Authorized Transaction Detection:**
Credit cards show transactions in different states. You MUST detect and mark pending transactions:
- **Pending transactions**: Recent transactions that haven't fully cleared yet. Look for:
  - Labels: "PENDING", "POSTED", "PROCESSING", "HOLD", "AUTHORIZATION"
  - Separate sections: "Recent Activity", "Pending Transactions", "Authorizations"
  - Visual indicators: Different styling, gray text, pending icons
- **Authorized/Settled transactions**: Final, cleared transactions in the main transaction history or statement

**Rules for isPending field:**
1. **Set isPending = true** for any transaction that shows pending/processing indicators
2. **Set isPending = false** for authorized/settled/cleared transactions
3. **Include ALL transactions** - both pending AND authorized, even if they appear to be duplicates. The app will handle reconciliation automatically.
4. **When in doubt, set isPending = false** - it's safer to treat ambiguous transactions as authorized

**Examples of pending indicators:**
- "UBER PENDING" → isPending: true
- "AMAZON.COM PENDING" → isPending: true  
- "STARBUCKS HOLD" → isPending: true
- Transaction in "Pending" or "Recent Activity" section → isPending: true
- "UBER *TRIP NYC" (in main history) → isPending: false
- "AMAZON.COM*AB12CD" (cleared) → isPending: false

**Transaction Type Classification:**
- **income**: Salary, wages, direct deposits from employers, business income, freelance payments, investment income, refunds, reimbursements
  - Keywords: SALARY, PAYROLL, DIRECT DEPOSIT, WAGE, INCOME, EMPLOYER, PAYCHECK, PAYMENT FROM, DEPOSIT, REFUND, REIMBURSEMENT
  - Patterns: Regular deposits of similar amounts, large credits
- **expense**: Purchases, bills, fees, charges, payments to merchants
  - Most debit transactions, card payments, bills, subscriptions
  - **EXCEPTION**: Credit card payments are NOT expenses (see transfer below)
- **transfer**: Transfers between own accounts, credit card payments
  - Keywords: TRANSFER TO/FROM, INTERNAL TRANSFER, ACCOUNT TRANSFER, CREDIT CARD PAYMENT, CARD PAYMENT, PAYMENT TO [CARD NAME], AUTO PAYMENT, E-PAYMENT
  - **IMPORTANT**: Credit card payments (like "Payment to Visa", "Card Payment", "Auto Pay Credit Card") should ALWAYS be classified as transfers, NOT expenses
  - **Reasoning**: Credit card payments move money from checking to credit card account. The actual expenses were already recorded as individual credit card transactions
  - Patterns: Round numbers, matching debits/credits, payments to credit card accounts
- **other**: Everything else that doesn't clearly fit

**Confidence & Clarification:**
- Assign confidence score (0.0 to 1.0) to each transaction type classification
- If confidence < 0.7, set clarificationNeeded = true
- Generate a specific clarification question like: "Is this a salary/income deposit or a transfer from another account?" or "Is this business income or a personal transfer?"

**Income Detection for Bank Statements:**
- Identify all income transactions and list separately in incomeTransactions array
- Detect payment frequency patterns (monthly on day X, biweekly, irregular)
- Include confidence scores for income identification

**Spend Classification (Essential vs Discretionary):**
For expense transactions, classify as:
- **essential**: Necessary living expenses - Rent, Mortgage, Utilities (electric, water, gas, internet, phone), Groceries, Healthcare, Insurance, Transportation/Gas, Loans, Basic necessities
- **discretionary**: Optional/lifestyle expenses - Dining out, Entertainment, Shopping, Travel, Subscriptions (streaming, gym), Electronics, Hobbies, Alcohol/Bars, Non-essential purchases
- **null**: For income, transfers, or if uncertain

Examples:
- Rent payment → essential
- Electric bill → essential
- Grocery store → essential
- Gas station → essential
- Restaurant → discretionary
- Amazon shopping → discretionary
- Netflix subscription → discretionary

Extract all transactions visible in the document. Categorize them logically (Food, Travel, Utilities, Entertainment, Shopping, etc.).
For amounts, use positive numbers for credits/deposits and negative numbers for debits/charges.
Always return valid JSON.`;

/**
 * Build system prompt with user context and budget categories
 */
async function buildSystemPrompt(userId: string): Promise<string> {
  const [memoriesText, budgetCategories] = await Promise.all([
    getAllMemories(userId).catch(() => ''),
    getBudgetCategories(userId),
  ]);
  
  let prompt = BASE_SYSTEM_PROMPT;
  
  // Add budget category guidance
  if (budgetCategories.length > 0) {
    const categoryNames = budgetCategories.map(c => c.name);
    prompt += `\n\n**Existing Budget Categories:**
The user has these budget categories set up:
${categoryNames.join(', ')}

**IMPORTANT**: When categorizing transactions, PREFER using these existing categories when applicable. However, you are FREE to create new categories if:
- The transaction doesn't fit any existing category
- A more specific category would be more accurate
- The merchant/transaction type requires a distinct category

Examples:
- If existing categories include "Groceries", use that instead of creating "Food Shopping"
- If existing categories include "Dining Out", use that instead of "Restaurants" or "Food & Dining"
- But if you see gym membership and there's no "Fitness" or "Health" category, create one`;
  }
  
  // Add user memories/context
  if (memoriesText) {
    prompt += `\n\n**User Context/Memories:**
${memoriesText}

Use these memories to help classify transactions. For example, if you know the user receives a salary of a certain amount from a specific merchant, classify similar transactions accordingly.`;
  }
  
  return prompt;
}

/**
 * Monitor transaction patterns and update memories when patterns change
 */
async function monitorPatternChanges(
  userId: string,
  newTransactions: any[],
  extractedData: any
): Promise<void> {
  if (!process.env.GEMINI_API_KEY || newTransactions.length === 0) {
    return;
  }

  try {
    // Get existing memories
    const existingMemories = await getAllMemories(userId);
    
    // Analyze income patterns from new transactions
    const incomeTransactions = newTransactions.filter(t => t.transactionType === 'income');
    const transferTransactions = newTransactions.filter(t => t.transactionType === 'transfer');

    // Check for salary/income pattern changes
    if (incomeTransactions.length > 0 && extractedData.incomeTransactions) {
      for (const incomeTxn of extractedData.incomeTransactions) {
        if (incomeTxn.frequency && incomeTxn.frequency !== 'irregular' && incomeTxn.confidence > 0.7) {
          const amount = Math.abs(incomeTxn.amount);
          const currency = extractedData.currency || 'USD';
          const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'INR' ? '₹' : currency;
          
          // Check if this conflicts with existing salary memory
          const newMemory = `User receives ${incomeTxn.frequency} ${incomeTxn.source ? `income of ${currencySymbol}${amount.toFixed(2)} from ${incomeTxn.source}` : `salary of ${currencySymbol}${amount.toFixed(2)}`}`;
          
          // Check if there's an existing salary memory with different amount
          if (existingMemories) {
            const salaryPattern = /salary|income.*\$|income.*€|income.*£|income.*₹/i;
            const existingSalaryMemories = existingMemories.split('\n').filter(m => salaryPattern.test(m));
            
            for (const existingMemory of existingSalaryMemories) {
              // Extract amount from existing memory
              const amountMatch = existingMemory.match(/(\$|€|£|₹)([\d,]+\.?\d*)/);
              if (amountMatch) {
                const existingAmount = parseFloat(amountMatch[2].replace(/,/g, ''));
                const tolerance = Math.max(existingAmount * 0.1, 100); // 10% tolerance or $100
                
                // If amounts differ significantly, update the memory
                if (Math.abs(existingAmount - amount) > tolerance) {
                  await upsertMemory(userId, newMemory);
                  console.log(`[Pattern Monitoring] Updated salary memory: ${existingAmount} -> ${amount}`);
                  break;
                }
              }
            }
            
            // If no existing salary memory, add new one
            if (existingSalaryMemories.length === 0) {
              await upsertMemory(userId, newMemory);
              console.log(`[Pattern Monitoring] Added new salary memory: ${newMemory}`);
            }
          } else {
            // No existing memories, add new one
            await upsertMemory(userId, newMemory);
            console.log(`[Pattern Monitoring] Added new salary memory: ${newMemory}`);
          }
        }
      }
    }

    // Check for transfer pattern changes
    if (transferTransactions.length > 0) {
      // Group transfers by amount and accounts
      const transferGroups = new Map<string, { count: number; accounts: Set<string>; amount: number }>();
      
      for (const txn of transferTransactions) {
        const amount = Math.abs(txn.amount);
        const key = `${amount.toFixed(2)}`;
        
        if (!transferGroups.has(key)) {
          transferGroups.set(key, { count: 0, accounts: new Set(), amount });
        }
        
        const group = transferGroups.get(key)!;
        group.count++;
        if (txn.account_name) {
          group.accounts.add(txn.account_name);
        }
      }
      
      // Check for regular transfer patterns (same amount appearing multiple times)
      for (const [amountKey, group] of transferGroups.entries()) {
        if (group.count >= 2) {
          // This looks like a regular transfer pattern
          const currency = extractedData.currency || 'USD';
          const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'INR' ? '₹' : currency;
          const accounts = Array.from(group.accounts);
          
          if (accounts.length >= 2) {
            const newMemory = `User regularly transfers ${currencySymbol}${group.amount.toFixed(2)} between ${accounts.join(' and ')}`;
            
            // Check if this conflicts with existing transfer memory
            if (existingMemories) {
              const transferPattern = /transfers.*\$|transfers.*€|transfers.*£|transfers.*₹/i;
              const existingTransferMemories = existingMemories.split('\n').filter(m => transferPattern.test(m));
              
              let foundMatch = false;
              for (const existingMemory of existingTransferMemories) {
                // Check if same accounts are mentioned
                const accountsMatch = accounts.some(acc => existingMemory.includes(acc));
                if (accountsMatch) {
                  // Extract amount from existing memory
                  const amountMatch = existingMemory.match(/(\$|€|£|₹)([\d,]+\.?\d*)/);
                  if (amountMatch) {
                    const existingAmount = parseFloat(amountMatch[2].replace(/,/g, ''));
                    const tolerance = Math.max(existingAmount * 0.1, 50); // 10% tolerance or $50
                    
                    // If amounts differ significantly, update the memory
                    if (Math.abs(existingAmount - group.amount) > tolerance) {
                      await upsertMemory(userId, newMemory);
                      console.log(`[Pattern Monitoring] Updated transfer memory: ${existingAmount} -> ${group.amount}`);
                      foundMatch = true;
                      break;
                    } else {
                      foundMatch = true; // Amount matches, no update needed
                      break;
                    }
                  }
                }
              }
              
              if (!foundMatch) {
                await upsertMemory(userId, newMemory);
                console.log(`[Pattern Monitoring] Added new transfer memory: ${newMemory}`);
              }
            } else {
              // No existing memories, add new one
              await upsertMemory(userId, newMemory);
              console.log(`[Pattern Monitoring] Added new transfer memory: ${newMemory}`);
            }
          }
        }
      }
    }
  } catch (error: any) {
    console.error('[Pattern Monitoring] Error:', error.message);
    // Don't throw - pattern monitoring is non-critical
  }
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendUpdate = (step: string, message: string, status: 'processing' | 'complete' = 'processing') => {
        const data = JSON.stringify({ step, message, status, timestamp: Date.now() });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        console.log(`[${status.toUpperCase()}] ${message}`);
      };

      try {
        if (!process.env.GEMINI_API_KEY) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Gemini API key not configured' })}\n\n`));
          controller.close();
          return;
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const userId = (formData.get('userId') as string) || 'default-user';

        // Build system prompt with memories and budget categories
        const systemPrompt = await buildSystemPrompt(userId);

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          systemInstruction: systemPrompt,
          generationConfig: {
            responseMimeType: 'application/json',
          },
        });

        if (!file) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'No file provided' })}\n\n`));
          controller.close();
          return;
        }

        sendUpdate('upload', `📄 Processing ${file.name}...`, 'complete');

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
        const isImage = file.type.startsWith('image/');

        if (!isPdf && !isImage) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Unsupported file type' })}\n\n`));
          controller.close();
          return;
        }

        sendUpdate('storage', '☁️ Uploading to secure storage...', 'processing');
        const fileUrl = await uploadFile(userId, buffer, file.name);
        sendUpdate('storage', '☁️ Uploaded to secure storage', 'complete');

        sendUpdate('analysis', '🤖 Analyzing document with AI...', 'processing');

        const filePart = {
          inlineData: {
            mimeType: isPdf ? 'application/pdf' : file.type,
            data: buffer.toString('base64'),
          },
        };

        const sessionId = createLLMSession();
        const llmStartTime = Date.now();
        const geminiResponse = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: 'Extract all information from this financial document and return the structured JSON.',
                },
                filePart,
              ],
            },
          ],
        });
        const llmDuration = Date.now() - llmStartTime;

        const content = geminiResponse.response.text();
        
        // Log the LLM call (no truncation - store full data for debugging)
        logLLMCall({
          sessionId,
          userId,
          flowName: 'statement_parsing_stream',
          model: GEMINI_MODEL,
          systemPrompt: systemPrompt,
          userMessage: 'Extract all information from this financial document',
          llmResult: content,
          hasAttachments: true,
          attachmentType: isPdf ? 'pdf' : 'image',
          durationMs: llmDuration,
        });
        
        if (!content) {
          throw new Error('No response from Gemini');
        }

        let extractedData;
        try {
          // First, try direct JSON parse
          extractedData = JSON.parse(content);
        } catch (parseError) {
          console.log('Direct JSON parse failed, attempting to extract JSON from response...');
          
          // Try to extract JSON from markdown code blocks
          let cleanedContent = content;
          
          // Remove markdown code blocks (```json ... ``` or ``` ... ```)
          cleanedContent = cleanedContent.replace(/```(?:json)?\s*/g, '');
          cleanedContent = cleanedContent.replace(/```\s*/g, '');
          
          // Try parsing the cleaned content
          try {
            extractedData = JSON.parse(cleanedContent);
          } catch (secondParseError) {
            // Last resort: extract the first complete JSON object
            const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                extractedData = JSON.parse(jsonMatch[0]);
              } catch (thirdParseError) {
                // If still failing, log the content for debugging
                console.error('Failed to parse JSON. Content preview:', content.substring(0, 500));
                throw new Error(`Failed to parse JSON response from Gemini. Error: ${thirdParseError instanceof Error ? thirdParseError.message : 'Unknown error'}`);
              }
            } else {
              console.error('No JSON object found in response. Content preview:', content.substring(0, 500));
              throw new Error('No valid JSON object found in Gemini response');
            }
          }
        }

        sendUpdate('analysis', '🤖 Document analyzed successfully', 'complete');

        // Generate friendly document description
        const docType = extractedData.documentType === 'credit_card_statement' 
          ? 'credit card statement' 
          : extractedData.documentType === 'bank_statement' 
            ? 'bank statement' 
            : 'financial document';
        
        const issuerText = extractedData.issuer ? ` from ${extractedData.issuer}` : '';
        const accountText = extractedData.accountName 
          ? ` for ${extractedData.accountName}` 
          : extractedData.accountId 
            ? ` ending with ${extractedData.accountId.slice(-4)}` 
            : '';
        
        const dateText = extractedData.firstTransactionDate && extractedData.lastTransactionDate
          ? ` covering ${new Date(extractedData.firstTransactionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} to ${new Date(extractedData.lastTransactionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
          : extractedData.statementDate
            ? ` for ${new Date(extractedData.statementDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
            : '';

        sendUpdate('detection', `📋 Detected ${docType}${issuerText}${accountText}${dateText}`, 'complete');

        // Check if this is a screenshot vs formal statement
        const sourceType = extractedData.sourceType || 'statement';
        const isScreenshot = sourceType === 'screenshot';

        // Account matching for statements (not screenshots)
        let accountMatchInfo: {
          needsConfirmation: boolean;
          matchedAccount?: any;
          officialName?: string;
          last4?: string;
          allAccounts?: any[];
        } = { needsConfirmation: false };
        
        // Track the resolved account ID to link transactions properly
        let resolvedAccountId: string | null = null;

        if (!isScreenshot && (extractedData.accountName || extractedData.accountNumberLast4)) {
          sendUpdate('account-check', '🔗 Checking for existing account matches...', 'processing');
          
          const officialName = extractedData.accountName || null;
          const last4 = extractedData.accountNumberLast4 || 
            (extractedData.accountId ? extractedData.accountId.slice(-4) : null);
          
          // Check if we have an account with matching last4
          if (last4) {
            const matchingAccounts = await findAccountsByLast4(userId, last4);
            
            if (matchingAccounts.length === 1) {
              // Found exactly one match - use it automatically
              resolvedAccountId = matchingAccounts[0].id ?? null;
              accountMatchInfo = {
                needsConfirmation: false,
                matchedAccount: matchingAccounts[0],
                officialName,
                last4,
              };
              sendUpdate('account-match', `🔗 Linked to existing account: "${matchingAccounts[0].display_name}" (****${last4})`, 'complete');
            } else if (matchingAccounts.length > 1) {
              // Multiple matches - user needs to pick (mark as pending)
              accountMatchInfo = {
                needsConfirmation: true,
                allAccounts: matchingAccounts,
                officialName,
                last4,
              };
              sendUpdate('account-match', `🔗 Found ${matchingAccounts.length} accounts with ****${last4} - please confirm which one`, 'complete');
            } else {
              // No last4 match - create new account automatically
              try {
                const { account } = await getOrCreateAccount(userId, {
                  display_name: officialName || `Account ****${last4}`,
                  account_number_last4: last4 || undefined,
                  official_name: officialName || undefined,
                  issuer: extractedData.issuer || undefined,
                  source: 'statement',
                });
                resolvedAccountId = account.id ?? null;
                sendUpdate('account-match', `✅ Created new account: ${officialName || `****${last4}`}`, 'complete');
              } catch (error) {
                console.error('[process-statement] Error creating account:', error);
                sendUpdate('account-match', `⚠️ Failed to create account, continuing...`, 'complete');
              }
            }
          } else if (officialName) {
            // No last4 but have official name - create or find by name
            try {
              const { account } = await getOrCreateAccount(userId, {
                display_name: officialName,
                official_name: officialName,
                issuer: extractedData.issuer || undefined,
                source: 'statement',
              });
              resolvedAccountId = account.id ?? null;
              sendUpdate('account-match', `✅ Linked to account: ${officialName}`, 'complete');
            } catch (error) {
              console.error('[process-statement] Error creating account:', error);
              sendUpdate('account-match', `⚠️ Failed to create account, continuing...`, 'complete');
            }
          }
        }

        // Duplicate detection and pending transaction reconciliation
        let transactionsToInsert = extractedData.transactions || [];
        let duplicatesInfo = { duplicatesFound: 0, duplicateExamples: [] as string[] };
        let pendingReconciliationInfo = { pendingReconciled: 0, pendingIdsToDelete: [] as string[], reconciledFromIds: new Map<number, string>() };

        if (transactionsToInsert.length > 0) {
          sendUpdate('extraction', `💳 Found ${transactionsToInsert.length} transaction${transactionsToInsert.length !== 1 ? 's' : ''} in the document`, 'complete');
        }

        if (transactionsToInsert.length > 0 && extractedData.firstTransactionDate && extractedData.lastTransactionDate) {
          sendUpdate('duplicate-check', '🔍 Checking for duplicates and pending transactions...', 'processing');
          
          const { searchTransactions, getPendingTransactions, deleteTransactionsByIds } = await import('@/lib/db-tools');
          
          // Expand date range by 5 days to catch pending/posted matches
          const startDate = new Date(extractedData.firstTransactionDate);
          startDate.setDate(startDate.getDate() - 5);
          const endDate = new Date(extractedData.lastTransactionDate);
          endDate.setDate(endDate.getDate() + 5);
          
          const existingTransactions = await searchTransactions(userId, {
            accountName: extractedData.accountName || undefined,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
          });

          // Also fetch pending transactions specifically (may overlap but ensures we have is_pending flag)
          let pendingTransactions: Array<any> = [];
          try {
            pendingTransactions = await getPendingTransactions(
              userId,
              resolvedAccountId,
              startDate.toISOString().split('T')[0],
              endDate.toISOString().split('T')[0]
            );
          } catch (e) {
            // is_pending column may not exist yet
            console.log('[process-statement] getPendingTransactions failed, column may not be migrated:', e);
          }

          // Merge existing and pending, ensuring we have id and is_pending
          const allExisting = existingTransactions.map(t => ({
            id: t.id || '',
            date: t.date instanceof Date ? t.date.toISOString().split('T')[0] : String(t.date),
            merchant: t.merchant,
            amount: Number(t.amount),
            category: t.category,
            description: t.description,
            is_pending: pendingTransactions.some(p => p.id === t.id) || (t as any).is_pending || false,
          }));

          if (allExisting.length > 0) {
            const { reconcilePendingTransactions } = await import('@/lib/deduplication-test');
            
            const reconciliationResult = reconcilePendingTransactions(
              transactionsToInsert,
              allExisting
            );

            // Store which transactions need reconciled_from_id
            const reconciledFromIds = new Map<number, string>();
            reconciliationResult.reconciledTransactions.forEach((rt) => {
              const txnIdx = transactionsToInsert.findIndex((t: any) => 
                t.date === rt.transaction.date && 
                t.merchant === rt.transaction.merchant && 
                Math.abs(t.amount - rt.transaction.amount) < 0.01
              );
              if (txnIdx >= 0) {
                reconciledFromIds.set(txnIdx, rt.reconciledFromId);
              }
            });

            // Delete reconciled pending transactions
            if (reconciliationResult.pendingIdsToDelete.length > 0) {
              try {
                const deletedCount = await deleteTransactionsByIds(reconciliationResult.pendingIdsToDelete);
                console.log(`[process-statement] Deleted ${deletedCount} reconciled pending transactions`);
              } catch (e) {
                console.error('[process-statement] Failed to delete pending transactions:', e);
              }
            }

            transactionsToInsert = reconciliationResult.transactionsToInsert;
            duplicatesInfo = {
              duplicatesFound: reconciliationResult.stats.exactDuplicatesSkipped,
              duplicateExamples: [],
            };
            pendingReconciliationInfo = {
              pendingReconciled: reconciliationResult.stats.pendingReconciled,
              pendingIdsToDelete: reconciliationResult.pendingIdsToDelete,
              reconciledFromIds,
            };

            // Generate status message
            const parts: string[] = [];
            if (reconciliationResult.stats.pendingReconciled > 0) {
              parts.push(`🔄 Reconciled ${reconciliationResult.stats.pendingReconciled} pending transaction${reconciliationResult.stats.pendingReconciled !== 1 ? 's' : ''}`);
            }
            if (reconciliationResult.stats.exactDuplicatesSkipped > 0) {
              parts.push(`✨ Skipped ${reconciliationResult.stats.exactDuplicatesSkipped} duplicate${reconciliationResult.stats.exactDuplicatesSkipped !== 1 ? 's' : ''}`);
            }
            if (transactionsToInsert.length > 0) {
              const pendingCount = transactionsToInsert.filter((t: any) => t.isPending).length;
              const postedCount = transactionsToInsert.length - pendingCount;
              if (pendingCount > 0 && postedCount > 0) {
                parts.push(`✅ Adding ${postedCount} posted + ${pendingCount} pending transaction${transactionsToInsert.length !== 1 ? 's' : ''}`);
              } else if (pendingCount > 0) {
                parts.push(`⏳ Adding ${pendingCount} pending transaction${pendingCount !== 1 ? 's' : ''}`);
              } else {
                parts.push(`✅ Adding ${postedCount} transaction${postedCount !== 1 ? 's' : ''}`);
              }
            }
            sendUpdate('deduplication', parts.join(' | ') || '✅ Processing complete', 'complete');
          } else {
            sendUpdate('deduplication', `✅ No existing transactions found - all ${transactionsToInsert.length} transaction${transactionsToInsert.length !== 1 ? 's are' : ' is'} new`, 'complete');
          }
        } else if (transactionsToInsert.length === 0) {
          sendUpdate('extraction', '⚠️ No transactions found in the document', 'complete');
        }

        // Auto-detect transfers by matching against other accounts
        if (transactionsToInsert.length > 0) {
          sendUpdate('transfer-check', '🔄 Checking for matching transfers in other accounts...', 'processing');
          
          let transferMatchesFound = 0;
          
          // We need to be careful not to hold up the stream too long, so we'll process sequentially but efficiently
          for (let i = 0; i < transactionsToInsert.length; i++) {
            const txn = transactionsToInsert[i];
            
            // Candidates: 
            // 1. Already classified as 'transfer' (to confirm)
            // 2. Classified as 'expense' or 'other' but flagged as needing clarification
            // 3. Any transaction with 'transfer' or 'payment' keyword in description even if not flagged
            
            const isPotentialTransfer = 
              txn.transactionType === 'transfer' || 
              (txn.clarificationNeeded && ['expense', 'other'].includes(txn.transactionType || '')) ||
              (txn.description?.toLowerCase().includes('transfer') || txn.description?.toLowerCase().includes('payment'));

            if (isPotentialTransfer) {
              try {
                // txn.date is typically YYYY-MM-DD string from JSON
                const match = await findMatchingTransfer(userId, txn.amount, txn.date);
                
                if (match) {
                  txn.transactionType = 'transfer';
                  txn.clarificationNeeded = false;
                  txn.clarificationQuestion = null;
                  // We can't strictly link by ID since we haven't inserted yet, but we can store the match info
                  // Note: txn object structure here matches the Gemini JSON output, not yet the DB Transaction interface
                  // We'll add metadata property if it doesn't exist
                  if (!txn.metadata) txn.metadata = {};
                  txn.metadata.matched_transfer_id = match.id;
                  txn.metadata.matched_account_name = match.account_name;
                  
                  transferMatchesFound++;
                }
              } catch (err) {
                console.error('Error checking transfer match for txn:', err);
                // Continue processing other transactions
              }
            }
          }
          
          if (transferMatchesFound > 0) {
             sendUpdate('transfer-match', `🔗 Linked ${transferMatchesFound} transfer${transferMatchesFound !== 1 ? 's' : ''} with other accounts`, 'complete');
          } else {
             sendUpdate('transfer-match', `✅ Transfer check complete`, 'complete');
          }
        }

        // Generate suggested actions for transactions needing clarification
        if (transactionsToInsert.length > 0) {
          const transactionsNeedingActions = transactionsToInsert.filter((txn: any) => txn.clarificationNeeded);
          
          if (transactionsNeedingActions.length > 0) {
            sendUpdate('action-generation', `🤖 Generating smart action suggestions for ${transactionsNeedingActions.length} transaction${transactionsNeedingActions.length !== 1 ? 's' : ''}...`, 'processing');
            
            // Generate actions for each transaction in parallel for better performance
            const actionPromises = transactionsNeedingActions.map(async (txn: any) => {
              try {
                const actions = await generateSuggestedActions({
                  merchant: txn.merchant,
                  amount: txn.amount,
                  date: txn.date,
                  clarificationQuestion: txn.clarificationQuestion || 'How should this transaction be categorized?',
                });
                
                // Add suggested actions to the transaction object
                txn.suggestedActions = actions; // Will be null if generation failed (uses fallback in UI)
              } catch (error) {
                console.error(`Failed to generate actions for transaction ${txn.merchant}:`, error);
                txn.suggestedActions = null; // Fallback to generic actions
              }
            });
            
            // Wait for all action generation to complete
            await Promise.all(actionPromises);
            
            const successCount = transactionsNeedingActions.filter((txn: any) => txn.suggestedActions !== null).length;
            if (successCount > 0) {
              sendUpdate('action-generation', `✨ Generated smart actions for ${successCount} transaction${successCount !== 1 ? 's' : ''}`, 'complete');
            } else {
              sendUpdate('action-generation', `⚠️ Using fallback actions (action generation unavailable)`, 'complete');
            }
          }
        }

        sendUpdate('saving', '💾 Saving to database...', 'processing');

        // Determine if account selection is needed (sourceType and isScreenshot already defined above)
        const accountName = extractedData.accountName || null;
        const accountLast4 = extractedData.accountNumberLast4 || null;
        
        // Account selection is needed if:
        // 1. No account info could be extracted, OR
        // 2. Multiple accounts matched and user needs to pick (accountMatchInfo.needsConfirmation)
        const needsAccountSelection = (!accountName && !accountLast4) || 
          (accountMatchInfo.needsConfirmation && !resolvedAccountId);
        
        // Get upload_id from request if provided (new upload entity)
        const uploadId = formData.get('uploadId') as string || null;
        // Keep batch_id for backwards compatibility (set to same as upload_id)
        const batchId = uploadId || (formData.get('batchId') as string || null);

        // Save to Supabase
        const documentEntry = {
          user_id: userId,
          file_name: file.name,
          file_url: fileUrl,
          uploaded_at: new Date().toISOString(),
          document_type: extractedData.documentType || 'unknown',
          issuer: extractedData.issuer || null,
          account_id: resolvedAccountId,  // Use the resolved account ID
          account_name: accountName,
          currency: extractedData.currency || 'USD',
          statement_date: extractedData.statementDate || null,
          previous_balance: extractedData.previousBalance || null,
          new_balance: extractedData.newBalance || null,
          credit_limit: extractedData.creditLimit || null,
          minimum_payment: extractedData.minimumPayment || null,
          due_date: extractedData.dueDate || null,
          source_type: sourceType,
          pending_account_selection: needsAccountSelection,
          upload_id: uploadId,
          batch_id: batchId,
          metadata: {
            firstTransactionDate: extractedData.firstTransactionDate || null,
            lastTransactionDate: extractedData.lastTransactionDate || null,
            duplicatesRemoved: duplicatesInfo.duplicatesFound,
            duplicateExamples: duplicatesInfo.duplicateExamples,
            accountNumberLast4: accountLast4,
          },
        };

        const insertedDoc = await insertDocument(documentEntry);
        const documentId = insertedDoc.id!;

        if (transactionsToInsert.length > 0) {
          // Canonicalize category strings to match existing budget category names (case/spacing-insensitive).
          const budgetCategories = await getBudgetCategories(userId).catch(() => []);
          const existingBudgetByKey = new Map<string, string>(
            budgetCategories
              .map(c => (typeof c?.name === 'string' ? normalizeCategoryDisplayName(c.name) : null))
              .filter((n): n is string => !!n)
              .map(n => [normalizeCategoryNameKey(n), n] as const)
          );

          const transactions: Transaction[] = transactionsToInsert.map((txn: any, idx: number) => ({
            user_id: userId,
            document_id: documentId,
            account_id: resolvedAccountId,  // Link transaction to account
            account_name: accountName,
            date: txn.date,
            merchant: txn.merchant,
            amount: txn.amount,
            category:
              typeof txn.category === 'string' && txn.category.trim()
                ? existingBudgetByKey.get(normalizeCategoryNameKey(txn.category)) ?? normalizeCategoryDisplayName(txn.category)
                : null,
            description: txn.description || null,
            transaction_type: txn.transactionType || null,
            spend_classification: txn.spendClassification || null,
            needs_clarification: txn.clarificationNeeded || false,
            clarification_question: txn.clarificationQuestion || null,
            suggested_actions: txn.suggestedActions || null,
            currency: extractedData.currency || 'USD',
            metadata: {},
            // Pending transaction tracking
            is_pending: txn.isPending === true,
            reconciled_from_id: pendingReconciliationInfo.reconciledFromIds.get(idx) || null,
          }));

          const insertedTransactions = await insertTransactions(transactions);

          // Fixed expense detection (NEW): category-based + LLM transaction-level tagging
          // Old cadence-based fixed-expense logic is intentionally disabled.
          sendUpdate('fixed-expenses', '📌 Detecting fixed expenses...', 'processing');
          try {
            const detected = await applyFixedExpenseDetectionToTransactions(userId, insertedTransactions as any);
            await persistFixedExpenseFlags(userId, detected as any);
            sendUpdate('fixed-expenses', '📌 Fixed expenses detected', 'complete');
          } catch (e: any) {
            sendUpdate('fixed-expenses', `⚠️ Fixed expense detection skipped: ${e?.message || 'unknown error'}`, 'complete');
          }
          
          // Sync new categories to budget
          const newCategories = extractedData.transactions
            .map((t: any) => t.category)
            .filter((c: any): c is string => !!c);
          await syncTransactionCategoriesToBudget(userId, newCategories);
          
          // Count transactions needing clarification
          const unclarifiedCount = transactions.filter(t => t.needs_clarification).length;
          if (unclarifiedCount > 0) {
            sendUpdate('clarification', `⚠️ ${unclarifiedCount} transaction${unclarifiedCount !== 1 ? 's need' : ' needs'} clarification`, 'complete');
          }
        }

        const metadataSummary = extractedData.metadataSummary || 'No metadata summary provided.';
        const metadataEntry = `\n\n---\n**Document:** ${file.name} (uploaded ${new Date().toISOString()})\n\n${metadataSummary}\n`;

        await appendMetadata(userId, metadataEntry);
        
        // Pattern monitoring: Detect changes in regular patterns and update memories
        try {
          await monitorPatternChanges(userId, transactionsToInsert, extractedData);
        } catch (error: any) {
          console.error('[process-statement] Error monitoring patterns:', error.message);
        }
        
        // Calculate and save monthly snapshots if we have balance information
        if (accountName && 
            extractedData.previousBalance !== undefined && 
            extractedData.newBalance !== undefined && 
            extractedData.firstTransactionDate && 
            extractedData.lastTransactionDate &&
            transactionsToInsert.length > 0) {
          
          sendUpdate('snapshots', '📊 Calculating monthly balance snapshots...', 'processing');
          
          const snapshots = calculateMonthlySnapshots(
            userId,
            accountName,
            documentId,
            extractedData.previousBalance,
            extractedData.newBalance,
            extractedData.firstTransactionDate,
            extractedData.lastTransactionDate,
            transactionsToInsert.map((txn: any) => ({
              date: txn.date,
              amount: txn.amount,
            })),
            extractedData.currency || 'USD'
          );
          
          if (snapshots.length > 0) {
            await insertAccountSnapshots(snapshots);
            sendUpdate('snapshots', `📊 Saved ${snapshots.length} monthly snapshot${snapshots.length !== 1 ? 's' : ''}`, 'complete');
          }
        }
        
        sendUpdate('saving', '💾 Saved to database successfully', 'complete');
        
        // If screenshot needs account selection, notify user
        if (needsAccountSelection) {
          sendUpdate('account-required', `📷 Account selection required - please specify which account these transactions belong to`, 'complete');
        }
        
        sendUpdate('complete', '🎉 Processing complete!', 'complete');

        // Get unclarified transactions for this document
        const unclarifiedTransactions = await getUnclarifiedTransactions(userId, documentId);

        // Send final result
        const result = {
          id: documentId,
          fileName: file.name,
          extractedAt: new Date().toISOString(),
          documentType: extractedData.documentType,
          sourceType: sourceType,
          transactionCount: transactionsToInsert.length,
          duplicatesRemoved: duplicatesInfo.duplicatesFound,
          totalTransactionsInDocument: (extractedData.transactions || []).length,
          // Screenshot-specific fields
          pendingAccountSelection: needsAccountSelection,
          batchId: batchId,
          accountNumberLast4: accountLast4,
          // Account matching for statements
          accountMatchInfo: accountMatchInfo.needsConfirmation ? {
            needsConfirmation: true,
            matchedAccount: accountMatchInfo.matchedAccount ? {
              id: accountMatchInfo.matchedAccount.id,
              displayName: accountMatchInfo.matchedAccount.display_name,
              last4: accountMatchInfo.matchedAccount.account_number_last4,
            } : undefined,
            officialName: accountMatchInfo.officialName,
            last4: accountMatchInfo.last4,
            existingAccounts: accountMatchInfo.allAccounts?.map(a => ({
              id: a.id,
              displayName: a.display_name,
              last4: a.account_number_last4,
            })),
          } : null,
          // Date range for gap detection
          firstTransactionDate: extractedData.firstTransactionDate || null,
          lastTransactionDate: extractedData.lastTransactionDate || null,
          unclarifiedTransactions: unclarifiedTransactions.map(t => ({
            id: t.id,
            date: t.date,
            merchant: t.merchant,
            amount: t.amount,
            clarificationQuestion: t.clarification_question,
          })),
          done: true,
        };

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(result)}\n\n`));
        controller.close();

      } catch (error: any) {
        console.error('Error processing statement:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message || 'Failed to process statement' })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

