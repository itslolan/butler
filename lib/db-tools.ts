import {
  supabase,
  Document,
  Transaction,
  UserMetadata,
  AccountSnapshot,
  UserMemory,
  Account,
  CreateAccountInput,
  PendingAccountDocument,
  Upload,
  UploadWithStats,
  UploadDetails,
  DocumentWithTransactions,
  ProcessingJob,
  ProcessingJobProgress,
} from './supabase';
import { isUserProvidedIncomeTransaction } from './financial-figure-sources';
import { classifyTransaction } from './transaction-classifier';

/**
 * Extract YYYY-MM month key from a transaction date in a timezone-stable way.
 *
 * IMPORTANT: Do NOT use `new Date('YYYY-MM-DD').getMonth()` for bucketing, because
 * JS parses date-only strings as UTC but `getMonth()` is local-time, which can
 * shift boundary-day transactions into the previous/next month depending on TZ.
 */
function monthKeyFromTxnDate(date: unknown): string | null {
  if (typeof date === 'string') {
    // Fast path for ISO-like strings: "YYYY-MM-DD" or "YYYY-MM-..."
    const m = date.match(/^(\d{4}-\d{2})/);
    if (m?.[1]) return m[1];
  }
  try {
    const d = new Date(date as any);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  } catch {
    return null;
  }
}

