import { supabase, Document, Transaction, UserMetadata, AccountSnapshot, UserMemory, Account, CreateAccountInput, PendingAccountDocument } from './supabase';

export interface DocumentFilter {
  documentType?: string;
  issuer?: string;
  accountName?: string;
  startDate?: string;
  endDate?: string;
  minBalance?: number;
  maxBalance?: number;
}

export interface TransactionFilter {
  accountName?: string;
  transactionType?: string;
  startDate?: string;
  endDate?: string;
  merchant?: string;
  category?: string;
  minAmount?: number;
  maxAmount?: number;
}

/**
 * Search documents with optional filters
 */
export async function searchDocuments(userId: string, filters: DocumentFilter = {}) {
  let query = supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId);

  if (filters.documentType) {
    query = query.eq('document_type', filters.documentType);
  }

  if (filters.issuer) {
    query = query.ilike('issuer', `%${filters.issuer}%`);
  }

  if (filters.accountName) {
    query = query.ilike('account_name', `%${filters.accountName}%`);
  }

  if (filters.startDate) {
    query = query.gte('statement_date', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('statement_date', filters.endDate);
  }

  if (filters.minBalance !== undefined) {
    query = query.gte('new_balance', filters.minBalance);
  }

  if (filters.maxBalance !== undefined) {
    query = query.lte('new_balance', filters.maxBalance);
  }

  const { data, error } = await query.order('uploaded_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to search documents: ${error.message}`);
  }

  return data || [];
}

/**
 * Search transactions with optional filters
 */
export async function searchTransactions(userId: string, filters: TransactionFilter = {}) {
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId);

  if (filters.accountName) {
    query = query.ilike('account_name', `%${filters.accountName}%`);
  }

  if (filters.transactionType) {
    query = query.eq('transaction_type', filters.transactionType);
  }

  if (filters.startDate) {
    query = query.gte('date', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('date', filters.endDate);
  }

  if (filters.merchant) {
    query = query.ilike('merchant', `%${filters.merchant}%`);
  }

  if (filters.category) {
    query = query.ilike('category', `%${filters.category}%`);
  }

  if (filters.minAmount !== undefined) {
    query = query.gte('amount', filters.minAmount);
  }

  if (filters.maxAmount !== undefined) {
    query = query.lte('amount', filters.maxAmount);
  }

  const { data, error } = await query.order('date', { ascending: false });

  if (error) {
    throw new Error(`Failed to search transactions: ${error.message}`);
  }

  return data || [];
}

/**
 * Find a matching transfer transaction in other accounts
 * Looks for a transaction with approximately the same amount (opposite sign)
 * within a small date window (+/- 3 days).
 */
export async function findMatchingTransfer(
  userId: string,
  amount: number,
  date: string,
  excludeDocumentId?: string
): Promise<Transaction | null> {
  // We are looking for the opposite flow (e.g. if I see -100, I look for +100)
  const targetAmount = -amount; 
  const tolerance = 0.01;
  
  // Calculate date window (+/- 3 days)
  const d = new Date(date);
  
  const startDateObj = new Date(d);
  startDateObj.setDate(d.getDate() - 3);
  const startDate = startDateObj.toISOString().split('T')[0];

  const endDateObj = new Date(d);
  endDateObj.setDate(d.getDate() + 3);
  const endDate = endDateObj.toISOString().split('T')[0];
  
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    // Amount matching (approximate for float safety)
    .gte('amount', targetAmount - tolerance)
    .lte('amount', targetAmount + tolerance);

  if (excludeDocumentId) {
    query = query.neq('document_id', excludeDocumentId);
  }

  // We only need one match to confirm
  const { data, error } = await query.limit(1);

  if (error) {
    console.error('Error finding matching transfer:', error);
    return null;
  }

  return data && data.length > 0 ? data[0] : null;
}

/**
 * Get all metadata for a user
 */
export async function getAllMetadata(userId: string) {
  const { data, error } = await supabase
    .from('user_metadata')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 is "not found" error, which is okay
    throw new Error(`Failed to get metadata: ${error.message}`);
  }

  return data || null;
}

/**
 * Insert a new document
 */
