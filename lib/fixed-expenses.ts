import { supabase } from '@/lib/supabase';
import { createMerchantSummaries, MerchantSummary } from './merchant-summarizer';
import { classifyAllMerchantsWithLLM, LLMClassification } from './llm-fixed-expense-classifier';
import { getAllMemories } from './db-tools';

export interface FixedExpense {
  merchant_name: string;
  median_amount: number; // Monthly amount
  occurrence_count: number;
  months_tracked: number;
  avg_day_of_month: number;
  last_occurrence_date: string;
  is_maybe?: boolean; // True if this is a "maybe" classification that needs user confirmation
  merchant_key?: string; // Normalized merchant key for memory storage
  // Internal fields for tracking (not shown in UI)
  _classification_source?: 'rule' | 'llm' | 'llm_maybe' | 'rule_fallback';
  _combined_score?: number;
}

export interface FixedExpensesResponse {
  total: number;
  expenses: FixedExpense[];
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
 * Calculate fixed expenses using LLM-powered classification
 * 
 * This function:
 * 1. Fetches all expense transactions for the user
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
    console.log('[Fixed Expenses] Starting calculation for user:', userId);

    // 1. Fetch all expense transactions
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('merchant, amount, date, description, transaction_type')
      .eq('user_id', userId)
      .in('transaction_type', ['expense', 'other'])
      .order('date', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }

    if (!transactions || transactions.length === 0) {
      console.log('[Fixed Expenses] No transactions found');
      return [];
    }

    console.log(`[Fixed Expenses] Processing ${transactions.length} transactions`);
    
    // Debug: Log rent-related transactions
    const rentRelated = transactions.filter(t => 
      t.merchant.toLowerCase().includes('rent') || 
      t.merchant.toLowerCase().includes('lease') || 
      t.merchant.toLowerCase().includes('realty')
    );
    if (rentRelated.length > 0) {
      console.log('[Fixed Expenses] Found rent-related transactions:', 
        rentRelated.map(t => ({ 
          date: t.date, 
          merchant: t.merchant, 
          type: t.transaction_type,
          amount: t.amount 
        }))
      );
    }

    // 2. Create merchant summaries
    const summaries = createMerchantSummaries(transactions);
    stats.total_merchants = summaries.length;
    
    console.log(`[Fixed Expenses] Created ${summaries.length} merchant summaries`);

    if (summaries.length === 0) {
      return [];
    }

    // 3. Fetch user memories about confirmed and rejected fixed expenses
    const memoriesText = await getAllMemories(userId);
    
    // Log all memories for debugging
    console.log('[Fixed Expenses] All memories from database:');
    console.log('---START MEMORIES---');
    console.log(memoriesText || '(empty)');
    console.log('---END MEMORIES---');
    
    const fixedExpenseMemories = memoriesText
      .split('\n')
      .filter(line => 
        (line.toLowerCase().includes('confirmed fixed expense') || 
         line.toLowerCase().includes('rejected fixed expense')) && 
        line.trim().length > 0
      );
    
    if (fixedExpenseMemories.length > 0) {
      const confirmed = fixedExpenseMemories.filter(m => m.toLowerCase().includes('confirmed')).length;
      const rejected = fixedExpenseMemories.filter(m => m.toLowerCase().includes('rejected')).length;
      console.log(`[Fixed Expenses] Found ${confirmed} confirmed and ${rejected} rejected fixed expense memories`);
      console.log('[Fixed Expenses] Filtered fixed expense memories:');
      fixedExpenseMemories.forEach((mem, i) => {
        console.log(`  ${i + 1}. ${mem}`);
      });
    } else {
      console.log('[Fixed Expenses] No fixed expense memories found in database');
    }

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
        console.log(
          `[Fixed Expenses] [ACCEPTED] ${summary.merchant_key}: ` +
          `conf=${classification.confidence.toFixed(2)}, ` +
          `score=${classification.llm_reasoning_score.toFixed(2)}`
        );
      } else if (classification.label === 'maybe') {
        // Show ALL "maybe" items for user confirmation, regardless of confidence
        stats.llm_maybe_accepted++;
        results.push(createFixedExpense(summary, classification));
        console.log(
          `[Fixed Expenses] [MAYBE - NEEDS CONFIRMATION] ${summary.merchant_key}: ` +
          `conf=${classification.confidence.toFixed(2)}, ` +
          `score=${classification.llm_reasoning_score.toFixed(2)}`
        );
      } else {
        stats.llm_rejected++;
        console.log(
          `[Fixed Expenses] [REJECTED] ${summary.merchant_key}: ` +
          `label=${classification.label}, conf=${classification.confidence.toFixed(2)}, ` +
          `score=${classification.llm_reasoning_score.toFixed(2)}`
        );
      }
    }

    // 5. Sort by median amount descending
    results.sort((a, b) => b.median_amount - a.median_amount);

    stats.processing_time_ms = Date.now() - startTime;

    // Log summary
    console.log('[Fixed Expenses] Calculation complete:', {
      total_found: results.length,
      stats,
    });

    return results;
  } catch (error: any) {
    stats.processing_time_ms = Date.now() - startTime;
    console.error('[Fixed Expenses] Error:', error.message, { stats });
    throw error;
  }
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
    })),
    calculated_at: data[0]?.calculated_at || new Date().toISOString(),
    from_cache: true,
  };
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
    merchant_name: exp.merchant_name,
    median_amount: exp.median_amount,
    occurrence_count: exp.occurrence_count,
    months_tracked: exp.months_tracked,
    avg_day_of_month: exp.avg_day_of_month,
    last_occurrence_date: exp.last_occurrence_date,
    calculated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('fixed_expenses_cache')
    .insert(cacheEntries);

  if (error) {
    console.error('Error caching fixed expenses:', error);
  }
}

/**
 * Invalidate and recalculate fixed expenses cache
 * Note: Caching is currently disabled per user preference
 */
export async function refreshFixedExpensesCache(userId: string): Promise<void> {
  try {
    const expenses = await calculateFixedExpenses(userId);
    await cacheFixedExpenses(userId, expenses);
    console.log(`[Fixed Expenses] Refreshed cache for user ${userId}: ${expenses.length} fixed expenses found`);
  } catch (error: any) {
    console.error(`[Fixed Expenses] Error refreshing cache for user ${userId}:`, error.message);
  }
}
