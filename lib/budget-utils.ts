import { supabase, BudgetCategory, Budget } from './supabase';

// Default categories for freelancers
export const DEFAULT_FREELANCER_CATEGORIES = [
  // Income
  'Client Payments',
  'Freelance Income',
  'Side Projects',
  'Refunds',
  // Essential Expenses
  'Rent / Housing',
  'Utilities',
  'Groceries',
  'Health Insurance',
  'Transportation',
  // Business Expenses
  'Software & Subscriptions',
  'Office Supplies',
  'Professional Development',
  'Marketing',
  'Coworking Space',
  // Discretionary
  'Dining Out',
  'Entertainment',
  'Shopping',
  'Travel',
  'Personal Care',
  // Savings
  'Emergency Fund',
  'Tax Savings',
  'Retirement',
  'Investments',
];

/**
 * Get all budget categories for a user
 */
export async function getBudgetCategories(userId: string): Promise<BudgetCategory[]> {
  const { data, error } = await supabase
    .from('budget_categories')
    .select('*')
    .eq('user_id', userId)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to get budget categories: ${error.message}`);
  }

  return data || [];
}

/**
 * Check if user has any budget categories set up
 */
export async function hasBudgetCategories(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('budget_categories')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to check budget categories: ${error.message}`);
  }

  return (count || 0) > 0;
}

/**
 * Get distinct categories from user's transactions
 */
export async function getCategoriesFromTransactions(userId: string): Promise<string[]> {
  // Fetch categorized transaction categories (non-null, non-empty)
  const { data, error } = await supabase
    .from('transactions')
    .select('category')
    .eq('user_id', userId)
    .not('category', 'is', null)
    .neq('category', '');

  if (error) {
    throw new Error(`Failed to get transaction categories: ${error.message}`);
  }

  // Check if the user has any uncategorized transactions (null or empty string).
  // If so, we include "Uncategorized" so users with existing transactions don't get starter categories.
  const { count: uncategorizedCount, error: uncategorizedError } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .or('category.is.null,category.eq.');

  if (uncategorizedError) {
    throw new Error(`Failed to check uncategorized transactions: ${uncategorizedError.message}`);
  }

  // Get unique categories
  const categories = new Set<string>();
  for (const txn of data || []) {
    if (txn.category && typeof txn.category === 'string') {
      const name = txn.category.trim();
      if (name) categories.add(name);
    }
  }

  if ((uncategorizedCount || 0) > 0) {
    categories.add('Uncategorized');
  }

  return Array.from(categories).sort();
}

/**
 * Check if user has any transactions (categorized or not)
 */
export async function hasTransactions(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to check transactions: ${error.message}`);
  }

  return (count || 0) > 0;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

async function fetchAllIncomeTransactionsInRange(
  userId: string,
  startDate: string
): Promise<Array<{ date: string; amount: number }>> {
  const PAGE_SIZE = 1000;
  let all: Array<{ date: string; amount: number }> = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('transactions')
      .select('date, amount')
      .eq('user_id', userId)
      .eq('transaction_type', 'income')
      .gte('date', startDate)
      .order('date', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch income transactions: ${error.message}`);
    }

    const rows = (data || []).map((d: any) => ({
      date: d.date as string,
      amount: Number(d.amount) || 0,
    }));

    all = all.concat(rows);

    if (!data || data.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return all;
}

/**
 * Get median monthly income over the last N months.
 * Returns median of monthly income totals and the number of months included.
 */
export async function getMedianMonthlyIncome(
  userId: string,
  monthsBack: number = 12
): Promise<{ medianMonthlyIncome: number; monthsIncluded: number }> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 1);
  const startDate = start.toISOString().split('T')[0];

  const txns = await fetchAllIncomeTransactionsInRange(userId, startDate);
  if (txns.length === 0) {
    return { medianMonthlyIncome: 0, monthsIncluded: 0 };
  }

  const monthlyTotals = new Map<string, number>();
  for (const txn of txns) {
    const d = new Date(txn.date);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const current = monthlyTotals.get(monthKey) || 0;
    monthlyTotals.set(monthKey, current + Math.abs(Number(txn.amount)));
  }

  const totals = Array.from(monthlyTotals.values()).filter(v => Number.isFinite(v) && v >= 0);
  return {
    medianMonthlyIncome: median(totals),
    monthsIncluded: totals.length,
  };
}

