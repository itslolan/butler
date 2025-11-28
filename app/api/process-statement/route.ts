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
  "statementDate": "YYYY-MM-DD" or null,
  "previousBalance": number or null,
  "newBalance": number or null,
  "creditLimit": number or null,
  "minimumPayment": number or null,
  "dueDate": "YYYY-MM-DD" or null,
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

Extract all transactions visible in the document. Categorize them logically (Food, Travel, Utilities, Entertainment, Shopping, etc.).
For amounts, use positive numbers for charges/debits and negative numbers for payments/credits.
Always return valid JSON.`;

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

    // Save to Supabase
    // Insert document
    const documentEntry = {
      user_id: userId,
      file_name: file.name,
      file_url: fileUrl,
      uploaded_at: new Date().toISOString(),
      document_type: extractedData.documentType || 'unknown',
      issuer: extractedData.issuer || null,
      account_id: extractedData.accountId || null,
      statement_date: extractedData.statementDate || null,
      previous_balance: extractedData.previousBalance || null,
      new_balance: extractedData.newBalance || null,
      credit_limit: extractedData.creditLimit || null,
      minimum_payment: extractedData.minimumPayment || null,
      due_date: extractedData.dueDate || null,
      metadata: {},
    };

    const insertedDoc = await insertDocument(documentEntry);
    const documentId = insertedDoc.id!;

    // Insert transactions
    if (extractedData.transactions && Array.isArray(extractedData.transactions)) {
      const transactions = extractedData.transactions.map((txn: any) => ({
        user_id: userId,
        document_id: documentId,
        date: txn.date,
        merchant: txn.merchant,
        amount: txn.amount,
        category: txn.category || null,
        description: txn.description || null,
        metadata: {},
      }));

      if (transactions.length > 0) {
        await insertTransactions(transactions);
      }
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
      transactionCount: extractedData.transactions?.length || 0,
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