function monthKeysBetween(startDateIso: string, endDateIso: string): string[] {
  const parse = (iso: string): { y: number; m: number } | null => {
    const m = iso.match(/^(\d{4})-(\d{2})/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return null;
    return { y, m: mo };
  };

  const s = parse(startDateIso);
  const e = parse(endDateIso);
  if (!s || !e) return [];

  const keys: string[] = [];
  let cur = new Date(Date.UTC(s.y, s.m - 1, 1));
  const endMarker = new Date(Date.UTC(e.y, e.m - 1, 1));

  // Safety cap (20 years) to avoid runaway loops on bad input.
  let guard = 0;
  while (cur <= endMarker && guard++ < 240) {
    keys.push(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}`);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return keys;
}

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

export interface DashboardWelcomeSummaryCache {
  user_id: string;
  summary_text: string;
  model?: string | null;
  generated_at?: string;
  updated_at?: string;
  latest_transaction_at?: string | null;
  date_range_key?: string | null;
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
 * Get cached LLM-generated dashboard welcome summary (if any).
 * Stored in dashboard_welcome_summaries to avoid expensive LLM calls on every load.
 */
export async function getDashboardWelcomeSummaryCache(
  userId: string
): Promise<DashboardWelcomeSummaryCache | null> {
  try {
    const { data, error } = await supabase
      .from('dashboard_welcome_summaries')
      .select('user_id, summary_text, model, generated_at, updated_at, latest_transaction_at, date_range_key')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      // If table isn't migrated yet, fail gracefully.
      if ((error as any).code === '42P01') return null;
      throw new Error(`Failed to get welcome summary cache: ${error.message}`);
    }

    return (data as any) || null;
  } catch (e: any) {
    // Avoid crashing the whole dashboard if cache layer is unavailable.
    console.warn('[getDashboardWelcomeSummaryCache] Falling back to null:', e?.message || e);
    return null;
  }
}

/**
 * Upsert cached LLM-generated dashboard welcome summary.
 * @param latestTransactionAt - The timestamp of the most recent transaction when caching.
 *                              Used to detect when new data has been added and cache should be invalidated.
 * @param dateRangeKey - Identifies the date range selection for date-range aware caching.
 */
export async function upsertDashboardWelcomeSummaryCache(
  userId: string,
  summaryText: string,
  model?: string | null,
  latestTransactionAt?: string | null,
  dateRangeKey?: string | null
): Promise<void> {
  try {
    const { error } = await supabase
      .from('dashboard_welcome_summaries')
      .upsert(
        {
          user_id: userId,
          summary_text: summaryText,
          model: model || null,
          generated_at: new Date().toISOString(),
          latest_transaction_at: latestTransactionAt || null,
          date_range_key: dateRangeKey || null,
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      // If table isn't migrated yet, fail gracefully.
      if ((error as any).code === '42P01') return;
      throw new Error(`Failed to upsert welcome summary cache: ${error.message}`);
    }
  } catch (e: any) {
    console.warn('[upsertDashboardWelcomeSummaryCache] Cache write skipped:', e?.message || e);
  }
}

/**
 * Get the timestamp of the most recently added transaction for a user.
 * Uses `created_at` to track when data was added to the system (not transaction date).
 */
export async function getLatestTransactionTimestamp(
  userId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[getLatestTransactionTimestamp] Query failed:', error.message);
      return null;
    }

    return data?.created_at || null;
  } catch (e: any) {
    console.warn('[getLatestTransactionTimestamp] Error:', e?.message || e);
    return null;
  }
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
    console.log(`[updateTransactionType] Starting update for transaction ${id} to type: ${transactionType}`);
    
    // Get the transaction to retrieve user_id for RLS policy compliance
    const { data: currentTransaction, error: fetchError } = await supabase
      .from('transactions')
      .select('id, user_id, needs_clarification')
      .eq('id', id)
      .single();

    if (fetchError || !currentTransaction) {
      console.error(`[updateTransactionType] Transaction ${id} not found:`, fetchError);
      throw new Error(`Transaction with id ${id} not found`);
    }

    console.log(`[updateTransactionType] Before update - needs_clarification: ${currentTransaction.needs_clarification}`);

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
      console.error(`[updateTransactionType] Update error:`, error);
      throw new Error(`Failed to update transaction type: ${error.message}`);
    }

    if (!data || data.length === 0) {
      console.error(`[updateTransactionType] No data returned after update`);
      throw new Error(`Transaction with id ${id} not found or could not be updated`);
    }

    // Verify that needs_clarification was actually set to false
    const updatedTransaction = data[0];
    console.log(`[updateTransactionType] After update - needs_clarification: ${updatedTransaction.needs_clarification}`);
    
    if (updatedTransaction.needs_clarification !== false) {
      throw new Error(`Update failed: needs_clarification is still ${updatedTransaction.needs_clarification} instead of false`);
    }
    
    console.log(`[updateTransactionType] Successfully updated transaction ${id}`);
  } catch (error) {
    console.error(`[updateTransactionType] Error:`, error);
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
    .eq('needs_clarification', true)
    // Use .or() to match both NULL and false for is_dismissed (handles pre-migration data)
    .or('is_dismissed.is.null,is_dismissed.eq.false');

  if (documentId) {
    query = query.eq('document_id', documentId);
  }

  const { data, error } = await query.order('date', { ascending: false });

  if (error) {
    console.error('[getUnclarifiedTransactions] Query error:', error);
    throw new Error(`Failed to get unclarified transactions: ${error.message}`);
  }

  console.log(`[getUnclarifiedTransactions] Found ${data?.length || 0} unclarified transactions for user ${userId}`);
  
  // Client-side filter to ensure we only return transactions that actually need clarification
  const filtered = (data || []).filter(txn => txn.needs_clarification === true && txn.is_dismissed !== true);
  console.log(`[getUnclarifiedTransactions] After filtering: ${filtered.length} transactions`);
  
  return filtered;
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
    /**
     * Backward-compat: older ingestion paths stored rows without `transaction_type`.
     * When enabled, we include untyped rows that "look like" the requested types
     * using amount sign inference (positive = income, negative = expense/other).
     */
    inferMissingTypesByAmountSign?: boolean;
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
      if (filters.inferMissingTypesByAmountSign) {
        const wantsIncome = filters.transactionTypes.includes('income');
        const wantsExpenseLike = filters.transactionTypes.includes('expense') || filters.transactionTypes.includes('other');

        // If only one "side" is requested, keep the inference tight by amount sign.
        if (wantsIncome && !wantsExpenseLike) {
          query = query.or('transaction_type.eq.income,and(transaction_type.is.null,amount.gt.0)');
        } else if (wantsExpenseLike && !wantsIncome) {
          query = query.or('transaction_type.in.(expense,other),and(transaction_type.is.null,amount.lt.0)');
        } else {
          // Mixed request: include the explicit types plus any untyped rows.
          // (Caller is responsible for classifying by sign downstream.)
          query = query.or(
            `transaction_type.in.(${filters.transactionTypes.join(',')}),transaction_type.is.null`
          );
        }
      } else {
        query = query.in('transaction_type', filters.transactionTypes);
      }
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
  specificMonth?: string,
  dateRange?: { startDate?: string; endDate?: string }
): Promise<Array<{ month: string; total: number }>> {
  let startDate: string;
  let endDate: string | undefined;

  if (specificMonth) {
    startDate = `${specificMonth}-01`;
    const [year, month] = specificMonth.split('-').map(Number);
    endDate = new Date(year, month, 0).toISOString().split('T')[0];
  } else if (dateRange?.startDate || dateRange?.endDate) {
    const now = new Date();
    startDate = dateRange?.startDate || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
    endDate = dateRange?.endDate || now.toISOString().split('T')[0];
  } else {
    const now = new Date();
    const monthsAgo = new Date(now.getFullYear(), now.getMonth() - months, 1);
    startDate = monthsAgo.toISOString().split('T')[0];
    // Set endDate to today to ensure we get all recent data
    endDate = now.toISOString().split('T')[0];
  }
  
  // Get all expense transactions in the date range using pagination
  // Include category for internal transfer detection
  const data = await fetchAllTransactions(userId, {
    transactionTypes: ['expense', 'other'],
    inferMissingTypesByAmountSign: true,
    startDate,
    endDate,
    selectFields: 'id, date, amount, transaction_type, merchant, category',
  });
  
  // DEDUPLICATION TEMPORARILY DISABLED
  // const deduplicatedData = deduplicateTransactions(data);
  // const duplicatesRemoved = data.length - deduplicatedData.length;
  // if (duplicatesRemoved > 0) {
  //   console.log(`[getMonthlySpendingTrend] Removed ${duplicatesRemoved} duplicate transactions`);
  // }
  const deduplicatedData = data; // Using raw data without deduplication

  if (!deduplicatedData || deduplicatedData.length === 0) {
    if (specificMonth) {
      return [{ month: specificMonth, total: 0 }];
    }

    // Return empty months for range
    if (dateRange?.startDate || dateRange?.endDate) {
      const keys = monthKeysBetween(startDate, endDate || startDate);
      return keys.map((m) => ({ month: m, total: 0 }));
    }

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

  // Aggregate by month, using unified classifier to filter out internal transfers
  const monthlyMap = new Map<string, number>();
  
  for (const txn of deduplicatedData) {
    // Use unified classifier to filter out internal transfers
    const classification = classifyTransaction(txn);
    if (classification.isExcluded) continue;
    
    const monthKey = monthKeyFromTxnDate((txn as any).date);
    if (!monthKey) continue;
    const current = monthlyMap.get(monthKey) || 0;
    monthlyMap.set(monthKey, current + classification.absAmount);
  }
  
  if (specificMonth) {
    return [{
      month: specificMonth,
      total: monthlyMap.get(specificMonth) || 0
    }];
  }

  // Initialize result with all months in range first
  if (dateRange?.startDate || dateRange?.endDate) {
    const keys = monthKeysBetween(startDate, endDate || startDate);
    return keys.map((m) => ({ month: m, total: monthlyMap.get(m) || 0 }));
  }

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
/**
 * Deduplicate transactions that appear in overlapping statements
 * Identifies duplicates based on:
 * - Same merchant name (case-insensitive, normalized)
 * - Same or very similar amount (within 0.01 tolerance)
 * - Date within 2 days of each other
 */
function deduplicateTransactions(transactions: any[]): any[] {
  if (transactions.length === 0) return transactions;
  
  // Sort by date, then by amount for consistent processing
  const sorted = [...transactions].sort((a, b) => {
    const dateCompare = (a.date || '').localeCompare(b.date || '');
    if (dateCompare !== 0) return dateCompare;
    return Math.abs(Number(a.amount)) - Math.abs(Number(b.amount));
  });
  
  const seen = new Set<string>();
  const deduplicated: any[] = [];
  
  for (const txn of sorted) {
    // Create a normalized signature for duplicate detection
    const merchant = (txn.merchant || '').toLowerCase().trim();
    const amount = Math.abs(Number(txn.amount)).toFixed(2);
    const date = txn.date || '';
    
    // Check if we've seen a similar transaction recently
    let isDuplicate = false;
    
    for (const seenTxn of deduplicated) {
      const seenMerchant = (seenTxn.merchant || '').toLowerCase().trim();
      const seenAmount = Math.abs(Number(seenTxn.amount)).toFixed(2);
      const seenDate = seenTxn.date || '';
      
      // Check if merchants match (exact or very similar)
      const merchantMatch = merchant && seenMerchant && (
        merchant === seenMerchant ||
        merchant.includes(seenMerchant) ||
        seenMerchant.includes(merchant)
      );
      
      // Check if amounts match (exact)
      const amountMatch = amount === seenAmount;
      
      // Check if dates are within 2 days
      const daysDiff = date && seenDate ? 
        Math.abs(new Date(date).getTime() - new Date(seenDate).getTime()) / (1000 * 60 * 60 * 24) :
        999;
      const dateMatch = daysDiff <= 2;
      
      if (merchantMatch && amountMatch && dateMatch) {
        isDuplicate = true;
        console.log(`[deduplicateTransactions] Duplicate found: ${merchant} $${amount} on ${date} (matches ${seenDate})`);
        break;
      }
    }
    
    if (!isDuplicate) {
      deduplicated.push(txn);
    }
  }
  
  return deduplicated;
}

export async function getCategoryBreakdown(
  userId: string,
  months: number = 6,
  specificMonth?: string, // Optional: 'YYYY-MM'
  dateRange?: { startDate?: string; endDate?: string }
): Promise<Array<{ category: string; total: number; percentage: number; count: number; spend_classification?: string | null }>> {
  
  let startDate: string;
  let endDate: string | undefined;

  if (specificMonth) {
    // Filter for specific month
    startDate = `${specificMonth}-01`;
    // Calculate end of month
    const [year, month] = specificMonth.split('-').map(Number);
    endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month
    console.log(`[getCategoryBreakdown] Using specific month: ${specificMonth}, dates: ${startDate} to ${endDate}, userId: ${userId}`);
  } else if (dateRange?.startDate || dateRange?.endDate) {
    const now = new Date();
    startDate = dateRange?.startDate || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
    endDate = dateRange?.endDate || now.toISOString().split('T')[0];
    console.log(`[getCategoryBreakdown] Using custom range: ${startDate} to ${endDate}, userId: ${userId}`);
  } else {
    // Default: last N months - start from the 1st of the month N months ago
    const now = new Date();
    const monthsAgo = new Date(now.getFullYear(), now.getMonth() - months, 1);
    startDate = monthsAgo.toISOString().split('T')[0];
    console.log(`[getCategoryBreakdown] Using months range: ${months}, startDate: ${startDate}, userId: ${userId}`);
  }
  
  // Get all transactions using pagination
  const data = await fetchAllTransactions(userId, {
    transactionTypes: ['expense', 'other'],
    inferMissingTypesByAmountSign: true,
    startDate,
    endDate,
    selectFields: 'id, category, amount, transaction_type, date, spend_classification, merchant',
  });

  if (!data || data.length === 0) {
    return [];
  }

  // DEDUPLICATION TEMPORARILY DISABLED
  // const deduplicatedData = deduplicateTransactions(data);
  // const duplicatesRemoved = data.length - deduplicatedData.length;
  // if (duplicatesRemoved > 0) {
  //   console.log(`[getCategoryBreakdown] Removed ${duplicatesRemoved} duplicate transactions`);
  // }
  const deduplicatedData = data; // Using raw data without deduplication

  // Aggregate by category, using unified classifier to filter out internal transfers
  const categoryMap = new Map<string, { total: number; count: number; spend_classification?: string | null }>();
  let grandTotal = 0;
  
  for (const txn of deduplicatedData) {
    // Use unified classifier to filter out internal transfers
    const classification = classifyTransaction(txn);
    if (classification.isExcluded) continue;
    
    const category = txn.category || 'Uncategorized';
    
    const current = categoryMap.get(category) || { total: 0, count: 0, spend_classification: txn.spend_classification };
    categoryMap.set(category, {
      total: current.total + classification.absAmount,
      count: current.count + 1,
      spend_classification: current.spend_classification || txn.spend_classification, // Use first non-null value
    });
    
    grandTotal += classification.absAmount;
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
  specificMonth?: string,
  dateRange?: { startDate?: string; endDate?: string }
): Promise<Array<{ month: string; income: number; expenses: number }>> {
  let startDate: string;
  let endDate: string | undefined;

  if (specificMonth) {
    startDate = `${specificMonth}-01`;
    const [year, month] = specificMonth.split('-').map(Number);
    endDate = new Date(year, month, 0).toISOString().split('T')[0];
  } else if (dateRange?.startDate || dateRange?.endDate) {
    const now = new Date();
    startDate = dateRange?.startDate || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
    endDate = dateRange?.endDate || now.toISOString().split('T')[0];
  } else {
    const now = new Date();
    const monthsAgo = new Date(now.getFullYear(), now.getMonth() - months, 1);
    startDate = monthsAgo.toISOString().split('T')[0];
    // Set endDate to today to ensure we get all recent data
    endDate = now.toISOString().split('T')[0];
  }
  
  // Get all transactions in the date range using pagination
  // Include category for internal transfer detection
  const data = await fetchAllTransactions(userId, {
    startDate,
    endDate,
    selectFields: 'id, date, amount, transaction_type, merchant, category',
  });
  
  // DEDUPLICATION TEMPORARILY DISABLED
  // const deduplicatedData = deduplicateTransactions(data);
  // const duplicatesRemoved = data.length - deduplicatedData.length;
  // if (duplicatesRemoved > 0) {
  //   console.log(`[getIncomeVsExpenses] Removed ${duplicatesRemoved} duplicate transactions`);
  // }
  const deduplicatedData = data; // Using raw data without deduplication

  // Initialize monthly data
  const monthlyData = new Map<string, { income: number; expenses: number }>();
  
  if (specificMonth) {
    monthlyData.set(specificMonth, { income: 0, expenses: 0 });
  } else if (dateRange?.startDate || dateRange?.endDate) {
    const keys = monthKeysBetween(startDate, endDate || startDate);
    for (const k of keys) {
      monthlyData.set(k, { income: 0, expenses: 0 });
    }
  } else {
    const now = new Date();
    // Fill in all months first with zeros for range
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(now.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyData.set(monthKey, { income: 0, expenses: 0 });
    }
  }

  if (deduplicatedData && deduplicatedData.length > 0) {
    // Aggregate transactions using unified classifier
    for (const txn of deduplicatedData) {
      // Exclude synthetic "user provided" income rows from derived charts/metrics.
      if (isUserProvidedIncomeTransaction(txn as any)) continue;

      // For a specific month query, everything we fetched is already in-range,
      // so bucket directly into that month to avoid timezone bucketing issues.
      const monthKey = specificMonth || monthKeyFromTxnDate((txn as any).date);
      if (!monthKey) continue;
      
      // Use unified classifier for consistent classification
      const classification = classifyTransaction(txn);
      
      // Skip transfers and excluded transactions
      if (classification.isExcluded) continue;
      
      const current = monthlyData.get(monthKey);
      
      // If month is in our pre-filled map, update it
      if (current) {
        if (classification.type === 'income') {
          current.income += classification.absAmount;
        } else if (classification.type === 'expense') {
          current.expenses += classification.absAmount;
        }
      } else if (!specificMonth) {
        // If not in map and we're in range mode, add it (edge case for data outside expected range)
        const newEntry = { income: 0, expenses: 0 };

        if (classification.type === 'income') {
          newEntry.income = classification.absAmount;
        } else if (classification.type === 'expense') {
          newEntry.expenses = classification.absAmount;
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
 * Get cash flow sankey data for a user
 * Returns nodes and links for income -> total -> expenses/savings
 */
export async function getCashFlowSankeyData(
  userId: string,
  months: number = 6,
  specificMonth?: string,
  dateRange?: { startDate?: string; endDate?: string }
): Promise<{ nodes: any[]; links: any[] }> {
  let startDate: string;
  let endDate: string | undefined;

  if (specificMonth) {
    startDate = `${specificMonth}-01`;
    const [year, month] = specificMonth.split('-').map(Number);
    endDate = new Date(year, month, 0).toISOString().split('T')[0];
  } else if (dateRange?.startDate || dateRange?.endDate) {
    const now = new Date();
    startDate = dateRange?.startDate || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
    endDate = dateRange?.endDate || now.toISOString().split('T')[0];
  } else {
    const now = new Date();
    const monthsAgo = new Date(now.getFullYear(), now.getMonth() - months, 1);
    startDate = monthsAgo.toISOString().split('T')[0];
    endDate = now.toISOString().split('T')[0];
  }
  
  // Get ALL transactions
  const data = await fetchAllTransactions(userId, {
    startDate,
    endDate,
    selectFields: 'id, category, merchant, amount, transaction_type, date',
  });
  
  // DEDUPLICATION TEMPORARILY DISABLED
  // const deduplicatedData = deduplicateTransactions(data);
  // const duplicatesRemoved = data.length - deduplicatedData.length;
  // if (duplicatesRemoved > 0) {
  //   console.log(`[getCashFlowSankeyData] Removed ${duplicatesRemoved} duplicate transactions`);
  // }
  const deduplicatedData = data; // Using raw data without deduplication

  if (!deduplicatedData || deduplicatedData.length === 0) {
    return { nodes: [], links: [] };
  }

  // 1. Process Income
  const incomeSources = new Map<string, number>();
  let sankeyTotalIncome = 0;
  
  // 2. Process Expenses
  const expenseCategories = new Map<string, number>();
  let sankeyTotalExpenses = 0;

  for (const txn of deduplicatedData) {
    // Exclude synthetic "user provided" income rows from derived charts/metrics.
    if (isUserProvidedIncomeTransaction(txn as any)) continue;

    // Use unified classifier for consistent classification
    const classification = classifyTransaction(txn);
    
    // Skip transfers and excluded transactions
    if (classification.isExcluded) continue;

    if (classification.type === 'income') {
      sankeyTotalIncome += classification.absAmount;
      
      // Group by category if available (e.g. "Paycheck"), otherwise merchant
      // If neither, "Other Income"
      let sourceName = txn.category || txn.merchant || 'Other Income';
      // Clean up common names
      if (sourceName.toLowerCase().includes('payroll') || sourceName.toLowerCase().includes('salary')) {
        sourceName = 'Paychecks';
      } else if (sourceName.toLowerCase().includes('interest')) {
        sourceName = 'Interest';
      }
      
      incomeSources.set(sourceName, (incomeSources.get(sourceName) || 0) + classification.absAmount);
    } else if (classification.type === 'expense') {
      sankeyTotalExpenses += classification.absAmount;
      
      const category = txn.category || 'Uncategorized';
      expenseCategories.set(category, (expenseCategories.get(category) || 0) + classification.absAmount);
    }
  }

  // Use the Sankey's own totals for calculating savings/overspend
  // This ensures visual consistency: what you see is what you get
  const totalIncome = sankeyTotalIncome;
  const totalExpenses = sankeyTotalExpenses;
  
  // Calculate surplus and deficit from the actual income/expense shown in visual
  const savings = Math.max(0, totalIncome - totalExpenses);
  const overspend = Math.max(0, totalExpenses - totalIncome);
  
  // Build Nodes and Links for 3-stage flow:
  // Stage 0 (left): Income sources + Overspend (if deficit)
  // Stage 1 (middle): Total Expenses
  // Stage 2 (right): Expense categories + Savings (if surplus)
  const nodes: Array<{ name: string; color?: string; depth?: number; value?: number; rank?: number }> = [];
  const links: Array<{ source: number; target: number; value: number; color?: string }> = [];

  // --- Stage 0: Income Sources (left) ---
  // Show ALL income sources (no grouping), sorted by amount
  const sortedIncome = Array.from(incomeSources.entries()).sort((a, b) => b[1] - a[1]);
  const incomeNodesStartIdx = 0;
  
  // Add all income source nodes
  sortedIncome.forEach(([name, val]) => {
    nodes.push({ name, color: '#0891b2', depth: 0 }); // Cyan-600 for income sources
  });

  // Add Overspend node if deficit (red shading)
  let overspendNodeIdx = -1;
  if (overspend > 0) {
    overspendNodeIdx = nodes.length;
    nodes.push({ name: 'Overspend', color: '#fca5a5', depth: 0 }); // Red-300 (light red) for overspend node
  }

  // --- Stage 1: Total Expenses (middle) ---
  const totalExpensesNodeIdx = nodes.length;
  nodes.push({ name: 'Total Expenses', color: '#f59e0b', depth: 1 }); // Amber-500 for total expenses

  // --- Stage 2: Expense Categories + Savings (right) ---
  
  const sortedExpenses = Array.from(expenseCategories.entries()).sort((a, b) => b[1] - a[1]);
  
  // Limit to top 7 categories, group rest into "Across X categories"
  const MAX_EXPENSE_NODES = 7;
  let expensesToShow = sortedExpenses;
  let otherExpensesTotal = 0;
  let otherExpensesCount = 0;

  if (sortedExpenses.length > MAX_EXPENSE_NODES) {
    expensesToShow = sortedExpenses.slice(0, MAX_EXPENSE_NODES);
    const remainingCategories = sortedExpenses.slice(MAX_EXPENSE_NODES);
    otherExpensesTotal = remainingCategories.reduce((sum, item) => sum + item[1], 0);
    otherExpensesCount = remainingCategories.length;
  }
  
  // Color palette for expenses - vibrant and distinct colors
  const expenseColors = [
    '#6366f1', // Indigo-500
    '#8b5cf6', // Violet-500
    '#ec4899', // Pink-500
    '#f43f5e', // Rose-500 
    '#f97316', // Orange-500
    '#eab308', // Yellow-500
    '#84cc16', // Lime-500
    '#06b6d4', // Cyan-500
    '#14b8a6', // Teal-500
    '#a855f7', // Purple-500
  ];

  // Build a combined list of all right-side items (top categories + grouped others + savings)
  const rightSideItems: Array<{ name: string; value: number; color: string; isSavings?: boolean; rank?: number }> = [];
  
  // Add top expense categories
  expensesToShow.forEach(([name, val], idx) => {
    rightSideItems.push({
      name,
      value: val,
      color: expenseColors[idx % expenseColors.length],
    });
  });

  // Add "Across X categories" if there are more categories
  if (otherExpensesTotal > 0) {
    rightSideItems.push({
      name: `Across ${otherExpensesCount} categories`,
      value: otherExpensesTotal,
      color: '#94a3b8', // Slate-400
    });
  }

  // Add Savings if there's actual savings (treated like any other category, sorted by value)
  let savingsNodeIdx = -1;
  if (savings > 0) {
    rightSideItems.push({
      name: 'Savings',
      value: savings,
      color: '#10b981', // Emerald-500 for savings
      isSavings: true,
    });
  }
  
  // Sort all right-side items by value (largest first) and assign ranks
  rightSideItems.sort((a, b) => b.value - a.value);
  rightSideItems.forEach((item, idx) => {
    item.rank = idx; // 0 = largest, 1 = second largest, etc.
  });
  
  // Add nodes and track Savings index
  const rightNodesStartIdx = nodes.length;
  rightSideItems.forEach((item) => {
    if (item.isSavings) {
      savingsNodeIdx = nodes.length;
    }
    // Include rank in node for label visibility logic
    nodes.push({ name: item.name, color: item.color, depth: 2, value: item.value, rank: item.rank });
  });

  // --- Create Links ---
  
  // Links: Income sources -> Total Expenses (and optionally -> Savings if surplus)
  if (savings > 0 && totalIncome > 0) {
    // Surplus case: split each income source proportionally between Total Expenses and Savings
    sortedIncome.forEach(([name, val], idx) => {
      const toExpenses = val * (totalExpenses / totalIncome);
      const toSavings = val - toExpenses;
      
      // Link: Income source -> Total Expenses
      links.push({
        source: incomeNodesStartIdx + idx,
        target: totalExpensesNodeIdx,
        value: toExpenses,
        color: '#99f6e460' // Teal-200 semi-transparent
      });
      
      // Link: Income source -> Savings
      if (toSavings > 0) {
        links.push({
          source: incomeNodesStartIdx + idx,
          target: savingsNodeIdx,
          value: toSavings,
          color: '#a7f3d060' // Emerald-300 semi-transparent
        });
      }
    });
  } else {
    // No savings (or deficit): all income goes directly to Total Expenses
    sortedIncome.forEach(([name, val], idx) => {
      links.push({
        source: incomeNodesStartIdx + idx,
        target: totalExpensesNodeIdx,
        value: val,
        color: '#99f6e460' // Teal-200 semi-transparent
      });
    });
  }

  // Link: Overspend -> Total Expenses (if deficit)
  if (overspendNodeIdx >= 0 && overspend > 0) {
    links.push({
      source: overspendNodeIdx,
      target: totalExpensesNodeIdx,
      value: overspend,
      color: '#fca5a560' // Red-300 semi-transparent
    });
  }

  // Links: Total Expenses -> Right-side nodes (expense categories and Other Expenses, but NOT Savings)
  // Savings gets direct links from income sources, not from Total Expenses
  rightSideItems.forEach((item, idx) => {
    // Skip Savings - it's linked directly from income sources
    if (item.isSavings) return;
    
    const nodeIdx = rightNodesStartIdx + idx;
    
    links.push({
      source: totalExpensesNodeIdx,
      target: nodeIdx,
      value: item.value,
      color: item.color + '60' // More transparent for softer look
    });
  });

  return { nodes, links };
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
    // Include accounts where is_active is not explicitly false
    .neq('is_active', false)
    .order('display_name', { ascending: true });

  if (error) {
    console.error(`[getAccountsByUserId] Error for userId ${userId}:`, error.message);
    throw new Error(`Failed to get accounts: ${error.message}`);
  }

  console.log(`[getAccountsByUserId] Found ${data?.length || 0} accounts for userId ${userId}`);
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
    // Use .or() to match both NULL and false for is_dismissed (handles pre-migration data)
    .or('is_dismissed.is.null,is_dismissed.eq.false')
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

// ============================================================================
// UPLOADS MANAGEMENT
// ============================================================================

/**
 * Create a new upload record
 * Call this BEFORE processing files to get an upload_id
 */
export async function createUpload(
  userId: string,
  uploadName: string,
  sourceType: Upload['source_type'] = 'manual_upload'
): Promise<Upload> {
  const { data, error } = await supabase
    .from('uploads')
    .insert({
      user_id: userId,
      upload_name: uploadName,
      source_type: sourceType,
      status: 'processing',
      uploaded_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create upload: ${error.message}`);
  }

  return data;
}

