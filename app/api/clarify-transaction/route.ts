import { NextRequest, NextResponse } from 'next/server';
import { updateTransactionType, getTransactionById, upsertMemory, findMatchingTransfer } from '@/lib/db-tools';

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

    // Get transaction details before updating
    const transaction = await getTransactionById(transaction_id);
    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    await updateTransactionType(transaction_id, transaction_type);

    // Extract and save memory if this is notable information
    try {
      const userId = transaction.user_id;
      const amount = Math.abs(Number(transaction.amount));
      const merchant = transaction.merchant || 'Unknown';
      const accountName = transaction.account_name || 'account';
      const currency = transaction.currency || 'USD';
      const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'INR' ? '₹' : currency;

      let memory: string | null = null;

      if (transaction_type === 'income') {
        // Extract income memory (salary, regular income)
        memory = `User receives ${transaction_type} of ${currencySymbol}${amount.toFixed(2)} from ${merchant}`;
      } else if (transaction_type === 'transfer') {
        // Extract transfer memory (regular transfers between accounts)
        // Try to find matching transfer to identify the pattern
        const matchingTransfer = await findMatchingTransfer(
          userId,
          transaction.amount,
          transaction.date.toString(),
          transaction.document_id
        );
        
        if (matchingTransfer) {
          const otherAccount = matchingTransfer.account_name || 'another account';
          memory = `User regularly transfers ${currencySymbol}${amount.toFixed(2)} between ${accountName} and ${otherAccount}`;
        } else {
          // Still save as a transfer pattern, might be one-way
          memory = `User transfers ${currencySymbol}${amount.toFixed(2)} from/to ${accountName}`;
        }
      }

      if (memory) {
        await upsertMemory(userId, memory);
      }
    } catch (memoryError: any) {
      // Don't fail the transaction update if memory extraction fails
      console.error('[clarify-transaction] Error extracting memory:', memoryError.message);
    }

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