/**
 * Initialize budget categories for a user
 * Uses categories from transactions if they exist, otherwise uses default freelancer categories
 */
export async function initializeBudgetCategories(userId: string): Promise<BudgetCategory[]> {
  // If the user has any existing transactions, we should ONLY initialize from those transactions
  // (including "Uncategorized" if applicable) — do NOT fall back to starter categories.
  const [transactionsExist, transactionCategories] = await Promise.all([
    hasTransactions(userId),
    getCategoriesFromTransactions(userId),
  ]);
  
  // If user has transactions, use only those categories; otherwise use default freelancer categories.
  const allCategories = transactionsExist
    ? new Set<string>(transactionCategories.length > 0 ? transactionCategories : ['Uncategorized'])
    : new Set<string>(DEFAULT_FREELANCER_CATEGORIES);

  // Create category records
  const categoryRecords: Omit<BudgetCategory, 'id' | 'created_at'>[] = [];
  let order = 0;
  
  for (const name of allCategories) {
    const isFromTransactions = transactionCategories.includes(name);
    categoryRecords.push({
      user_id: userId,
      name,
      is_custom: false, // All initial categories are not custom
      display_order: order++,
    });
  }

  if (categoryRecords.length === 0) {
    return [];
  }

  // Insert categories (ignore conflicts for existing ones)
  const { data, error } = await supabase
    .from('budget_categories')
    .upsert(categoryRecords, { 
      onConflict: 'user_id,name',
      ignoreDuplicates: true 
    })
    .select();

  if (error) {
    throw new Error(`Failed to initialize budget categories: ${error.message}`);
  }

  // Return all categories for the user
  return getBudgetCategories(userId);
}

/**
 * Add a custom category for a user
 */
export async function addCustomCategory(userId: string, name: string): Promise<BudgetCategory> {
  // Get max display order
  const { data: maxOrderData } = await supabase
    .from('budget_categories')
    .select('display_order')
    .eq('user_id', userId)
    .order('display_order', { ascending: false })
    .limit(1);

  const maxOrder = maxOrderData?.[0]?.display_order || 0;

  const { data, error } = await supabase
    .from('budget_categories')
    .insert({
      user_id: userId,
      name: name.trim(),
      is_custom: true,
      display_order: maxOrder + 1,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('A category with this name already exists');
    }
    throw new Error(`Failed to add category: ${error.message}`);
  }

  return data;
}

/**
 * Delete a category (only if no transactions use it)
 */
export async function deleteCategory(userId: string, categoryId: string): Promise<void> {
  // First get the category name
  const { data: category, error: fetchError } = await supabase
    .from('budget_categories')
    .select('name')
    .eq('id', categoryId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !category) {
    throw new Error('Category not found');
  }

  // Check if any transactions use this category
  const { count, error: countError } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('category', category.name);

  if (countError) {
    throw new Error(`Failed to check transactions: ${countError.message}`);
  }

  if (count && count > 0) {
    throw new Error(`Cannot delete category: ${count} transaction(s) are using this category`);
  }

  // Delete the category
  const { error: deleteError } = await supabase
    .from('budget_categories')
    .delete()
    .eq('id', categoryId)
    .eq('user_id', userId);

  if (deleteError) {
    throw new Error(`Failed to delete category: ${deleteError.message}`);
  }
}

/**
 * Get budgets for a specific month
 */
export async function getBudgetsForMonth(
  userId: string,
  month: string
): Promise<Budget[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month);

  if (error) {
    throw new Error(`Failed to get budgets: ${error.message}`);
  }

  return data || [];
}

/**
 * Save budgets for a month (upsert)
 */