/**
 * Update upload status
 */
export async function updateUploadStatus(
  uploadId: string,
  status: Upload['status']
): Promise<void> {
  const { error } = await supabase
    .from('uploads')
    .update({ status })
    .eq('id', uploadId);

  if (error) {
    throw new Error(`Failed to update upload status: ${error.message}`);
  }
}

// ============================================================================
// BACKGROUND PROCESSING JOBS
// ============================================================================

export async function createProcessingJob(input: Omit<ProcessingJob, 'id' | 'created_at' | 'started_at' | 'completed_at'>): Promise<ProcessingJob> {
  const { data, error } = await supabase
    .from('processing_jobs')
    .insert({
      user_id: input.user_id,
      upload_id: input.upload_id ?? null,
      bucket: input.bucket,
      file_path: input.file_path,
      file_name: input.file_name,
      status: input.status,
      priority: input.priority ?? 0,
      attempts: input.attempts ?? 0,
      max_attempts: input.max_attempts ?? 3,
      progress: input.progress ?? {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create processing job: ${error.message}`);
  }

  return data;
}

export async function getJobsByUploadId(uploadId: string): Promise<ProcessingJob[]> {
  const { data, error } = await supabase
    .from('processing_jobs')
    .select('*')
    .eq('upload_id', uploadId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch jobs: ${error.message}`);
  }

  return data || [];
}

export async function getJobsByIds(jobIds: string[]): Promise<ProcessingJob[]> {
  if (jobIds.length === 0) return [];

  const { data, error } = await supabase
    .from('processing_jobs')
    .select('*')
    .in('id', jobIds);

  if (error) {
    throw new Error(`Failed to fetch jobs: ${error.message}`);
  }

  return data || [];
}

export async function updateJobProgress(jobId: string, progress: ProcessingJobProgress): Promise<void> {
  const { error } = await supabase
    .from('processing_jobs')
    .update({
      progress,
    })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to update job progress: ${error.message}`);
  }
}

export async function completeJob(jobId: string, result: Record<string, any>): Promise<void> {
  const { error } = await supabase
    .from('processing_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      progress: { step: 'complete', percent: 100, message: 'Completed' },
      result,
      error_message: null,
    })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to complete job: ${error.message}`);
  }
}