export async function insertDocument(doc: Document) {
  const { data, error } = await supabase
    .from('documents')
    .insert(doc)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert document: ${error.message}`);
  }

  return data;
}

/**
 * Insert multiple transactions
 */
export async function insertTransactions(transactions: Transaction[]) {
  if (transactions.length === 0) return [];

  const { data, error } = await supabase
    .from('transactions')
    .insert(transactions)
    .select();

  if (error) {
    throw new Error(`Failed to insert transactions: ${error.message}`);
  }

  return data || [];
}

/**
 * Append metadata summary for a user
 */
export async function appendMetadata(userId: string, newContent: string) {
  // First, try to get existing metadata
  const existing = await getAllMetadata(userId);

  if (existing) {
    // Update existing
    const updatedContent = existing.content + newContent;
    const { error } = await supabase
      .from('user_metadata')
      .update({ content: updatedContent, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to update metadata: ${error.message}`);
    }
  } else {
    // Insert new
    const { error } = await supabase
      .from('user_metadata')
      .insert({ user_id: userId, content: newContent });

    if (error) {
      throw new Error(`Failed to insert metadata: ${error.message}`);
    }
  }
}

/**
 * Get a transaction by ID
 */
export async function getTransactionById(id: string): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get transaction: ${error.message}`);
  }

  return data || null;
}

/**
 * Update transaction type
 */
export async function updateTransactionType(
  id: string,
  transactionType: 'income' | 'expense' | 'transfer' | 'other'
): Promise<void> {
  try {
    // Get the transaction to retrieve user_id for RLS policy compliance
    const { data: currentTransaction, error: fetchError } = await supabase
      .from('transactions')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (fetchError || !currentTransaction) {
      throw new Error(`Transaction with id ${id} not found`);
    }

    // Update with explicit user_id check to ensure RLS policies allow it
    const { data, error } = await supabase
      .from('transactions')
      .update({ 
        transaction_type: transactionType,
        needs_clarification: false,
        clarification_question: null,
      })
      .eq('id', id)
      .eq('user_id', currentTransaction.user_id)
      .select();

    if (error) {
      throw new Error(`Failed to update transaction type: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error(`Transaction with id ${id} not found or could not be updated`);
    }

    // Verify that needs_clarification was actually set to false
    const updatedTransaction = data[0];
    if (updatedTransaction.needs_clarification !== false) {
      throw new Error(`Update failed: needs_clarification is still ${updatedTransaction.needs_clarification} instead of false`);
    }
  } catch (error: any) {
    console.error('[updateTransactionType] Error:', error.message);
    throw error;
  }
}

/**
 * Get transactions that need clarification
 */
export async function getUnclarifiedTransactions(
  userId: string,
  documentId?: string
): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .is('needs_clarification', true)
    .eq('is_dismissed', false);

  if (documentId) {
    query = query.eq('document_id', documentId);
  }

  const { data, error } = await query.order('date', { ascending: false });

  if (error) {
    throw new Error(`Failed to get unclarified transactions: ${error.message}`);
  }

  // Client-side filter to ensure we only return transactions that actually need clarification
  return (data || []).filter(txn => txn.needs_clarification === true && txn.is_dismissed !== true);
}

/**
 * Insert account snapshot
 */
export async function insertAccountSnapshot(snapshot: AccountSnapshot): Promise<void> {
  const { error } = await supabase
    .from('account_snapshots')
    .upsert(snapshot, {
      onConflict: 'user_id,account_name,snapshot_date,snapshot_type',
    });

  if (error) {
    throw new Error(`Failed to insert account snapshot: ${error.message}`);
  }
}

/**
 * Insert multiple account snapshots
 */
export async function insertAccountSnapshots(snapshots: AccountSnapshot[]): Promise<void> {
  if (snapshots.length === 0) return;

  const { error } = await supabase
    .from('account_snapshots')
    .upsert(snapshots, {
      onConflict: 'user_id,account_name,snapshot_date,snapshot_type',
    });

  if (error) {
    throw new Error(`Failed to insert account snapshots: ${error.message}`);
  }
}

/**
 * Get account snapshots with optional filters
 */
export async function getAccountSnapshots(
  userId: string,
  accountName?: string,
  startDate?: string,
  endDate?: string
): Promise<AccountSnapshot[]> {
  let query = supabase
    .from('account_snapshots')
    .select('*')
    .eq('user_id', userId);

  if (accountName) {
    query = query.ilike('account_name', `%${accountName}%`);
  }

  if (startDate) {
    query = query.gte('snapshot_date', startDate);
  }

  if (endDate) {
    query = query.lte('snapshot_date', endDate);
  }

  const { data, error } = await query.order('snapshot_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to get account snapshots: ${error.message}`);
  }

  return data || [];
}

/**
 * Calculate net worth at a specific date across all accounts
 */
