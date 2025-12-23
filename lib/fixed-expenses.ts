import { supabase } from '@/lib/supabase';
import { createMerchantSummaries, MerchantSummary } from './merchant-summarizer';
import { classifyAllMerchantsWithLLM, LLMClassification } from './llm-fixed-expense-classifier';
import { matchSubscriptionPattern } from './subscription-merchant-patterns';
import { tagSubscriptionsWithLLM } from './llm-subscription-tagger';
import { getAllMemories } from './db-tools';

export interface FixedExpense {
  merchant_name: string;
  median_amount: number; // Monthly amount
  occurrence_count: number;
  months_tracked: number;
  avg_day_of_month: number;
  last_occurrence_date: string;
  is_maybe?: boolean; // True if this is a "maybe" classification that needs user confirmation
  is_subscription?: boolean; // True if subscription service (LLM tag)
  merchant_key?: string; // Normalized merchant key for memory storage
  // Internal fields for tracking (not shown in UI)
  _classification_source?: 'rule' | 'llm' | 'llm_maybe' | 'rule_fallback';
  _combined_score?: number;
}

export interface FixedExpensesResponse {
  total: number;
  expenses: FixedExpense[];
  subscription_candidates?: FixedExpense[]; // short-history subscriptions (optional)
  calculated_at: string;
  from_cache: boolean;
}

// Internal type for tracking classification stats
interface ClassificationStats {
  total_merchants: number;
  llm_accepted: number;
  llm_rejected: number;
  llm_maybe_accepted: number;
  processing_time_ms: number;
}

/**
 * Calculate median value from an array of numbers
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Create a FixedExpense object from a merchant summary and LLM classification
 */
function createFixedExpense(
  summary: MerchantSummary,
  classification: LLMClassification
): FixedExpense {
  // Calculate median amount
  const amounts = summary.sample_transactions.map(t => t.amount);
  
  // Estimate monthly amount
  // If median interval is ~30 days, use median amount
  // If bi-weekly (~14 days), double it
  // If quarterly (~90 days), divide by 3
  let monthlyAmount = median(amounts);
  if (summary.stats.median_interval_days >= 12 && summary.stats.median_interval_days <= 16) {
    // Bi-weekly
    monthlyAmount = monthlyAmount * 2;
  } else if (summary.stats.median_interval_days >= 85 && summary.stats.median_interval_days <= 95) {
    // Quarterly
    monthlyAmount = monthlyAmount / 3;
  }
  
  // Extract average day of month from day_concentration string
  const dayMatch = summary.stats.day_concentration.match(/day (\d+)/);
  const avgDay = dayMatch ? parseInt(dayMatch[1]) : 1;
  
  return {
    merchant_name: summary.original_name,
    median_amount: Math.round(monthlyAmount * 100) / 100,
    occurrence_count: summary.stats.count,
    months_tracked: summary.unique_months,
    avg_day_of_month: avgDay,
    last_occurrence_date: summary.last_date,
    is_maybe: classification.label === 'maybe',
    merchant_key: summary.merchant_key,
    _classification_source: classification.label as 'rule' | 'llm' | 'llm_maybe' | 'rule_fallback',
    _combined_score: Math.round(classification.llm_reasoning_score * 100) / 100,
  };
}

/**
 * Fetch all expense transactions with pagination to avoid memory issues
 */
async function fetchAllExpenseTransactions(
  userId: string
): Promise<Array<{ merchant: string; amount: number; date: string; description: string | null; transaction_type: string }>> {
  const PAGE_SIZE = 1000;
  let allData: Array<{ merchant: string; amount: number; date: string; description: string | null; transaction_type: string }> = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('transactions')
      .select('merchant, amount, date, description, transaction_type')
      .eq('user_id', userId)
      .in('transaction_type', ['expense', 'other'])
      .order('date', { ascending: true })
      .range(from, to);

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

function buildSubscriptionCandidates(
  txns: Array<{ merchant: string; amount: number; date: string; description: string | null; transaction_type: string }>
): FixedExpense[] {
  // Look at recent transactions only (catch new subscriptions)
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 45);

  const recent = txns.filter(t => new Date(t.date).getTime() >= cutoff.getTime());

  // Group by merchant string (keep it simple; normalize can over-group for billing)
  type Txn = (typeof recent)[number];
  const groups = new Map<string, Txn[]>();
  for (const t of recent) {
    const key = (t.merchant || '').trim();
    if (!key) continue;

    const text = `${t.merchant} ${t.description || ''}`.toLowerCase();
    const matched = matchSubscriptionPattern(text);
    if (!matched) continue;

    const existing = groups.get(key);
    if (existing) existing.push(t);
    else groups.set(key, [t]);
  }

  const candidates: FixedExpense[] = [];
  for (const [merchantName, items] of groups.entries()) {
    // Require at least 1 occurrence (by definition), but prefer >=2 to reduce noise
    const occurrence = items.length;
    if (occurrence < 1) continue;

    const amounts = items.map(i => Math.abs(Number(i.amount)));
    const medianAmt = amounts.sort((a, b) => a - b)[Math.floor(amounts.length / 2)] || 0;

    const last = items.reduce(
      (max, t) => (new Date(t.date).getTime() > new Date(max.date).getTime() ? t : max),
      items[0]
    );
    const lastDate = new Date(last.date).toISOString().split('T')[0];
    const avgDay = new Date(last.date).getUTCDate();

    candidates.push({
      merchant_name: merchantName,
      median_amount: Math.round(medianAmt * 100) / 100,
      occurrence_count: occurrence,
      months_tracked: 1,
      avg_day_of_month: avgDay,
      last_occurrence_date: lastDate,
      is_maybe: true,
      is_subscription: true,
      _classification_source: 'rule_fallback',
      _combined_score: 0.5,
    });
  }

  // Sort by amount
  candidates.sort((a, b) => (b.median_amount || 0) - (a.median_amount || 0));
  return candidates;
}

