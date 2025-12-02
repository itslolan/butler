import { NextRequest, NextResponse } from 'next/server';
import { updateTransactionType } from '@/lib/db-tools';

export const runtime = 'nodejs';

/**
 * API endpoint to clarify/categorize a transaction
 * 
 * POST /api/clarify-transaction
 * Body: {
 *   transaction_id: string,
 *   transaction_type: 'income' | 'expense' | 'transfer' | 'other'
 * }
 */
export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[clarify-transaction:${requestId}] Incoming request`, {
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
  });

  try {
    const body = await request.json();
    const { transaction_id, transaction_type } = body;

    console.log(`[clarify-transaction:${requestId}] Request body parsed`, {
      transaction_id,
      transaction_type,
      full_body: body,
    });

    if (!transaction_id) {
      console.warn(`[clarify-transaction:${requestId}] Missing transaction_id`);
      return NextResponse.json(
        { error: 'transaction_id is required' },
        { status: 400 }
      );
    }

    if (!transaction_type || !['income', 'expense', 'transfer', 'other'].includes(transaction_type)) {
      console.warn(`[clarify-transaction:${requestId}] Invalid transaction_type`, {
        received: transaction_type,
        expected: ['income', 'expense', 'transfer', 'other'],
      });
      return NextResponse.json(
        { error: 'Valid transaction_type is required (income, expense, transfer, or other)' },
        { status: 400 }
      );
    }

    // Update the transaction
    console.log(`[clarify-transaction:${requestId}] Calling updateTransactionType`);
    await updateTransactionType(transaction_id, transaction_type);

    console.log(`[clarify-transaction:${requestId}] Successfully categorized transaction`, {
      transaction_id,
      transaction_type,
    });

    return NextResponse.json({
      success: true,
      message: `Transaction categorized as ${transaction_type}`,
      transaction_id,
      transaction_type,
    });

  } catch (error: any) {
    console.error(`[clarify-transaction:${requestId}] ERROR:`, {
      error_name: error.name,
      error_message: error.message,
      error_stack: error.stack,
      error_cause: error.cause,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to clarify transaction',
        error_type: error.name,
        error_details: error.stack,
      },
      { status: 500 }
    );
  }
}