export async function calculateNetWorth(userId: string, date: string): Promise<{
  netWorth: number;
  breakdown: Array<{ accountName: string; balance: number; type: string }>;
  accountsCount: number;
}> {
  // Get all month_end snapshots closest to the given date
  const { data, error } = await supabase
    .from('account_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('snapshot_type', 'month_end')
    .lte('snapshot_date', date)
    .order('snapshot_date', { ascending: false });

  if (error) {
    throw new Error(`Failed to calculate net worth: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return { netWorth: 0, breakdown: [], accountsCount: 0 };
  }

  // Get the most recent snapshot for each account
  const latestByAccount = new Map<string, AccountSnapshot>();
  
  for (const snapshot of data) {
    if (!latestByAccount.has(snapshot.account_name)) {
      latestByAccount.set(snapshot.account_name, snapshot);
    }
  }

  const breakdown = Array.from(latestByAccount.values()).map(snapshot => ({
    accountName: snapshot.account_name,
    balance: Number(snapshot.balance),
    type: snapshot.balance >= 0 ? 'asset' : 'liability',
  }));

  const netWorth = breakdown.reduce((sum, item) => sum + item.balance, 0);

  return {
    netWorth,
    breakdown,
    accountsCount: breakdown.length,
  };
}

/**
 * Helper function to fetch all records with pagination
 */
async function fetchAllTransactions(
  userId: string,
  filters: {
    transactionTypes?: string[];
    startDate?: string;
    endDate?: string;
    selectFields?: string;
  }
): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('transactions')
      .select(filters.selectFields || '*')
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filters.transactionTypes && filters.transactionTypes.length > 0) {
      query = query.in('transaction_type', filters.transactionTypes);
    }

    if (filters.startDate) {
      query = query.gte('date', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('date', filters.endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data);
      if (data.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  return allData;
}

/**
 * Get monthly spending trend for a user
 * Aggregates expenses by month for the last N months OR a specific month
 */
export async function getMonthlySpendingTrend(
  userId: string,
  months: number = 6,
  specificMonth?: string
): Promise<Array<{ month: string; total: number }>> {
  let startDate: string;
  let endDate: string | undefined;

  if (specificMonth) {
    startDate = `${specificMonth}-01`;
    const [year, month] = specificMonth.split('-').map(Number);
    endDate = new Date(year, month, 0).toISOString().split('T')[0];
  } else {
    const now = new Date();
    const monthsAgo = new Date(now.getFullYear(), now.getMonth() - months, 1);
    startDate = monthsAgo.toISOString().split('T')[0];
    // Set endDate to today to ensure we get all recent data
    endDate = now.toISOString().split('T')[0];
  }
  
  // Get all expense transactions in the date range using pagination
  const data = await fetchAllTransactions(userId, {
    transactionTypes: ['expense', 'other'],
    startDate,
    endDate,
    selectFields: 'date, amount, transaction_type',
  });

  if (!data || data.length === 0) {
    if (specificMonth) {
      return [{ month: specificMonth, total: 0 }];
    }
    
    // Return empty months for range
    const result: Array<{ month: string; total: number }> = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(now.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      result.push({ month: monthKey, total: 0 });
    }
    return result;
  }

  // Aggregate by month
  const monthlyMap = new Map<string, number>();
  
  for (const txn of data) {
    const date = new Date(txn.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const current = monthlyMap.get(monthKey) || 0;
    monthlyMap.set(monthKey, current + Math.abs(Number(txn.amount)));
  }
  
  if (specificMonth) {
    return [{
      month: specificMonth,
      total: monthlyMap.get(specificMonth) || 0
    }];
  }

  // Initialize result with all months in range first
  const result: Array<{ month: string; total: number }> = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(now.getMonth() - i);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    result.push({ month: monthKey, total: monthlyMap.get(monthKey) || 0 });
  }
  
  return result;
}

/**
 * Get category breakdown for a user
 * Aggregates expenses by category for the last N months OR a specific month
 */
export async function getCategoryBreakdown(
  userId: string,
  months: number = 6,
  specificMonth?: string // Optional: 'YYYY-MM'
): Promise<Array<{ category: string; total: number; percentage: number; count: number; spend_classification?: string | null }>> {
  
  let startDate: string;
  let endDate: string | undefined;

  if (specificMonth) {
    // Filter for specific month
    startDate = `${specificMonth}-01`;
    // Calculate end of month
    const [year, month] = specificMonth.split('-').map(Number);
    endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month
  } else {
    // Default: last N months - start from the 1st of the month N months ago
    const now = new Date();
    const monthsAgo = new Date(now.getFullYear(), now.getMonth() - months, 1);
    startDate = monthsAgo.toISOString().split('T')[0];
  }
  
  // Get all transactions using pagination
  const data = await fetchAllTransactions(userId, {
    transactionTypes: ['expense', 'other'],
    startDate,
    endDate,
    selectFields: 'category, amount, transaction_type, date, spend_classification',
  });

  if (!data || data.length === 0) {
    return [];
  }

  // Aggregate by category
  const categoryMap = new Map<string, { total: number; count: number; spend_classification?: string | null }>();
  let grandTotal = 0;
  
  for (const txn of data) {
    const category = txn.category || 'Uncategorized';
    const absAmount = Math.abs(Number(txn.amount));
    
    const current = categoryMap.get(category) || { total: 0, count: 0, spend_classification: txn.spend_classification };
    categoryMap.set(category, {
      total: current.total + absAmount,
      count: current.count + 1,
      spend_classification: current.spend_classification || txn.spend_classification, // Use first non-null value
    });
    
    grandTotal += absAmount;
  }
  
  // Convert to array and calculate percentages
  const result = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    total: data.total,
    count: data.count,
    percentage: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0,
    spend_classification: data.spend_classification,
  }));
  
  // Sort by total descending
  result.sort((a, b) => b.total - a.total);
  
  return result;
}

/**
 * Get distinct categories with transaction counts
 */
export async function getDistinctCategories(
  userId: string,
  filters?: {
    startDate?: string;
    endDate?: string;
    transactionType?: string;
  }
): Promise<Array<{ category: string; count: number }>> {
  let query = supabase
    .from('transactions')
    .select('category')
    .eq('user_id', userId);

  if (filters?.startDate) {
    query = query.gte('date', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('date', filters.endDate);
  }

  if (filters?.transactionType) {
    query = query.eq('transaction_type', filters.transactionType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get distinct categories: ${error.message}`);
  }

  // Aggregate by category
  const categoryMap = new Map<string, number>();
  
  for (const txn of data || []) {
    const category = txn.category || 'Uncategorized';
    categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
  }

  // Convert to array and sort by count descending
  const result = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return result;
}

/**
 * Get distinct merchants with transaction counts
 */
export async function getDistinctMerchants(
  userId: string,
  filters?: {
    startDate?: string;
    endDate?: string;
    category?: string;
  }
): Promise<Array<{ merchant: string; count: number }>> {
  let query = supabase
    .from('transactions')
    .select('merchant')
    .eq('user_id', userId);

  if (filters?.startDate) {
    query = query.gte('date', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('date', filters.endDate);
  }

  if (filters?.category) {
    query = query.ilike('category', `%${filters.category}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get distinct merchants: ${error.message}`);
  }

  // Aggregate by merchant
  const merchantMap = new Map<string, number>();
  
  for (const txn of data || []) {
    const merchant = txn.merchant || 'Unknown';
    merchantMap.set(merchant, (merchantMap.get(merchant) || 0) + 1);
  }

  // Convert to array and sort by count descending
  const result = Array.from(merchantMap.entries())
    .map(([merchant, count]) => ({ merchant, count }))
    .sort((a, b) => b.count - a.count);

  return result;
}

/**
 * Get distinct account names
 */
export async function getDistinctAccountNames(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('account_name')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to get distinct account names: ${error.message}`);
  }

  // Get unique account names
  const accountNames = new Set<string>();
  for (const txn of data || []) {
    if (txn.account_name) {
      accountNames.add(txn.account_name);
    }
  }

  return Array.from(accountNames).sort();
}

/**
 * Bulk update transactions by merchant
 */
export async function bulkUpdateTransactionsByMerchant(
  userId: string,
  merchant: string,
  updates: {
    category?: string;
    transactionType?: string;
    spendClassification?: string;
  },
  filters?: {
    startDate?: string;
    endDate?: string;
  }
): Promise<{ updatedCount: number }> {
  // First, find matching transactions
  let query = supabase
    .from('transactions')
    .select('id')
    .eq('user_id', userId)
    .ilike('merchant', `%${merchant}%`);

  if (filters?.startDate) {
    query = query.gte('date', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('date', filters.endDate);
  }

  const { data: transactions, error: selectError } = await query;

  if (selectError) {
    throw new Error(`Failed to find transactions: ${selectError.message}`);
  }

  if (!transactions || transactions.length === 0) {
    return { updatedCount: 0 };
  }

  // Build update object
  const updateData: any = {};
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.transactionType !== undefined) updateData.transaction_type = updates.transactionType;
  if (updates.spendClassification !== undefined) updateData.spend_classification = updates.spendClassification;

  // Update all matching transactions
  const ids = transactions.map(t => t.id);
  const { error: updateError } = await supabase
    .from('transactions')
    .update(updateData)
    .in('id', ids);

  if (updateError) {
    throw new Error(`Failed to update transactions: ${updateError.message}`);
  }

  return { updatedCount: transactions.length };
}

/**
 * Bulk update transactions by category
 */
export async function bulkUpdateTransactionsByCategory(
  userId: string,
  oldCategory: string,
  newCategory: string,
  filters?: {
    startDate?: string;
    endDate?: string;
  }
): Promise<{ updatedCount: number }> {
  // First, find matching transactions
  let query = supabase
    .from('transactions')
    .select('id')
    .eq('user_id', userId)
    .ilike('category', `%${oldCategory}%`);

  if (filters?.startDate) {
    query = query.gte('date', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('date', filters.endDate);
  }

  const { data: transactions, error: selectError } = await query;

  if (selectError) {
    throw new Error(`Failed to find transactions: ${selectError.message}`);
  }

  if (!transactions || transactions.length === 0) {
    return { updatedCount: 0 };
  }

  // Update all matching transactions
  const ids = transactions.map(t => t.id);
  const { error: updateError } = await supabase
    .from('transactions')
    .update({ category: newCategory })
    .in('id', ids);

  if (updateError) {
    throw new Error(`Failed to update transactions: ${updateError.message}`);
  }

  return { updatedCount: transactions.length };
}

/**
 * Bulk update transactions by filters
 */
export async function bulkUpdateTransactionsByFilters(
  userId: string,
  filters: {
    merchant?: string;
    category?: string;
    transactionType?: string;
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
    accountName?: string;
  },
  updates: {
    category?: string;
    transactionType?: string;
    spendClassification?: string;
  }
): Promise<{ updatedCount: number }> {
  // Build query to find matching transactions
  let query = supabase
    .from('transactions')
    .select('id')
    .eq('user_id', userId);

  if (filters.merchant) {
    query = query.ilike('merchant', `%${filters.merchant}%`);
  }

  if (filters.category) {
    query = query.ilike('category', `%${filters.category}%`);
  }

  if (filters.transactionType) {
    query = query.eq('transaction_type', filters.transactionType);
  }

  if (filters.startDate) {
    query = query.gte('date', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('date', filters.endDate);
  }

  if (filters.minAmount !== undefined) {
    query = query.gte('amount', filters.minAmount);
  }

  if (filters.maxAmount !== undefined) {
    query = query.lte('amount', filters.maxAmount);
  }

  if (filters.accountName) {
    query = query.ilike('account_name', `%${filters.accountName}%`);
  }

  const { data: transactions, error: selectError } = await query;

  if (selectError) {
    throw new Error(`Failed to find transactions: ${selectError.message}`);
  }

  if (!transactions || transactions.length === 0) {
    return { updatedCount: 0 };
  }

  // Build update object
  const updateData: any = {};
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.transactionType !== undefined) updateData.transaction_type = updates.transactionType;
  if (updates.spendClassification !== undefined) updateData.spend_classification = updates.spendClassification;

  // Update all matching transactions
  const ids = transactions.map(t => t.id);
  const { error: updateError } = await supabase
    .from('transactions')
    .update(updateData)
    .in('id', ids);

  if (updateError) {
    throw new Error(`Failed to update transactions: ${updateError.message}`);
  }

  return { updatedCount: transactions.length };
}

/**
 * Get income vs expenses comparison by month
 * Returns monthly totals for both income and expenses
 */
export async function getIncomeVsExpenses(
  userId: string,
  months: number = 6,
  specificMonth?: string
): Promise<Array<{ month: string; income: number; expenses: number }>> {
  let startDate: string;
  let endDate: string | undefined;

  if (specificMonth) {
    startDate = `${specificMonth}-01`;
    const [year, month] = specificMonth.split('-').map(Number);
    endDate = new Date(year, month, 0).toISOString().split('T')[0];
  } else {
    const now = new Date();
    const monthsAgo = new Date(now.getFullYear(), now.getMonth() - months, 1);
    startDate = monthsAgo.toISOString().split('T')[0];
    // Set endDate to today to ensure we get all recent data
    endDate = now.toISOString().split('T')[0];
  }
  
  // Get all transactions in the date range using pagination
  const data = await fetchAllTransactions(userId, {
    startDate,
    endDate,
    selectFields: 'date, amount, transaction_type',
  });

  // Initialize monthly data
  const monthlyData = new Map<string, { income: number; expenses: number }>();
  
  if (!specificMonth) {
    const now = new Date();
    // Fill in all months first with zeros for range
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(now.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyData.set(monthKey, { income: 0, expenses: 0 });
    }
  } else {
    monthlyData.set(specificMonth, { income: 0, expenses: 0 });
  }

  if (data && data.length > 0) {
    // Aggregate transactions
    for (const txn of data) {
      const date = new Date(txn.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      const current = monthlyData.get(monthKey);
      
      // If month is in our pre-filled map, update it
      if (current) {
        const absAmount = Math.abs(Number(txn.amount));
        
        if (txn.transaction_type === 'income') {
          current.income += absAmount;
        } else if (txn.transaction_type === 'expense' || txn.transaction_type === 'other') {
          current.expenses += absAmount;
        }
      } else if (!specificMonth) {
        // If not in map and we're in range mode, add it (edge case for data outside expected range)
        const absAmount = Math.abs(Number(txn.amount));
        const newEntry = { income: 0, expenses: 0 };
        
        if (txn.transaction_type === 'income') {
          newEntry.income = absAmount;
        } else if (txn.transaction_type === 'expense' || txn.transaction_type === 'other') {
          newEntry.expenses = absAmount;
        }
        
        monthlyData.set(monthKey, newEntry);
      }
    }
  }
  
  // Convert to array
  const result = Array.from(monthlyData.entries()).map(([month, data]) => ({
    month,
    income: data.income,
    expenses: data.expenses,
  }));
  
  // Sort by month
  result.sort((a, b) => a.month.localeCompare(b.month));
  
  return result;
}

/**
 * Get all memories for a user as plain text
 */
export async function getAllMemories(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('user_memories')
    .select('content')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get memories: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return '';
  }

  // Combine all memories into a single text with bullet points
  return data.map(m => m.content).join('\n');
}

/**
 * Append a new memory to the user's memories
 * Note: This creates a new row. For updating existing memories, use updateMemory or handleConflict.
 */
export async function appendMemory(userId: string, newMemory: string): Promise<void> {
  // Ensure memory starts with bullet point format
  const formattedMemory = newMemory.startsWith('- ') ? newMemory : `- ${newMemory}`;

  const { error } = await supabase
    .from('user_memories')
    .insert({ user_id: userId, content: formattedMemory });

  if (error) {
    throw new Error(`Failed to append memory: ${error.message}`);
  }
}

/**
 * Update an existing memory by replacing old content with new content
 */
export async function updateMemory(userId: string, oldMemory: string, newMemory: string): Promise<void> {
  const formattedNewMemory = newMemory.startsWith('- ') ? newMemory : `- ${newMemory}`;

  const { error } = await supabase
    .from('user_memories')
    .update({ content: formattedNewMemory, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('content', oldMemory);

  if (error) {
    throw new Error(`Failed to update memory: ${error.message}`);
  }
}

/**
 * Delete a specific memory
 */
export async function deleteMemory(userId: string, memoryToDelete: string): Promise<void> {
  const { error } = await supabase
    .from('user_memories')
    .delete()
    .eq('user_id', userId)
    .eq('content', memoryToDelete);

  if (error) {
    throw new Error(`Failed to delete memory: ${error.message}`);
  }
}

/**
 * Find memories that might conflict with new information
 * Uses LLM to intelligently detect semantic conflicts
 */
export async function findConflictingMemories(
  userId: string,
  newMemory: string
): Promise<Array<{ id: string; content: string }>> {
  const { data, error } = await supabase
    .from('user_memories')
    .select('id, content')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to find conflicting memories: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Use LLM to detect conflicts intelligently
  if (!process.env.GEMINI_API_KEY) {
    // Fallback: simple keyword matching if no API key
    return data.filter(m => {
      const newLower = newMemory.toLowerCase();
      const memLower = m.content.toLowerCase();
      
      // Check for common conflict patterns
      const conflictKeywords = ['salary', 'income', 'transfer', 'monthly', 'regularly'];
      const hasCommonKeyword = conflictKeywords.some(keyword => 
        newLower.includes(keyword) && memLower.includes(keyword)
      );
      
      return hasCommonKeyword;
    });
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const existingMemoriesText = data.map(m => m.content).join('\n');
    
    const prompt = `You are analyzing user memories to detect conflicts. Given a new memory and existing memories, identify which existing memories conflict with the new one.

New memory: "${newMemory}"

Existing memories:
${existingMemoriesText}

A conflict occurs when:
- Same fact but different value (e.g., "salary is $4000" vs "salary is $5000")
- Same pattern but different details (e.g., "transfers $2000 monthly" vs "transfers $3000 monthly")
- Contradictory information about the same thing

Return a JSON array of the EXACT content strings from existing memories that conflict with the new memory. If no conflicts, return empty array [].

Format: ["- memory content 1", "- memory content 2"]`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const conflictingContents: string[] = JSON.parse(responseText);

    if (!Array.isArray(conflictingContents) || conflictingContents.length === 0) {
      return [];
    }

    // Find the memory records that match the conflicting contents
    return data.filter(m => conflictingContents.includes(m.content));
  } catch (error: any) {
    console.error('Error detecting memory conflicts with LLM:', error.message);
    // Fallback to simple matching
    return data.filter(m => {
      const newLower = newMemory.toLowerCase();
      const memLower = m.content.toLowerCase();
      const conflictKeywords = ['salary', 'income', 'transfer', 'monthly', 'regularly'];
      return conflictKeywords.some(keyword => 
        newLower.includes(keyword) && memLower.includes(keyword)
      );
    });
  }
}

/**
 * Smart memory update: checks for conflicts and updates or appends accordingly
 */
export async function upsertMemory(userId: string, newMemory: string): Promise<void> {
  const formattedMemory = newMemory.startsWith('- ') ? newMemory : `- ${newMemory}`;
  
  // Find conflicting memories
  const conflicts = await findConflictingMemories(userId, formattedMemory);
  
  if (conflicts.length > 0) {
    // Update the first conflicting memory (most recent or first found)
    // Delete others to avoid duplicates
    for (let i = 0; i < conflicts.length; i++) {
      if (i === 0) {
        // Update the first one
        await updateMemory(userId, conflicts[i].content, formattedMemory);
      } else {
        // Delete duplicates
        await deleteMemory(userId, conflicts[i].content);
      }
    }
    console.log(`[Memory] Updated ${conflicts.length} conflicting memory/memories with: ${formattedMemory}`);
  } else {
    // No conflicts, append new memory
    await appendMemory(userId, formattedMemory);
    console.log(`[Memory] Added new memory: ${formattedMemory}`);
  }
}

// ============================================
// Account Management Functions
// ============================================

/**
 * Create a new account
 */
export async function createAccount(
  userId: string,
  input: CreateAccountInput
): Promise<Account> {
  const accountData = {
    user_id: userId,
    display_name: input.display_name,
    official_name: input.official_name || null,
    alias: input.alias || input.display_name, // Default alias to display_name
    account_number_last4: input.account_number_last4 || null,
    account_type: input.account_type || null,
    issuer: input.issuer || null,
    source: input.source,
    plaid_account_id: input.plaid_account_id || null,
    is_active: true,
  };

  const { data, error } = await supabase
    .from('accounts')
    .insert(accountData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create account: ${error.message}`);
  }

  return data;
}