/**
 * Calculate fixed expenses using LLM-powered classification
 * 
 * This function:
 * 1. Fetches all expense transactions for the user (with pagination)
 * 2. Creates merchant summaries with compact stats
 * 3. Sends ALL summaries to LLM in a single batch call
 * 4. Filters results based on LLM confidence and score
 */
export async function calculateFixedExpenses(userId: string): Promise<FixedExpense[]> {
  const startTime = Date.now();
  const stats: ClassificationStats = {
    total_merchants: 0,
    llm_accepted: 0,
    llm_rejected: 0,
    llm_maybe_accepted: 0,
    processing_time_ms: 0,
  };

  try {
    // 1. Fetch all expense transactions with pagination
    const transactions = await fetchAllExpenseTransactions(userId);

    if (transactions.length === 0) {
      return [];
    }

    // 2. Create merchant summaries (these enforce >=3 txns and >=3 unique months)
    const summaries = createMerchantSummaries(transactions);
    stats.total_merchants = summaries.length;

    if (summaries.length === 0) {
      return [];
    }

    // 3. Fetch user memories about confirmed and rejected fixed expenses
    const memoriesText = await getAllMemories(userId);
    
    const fixedExpenseMemories = memoriesText
      .split('\n')
      .filter(line => 
        (line.toLowerCase().includes('confirmed fixed expense') || 
         line.toLowerCase().includes('rejected fixed expense')) && 
        line.trim().length > 0
      );

    // 4. Send ALL merchants to LLM in a single batch call with memories
    const classifications = await classifyAllMerchantsWithLLM(summaries, fixedExpenseMemories);

    // 5. Process classifications and create fixed expenses
    const results: FixedExpense[] = [];
    
    for (let i = 0; i < summaries.length; i++) {
      const summary = summaries[i];
      const classification = classifications[i];
      
      // Decision logic based on LLM output only
      if (classification.label === 'fixed' && classification.confidence >= 0.7 && classification.llm_reasoning_score >= 0.7) {
        stats.llm_accepted++;
        results.push(createFixedExpense(summary, classification));
      } else if (classification.label === 'maybe') {
        // Show ALL "maybe" items for user confirmation, regardless of confidence
        stats.llm_maybe_accepted++;
        results.push(createFixedExpense(summary, classification));
      } else {
        stats.llm_rejected++;
      }
    }

    // 6. Sort by median amount descending
    results.sort((a, b) => b.median_amount - a.median_amount);

    stats.processing_time_ms = Date.now() - startTime;

    return results;
  } catch (error: any) {
    stats.processing_time_ms = Date.now() - startTime;
    console.error('[Fixed Expenses] Error:', error.message);
    throw error;
  }
}

export async function recalculateFixedExpensesCache(userId: string): Promise<{
  expenses: FixedExpense[];
  subscription_candidates: FixedExpense[];
}> {
  const transactions = await fetchAllExpenseTransactions(userId);

  // Calculate fixed expenses (>=3 months eligible)
  const expenses = await calculateFixedExpenses(userId);

  // Deterministic recent candidates (<3 months)
  const candidates = buildSubscriptionCandidates(transactions);

  // Tag subscriptions via LLM across BOTH lists
  const tagInputs = [...expenses, ...candidates].map(e => ({
    merchant_name: e.merchant_name,
    samples: [],
  }));

  const tags = await tagSubscriptionsWithLLM(tagInputs);
  const tagMap = new Map<string, boolean>();
  const confMap = new Map<string, number>();
  for (const t of tags) {
    tagMap.set(t.merchant_name, t.is_subscription);
    confMap.set(t.merchant_name, t.confidence);
  }

  const taggedExpenses = expenses.map(e => ({
    ...e,
    is_subscription: tagMap.get(e.merchant_name) || false,
  }));

  // Keep only candidates that LLM agrees are subscriptions with reasonable confidence
  const taggedCandidates = candidates
    .map(c => ({ ...c, is_subscription: tagMap.get(c.merchant_name) || false }))
    .filter(c => c.is_subscription && (confMap.get(c.merchant_name) ?? 0.5) >= 0.6);

  return { expenses: taggedExpenses, subscription_candidates: taggedCandidates };
}

