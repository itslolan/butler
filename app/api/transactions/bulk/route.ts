import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface BulkUpdateRequest {
  transactionIds: string[];
  action: 'update_category' | 'update_type' | 'update_account' | 'delete';
  value?: string;
  userId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: BulkUpdateRequest = await request.json();
    const { transactionIds, action, value, userId } = body;

    if (!transactionIds || transactionIds.length === 0) {
      return NextResponse.json({ error: 'transactionIds are required' }, { status: 400 });
    }

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Verify ownership of all transactions
    const { data: ownedTransactions, error: verifyError } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', userId)
      .in('id', transactionIds);

    if (verifyError) {
      return NextResponse.json({ error: verifyError.message }, { status: 500 });
    }

    if (!ownedTransactions || ownedTransactions.length !== transactionIds.length) {
      return NextResponse.json(
        { error: 'Some transactions do not belong to the user' },
        { status: 403 }
      );
    }

    // Handle delete action separately
    if (action === 'delete') {
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .in('id', transactionIds)
        .eq('user_id', userId);

      if (deleteError) {
        console.error('[transactions/bulk] Delete error:', deleteError.message);
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        deletedCount: transactionIds.length,
      });
    }

    // Handle update actions
    let updateData: Record<string, any> = {};

    switch (action) {
      case 'update_category':
        updateData = { category: value || null };
        break;

      case 'update_type':
        if (!value || !['income', 'expense', 'transfer', 'other'].includes(value)) {
          return NextResponse.json(
            { error: 'Invalid transaction type' },
            { status: 400 }
          );
        }
        updateData = { 
          transaction_type: value,
          needs_clarification: false,
          clarification_question: null,
        };
        break;

      case 'update_account':
        // Verify the account belongs to the user
        const { data: account, error: accountError } = await supabase
          .from('accounts')
          .select('id, display_name')
          .eq('id', value)
          .eq('user_id', userId)
          .single();

        if (accountError || !account) {
          return NextResponse.json(
            { error: 'Account not found or does not belong to user' },
            { status: 400 }
          );
        }

        updateData = { 
          account_id: value,
          account_name: account.display_name,
        };
        break;

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    // Perform the bulk update
    const { data: updatedTransactions, error: updateError } = await supabase
      .from('transactions')
      .update(updateData)
      .in('id', transactionIds)
      .eq('user_id', userId)
      .select('id');

    if (updateError) {
      console.error('[transactions/bulk] Update error:', updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updatedCount: updatedTransactions?.length || 0,
    });
  } catch (error: any) {
    console.error('[transactions/bulk] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to update transactions' },
      { status: 500 }
    );
  }
}