/**
 * Get account by ID
 */
export async function getAccountById(accountId: string): Promise<Account | null> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', accountId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get account: ${error.message}`);
  }

  return data || null;
}

/**
 * Get all accounts for a user
 */
export async function getAccountsByUserId(userId: string): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    // Include accounts where is_active is true OR null (for backward compatibility)
    .or('is_active.is.true,is_active.is.null')
    .order('display_name', { ascending: true });

  if (error) {
    throw new Error(`Failed to get accounts: ${error.message}`);
  }

  return data || [];
}

/**
 * Find accounts by last 4 digits
 */
export async function findAccountsByLast4(
  userId: string,
  last4: string
): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('account_number_last4', last4)
    .eq('is_active', true);

  if (error) {
    throw new Error(`Failed to find accounts by last4: ${error.message}`);
  }

  return data || [];
}

/**
 * Find account by Plaid account ID
 */
export async function findAccountByPlaidId(
  userId: string,
  plaidAccountId: string
): Promise<Account | null> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('plaid_account_id', plaidAccountId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to find account by Plaid ID: ${error.message}`);
  }

  return data || null;
}

/**
 * Update account with official name (used when statement/Plaid provides official name)
 */
export async function updateAccountWithOfficialName(
  accountId: string,
  officialName: string,
  issuer?: string
): Promise<Account> {
  const updateData: Partial<Account> = {
    official_name: officialName,
  };
  
  if (issuer) {
    updateData.issuer = issuer;
  }

  const { data, error } = await supabase
    .from('accounts')
    .update(updateData)
    .eq('id', accountId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update account: ${error.message}`);
  }

  return data;
}

