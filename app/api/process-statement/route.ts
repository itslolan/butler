import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { insertDocument, insertTransactions, appendMetadata } from '@/lib/db-tools';
import { uploadFile } from '@/lib/supabase';

export const runtime = 'nodejs';

const GEMINI_MODEL = 'gemini-2.0-flash-exp';

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
      "description": string or null
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

    // Upload file to Supabase Storage
    const fileUrl = await uploadFile(userId, buffer, file.name);

    // Send file directly to Gemini
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
      extractedData = JSON.parse(content);
    } catch (parseError) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse JSON response from Gemini');
      }
    }

    // Duplicate detection: Check for existing transactions in the date range
    let transactionsToInsert = extractedData.transactions || [];
    let duplicatesInfo = { duplicatesFound: 0, duplicateExamples: [] };

    if (transactionsToInsert.length > 0 && extractedData.firstTransactionDate && extractedData.lastTransactionDate) {
      // Fetch existing transactions in the same date range for this account
      const { searchTransactions } = await import('@/lib/db-tools');
      
      const existingTransactions = await searchTransactions(userId, {
        accountName: extractedData.accountName || undefined,
        startDate: extractedData.firstTransactionDate,
        endDate: extractedData.lastTransactionDate,
      });

      // If there are existing transactions, use Gemini to deduplicate
      if (existingTransactions.length > 0) {
        console.log(`Found ${existingTransactions.length} existing transactions in date range. Running deduplication...`);

        const deduplicationResponse = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `${DEDUPLICATION_PROMPT}

**Newly Parsed Transactions:**
${JSON.stringify(transactionsToInsert, null, 2)}

**Existing Transactions in Database:**
${JSON.stringify(existingTransactions.map(t => ({
  date: t.date,
  merchant: t.merchant,
  amount: t.amount,
  category: t.category,
  description: t.description
})), null, 2)}

Return only the unique transactions from the newly parsed list.`,
                },
              ],
            },
          ],
        });

        const deduplicationContent = deduplicationResponse.response.text();
        
        try {
          const deduplicationResult = JSON.parse(deduplicationContent);
          transactionsToInsert = deduplicationResult.uniqueTransactions || [];
          duplicatesInfo = {
            duplicatesFound: deduplicationResult.duplicatesFound || 0,
            duplicateExamples: deduplicationResult.duplicateExamples || [],
          };
          
          console.log(`Deduplication complete: ${duplicatesInfo.duplicatesFound} duplicates removed, ${transactionsToInsert.length} unique transactions remaining.`);
        } catch (parseError) {
          console.error('Failed to parse deduplication response, using all transactions:', parseError);
          // If deduplication fails, proceed with all transactions (safer than losing data)
        }
      }
    }

    // Save to Supabase
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
      const transactions = transactionsToInsert.map((txn: any) => ({
        user_id: userId,
        document_id: documentId,
        account_name: accountName,
        date: txn.date,
        merchant: txn.merchant,
        amount: txn.amount,
        category: txn.category || null,
        description: txn.description || null,
        metadata: {},
      }));

      await insertTransactions(transactions);
    }

    // Append metadata summary
    const metadataSummary = extractedData.metadataSummary || 'No metadata summary provided.';
    const metadataEntry = `\n\n---\n**Document:** ${file.name} (uploaded ${new Date().toISOString()})\n\n${metadataSummary}\n`;

    await appendMetadata(userId, metadataEntry);

    const result = {
      id: documentId,
      fileName: file.name,
      extractedAt: new Date().toISOString(),
      documentType: extractedData.documentType,
      transactionCount: transactionsToInsert.length,
      totalTransactionsParsed: extractedData.transactions?.length || 0,
      duplicatesRemoved: duplicatesInfo.duplicatesFound,
      duplicateExamples: duplicatesInfo.duplicateExamples.slice(0, 3), // Show first 3 examples
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


