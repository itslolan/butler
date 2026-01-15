import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { upsertMemory } from '@/lib/db-tools';
import { supabase } from '@/lib/supabase';
import { normalizeMerchantName } from '@/lib/merchant-summarizer';

export const runtime = 'nodejs';

/**
 * POST - Confirm or reject an expense as a fixed expense
 * Stores the user's feedback in memories for future LLM classification
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabaseAuth = createClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const body = await request.json();
    const { transaction_id, merchant_key, merchant_name, action, amount, day, date } = body;

    if (!action || !['confirm', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "confirm" or "reject"' },
        { status: 400 }
      );
    }

    // Resolve transaction details when provided (new flow)
    let resolvedMerchantName: string | null = typeof merchant_name === 'string' ? merchant_name : null;
    let resolvedAmount: number | null = typeof amount === 'number' ? amount : amount ? Number(amount) : null;
    let resolvedDay: number | null = typeof day === 'number' ? day : day ? Number(day) : null;
    let resolvedDate: string | null = typeof date === 'string' ? date : null;

    if (transaction_id) {
      const { data: txn, error: txnError } = await supabase
        .from('transactions')
        .select('id, merchant, amount, date')
        .eq('id', transaction_id)
        .eq('user_id', userId)
        .single();

      if (txnError || !txn) {
        return NextResponse.json(
          { error: 'Transaction not found' },
          { status: 404 }
        );
      }

      if (!resolvedMerchantName) resolvedMerchantName = txn.merchant;
      if (!Number.isFinite(Number(resolvedAmount))) resolvedAmount = Number(txn.amount);
      if (!resolvedDate) resolvedDate = typeof txn.date === 'string' ? txn.date : new Date(txn.date).toISOString().slice(0, 10);
      if (!Number.isFinite(Number(resolvedDay))) {
        const d = new Date(resolvedDate || txn.date);
        resolvedDay = Number.isFinite(d.getTime()) ? d.getUTCDate() : null;
      }

      // Persist the user's decision directly onto this transaction.
      if (action === 'confirm') {
        await supabase
          .from('transactions')
          .update({
            is_fixed_expense: true,
            fixed_expense_status: 'fixed',
            fixed_expense_source: 'user',
            fixed_expense_confidence: 1,
            fixed_expense_model: null,
            fixed_expense_explain: 'User confirmed this fixed expense',
          })
          .eq('id', transaction_id)
          .eq('user_id', userId);
      } else {
        await supabase
          .from('transactions')
          .update({
            is_fixed_expense: false,
            fixed_expense_status: null,
            fixed_expense_source: null,
            fixed_expense_confidence: null,
            fixed_expense_model: null,
            fixed_expense_explain: null,
            fixed_expense_user_input_id: null,
          })
          .eq('id', transaction_id)
          .eq('user_id', userId);
      }
    }

    // Backward compatible: allow calls without transaction_id as long as merchant_name exists.
    if (!resolvedMerchantName) {
      return NextResponse.json(
        { error: 'merchant_name is required (or provide transaction_id)' },
        { status: 400 }
      );
    }

    const resolvedMerchantKey =
      typeof merchant_key === 'string' && merchant_key.trim().length > 0
        ? merchant_key.trim()
        : normalizeMerchantName(resolvedMerchantName);

    // Create a memory entry based on the action
    let memoryContent: string;
    
    // Format details string if available
    const detailsParts = [];
    if (Number.isFinite(Number(resolvedAmount))) detailsParts.push(`Amount: ~$${Math.round(Number(resolvedAmount))}`);
    if (Number.isFinite(Number(resolvedDay))) detailsParts.push(`Typical Date: Day ${Number(resolvedDay)}`);
    const detailsStr = detailsParts.length > 0 ? ` [${detailsParts.join(', ')}]` : '';
    
    if (action === 'confirm') {
      memoryContent = `Confirmed fixed expense: "${resolvedMerchantName}" (normalized: ${resolvedMerchantKey})${detailsStr}. User confirmed this as a recurring fixed payment.`;
      console.log(`[Fixed Expense Feedback] User ${userId} confirmed "${resolvedMerchantName}" as fixed expense`);
    } else {
      memoryContent = `Rejected fixed expense: "${resolvedMerchantName}" (normalized: ${resolvedMerchantKey})${detailsStr}. User indicated this is NOT a fixed recurring payment.`;
      console.log(`[Fixed Expense Feedback] User ${userId} rejected "${resolvedMerchantName}" as fixed expense`);
    }

    console.log(`[Fixed Expense Feedback] Saving memory: "${memoryContent}"`);
    await upsertMemory(userId, memoryContent);
    console.log(`[Fixed Expense Feedback] Memory saved successfully`);

    return NextResponse.json({
      success: true,
      message: `Fixed expense ${action}ed`,
      action,
    });

  } catch (error: any) {
    console.error('[confirm-fixed-expense] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save fixed expense feedback' },
      { status: 500 }
    );
  }
}

