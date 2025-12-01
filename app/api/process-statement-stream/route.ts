import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { insertDocument, insertTransactions, appendMetadata, insertAccountSnapshots, getUnclarifiedTransactions, findMatchingTransfer } from '@/lib/db-tools';
import { uploadFile, Transaction } from '@/lib/supabase';
import { calculateMonthlySnapshots } from '@/lib/snapshot-calculator';
import { generateSuggestedActions } from '@/lib/action-generator';

export const runtime = 'nodejs';

const GEMINI_MODEL = 'gemini-3-pro-preview';

const SYSTEM_PROMPT = `You are a financial document parser. Extract structured information from bank statements and credit card statements.

**CRITICAL**: Return ONLY valid JSON. Do NOT wrap your response in markdown code blocks. Do NOT include any text before or after the JSON object.

Return a JSON object with this exact structure:
{
  "documentType": "bank_statement" | "credit_card_statement" | "unknown",
  "issuer": string or null,
  "accountId": string or null,
  "accountName": string or null,
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
      "description": string or null,
      "confidence": number (0.0 to 1.0),
      "clarificationNeeded": boolean,
      "clarificationQuestion": string or null
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

**Important Instructions:**
1. **accountId**: Extract the full account number or last 4 digits (e.g., "1234" or "****1234")
2. **accountName**: Extract the account nickname or card name if visible (e.g., "Chase Freedom", "Checking Account", "Visa Signature", "Platinum Card"). This helps identify the account across multiple statements.
3. **issuer**: The bank or financial institution name (e.g., "Chase", "Bank of America", "American Express")
4. **firstTransactionDate**: The date of the EARLIEST transaction in the document
5. **lastTransactionDate**: The date of the LATEST transaction in the document

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

Extract all transactions visible in the document. Categorize them logically (Food, Travel, Utilities, Entertainment, Shopping, etc.).
For amounts, use positive numbers for credits/deposits and negative numbers for debits/charges.
Always return valid JSON.`;

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

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          systemInstruction: SYSTEM_PROMPT,
          generationConfig: {
            responseMimeType: 'application/json',
          },
        });

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const userId = (formData.get('userId') as string) || 'default-user';

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

        const content = geminiResponse.response.text();
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

        // Duplicate detection
        let transactionsToInsert = extractedData.transactions || [];
        let duplicatesInfo = { duplicatesFound: 0, duplicateExamples: [] as string[] };

        if (transactionsToInsert.length > 0) {
          sendUpdate('extraction', `💳 Found ${transactionsToInsert.length} transaction${transactionsToInsert.length !== 1 ? 's' : ''} in the document`, 'complete');
        }

        if (transactionsToInsert.length > 0 && extractedData.firstTransactionDate && extractedData.lastTransactionDate) {
          sendUpdate('duplicate-check', '🔍 Checking for duplicate transactions...', 'processing');
          
          const { searchTransactions } = await import('@/lib/db-tools');
          
          const existingTransactions = await searchTransactions(userId, {
            accountName: extractedData.accountName || undefined,
            startDate: extractedData.firstTransactionDate,
            endDate: extractedData.lastTransactionDate,
          });

          if (existingTransactions.length > 0) {
            const { deduplicateTransactionsSimple } = await import('@/lib/deduplication-test');
            
            const deduplicationResult = deduplicateTransactionsSimple(
              transactionsToInsert,
              existingTransactions.map(t => ({
                date: t.date instanceof Date ? t.date.toISOString().split('T')[0] : t.date,
                merchant: t.merchant,
                amount: Number(t.amount),
                category: t.category,
                description: t.description,
              }))
            );

            transactionsToInsert = deduplicationResult.uniqueTransactions;
            duplicatesInfo = {
              duplicatesFound: deduplicationResult.duplicatesFound,
              duplicateExamples: deduplicationResult.duplicateExamples,
            };

            if (duplicatesInfo.duplicatesFound > 0) {
              sendUpdate('deduplication', `✨ Removed ${duplicatesInfo.duplicatesFound} duplicate transaction${duplicatesInfo.duplicatesFound !== 1 ? 's' : ''} - keeping only ${transactionsToInsert.length} unique transaction${transactionsToInsert.length !== 1 ? 's' : ''}`, 'complete');
            } else {
              sendUpdate('deduplication', `✅ No duplicates found - all ${transactionsToInsert.length} transaction${transactionsToInsert.length !== 1 ? 's are' : ' is'} new`, 'complete');
            }
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

        // Save to Supabase
        const accountName = extractedData.accountName || null;
        
        const documentEntry = {
          user_id: userId,
          file_name: file.name,
          file_url: fileUrl,
          uploaded_at: new Date().toISOString(),
          document_type: extractedData.documentType || 'unknown',
          issuer: extractedData.issuer || null,
          account_id: extractedData.accountId || null,
          account_name: accountName,
          statement_date: extractedData.statementDate || null,
          previous_balance: extractedData.previousBalance || null,
          new_balance: extractedData.newBalance || null,
          credit_limit: extractedData.creditLimit || null,
          minimum_payment: extractedData.minimumPayment || null,
          due_date: extractedData.dueDate || null,
          metadata: {
            firstTransactionDate: extractedData.firstTransactionDate || null,
            lastTransactionDate: extractedData.lastTransactionDate || null,
            duplicatesRemoved: duplicatesInfo.duplicatesFound,
            duplicateExamples: duplicatesInfo.duplicateExamples,
          },
        };

        const insertedDoc = await insertDocument(documentEntry);
        const documentId = insertedDoc.id!;

        if (transactionsToInsert.length > 0) {
          const transactions: Transaction[] = transactionsToInsert.map((txn: any) => ({
            user_id: userId,
            document_id: documentId,
            account_name: accountName,
            date: txn.date,
            merchant: txn.merchant,
            amount: txn.amount,
            category: txn.category || null,
            description: txn.description || null,
            transaction_type: txn.transactionType || null,
            needs_clarification: txn.clarificationNeeded || false,
            clarification_question: txn.clarificationQuestion || null,
            suggested_actions: txn.suggestedActions || null,
            metadata: {},
          }));

          await insertTransactions(transactions);
          
          // Count transactions needing clarification
          const unclarifiedCount = transactions.filter(t => t.needs_clarification).length;
          if (unclarifiedCount > 0) {
            sendUpdate('clarification', `⚠️ ${unclarifiedCount} transaction${unclarifiedCount !== 1 ? 's need' : ' needs'} clarification`, 'complete');
          }
        }

        const metadataSummary = extractedData.metadataSummary || 'No metadata summary provided.';
        const metadataEntry = `\n\n---\n**Document:** ${file.name} (uploaded ${new Date().toISOString()})\n\n${metadataSummary}\n`;

        await appendMetadata(userId, metadataEntry);
        
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
            }))
          );
          
          if (snapshots.length > 0) {
            await insertAccountSnapshots(snapshots);
            sendUpdate('snapshots', `📊 Saved ${snapshots.length} monthly snapshot${snapshots.length !== 1 ? 's' : ''}`, 'complete');
          }
        }
        
        sendUpdate('saving', '💾 Saved to database successfully', 'complete');
        sendUpdate('complete', '🎉 Processing complete!', 'complete');

        // Get unclarified transactions for this document
        const unclarifiedTransactions = await getUnclarifiedTransactions(userId, documentId);

        // Send final result
        const result = {
          id: documentId,
          fileName: file.name,
          extractedAt: new Date().toISOString(),
          documentType: extractedData.documentType,
          transactionCount: transactionsToInsert.length,
          duplicatesRemoved: duplicatesInfo.duplicatesFound,
          totalTransactionsInDocument: (extractedData.transactions || []).length,
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

