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
  const { error } = await supabase
    .from('transactions')
    .update({ 
      transaction_type: transactionType,
      needs_clarification: false,
      clarification_question: null,
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update transaction type: ${error.message}`);
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
    const monthsAgo = new Date(now);
    monthsAgo.setMonth(now.getMonth() - months);
    startDate = monthsAgo.toISOString().split('T')[0];
  }
  
  // Get all expense transactions in the date range
  let query = supabase
    .from('transactions')
    .select('date, amount, transaction_type')
    .eq('user_id', userId)
    .in('transaction_type', ['expense', 'other'])
    .gte('date', startDate)
    .order('date', { ascending: true });

  if (endDate) {
    query = query.lte('date', endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get spending trend: ${error.message}`);
  }

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
): Promise<Array<{ category: string; total: number; percentage: number; count: number }>> {
  
  let query = supabase
    .from('transactions')
    .select('category, amount, transaction_type, date')
    .eq('user_id', userId)
    .in('transaction_type', ['expense', 'other']);

  if (specificMonth) {
    // Filter for specific month
    const startOfMonth = `${specificMonth}-01`;
    // Calculate end of month
    const [year, month] = specificMonth.split('-').map(Number);
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month
    
    query = query.gte('date', startOfMonth).lte('date', endDate);
  } else {
    // Default: last N months
    const now = new Date();
    const monthsAgo = new Date(now);
    monthsAgo.setMonth(now.getMonth() - months);
    const startDate = monthsAgo.toISOString().split('T')[0];
    
    query = query.gte('date', startDate);
  }
  
  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get category breakdown: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Aggregate by category
  const categoryMap = new Map<string, { total: number; count: number }>();
  let grandTotal = 0;
  
  for (const txn of data) {
    const category = txn.category || 'Uncategorized';
    const absAmount = Math.abs(Number(txn.amount));
    
    const current = categoryMap.get(category) || { total: 0, count: 0 };
    categoryMap.set(category, {
      total: current.total + absAmount,
      count: current.count + 1,
    });
    
    grandTotal += absAmount;
  }
  
  // Convert to array and calculate percentages
  const result = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    total: data.total,
    count: data.count,
    percentage: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0,
  }));
  
  // Sort by total descending
  result.sort((a, b) => b.total - a.total);
  
  return result;
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
    const monthsAgo = new Date(now);
    monthsAgo.setMonth(now.getMonth() - months);
    startDate = monthsAgo.toISOString().split('T')[0];
  }
  
  // Get all transactions in the date range
  let query = supabase
    .from('transactions')
    .select('date, amount, transaction_type')
    .eq('user_id', userId)
    .gte('date', startDate)
    .order('date', { ascending: true });

  if (endDate) {
    query = query.lte('date', endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get income vs expenses: ${error.message}`);
  }

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