export async function failJob(jobId: string, errorMessage: string): Promise<void> {
  const { error } = await supabase
    .from('processing_jobs')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
      progress: {
        step: 'failed',
        percent: 100,
        message: `Failed: ${errorMessage}`,
      },
    })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to fail job: ${error.message}`);
  }
}

export async function claimNextPendingJob(workerId: string): Promise<ProcessingJob | null> {
  const { data, error } = await supabase
    .rpc('claim_next_job', { worker_id: workerId });

  if (error) {
    throw new Error(`Failed to claim next job: ${error.message}`);
  }

  // When there are no rows, PostgREST returns null
  return (data as any) || null;
}

export async function updateUploadStatusFromJobs(uploadId: string): Promise<void> {
  const { data, error } = await supabase
    .from('processing_jobs')
    .select('status')
    .eq('upload_id', uploadId);

  if (error) {
    throw new Error(`Failed to fetch job statuses: ${error.message}`);
  }

  const statuses = (data || []).map((r: any) => r.status as string);
  if (statuses.length === 0) return;

  if (statuses.some(s => s === 'processing' || s === 'pending')) {
    await updateUploadStatus(uploadId, 'processing');
    return;
  }

  if (statuses.every(s => s === 'completed')) {
    await updateUploadStatus(uploadId, 'completed');
    return;
  }

  // Mixed completed/failed OR all failed => failed
  await updateUploadStatus(uploadId, 'failed');
}

/**
 * Get all uploads for a user with document counts and transaction counts
 */
export async function getUploadsForUser(userId: string): Promise<UploadWithStats[]> {
  // Get all uploads for user
  const { data: uploads, error: uploadsError } = await supabase
    .from('uploads')
    .select('*')
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false });

  if (uploadsError) {
    throw new Error(`Failed to fetch uploads: ${uploadsError.message}`);
  }

  if (!uploads || uploads.length === 0) {
    return [];
  }

  // Get document counts and info for each upload
  const uploadIds = uploads.map(u => u.id);
  
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('id, upload_id, file_name, document_type')
    .in('upload_id', uploadIds);

  if (docsError) {
    throw new Error(`Failed to fetch documents: ${docsError.message}`);
  }

  // Get transaction counts per document
  const docIds = (documents || []).map(d => d.id);
  
  let transactionCounts: Record<string, number> = {};
  if (docIds.length > 0) {
    const { data: txnCounts, error: txnError } = await supabase
      .from('transactions')
      .select('document_id')
      .in('document_id', docIds);

    if (txnError) {
      console.error('Failed to fetch transaction counts:', txnError.message);
    } else {
      // Count transactions per document
      (txnCounts || []).forEach(t => {
        if (t.document_id) {
          transactionCounts[t.document_id] = (transactionCounts[t.document_id] || 0) + 1;
        }
      });
    }
  }

  // Build upload stats
  const uploadsWithStats: UploadWithStats[] = uploads.map(upload => {
    const uploadDocs = (documents || []).filter(d => d.upload_id === upload.id);
    const docSummaries = uploadDocs.map(d => ({
      id: d.id,
      file_name: d.file_name,
      document_type: d.document_type || 'unknown',
      transaction_count: transactionCounts[d.id] || 0,
    }));
    
    const totalTransactions = docSummaries.reduce((sum, d) => sum + (d.transaction_count || 0), 0);

    return {
      ...upload,
      document_count: uploadDocs.length,
      total_transactions: totalTransactions,
      documents: docSummaries,
    };
  });

  return uploadsWithStats;
}

/**
 * Get single upload with all documents and their transactions
 */
export async function getUploadDetails(
  uploadId: string,
  userId: string
): Promise<UploadDetails | null> {
  // Get the upload
  const { data: upload, error: uploadError } = await supabase
    .from('uploads')
    .select('*')
    .eq('id', uploadId)
    .eq('user_id', userId)
    .single();

  if (uploadError) {
    if (uploadError.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch upload: ${uploadError.message}`);
  }

  // Get all documents for this upload
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('id, file_name, file_url, document_type, source_type')
    .eq('upload_id', uploadId)
    .order('created_at', { ascending: true });

  if (docsError) {
    throw new Error(`Failed to fetch documents: ${docsError.message}`);
  }

  // Get transactions for all documents
  const docIds = (documents || []).map(d => d.id);
  
  let transactions: Transaction[] = [];
  if (docIds.length > 0) {
    const { data: txns, error: txnError } = await supabase
      .from('transactions')
      .select('*')
      .in('document_id', docIds)
      .order('date', { ascending: false });

    if (txnError) {
      console.error('Failed to fetch transactions:', txnError.message);
    } else {
      transactions = txns || [];
    }
  }

  // Build documents with transactions
  const documentsWithTransactions: DocumentWithTransactions[] = (documents || []).map(doc => ({
    id: doc.id,
    file_name: doc.file_name,
    file_url: doc.file_url,
    document_type: doc.document_type || 'unknown',
    source_type: doc.source_type,
    transactions: transactions.filter(t => t.document_id === doc.id),
  }));

  return {
    upload,
    documents: documentsWithTransactions,
  };
}

