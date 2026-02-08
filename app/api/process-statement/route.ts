import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { insertDocument, insertTransactions, appendMetadata } from '@/lib/db-tools';
import { uploadFile } from '@/lib/supabase';
import { applyFixedExpenseDetectionToTransactions, persistFixedExpenseFlags } from '@/lib/fixed-expense-detector';
import { createLLMSession, logLLMCall } from '@/lib/llm-logger';

export const runtime = 'nodejs';

const GEMINI_MODEL = 'gemini-3-flash-preview';

const SYSTEM_PROMPT = `You are a financial document parser. Extract structured information from bank statements and credit card statements.

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
      "category": string or null,
      "description": string or null,
      "isPending": boolean
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

**CRITICAL - Pending vs Posted/Authorized Transaction Detection:**
Credit cards show transactions in different states. You MUST detect and mark pending transactions:
- **Pending transactions**: Recent transactions that haven't fully cleared yet. Look for:
  - Labels: "PENDING", "POSTED", "PROCESSING", "HOLD", "AUTHORIZATION"
  - Separate sections: "Recent Activity", "Pending Transactions", "Authorizations"
- **Authorized/Settled transactions**: Final, cleared transactions in the main transaction history or statement

**Rules for isPending field:**
1. **Set isPending = true** for any transaction that shows pending/processing indicators
2. **Set isPending = false** for authorized/settled/cleared transactions
3. **Include ALL transactions** - both pending AND authorized. The app will handle reconciliation automatically.
4. **When in doubt, set isPending = false** - it's safer to treat ambiguous transactions as authorized

Extract all transactions visible in the document. Categorize them logically (Food, Travel, Utilities, Entertainment, Shopping, etc.).
For amounts, use positive numbers for charges/debits and negative numbers for payments/credits.
Always return valid JSON.`;

