import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/user/delete-data
 * 
 * Deletes all user data including:
 * - Transactions
 * - Documents
 * - Uploads
 * - Accounts
 * - Budget categories and allocations
 * - User metadata and memories
 * - Fixed expenses cache
 * - Account snapshots
 * 
 * This is a destructive operation and cannot be undone.
 */
export async function DELETE(request: NextRequest) {
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
    const deletedCounts: Record<string, number> = {};

    console.log(`[delete-data] Starting data deletion for user: ${userId}`);

    // Delete in order to respect foreign key constraints
    // 1. Delete transactions first (references documents and accounts)
    const { count: transactionsCount } = await supabase
      .from('transactions')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    deletedCounts.transactions = transactionsCount || 0;
    console.log(`[delete-data] Deleted ${transactionsCount || 0} transactions`);

    // 2. Delete documents (references uploads)
    const { count: documentsCount } = await supabase
      .from('documents')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    deletedCounts.documents = documentsCount || 0;
    console.log(`[delete-data] Deleted ${documentsCount || 0} documents`);

    // 3. Delete uploads
    const { count: uploadsCount } = await supabase
      .from('uploads')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    deletedCounts.uploads = uploadsCount || 0;
    console.log(`[delete-data] Deleted ${uploadsCount || 0} uploads`);

    // 4. Delete accounts
    const { count: accountsCount } = await supabase
      .from('accounts')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    deletedCounts.accounts = accountsCount || 0;
    console.log(`[delete-data] Deleted ${accountsCount || 0} accounts`);

    // 5. Delete budget allocations
    const { count: allocationsCount } = await supabase
      .from('budget_allocations')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    deletedCounts.budget_allocations = allocationsCount || 0;
    console.log(`[delete-data] Deleted ${allocationsCount || 0} budget allocations`);

    // 6. Delete budget categories
    const { count: categoriesCount } = await supabase
      .from('budget_categories')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    deletedCounts.budget_categories = categoriesCount || 0;
    console.log(`[delete-data] Deleted ${categoriesCount || 0} budget categories`);

    // 7. Delete user memories
    const { count: memoriesCount } = await supabase
      .from('user_memories')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    deletedCounts.user_memories = memoriesCount || 0;
    console.log(`[delete-data] Deleted ${memoriesCount || 0} user memories`);

    // 8. Delete user metadata
    const { count: metadataCount } = await supabase
      .from('user_metadata')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    deletedCounts.user_metadata = metadataCount || 0;
    console.log(`[delete-data] Deleted ${metadataCount || 0} user metadata entries`);

    // 9. Delete account snapshots
    const { count: snapshotsCount } = await supabase
      .from('account_snapshots')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    deletedCounts.account_snapshots = snapshotsCount || 0;
    console.log(`[delete-data] Deleted ${snapshotsCount || 0} account snapshots`);

    // 10. Delete fixed expenses cache
    const { count: fixedExpensesCount } = await supabase
      .from('fixed_expenses_cache')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    deletedCounts.fixed_expenses_cache = fixedExpensesCount || 0;
    console.log(`[delete-data] Deleted ${fixedExpensesCount || 0} fixed expenses cache entries`);

    // 11. Delete files from storage
    try {
      const { data: files } = await supabase.storage
        .from('statements')
        .list(userId);

      if (files && files.length > 0) {
        const filePaths = files.map(file => `${userId}/${file.name}`);
        await supabase.storage.from('statements').remove(filePaths);
        deletedCounts.storage_files = files.length;
        console.log(`[delete-data] Deleted ${files.length} storage files`);
      }
    } catch (storageError) {
      console.error('[delete-data] Error deleting storage files:', storageError);
      // Continue even if storage deletion fails
    }

    console.log(`[delete-data] Data deletion complete for user: ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'All user data has been deleted',
      deletedCounts,
    });

  } catch (error: any) {
    console.error('[delete-data] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete user data' },
      { status: 500 }
    );
  }
}