export async function saveBudgets(
  userId: string,
  month: string,
  budgets: Array<{ category_id: string; budgeted_amount: number }>
): Promise<void> {
  const records = budgets.map(b => ({
    user_id: userId,
    category_id: b.category_id,
    month,
    budgeted_amount: b.budgeted_amount,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('budgets')
    .upsert(records, {
      onConflict: 'user_id,category_id,month',
    });

  if (error) {
    throw new Error(`Failed to save budgets: ${error.message}`);
  }
}

/**
 * Get spending by category for a month
 */
export async function getSpendingByCategory(
  userId: string,
  month: string
): Promise<Record<string, number>> {
  const startDate = `${month}-01`;
  const [year, monthNum] = month.split('-').map(Number);
  const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0]; // Last day of month

  const { data, error } = await supabase
    .from('transactions')
    .select('category, amount, transaction_type')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .in('transaction_type', ['expense', 'other']);

  if (error) {
    throw new Error(`Failed to get spending: ${error.message}`);
  }

  // Aggregate by category
  const spending: Record<string, number> = {};
  for (const txn of data || []) {
    const category = txn.category || 'Uncategorized';
    spending[category] = (spending[category] || 0) + Math.abs(Number(txn.amount));
  }

  return spending;
}

/**
 * Get total income for a month
 */
export async function getIncomeForMonth(userId: string, month: string): Promise<number> {
  const startDate = `${month}-01`;
  const [year, monthNum] = month.split('-').map(Number);
  const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .eq('transaction_type', 'income');

  if (error) {
    throw new Error(`Failed to get income: ${error.message}`);
  }

  return (data || []).reduce((sum, txn) => sum + Math.abs(Number(txn.amount)), 0);
}

/**
 * Find the most recent month with income transactions
 */
export async function findLastMonthWithIncome(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('date')
    .eq('user_id', userId)
    .eq('transaction_type', 'income')
    .order('date', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  // Extract YYYY-MM from the date
  const date = new Date(data[0].date);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get historical spending breakdown by category for the last N months
 */
export async function getHistoricalSpendingBreakdown(
  userId: string,
  months: number = 6
): Promise<{
  categoryAverages: Record<string, number>;
  categoryTotals: Record<string, number>;
  monthlyData: Array<{ month: string; categories: Record<string, number> }>;
  totalMonths: number;
}> {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);
  const startDateStr = startDate.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('transactions')
    .select('date, category, amount, transaction_type')
    .eq('user_id', userId)
    .gte('date', startDateStr)
    .in('transaction_type', ['expense', 'other']);

  if (error) {
    throw new Error(`Failed to get historical spending: ${error.message}`);
  }

  // Aggregate by month and category
  const monthlyData: Record<string, Record<string, number>> = {};
  const categoryTotals: Record<string, number> = {};

  for (const txn of data || []) {
    const date = new Date(txn.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const category = txn.category || 'Uncategorized';
    const amount = Math.abs(Number(txn.amount));

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {};
    }
    monthlyData[monthKey][category] = (monthlyData[monthKey][category] || 0) + amount;
    categoryTotals[category] = (categoryTotals[category] || 0) + amount;
  }

  // Calculate averages
  const monthCount = Object.keys(monthlyData).length || 1;
  const categoryAverages: Record<string, number> = {};
  for (const [category, total] of Object.entries(categoryTotals)) {
    categoryAverages[category] = total / monthCount;
  }

  // Convert to array format
  const monthlyDataArray = Object.entries(monthlyData)
    .map(([month, categories]) => ({ month, categories }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    categoryAverages,
    categoryTotals,
    monthlyData: monthlyDataArray,
    totalMonths: monthCount,
  };
}

/**
 * Get complete budget data for a month (categories + budgets + spending + income)
 */
export async function getBudgetData(userId: string, month: string): Promise<{
  categories: BudgetCategory[];
  budgets: Budget[];
  spending: Record<string, number>;
  income: number;
  incomeMonth: string; // The month the income is from (may differ from requested month)
  isInitialized: boolean;
}> {
  // Check if categories exist
  let categories = await getBudgetCategories(userId);
  let isInitialized = categories.length > 0;

  // If no categories, initialize them
  if (!isInitialized) {
    categories = await initializeBudgetCategories(userId);
    isInitialized = true;
  }

  // Get budgets, spending, and income in parallel
  const [budgets, spending, income] = await Promise.all([
    getBudgetsForMonth(userId, month),
    getSpendingByCategory(userId, month),
    getIncomeForMonth(userId, month),
  ]);

  // If no income in requested month, find the last month with income
  let incomeMonth = month;
  let finalIncome = income;

  if (income === 0) {
    const lastIncomeMonth = await findLastMonthWithIncome(userId);
    if (lastIncomeMonth) {
      incomeMonth = lastIncomeMonth;
      finalIncome = await getIncomeForMonth(userId, lastIncomeMonth);
    }
  }

  return {
    categories,
    budgets,
    spending,
    income: finalIncome,
    incomeMonth,
    isInitialized,
  };
}

/**
 * Check if user has any budgets configured (for showing CTA panel)
 */
export async function hasBudgets(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('budgets')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    return false;
  }

  return (count || 0) > 0;
}