const DEDUPLICATION_PROMPT = `You are a transaction deduplication expert. You will be given two lists:
1. **Newly parsed transactions** from an uploaded document
2. **Existing transactions** already in the database

Your task: Return ONLY the transactions from the newly parsed list that are NOT duplicates of existing transactions.

**Duplicate Detection Rules:**
- A transaction is a duplicate if it has the SAME date, merchant, and amount as an existing transaction
- Minor variations in merchant names should be considered (e.g., "STARBUCKS #1234" vs "Starbucks" are the same)
- Amounts must match exactly (including sign)
- Dates must match exactly

Return a JSON object:
{
  "uniqueTransactions": [
    {
      "date": "YYYY-MM-DD",
      "merchant": string,
      "amount": number,
      "category": string or null,
      "description": string or null
    }
  ],
  "duplicatesFound": number,
  "duplicateExamples": [
    "Brief description of why transaction was marked as duplicate"
  ]
}

Be conservative: if unsure whether something is a duplicate, include it in uniqueTransactions.`;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured. Please set GEMINI_API_KEY in your environment variables.' },
        { status: 500 }
      );
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
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Processing steps to track
    const processingSteps: Array<{ step: string; status: 'processing' | 'complete'; message: string; timestamp: number }> = [];
    
    const addStep = (step: string, message: string, status: 'processing' | 'complete' = 'processing') => {
      processingSteps.push({ step, status, message, timestamp: Date.now() });
      console.log(`[${status.toUpperCase()}] ${message}`);
    };

    addStep('upload', `📄 Processing ${file.name}...`, 'complete');

    // Get file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a PDF or an image.' },
        { status: 400 }
      );
    }

    addStep('storage', '☁️ Uploading to secure storage...', 'processing');
    
    // Upload file to Supabase Storage
    const fileUrl = await uploadFile(userId, buffer, file.name);
    
    processingSteps[processingSteps.length - 1].status = 'complete';
    addStep('analysis', '🤖 Analyzing document with AI...', 'processing');

    // Send file directly to Gemini
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
    
    // Log the LLM call
    logLLMCall({
      sessionId,
      userId,
      flowName: 'statement_parsing',
      model: GEMINI_MODEL,
      systemPrompt: SYSTEM_PROMPT.substring(0, 3000),
      userMessage: 'Extract all information from this financial document',
      llmResult: content.substring(0, 2000),
      hasAttachments: true,
      attachmentType: isPdf ? 'pdf' : 'image',
      durationMs: llmDuration,
    });
    if (!content) {
      throw new Error('No response from Gemini');
    }

    let extractedData;
    try {
      extractedData = JSON.parse(content);
    } catch (parseError) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse JSON response from Gemini');
      }
    }

    processingSteps[processingSteps.length - 1].status = 'complete';

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

    addStep('detection', `📋 Detected ${docType}${issuerText}${accountText}${dateText}`, 'complete');

    // Duplicate detection: Check for existing transactions in the date range
    let transactionsToInsert = extractedData.transactions || [];
    let duplicatesInfo = { duplicatesFound: 0, duplicateExamples: [] as string[] };

    console.log('\n=== DUPLICATE DETECTION & PENDING RECONCILIATION START ===');
    console.log(`Extracted transactions: ${transactionsToInsert.length}`);
    console.log(`First transaction date: ${extractedData.firstTransactionDate}`);
    console.log(`Last transaction date: ${extractedData.lastTransactionDate}`);
    console.log(`Account name: ${extractedData.accountName}`);

    let pendingReconciliationInfo = { pendingReconciled: 0, pendingIdsToDelete: [] as string[], reconciledFromIds: new Map<number, string>() };

    if (transactionsToInsert.length > 0) {
      addStep('extraction', `💳 Found ${transactionsToInsert.length} transaction${transactionsToInsert.length !== 1 ? 's' : ''} in the document`, 'complete');
    }

    if (transactionsToInsert.length > 0 && extractedData.firstTransactionDate && extractedData.lastTransactionDate) {
      addStep('duplicate-check', '🔍 Checking for duplicates and pending transactions...', 'processing');
      
      // Fetch existing transactions in the same date range for this account
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

      // Also fetch pending transactions specifically
      let pendingTransactions: Array<any> = [];
      try {
        pendingTransactions = await getPendingTransactions(
          userId,
          null, // account_id not available in this route
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        );
      } catch (e) {
        console.log('[process-statement] getPendingTransactions failed, column may not be migrated:', e);
      }

      console.log(`Found ${existingTransactions.length} existing transactions in database`);
      console.log(`Found ${pendingTransactions.length} pending transactions`);

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

      // If there are existing transactions, use reconciliation logic
      if (allExisting.length > 0) {
        console.log('Running pending reconciliation...');

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

        console.log(`Reconciliation complete:`);
        console.log(`  - ${duplicatesInfo.duplicatesFound} duplicates skipped`);
        console.log(`  - ${pendingReconciliationInfo.pendingReconciled} pending transactions reconciled`);
        console.log(`  - ${transactionsToInsert.length} transactions to save`);
        
        processingSteps[processingSteps.length - 1].status = 'complete';
        
        // Generate status message
        const parts: string[] = [];
        if (pendingReconciliationInfo.pendingReconciled > 0) {
          parts.push(`🔄 Reconciled ${pendingReconciliationInfo.pendingReconciled} pending`);
        }
        if (duplicatesInfo.duplicatesFound > 0) {
          parts.push(`✨ Skipped ${duplicatesInfo.duplicatesFound} duplicate${duplicatesInfo.duplicatesFound !== 1 ? 's' : ''}`);
        }
        if (transactionsToInsert.length > 0) {
          parts.push(`✅ Adding ${transactionsToInsert.length} transaction${transactionsToInsert.length !== 1 ? 's' : ''}`);
        }
        addStep('deduplication', parts.join(' | ') || '✅ Processing complete', 'complete');
      } else {
        console.log('No existing transactions found, skipping deduplication');
        processingSteps[processingSteps.length - 1].status = 'complete';
        addStep('deduplication', `✅ No existing transactions found - all ${transactionsToInsert.length} transaction${transactionsToInsert.length !== 1 ? 's are' : ' is'} new`, 'complete');
      }
    } else {
      if (transactionsToInsert.length === 0) {
        console.log('⚠️  No transactions to insert');
        addStep('extraction', '⚠️ No transactions found in the document', 'complete');
      }
      if (!extractedData.firstTransactionDate || !extractedData.lastTransactionDate) {
        console.log('⚠️  Missing date range - firstTransactionDate or lastTransactionDate not extracted');
        console.log('   Deduplication will be skipped!');
      }
    }

    console.log('=== DUPLICATE DETECTION & PENDING RECONCILIATION END ===\n');

    // Save to Supabase
    addStep('saving', '💾 Saving to database...', 'processing');
    
    // Insert document
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

    // Insert only unique transactions (include account_name for easy querying)
    if (transactionsToInsert.length > 0) {
      const transactions = transactionsToInsert.map((txn: any, idx: number) => ({
        user_id: userId,
        document_id: documentId,
        account_name: accountName,
        date: txn.date,
        merchant: txn.merchant,
        amount: txn.amount,
        category: txn.category || null,
        description: txn.description || null,
        // IMPORTANT: older versions of this route forgot to persist these fields,
        // which made expenses "invisible" to the UI (charts/budget filter by transaction_type).
        transaction_type: txn.transactionType || null,
        spend_classification: txn.spendClassification || null,
        needs_clarification: txn.clarificationNeeded || false,
        clarification_question: txn.clarificationQuestion || null,
        suggested_actions: txn.suggestedActions || null,
        metadata: {},
        // Pending transaction tracking
        is_pending: txn.isPending === true,
        reconciled_from_id: pendingReconciliationInfo.reconciledFromIds.get(idx) || null,
      }));

      const insertedTransactions = await insertTransactions(transactions);

      // Fixed expense detection (NEW): category-based + LLM transaction-level tagging
      // Old cadence-based fixed-expense logic is intentionally disabled.
      addStep('fixed-expenses', '📌 Detecting fixed expenses...', 'processing');
      try {
        const detected = await applyFixedExpenseDetectionToTransactions(userId, insertedTransactions as any);
        await persistFixedExpenseFlags(userId, detected as any);
        processingSteps[processingSteps.length - 1].status = 'complete';
        addStep('fixed-expenses', '📌 Fixed expenses detected', 'complete');
      } catch (e: any) {
        processingSteps[processingSteps.length - 1].status = 'complete';
        addStep('fixed-expenses', `⚠️ Fixed expense detection skipped: ${e?.message || 'unknown error'}`, 'complete');
      }
    }

    // Append metadata summary
    const metadataSummary = extractedData.metadataSummary || 'No metadata summary provided.';
    const metadataEntry = `\n\n---\n**Document:** ${file.name} (uploaded ${new Date().toISOString()})\n\n${metadataSummary}\n`;

    await appendMetadata(userId, metadataEntry);
    
    processingSteps[processingSteps.length - 1].status = 'complete';
    addStep('complete', '🎉 Processing complete!', 'complete');

    const result = {
      id: documentId,
      fileName: file.name,
      extractedAt: new Date().toISOString(),
      documentType: extractedData.documentType,
      transactionCount: transactionsToInsert.length,
      totalTransactionsParsed: extractedData.transactions?.length || 0,
      duplicatesRemoved: duplicatesInfo.duplicatesFound,
      duplicateExamples: duplicatesInfo.duplicateExamples.slice(0, 3), // Show first 3 examples
      processingSteps,
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error processing statement:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process statement' },
      { status: 500 }
    );
  }
}