/**
 * Update account's last 4 digits
 */
export async function updateAccountLast4(
  accountId: string,
  last4: string
): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .update({ account_number_last4: last4 })
    .eq('id', accountId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update account last4: ${error.message}`);
  }

  return data;
}

/**
 * Link Plaid account to unified account
 */
export async function linkPlaidToAccount(
  accountId: string,
  plaidAccountId: string
): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .update({ 
      plaid_account_id: plaidAccountId,
      source: 'plaid' 
    })
    .eq('id', accountId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to link Plaid account: ${error.message}`);
  }

  return data;
}

/**
 * Find potential account matches for a new official name
 * Returns accounts that might match based on last4 or similar names
 */
export async function findPotentialAccountMatches(
  userId: string,
  officialName: string,
  last4?: string
): Promise<{ exact_last4_matches: Account[]; all_accounts: Account[] }> {
  // Get all user accounts
  const allAccounts = await getAccountsByUserId(userId);
  
  // If we have last4, find exact matches
  let exactLast4Matches: Account[] = [];
  if (last4) {
    exactLast4Matches = allAccounts.filter(
      acc => acc.account_number_last4 === last4
    );
  }
  
  return {
    exact_last4_matches: exactLast4Matches,
    all_accounts: allAccounts,
  };
}

// ============================================
// Document Account Assignment Functions
// ============================================

