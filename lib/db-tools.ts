import { supabase, Document, Transaction, UserMetadata, AccountSnapshot } from './supabase';

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
  console.log('[updateTransactionType] Starting transaction update', {
    transaction_id: id,
    transaction_type: transactionType,
    timestamp: new Date().toISOString(),
  });

  try {
    const { data, error } = await supabase
      .from('transactions')
      .update({ 
        transaction_type: transactionType,
        needs_clarification: false,
        clarification_question: null,
      })
      .eq('id', id)
      .select();

    if (error) {
      console.error('[updateTransactionType] Supabase error:', {
        error_message: error.message,
        error_details: error.details,
        error_hint: error.hint,
        error_code: error.code,
        transaction_id: id,
        transaction_type: transactionType,
        timestamp: new Date().toISOString(),
      });
      throw new Error(`Failed to update transaction type: ${error.message} (code: ${error.code}, details: ${error.details})`);
    }

    console.log('[updateTransactionType] Transaction updated successfully', {
      transaction_id: id,
      transaction_type: transactionType,
      updated_rows: data?.length || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[updateTransactionType] Unexpected error:', {
      error_name: error.name,
      error_message: error.message,
      error_stack: error.stack,
      transaction_id: id,
      transaction_type: transactionType,
      timestamp: new Date().toISOString(),
    });
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
    .eq('needs_clarification', true);

  if (documentId) {
    query = query.eq('document_id', documentId);
  }

  const { data, error } = await query.order('date', { ascending: false });

  if (error) {
    throw new Error(`Failed to get unclarified transactions: ${error.message}`);
  }

  return data || [];
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

  // Fill in missing months with 0 for range
  const result: Array<{ month: string; total: number }> = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(now.getMonth() - i);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    
    result.push({
      month: monthKey,
      total: monthlyMap.get(monthKey) || 0,
    });
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
      // Only update if the month is in our map (handles edge cases where transaction date might be slightly off or logic mismatch)
      // For specificMonth mode, this ensures we only count for that month
      if (current || (!specificMonth && !current)) {
        // If not in map and we are in range mode, we might need to handle it? 
        // But we pre-filled the map, so it should be there if within range.
        // If specificMonth is set, we only care about that key.
        
        // Let's be safe:
        if (!current && specificMonth) continue;
        
        const target = current || monthlyData.get(monthKey) || { income: 0, expenses: 0 };
        if (!current && !specificMonth) monthlyData.set(monthKey, target);

        const absAmount = Math.abs(Number(txn.amount));
        
        if (txn.transaction_type === 'income') {
          target.income += absAmount;
        } else if (txn.transaction_type === 'expense' || txn.transaction_type === 'other') {
          target.expenses += absAmount;
        }
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