/**
 * Get transactions for a specific document
 */
export async function getTransactionsByDocumentId(
  documentId: string
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('document_id', documentId)
    .order('date', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch transactions: ${error.message}`);
  }

  return data || [];
}

/**
 * Delete an upload and all associated data
 * Documents and transactions will cascade delete via FK constraints
 * Also deletes files from Supabase Storage
 */
export async function deleteUpload(
  uploadId: string,
  userId: string
): Promise<{ deletedDocuments: number; deletedTransactions: number }> {
  // Fetch any queued/processing jobs for this upload (these may exist even if no documents were created yet)
  const { data: jobs, error: jobsError } = await supabase
    .from('processing_jobs')
    .select('id, bucket, file_path')
    .eq('upload_id', uploadId);

  if (jobsError) {
    // Don't hard-fail deletion if jobs table isn't present (backwards compatibility)
    console.error('[deleteUpload] Failed to fetch processing jobs:', jobsError.message);
  }

  // First get all documents to delete their storage files
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('id, file_url')
    .eq('upload_id', uploadId);

  if (docsError) {
    throw new Error(`Failed to fetch documents for deletion: ${docsError.message}`);
  }

  // Count transactions that will be deleted
  const docIds = (documents || []).map(d => d.id);
  let transactionCount = 0;
  
  if (docIds.length > 0) {
    const { count, error: countError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .in('document_id', docIds);

    if (!countError) {
      transactionCount = count || 0;
    }
  }

  // IMPORTANT: account_snapshots references documents(document_id) without cascading,
  // so we must delete snapshots first to avoid FK violations.
  if (docIds.length > 0) {
    const { error: snapshotsError } = await supabase
      .from('account_snapshots')
      .delete()
      .in('document_id', docIds);

    if (snapshotsError) {
      throw new Error(`Failed to delete account snapshots: ${snapshotsError.message}`);
    }
  }

  // Delete files from storage
  for (const doc of documents || []) {
    if (doc.file_url) {
      try {
        // Extract path from Supabase URL
        const url = new URL(doc.file_url);
        const pathname = decodeURIComponent(url.pathname);
        const prefixes = [
          '/storage/v1/object/public/statements/',
          '/storage/v1/object/statements/',
          '/storage/v1/object/sign/statements/',
        ];
        for (const prefix of prefixes) {
          if (pathname.startsWith(prefix)) {
            const filePath = pathname.slice(prefix.length).replace(/^\/+/, '');
            if (filePath) {
              await supabase.storage.from('statements').remove([filePath]);
            }
            break;
          }
        }
      } catch (err) {
        console.error(`Failed to delete storage file: ${doc.file_url}`, err);
        // Continue with deletion even if storage cleanup fails
      }
    }
  }

  // Delete any job-uploaded storage objects (pending files) too
  for (const job of jobs || []) {
    const bucket = (job as any).bucket || 'statements';
    const filePath = (job as any).file_path;
    if (!filePath) continue;
    try {
      await supabase.storage.from(bucket).remove([filePath]);
    } catch (err) {
      console.error(`[deleteUpload] Failed to delete job storage file: ${bucket}/${filePath}`, err);
    }
  }

  // Delete processing jobs explicitly (they also cascade when upload is deleted, but do it here to clean status fast)
  if ((jobs || []).length > 0) {
    const { error: deleteJobsError } = await supabase
      .from('processing_jobs')
      .delete()
      .eq('upload_id', uploadId);
    if (deleteJobsError) {
      console.error('[deleteUpload] Failed to delete processing jobs:', deleteJobsError.message);
    }
  }

  // Delete the upload (documents and transactions will cascade delete)
  const { error: deleteError } = await supabase
    .from('uploads')
    .delete()
    .eq('id', uploadId)
    .eq('user_id', userId);

  if (deleteError) {
    throw new Error(`Failed to delete upload: ${deleteError.message}`);
  }

  return {
    deletedDocuments: documents?.length || 0,
    deletedTransactions: transactionCount,
  };
}

/**
 * Generate an upload name based on current timestamp
 */
export function generateUploadName(): string {
  const now = new Date();
  return `Upload ${now.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })}`;
}

