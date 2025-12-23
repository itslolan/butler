import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { assignAccountToDocuments, getAccountById, getOrCreateAccount, updateTransactionType } from '@/lib/db-tools';
import { CreateAccountInput } from '@/lib/supabase';
import { createClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TodoType = 'transaction_clarification' | 'account_selection';
type ResolveAction = 'resolve' | 'dismiss';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      userId,
      todoType,
      todoId,
      action,
      // transaction clarification
      transaction_type,
      // account selection
      document_ids,
      account_id,
      new_account,
    } = body as any;

    if (!userId || !todoType || !todoId || !action) {
      return NextResponse.json(
        { error: 'userId, todoType, todoId, and action are required' },
        { status: 400 }
      );
    }

    // Best-effort auth check (keeps existing userId-query flow working in local/dev)
    try {
      const supabaseAuth = createClient();
      const {
        data: { user },
      } = await supabaseAuth.auth.getUser();
      if (user && user.id !== userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } catch {
      // ignore auth failures; route will still use provided userId like existing /api/todos
    }

    if (todoType !== 'transaction_clarification' && todoType !== 'account_selection') {
      return NextResponse.json({ error: 'Invalid todoType' }, { status: 400 });
    }

    if (action !== 'resolve' && action !== 'dismiss') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (todoType === 'transaction_clarification') {
      const transactionId = todoId;

      if (action === 'dismiss') {
        const { error } = await supabase
          .from('transactions')
          .update({
            is_dismissed: true,
            needs_clarification: false,
            clarification_question: null,
          })
          .eq('id', transactionId)
          .eq('user_id', userId);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, dismissed: true });
      }

      if (!transaction_type || !['income', 'expense', 'transfer', 'other'].includes(transaction_type)) {
        return NextResponse.json(
          { error: 'transaction_type is required for resolving transaction_clarification todos' },
          { status: 400 }
        );
      }

      await updateTransactionType(transactionId, transaction_type);

      return NextResponse.json({ success: true, resolved: true, transaction_id: transactionId, transaction_type });
    }

    // account_selection
    const documentIds: string[] = Array.isArray(document_ids)
      ? document_ids
      : typeof document_ids === 'string'
        ? [document_ids]
        : // Most todos use id format: account-selection-{docId}
          [todoId.replace('account-selection-', '')];

    if (documentIds.length === 0 || !documentIds[0]) {
      return NextResponse.json({ error: 'document_ids is required' }, { status: 400 });
    }

    if (action === 'dismiss') {
      const { error } = await supabase
        .from('documents')
        .update({ is_dismissed: true, pending_account_selection: false })
        .in('id', documentIds)
        .eq('user_id', userId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, dismissed: true });
    }

    // resolve: must provide either account_id or new_account
    if (!account_id && !new_account) {
      return NextResponse.json(
        { error: 'Either account_id or new_account must be provided to resolve account_selection' },
        { status: 400 }
      );
    }

    let accountToAssign: any = null;
    let accountCreated = false;

    if (account_id) {
      accountToAssign = await getAccountById(account_id);
      if (!accountToAssign) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }
    } else {
      if (!new_account?.display_name) {
        return NextResponse.json({ error: 'new_account.display_name is required' }, { status: 400 });
      }

      const input: CreateAccountInput = {
        display_name: new_account.display_name,
        alias: new_account.alias || new_account.display_name,
        account_number_last4: new_account.last4 || new_account.account_number_last4 || null,
        account_type: new_account.account_type || null,
        issuer: new_account.issuer || null,
        source: 'manual',
      };

      const result = await getOrCreateAccount(userId, input);
      accountToAssign = result.account;
      accountCreated = result.created;
    }

    const assignResult = await assignAccountToDocuments(documentIds, accountToAssign.id, accountToAssign.display_name);

    return NextResponse.json({
      success: true,
      resolved: true,
      account: accountToAssign,
      account_created: accountCreated,
      documents_updated: assignResult.documents_updated,
      transactions_updated: assignResult.transactions_updated,
    });
  } catch (error: any) {
    console.error('[todos/resolve] Error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Failed to resolve todo' }, { status: 500 });
  }
}

