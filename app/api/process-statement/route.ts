import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ObjectId } from 'mongodb';

import { getCollection } from '@/lib/mongodb';
import {
  DerivedMetricsRecord,
  DocumentRecord,
  DocumentType,
  LlmExtractionRecord,
  StatementSummaryRecord,
  TransactionRecord,
} from '@/types/database';
import { FinancialData } from '@/types/financial';

type StatementData = FinancialData['data'];

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please set OPENAI_API_KEY in your environment variables.' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const userId = resolveUserId(request, formData);
    const documentType = resolveDocumentType(formData);
    const filePathEntry = formData.get('filePath');
    const filePath = typeof filePathEntry === 'string' ? filePathEntry : undefined;

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');
    const mimeType = file.type || 'image/png';

    // Call GPT-4o to extract financial information
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a financial statement analyzer. Extract financial information from bank and credit card statements. 
          
          Extract the following information and return it as JSON:
          
          1. **Carry-forward balance behavior**: Look for "Previous Balance", "Payments", "New Balance" in the statement summary. Compare balances to detect unpaid carry-over.
          
          2. **Cash advances**: Identify transactions containing "CASH ADVANCE" or "CASH ADVANCE FEE" in the transaction list.
          
          3. **Credit utilization ratio**: Find "Credit Limit" and "New Balance" in the statement header. Calculate utilization as new_balance / credit_limit.
          
          4. **Volatility of spending**: Calculate standard deviation of total monthly spend from all transactions.
          
          5. **Payment regularity**: Find "Payment - Thank You" entries and due dates. Check if minimum payments are made on time each cycle.
          
          6. **Category-level financial behavior**: Categorize merchants (Food, Travel, Utilities, Entertainment, Shopping, etc.) and sum spend by category.
          
          7. **Refunds & reversals**: Flag transactions with "REFUND" or negative amounts.
          
          8. **Subscription creep**: Detect recurring charges from the same merchant with similar amounts across statements.
          
          Return a JSON object with this structure:
          {
            "carryForwardBalance": {
              "previousBalance": number,
              "payments": number,
              "newBalance": number,
              "hasCarryOver": boolean
            },
            "cashAdvances": {
              "transactions": [{"date": "string", "description": "string", "amount": number, "fee": number}],
              "totalAmount": number,
              "totalFees": number
            },
            "creditUtilization": {
              "creditLimit": number,
              "newBalance": number,
              "utilizationRatio": number,
              "percentage": number
            },
            "spendingVolatility": {
              "monthlySpends": [number],
              "standardDeviation": number,
              "averageSpend": number
            },
            "paymentRegularity": {
              "payments": [{"date": "string", "amount": number, "dueDate": "string", "onTime": boolean}],
              "onTimePercentage": number
            },
            "categorySpending": {
              "categories": {"category": amount},
              "total": number
            },
            "refunds": {
              "transactions": [{"date": "string", "description": "string", "amount": number}],
              "totalAmount": number
            },
            "subscriptions": {
              "recurringCharges": [{"merchant": "string", "amount": number, "frequency": "string", "occurrences": number}]
            }
          }
          
          If information is not available, use null or empty arrays/objects. Always return valid JSON.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    let extractedData: StatementData | undefined;
    try {
      extractedData = JSON.parse(content);
    } catch (parseError) {
      // If JSON parsing fails, try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse JSON response');
      }
    }

    const statementData: StatementData = extractedData ?? {};

    // Calculate standard deviation if not provided
    if (statementData.spendingVolatility?.monthlySpends && Array.isArray(statementData.spendingVolatility.monthlySpends)) {
      const spends = statementData.spendingVolatility.monthlySpends.filter((s: any) => typeof s === 'number');
      if (spends.length > 0 && !statementData.spendingVolatility.standardDeviation) {
        const avg = spends.reduce((a: number, b: number) => a + b, 0) / spends.length;
        const variance = spends.reduce((sum: number, val: number) => sum + Math.pow(val - avg, 2), 0) / spends.length;
        statementData.spendingVolatility.standardDeviation = Math.sqrt(variance);
        statementData.spendingVolatility.averageSpend = avg;
      }
    }

    // Calculate credit utilization percentage if not provided
    if (statementData.creditUtilization?.utilizationRatio != null && statementData.creditUtilization.percentage == null) {
      statementData.creditUtilization.percentage = Number(statementData.creditUtilization.utilizationRatio) * 100;
    }

    // Calculate payment regularity percentage if not provided
    if (
      statementData.paymentRegularity?.payments &&
      Array.isArray(statementData.paymentRegularity.payments) &&
      statementData.paymentRegularity.onTimePercentage === undefined
    ) {
      const payments = statementData.paymentRegularity.payments;
      const onTimeCount = payments.filter((p: any) => p?.onTime === true).length;
      statementData.paymentRegularity.onTimePercentage = payments.length > 0 ? (onTimeCount / payments.length) * 100 : 0;
    }

    // Calculate category total if not provided
    if (
      statementData.categorySpending?.categories &&
      typeof statementData.categorySpending.categories === 'object' &&
      statementData.categorySpending.total === undefined
    ) {
      statementData.categorySpending.total = Object.values(statementData.categorySpending.categories).reduce(
        (sum: number, val: any) => sum + (typeof val === 'number' ? val : 0),
        0
      );
    }

    // Ensure arrays exist for safety
    if (statementData.cashAdvances && !Array.isArray(statementData.cashAdvances.transactions)) {
      statementData.cashAdvances.transactions = [];
    }
    if (statementData.refunds && !Array.isArray(statementData.refunds.transactions)) {
      statementData.refunds.transactions = [];
    }
    if (statementData.subscriptions && !Array.isArray(statementData.subscriptions.recurringCharges)) {
      statementData.subscriptions.recurringCharges = [];
    }
    if (statementData.paymentRegularity && !Array.isArray(statementData.paymentRegularity.payments)) {
      statementData.paymentRegularity.payments = [];
    }

    const extractedAt = new Date();
    const result: FinancialData & { documentId?: string } = {
      id: `stmt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      fileName: file.name,
      extractedAt: extractedAt.toISOString(),
      data: statementData,
    };

    try {
      const documentId = await persistExtraction({
        userId,
        documentType,
        fileName: file.name,
        filePath,
        mimeType: file.type,
        fileSize: file.size,
        extractedData: statementData,
        rawModelResponse: content,
        extractedAt,
      });

      if (documentId) {
        result.documentId = documentId.toHexString();
      }
    } catch (storageError) {
      console.error('Error persisting extraction results:', storageError);
      return NextResponse.json(
        { error: storageError instanceof Error ? storageError.message : 'Failed to persist extraction results' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error processing statement:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process statement' },
      { status: 500 }
    );
  }
}

function resolveUserId(request: NextRequest, formData: FormData): string | undefined {
  const userIdFromForm = formData.get('userId');
  const userIdFromHeader = request.headers.get('x-user-id');
  const candidate = typeof userIdFromForm === 'string' ? userIdFromForm : userIdFromHeader;
  return candidate || undefined;
}

function resolveDocumentType(formData: FormData): DocumentType | undefined {
  const typeFromForm = formData.get('documentType');
  return typeof typeFromForm === 'string' ? (typeFromForm as DocumentType) : undefined;
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function toDate(value: unknown): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function filterUndefined(obj: Record<string, unknown>): Record<string, unknown> | undefined {
  const entries = Object.entries(obj).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return undefined;
  }
  return Object.fromEntries(entries);
}

function hasTransactions(data?: StatementData): boolean {
  if (!data) {
    return false;
  }

  if (Array.isArray(data.cashAdvances?.transactions) && data.cashAdvances.transactions.length > 0) {
    return true;
  }
  if (Array.isArray(data.refunds?.transactions) && data.refunds.transactions.length > 0) {
    return true;
  }
  if (Array.isArray(data.paymentRegularity?.payments) && data.paymentRegularity.payments.length > 0) {
    return true;
  }

  return false;
}

async function persistExtraction({
  userId,
  documentType,
  fileName,
  filePath,
  mimeType,
  fileSize,
  extractedData,
  rawModelResponse,
  extractedAt,
}: {
  userId?: string;
  documentType?: DocumentType;
  fileName: string;
  filePath?: string;
  mimeType?: string;
  fileSize?: number;
  extractedData: StatementData;
  rawModelResponse: unknown;
  extractedAt: Date;
}): Promise<ObjectId | undefined> {
  const now = new Date();
  const documentsCollection = await getCollection<DocumentRecord>('documents');

  const documentRecord: DocumentRecord = {
    user_id: userId,
    document_type: documentType,
    file_name: fileName,
    file_path: filePath,
    upload_date: extractedAt,
    metadata: filterUndefined({
      mimeType,
      size: fileSize,
    }),
    extraction_status: {
      summary_extracted: Boolean(extractedData),
      transactions_extracted: hasTransactions(extractedData),
      last_extracted_at: extractedAt,
    },
    created_at: now,
    updated_at: now,
  };

  const documentInsert = await documentsCollection.insertOne(documentRecord);
  const documentId = documentInsert.insertedId;

  await Promise.all([
    persistStatementSummary({
      userId,
      documentId,
      extractedData,
      extractedAt,
      now,
    }),
    persistTransactions({
      userId,
      documentId,
      extractedData,
      now,
    }),
    persistLlmExtraction({
      userId,
      documentId,
      rawModelResponse,
      normalizedOutput: extractedData,
      extractedAt,
      now,
    }),
    persistDerivedMetrics({
      userId,
      documentId,
      extractedData,
      extractedAt,
      now,
    }),
  ]);

  return documentId;
}

async function persistStatementSummary({
  userId,
  documentId,
  extractedData,
  extractedAt,
  now,
}: {
  userId?: string;
  documentId: ObjectId;
  extractedData: StatementData;
  extractedAt: Date;
  now: Date;
}) {
  const summaryMetadata = filterUndefined({
    onTimePercentage: toNumber(extractedData.paymentRegularity?.onTimePercentage),
    paymentsTracked: extractedData.paymentRegularity?.payments?.length,
    averageSpend: toNumber(extractedData.spendingVolatility?.averageSpend),
    monthlySpends: extractedData.spendingVolatility?.monthlySpends,
    categorySpending: extractedData.categorySpending?.categories,
    subscriptions: extractedData.subscriptions?.recurringCharges,
    refundsCount: extractedData.refunds?.transactions?.length,
  });

  const statementSummary: StatementSummaryRecord = {
    user_id: userId,
    document_id: documentId,
    credit_limit: toNumber(extractedData.creditUtilization?.creditLimit),
    previous_balance: toNumber(extractedData.carryForwardBalance?.previousBalance),
    payments_total: toNumber(extractedData.carryForwardBalance?.payments),
    new_balance: toNumber(extractedData.carryForwardBalance?.newBalance),
    cash_advances_total: toNumber(extractedData.cashAdvances?.totalAmount),
    utilization_ratio: toNumber(extractedData.creditUtilization?.utilizationRatio),
    payment_regular:
      typeof extractedData.paymentRegularity?.onTimePercentage === 'number'
        ? extractedData.paymentRegularity.onTimePercentage >= 90
        : undefined,
    metrics_computed_at: extractedAt,
    created_at: now,
    updated_at: now,
    metadata: summaryMetadata,
  };

  const significantFields = [
    statementSummary.credit_limit,
    statementSummary.previous_balance,
    statementSummary.payments_total,
    statementSummary.new_balance,
    statementSummary.cash_advances_total,
    statementSummary.utilization_ratio,
    statementSummary.payment_regular,
  ];

  if (!significantFields.some((value) => value !== undefined) && !statementSummary.metadata) {
    return;
  }

  const statementSummariesCollection = await getCollection<StatementSummaryRecord>('statement_summaries');
  await statementSummariesCollection.insertOne(statementSummary);
}

async function persistTransactions({
  userId,
  documentId,
  extractedData,
  now,
}: {
  userId?: string;
  documentId: ObjectId;
  extractedData: StatementData;
  now: Date;
}) {
  const transactions: TransactionRecord[] = [];

  if (Array.isArray(extractedData.cashAdvances?.transactions)) {
    for (const txn of extractedData.cashAdvances.transactions) {
      const amount = toNumber(txn?.amount);
      if (amount === undefined) {
        continue;
      }
      transactions.push({
        user_id: userId,
        document_id: documentId,
        txn_date: toDate(txn?.date),
        merchant: typeof txn?.description === 'string' ? txn.description : undefined,
        amount,
        type: 'cash_advance',
        is_cash_advance: true,
        metadata: filterUndefined({
          fee: toNumber((txn as any)?.fee),
        }),
        created_at: now,
        updated_at: now,
      });
    }
  }

  if (Array.isArray(extractedData.refunds?.transactions)) {
    for (const txn of extractedData.refunds.transactions) {
      const amount = toNumber(txn?.amount);
      if (amount === undefined) {
        continue;
      }
      transactions.push({
        user_id: userId,
        document_id: documentId,
        txn_date: toDate(txn?.date),
        merchant: typeof txn?.description === 'string' ? txn.description : undefined,
        amount,
        type: 'refund',
        is_refund: true,
        created_at: now,
        updated_at: now,
      });
    }
  }

  if (Array.isArray(extractedData.paymentRegularity?.payments)) {
    for (const txn of extractedData.paymentRegularity.payments) {
      const amount = toNumber(txn?.amount);
      if (amount === undefined) {
        continue;
      }
      transactions.push({
        user_id: userId,
        document_id: documentId,
        txn_date: toDate(txn?.date),
        posting_date: toDate(txn?.dueDate),
        merchant: undefined,
        amount,
        type: 'payment',
        is_payment: true,
        metadata: filterUndefined({
          dueDate: txn?.dueDate,
          onTime: txn?.onTime,
        }),
        created_at: now,
        updated_at: now,
      });
    }
  }

  if (transactions.length === 0) {
    return;
  }

  const transactionsCollection = await getCollection<TransactionRecord>('transactions');
  await transactionsCollection.insertMany(transactions, { ordered: false });
}

async function persistLlmExtraction({
  userId,
  documentId,
  rawModelResponse,
  normalizedOutput,
  extractedAt,
  now,
}: {
  userId?: string;
  documentId: ObjectId;
  rawModelResponse: unknown;
  normalizedOutput: StatementData;
  extractedAt: Date;
  now: Date;
}) {
  const llmRecord: LlmExtractionRecord = {
    user_id: userId,
    document_id: documentId,
    model_name: 'gpt-4o',
    output_version: 1,
    raw_output: rawModelResponse,
    normalized_output: normalizedOutput ?? undefined,
    created_at: now,
    updated_at: now,
  };

  const llmCollection = await getCollection<LlmExtractionRecord>('llm_extractions');
  await llmCollection.insertOne(llmRecord);
}

async function persistDerivedMetrics({
  userId,
  documentId,
  extractedData,
  extractedAt,
  now,
}: {
  userId?: string;
  documentId: ObjectId;
  extractedData: StatementData;
  extractedAt: Date;
  now: Date;
}) {
  if (!userId) {
    return;
  }

  const categoryTotal = toNumber(extractedData.categorySpending?.total);
  const refundsTotal = toNumber(extractedData.refunds?.totalAmount);
  const refundRate =
    categoryTotal && refundsTotal !== undefined && categoryTotal !== 0
      ? Math.abs(refundsTotal ?? 0) / Math.abs(categoryTotal)
      : undefined;

  const derivedMetricsPayload: Record<string, unknown> =
    filterUndefined({
      avg_utilization_3mo: null,
      carry_forward_flag: extractedData.carryForwardBalance?.hasCarryOver ?? null,
      spend_volatility: toNumber(extractedData.spendingVolatility?.standardDeviation) ?? null,
      payment_regular_flag:
        typeof extractedData.paymentRegularity?.onTimePercentage === 'number'
          ? extractedData.paymentRegularity.onTimePercentage >= 90
          : null,
      discretionary_ratio: null,
      refund_rate: refundRate ?? null,
      recurring_merchants: Array.isArray(extractedData.subscriptions?.recurringCharges)
        ? extractedData.subscriptions.recurringCharges
            .map((item) => (typeof item?.merchant === 'string' ? item.merchant : undefined))
            .filter((merchant): merchant is string => Boolean(merchant))
        : [],
      category_spend: extractedData.categorySpending?.categories ?? {},
      health_score: null,
    }) ?? {};

  const derivedMetricsMetadata = filterUndefined({
    latest_statement_id: documentId,
    credit_utilization_percentage: toNumber(extractedData.creditUtilization?.percentage),
    statements_considered: 1,
  });

  const derivedMetricsCollection = await getCollection<DerivedMetricsRecord>('derived_metrics');

  const updateDocument: {
    $set: {
      metrics: Record<string, unknown>;
      computed_at: Date;
      updated_at: Date;
      metadata?: Record<string, unknown>;
    };
    $setOnInsert: {
      user_id: string;
      created_at: Date;
    };
    $unset?: Record<string, number>;
  } = {
    $set: {
      metrics: derivedMetricsPayload,
      computed_at: extractedAt,
      updated_at: now,
    },
    $setOnInsert: {
      user_id: userId,
      created_at: now,
    },
  };

  if (derivedMetricsMetadata) {
    updateDocument.$set.metadata = derivedMetricsMetadata;
  } else {
    updateDocument.$unset = { metadata: 1 };
  }

  await derivedMetricsCollection.updateOne(
    { user_id: userId },
    updateDocument,
    { upsert: true }
  );
}
