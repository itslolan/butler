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