/**
 * Get documents pending account selection
 */
export async function getDocumentsPendingAccountSelection(
  userId: string
): Promise<PendingAccountDocument[]> {
  const { data: documents, error } = await supabase
    .from('documents')
    .select('id, file_name, batch_id, metadata')
    .eq('user_id', userId)
    .eq('pending_account_selection', true)
    .eq('is_dismissed', false)
    .order('uploaded_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get pending documents: ${error.message}`);
  }

  if (!documents || documents.length === 0) {
    return [];
  }

  // Get transaction counts and date ranges for each document
  const result: PendingAccountDocument[] = [];
  
  for (const doc of documents) {
    const { data: txnData, error: txnError } = await supabase
      .from('transactions')
      .select('date')
      .eq('document_id', doc.id)
      .order('date', { ascending: true });

    if (txnError) {
      console.error(`Error getting transactions for doc ${doc.id}:`, txnError);
      continue;
    }

    const transactions = txnData || [];
    const dates = transactions.map(t => t.date).filter(Boolean).sort();

    result.push({
      document_id: doc.id,
      file_name: doc.file_name,
      transaction_count: transactions.length,
      first_transaction_date: dates[0] || undefined,
      last_transaction_date: dates[dates.length - 1] || undefined,
      batch_id: doc.batch_id || undefined,
    });
  }

  return result;
}