/**
 * Get cached fixed expenses
 * Note: Caching is currently disabled per user preference
 */
export async function getCachedFixedExpenses(userId: string): Promise<FixedExpensesResponse | null> {
  const { data, error } = await supabase
    .from('fixed_expenses_cache')
    .select('*')
    .eq('user_id', userId)
    .eq('kind', 'fixed_expense')
    .order('median_amount', { ascending: false });

  if (error) {
    console.error('Error fetching cached fixed expenses:', error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const total = data.reduce((sum, exp) => sum + Number(exp.median_amount), 0);

  return {
    total: Math.round(total * 100) / 100,
    expenses: data.map(exp => ({
      merchant_name: exp.merchant_name,
      median_amount: Number(exp.median_amount),
      occurrence_count: exp.occurrence_count,
      months_tracked: exp.months_tracked,
      avg_day_of_month: exp.avg_day_of_month,
      last_occurrence_date: exp.last_occurrence_date,
      is_maybe: !!(exp as any).is_maybe,
      is_subscription: !!(exp as any).is_subscription,
    })),
    calculated_at: data[0]?.calculated_at || new Date().toISOString(),
    from_cache: true,
  };
}

export async function getCachedSubscriptionCandidates(userId: string): Promise<FixedExpense[]> {
  const { data, error } = await supabase
    .from('fixed_expenses_cache')
    .select('*')
    .eq('user_id', userId)
    .eq('kind', 'subscription_candidate')
    .order('median_amount', { ascending: false });

  if (error || !data) return [];

  return data.map(exp => ({
    merchant_name: exp.merchant_name,
    median_amount: Number(exp.median_amount),
    occurrence_count: exp.occurrence_count,
    months_tracked: exp.months_tracked,
    avg_day_of_month: exp.avg_day_of_month,
    last_occurrence_date: exp.last_occurrence_date,
    is_maybe: true,
    is_subscription: !!(exp as any).is_subscription,
  }));
}

/**
 * Save fixed expenses to cache
 * Note: Caching is currently disabled per user preference
 */
export async function cacheFixedExpenses(userId: string, expenses: FixedExpense[]): Promise<void> {
  // Delete existing cache for this user
  await supabase
    .from('fixed_expenses_cache')
    .delete()
    .eq('user_id', userId);

  if (expenses.length === 0) {
    return;
  }

  // Insert new cache entries
  const cacheEntries = expenses.map(exp => ({
    user_id: userId,
    kind: 'fixed_expense',
    merchant_name: exp.merchant_name,
    median_amount: exp.median_amount,
    occurrence_count: exp.occurrence_count,
    months_tracked: exp.months_tracked,
    avg_day_of_month: exp.avg_day_of_month,
    last_occurrence_date: exp.last_occurrence_date,
    is_subscription: exp.is_subscription || false,
    is_maybe: exp.is_maybe || false,
    calculated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('fixed_expenses_cache')
    .insert(cacheEntries);

  if (error) {
    console.error('Error caching fixed expenses:', error);
  }
}

export async function cacheSubscriptionCandidates(userId: string, candidates: FixedExpense[]): Promise<void> {
  if (!candidates || candidates.length === 0) return;

  const entries = candidates.map(exp => ({
    user_id: userId,
    kind: 'subscription_candidate',
    merchant_name: exp.merchant_name,
    median_amount: exp.median_amount,
    occurrence_count: exp.occurrence_count,
    months_tracked: exp.months_tracked,
    avg_day_of_month: exp.avg_day_of_month,
    last_occurrence_date: exp.last_occurrence_date,
    is_subscription: exp.is_subscription || false,
    is_maybe: true,
    calculated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('fixed_expenses_cache').insert(entries);
  if (error) console.error('Error caching subscription candidates:', error);
}

/**
 * Invalidate and recalculate fixed expenses cache
 * Note: Caching is currently disabled per user preference
 */
export async function refreshFixedExpensesCache(userId: string): Promise<void> {
  try {
    const { expenses, subscription_candidates } = await recalculateFixedExpensesCache(userId);
    await cacheFixedExpenses(userId, expenses);
    await cacheSubscriptionCandidates(userId, subscription_candidates);
    console.log(`[Fixed Expenses] Refreshed cache for user ${userId}: ${expenses.length} fixed expenses, ${subscription_candidates.length} subscription candidates`);
  } catch (error: any) {
    console.error(`[Fixed Expenses] Error refreshing cache for user ${userId}:`, error.message);
  }
}
