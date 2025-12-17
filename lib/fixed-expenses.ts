import { supabase } from '@/lib/supabase';

// Fixed expense detection parameters
const MIN_MONTHS_REQUIRED = 2;
const AMOUNT_VARIANCE_THRESHOLD = 0.15; // 15% variance allowed
const DAY_OF_MONTH_VARIANCE = 5; // +/- 5 days considered "same time of month"

export interface FixedExpense {
  merchant_name: string;
  median_amount: number;
  occurrence_count: number;
  months_tracked: number;
  avg_day_of_month: number;
  last_occurrence_date: string;
}

export interface FixedExpensesResponse {
  total: number;
  expenses: FixedExpense[];
  calculated_at: string;
  from_cache: boolean;
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
 * Normalize merchant names for grouping
 * Strips common variations like store numbers, locations, etc.
 */
function normalizeMerchantName(merchant: string): string {
  return merchant
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*#\d+/g, '') // Remove store numbers like #1234
    .replace(/\s*\d{4,}/g, '') // Remove long numbers (phone numbers, etc.)
    .replace(/\s+-\s+.*/g, '') // Remove location suffixes
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if amounts are consistent enough to be a fixed expense
 */
function isAmountConsistent(amounts: number[]): boolean {
  if (amounts.length < MIN_MONTHS_REQUIRED) return false;
  
  const medianAmount = median(amounts);
  if (medianAmount === 0) return false;
  
  // Check if all amounts are within the variance threshold
  const allWithinThreshold = amounts.every(amount => {
    const variance = Math.abs(amount - medianAmount) / medianAmount;
    return variance <= AMOUNT_VARIANCE_THRESHOLD;
  });
  
  return allWithinThreshold;
}

/**
 * Check if transactions occur at roughly the same time each month
 */
function isDayConsistent(daysOfMonth: number[]): boolean {
  if (daysOfMonth.length < MIN_MONTHS_REQUIRED) return false;
  
  const avgDay = daysOfMonth.reduce((a, b) => a + b, 0) / daysOfMonth.length;
  
  // Check if all days are within the variance threshold
  const allWithinThreshold = daysOfMonth.every(day => {
    return Math.abs(day - avgDay) <= DAY_OF_MONTH_VARIANCE;
  });
  
  return allWithinThreshold;
}

/**
 * Get months difference between two YYYY-MM strings
 */
function getMonthsDifference(start: string, end: string): number {
  const [startYear, startMonth] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);
  return (endYear - startYear) * 12 + (endMonth - startMonth);
}

/**
 * Calculate fixed expenses from transaction data
 */
export async function calculateFixedExpenses(userId: string): Promise<FixedExpense[]> {
  // Get all expense transactions
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('merchant, amount, date')
    .eq('user_id', userId)
    .in('transaction_type', ['expense', 'other'])
    .order('date', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch transactions: ${error.message}`);
  }

  if (!transactions || transactions.length === 0) {
    return [];
  }

  // Group transactions by normalized merchant name
  const merchantGroups = new Map<string, Array<{
    originalName: string;
    amount: number;
    date: string;
    dayOfMonth: number;
    yearMonth: string;
  }>>();

  for (const txn of transactions) {
    const normalizedName = normalizeMerchantName(txn.merchant);
    const date = new Date(txn.date);
    const dayOfMonth = date.getDate();
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!merchantGroups.has(normalizedName)) {
      merchantGroups.set(normalizedName, []);
    }
    
    merchantGroups.get(normalizedName)!.push({
      originalName: txn.merchant,
      amount: Math.abs(Number(txn.amount)),
      date: txn.date,
      dayOfMonth,
      yearMonth,
    });
  }

  const fixedExpenses: FixedExpense[] = [];

  // Analyze each merchant group
  for (const [, transactions] of merchantGroups) {
    // Group by month to avoid counting multiple transactions in same month
    const monthlyTransactions = new Map<string, typeof transactions[0]>();
    
    for (const txn of transactions) {
      // Keep the transaction with the highest amount for each month
      const existing = monthlyTransactions.get(txn.yearMonth);
      if (!existing || txn.amount > existing.amount) {
        monthlyTransactions.set(txn.yearMonth, txn);
      }
    }

    const monthlyTxnArray = Array.from(monthlyTransactions.values());
    
    // Need at least MIN_MONTHS_REQUIRED months of data
    if (monthlyTxnArray.length < MIN_MONTHS_REQUIRED) {
      continue;
    }

    // Check if months are consecutive or nearly consecutive
    const sortedMonths = Array.from(monthlyTransactions.keys()).sort();
    const monthsDiff = getMonthsDifference(sortedMonths[0], sortedMonths[sortedMonths.length - 1]);
    
    // If the range is too sparse (more than 2x the number of transactions), skip
    if (monthsDiff > monthlyTxnArray.length * 2) {
      continue;
    }

    const amounts = monthlyTxnArray.map(t => t.amount);
    const daysOfMonth = monthlyTxnArray.map(t => t.dayOfMonth);

    // Check if this qualifies as a fixed expense
    if (isAmountConsistent(amounts) && isDayConsistent(daysOfMonth)) {
      const medianAmount = median(amounts);
      const avgDay = Math.round(daysOfMonth.reduce((a, b) => a + b, 0) / daysOfMonth.length);
      const lastTxn = monthlyTxnArray[monthlyTxnArray.length - 1];

      fixedExpenses.push({
        merchant_name: lastTxn.originalName, // Use the most recent original name
        median_amount: Math.round(medianAmount * 100) / 100,
        occurrence_count: monthlyTxnArray.length,
        months_tracked: monthsDiff + 1,
        avg_day_of_month: avgDay,
        last_occurrence_date: lastTxn.date,
      });
    }
  }

  // Sort by median amount descending
  fixedExpenses.sort((a, b) => b.median_amount - a.median_amount);

  return fixedExpenses;
}

/**
 * Get cached fixed expenses
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
