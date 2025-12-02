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
  try {
    const body = await request.json();
    const { transaction_id, transaction_type } = body;

    if (!transaction_id) {
      return NextResponse.json(
        { error: 'transaction_id is required' },
        { status: 400 }
      );
    }

    if (!transaction_type || !['income', 'expense', 'transfer', 'other'].includes(transaction_type)) {
      return NextResponse.json(
        { error: 'Valid transaction_type is required (income, expense, transfer, or other)' },
        { status: 400 }
      );
    }

    await updateTransactionType(transaction_id, transaction_type);

    return NextResponse.json({
      success: true,
      message: `Transaction categorized as ${transaction_type}`,
      transaction_id,
      transaction_type,
    });

  } catch (error: any) {
    console.error('[clarify-transaction] Error:', error.message);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to clarify transaction',
      },
      { status: 500 }
    );
  }
}

