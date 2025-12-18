import { NextRequest, NextResponse } from 'next/server';
import { getUnclarifiedTransactions, getDocumentsPendingAccountSelection, getAccountsByUserId } from '@/lib/db-tools';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Fetch both transaction clarifications and pending account selections
    const [transactionTodos, pendingAccountDocs, accounts] = await Promise.all([
      getUnclarifiedTransactions(userId),
      getDocumentsPendingAccountSelection(userId),
      getAccountsByUserId(userId),
    ]);

    // Convert pending account docs to todo format
    const accountSelectionTodos = pendingAccountDocs.map(doc => ({
      id: `account-selection-${doc.document_id}`,
      type: 'account_selection' as const,
      document_id: doc.document_id,
      file_name: doc.file_name,
      transaction_count: doc.transaction_count,
      first_transaction_date: doc.first_transaction_date,
      last_transaction_date: doc.last_transaction_date,
      batch_id: doc.batch_id,
      clarification_question: `Which account do these ${doc.transaction_count} transaction${doc.transaction_count !== 1 ? 's' : ''} belong to?`,
      // Include accounts for the selector
      accounts: accounts,
    }));

    // Mark transaction todos with type
    const transactionTodosWithType = transactionTodos.map(todo => ({
      ...todo,
      type: 'transaction_clarification' as const,
    }));

    // Combine all todos - account selections first (more urgent)
    const allTodos = [...accountSelectionTodos, ...transactionTodosWithType];

    return NextResponse.json({
      count: allTodos.length,
      todos: allTodos,
      // Also return separate counts for UI
      accountSelectionCount: accountSelectionTodos.length,
      transactionClarificationCount: transactionTodos.length,
    });
  } catch (error: any) {
    console.error('[todos] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch todos' },
      { status: 500 }
    );
  }
}