/**
 * Assign account to documents and their transactions
 */
export async function assignAccountToDocuments(
  documentIds: string[],
  accountId: string,
  accountDisplayName: string
): Promise<{ documents_updated: number; transactions_updated: number }> {
  if (documentIds.length === 0) {
    return { documents_updated: 0, transactions_updated: 0 };
  }

  // Update documents
  const { error: docError } = await supabase
    .from('documents')
    .update({
      account_name: accountDisplayName,
      pending_account_selection: false,
    })
    .in('id', documentIds);

  if (docError) {
    throw new Error(`Failed to update documents: ${docError.message}`);
  }

  // Update transactions with account_id and account_name
  const { data: txnData, error: txnError } = await supabase
    .from('transactions')
    .update({
      account_id: accountId,
      account_name: accountDisplayName,
    })
    .in('document_id', documentIds)
    .select('id');

  if (txnError) {
    throw new Error(`Failed to update transactions: ${txnError.message}`);
  }

  return {
    documents_updated: documentIds.length,
    transactions_updated: txnData?.length || 0,
  };
}

/**
 * Mark document as pending account selection
 */
export async function markDocumentPendingAccountSelection(
  documentId: string,
  batchId?: string
): Promise<void> {
  const updateData: any = {
    pending_account_selection: true,
    source_type: 'screenshot',
  };
  
  if (batchId) {
    updateData.batch_id = batchId;
  }

  const { error } = await supabase
    .from('documents')
    .update(updateData)
    .eq('id', documentId);

  if (error) {
    throw new Error(`Failed to mark document pending: ${error.message}`);
  }
}

/**
 * Get or create account - creates if doesn't exist, returns existing if found
 */
export async function getOrCreateAccount(
  userId: string,
  input: CreateAccountInput
): Promise<{ account: Account; created: boolean }> {
  // First try to find by display_name
  const { data: existing, error: findError } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('display_name', input.display_name)
    .single();

  if (findError && findError.code !== 'PGRST116') {
    throw new Error(`Failed to find account: ${findError.message}`);
  }

  if (existing) {
    return { account: existing, created: false };
  }

  // Create new account
  const account = await createAccount(userId, input);
  return { account, created: true };
}
