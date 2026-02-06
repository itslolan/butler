/**
 * Budget Utilities
 * 
 * NOTE: Transaction classification in SQL queries follows the same logic as
 * lib/transaction-classifier.ts:
 * 
 * - Expenses: transaction_type IN ('expense', 'other') OR (transaction_type IS NULL AND amount < 0)
 * - Income: transaction_type = 'income' OR (transaction_type IS NULL AND amount > 0)
 * - Transfers: Excluded from totals (transaction_type = 'transfer' or internal transfer patterns)
 * 
 * For complex post-processing or internal transfer detection, use the 
 * classifyTransaction() function from lib/transaction-classifier.ts.
 */
import { supabase, BudgetCategory, Budget, BudgetSuperCategory } from './supabase';
import { USER_PROVIDED_INCOME_MERCHANT } from './financial-figure-sources';
import { normalizeCategoryNameKey, normalizeCategoryDisplayName, uniqueCategoryNamesByKey } from './category-normalization';

export const DEFAULT_MISC_SUPER_CATEGORY = 'Miscellaneous';

function guessIsFixedExpenseCategoryName(name: string): boolean {
  const n = (name || '').toLowerCase().trim();
  if (!n) return false;

  // Keep this conservative: only mark categories that are very commonly fixed/recurring for most users.
  const strong = [
    // Housing
    'rent',
    'mortgage',
    'property taxes',
    'home insurance',
    'hoa',
    // Utilities
    'utilities',
    'electric',
    'electricity',
    'water',
    'gas',
    'internet',
    'mobile phone',
    'phone',
    // Insurance
    'insurance',
    'health insurance',
    'vehicle insurance',
    // Debt
    'loan',
    'loans',
    'student loans',
    'auto loans',
    'personal loans',
    // Subscriptions (often fixed)
    'subscriptions',
    'streaming services',
    'hosting / domains',
    'coworking / office rent',
  ];

  return strong.some((k) => n.includes(k));
}

// Default category hierarchy for new users
export const DEFAULT_CATEGORY_HIERARCHY: Array<{
  name: string;
  categoryType: 'income' | 'expense' | 'savings';
  categories: string[];
}> = [
  // Income
  {
    name: 'Primary Income',
    categoryType: 'income',
    categories: ['Salary / Wages', 'Contract Income', 'Freelance Income'],
  },
  {
    name: 'Variable Income',
    categoryType: 'income',
    categories: ['Bonuses', 'Commissions', 'Overtime', 'Tips'],
  },
  {
    name: 'Business Income',
    categoryType: 'income',
    categories: ['Client Payments', 'Project-Based Income', 'Retainers'],
  },
  {
    name: 'Other Income',
    categoryType: 'income',
    categories: ['Interest', 'Dividends', 'Rental Income', 'Refunds & Reimbursements', 'Gifts', 'Other Income'],
  },
  // Expenses
  {
    name: 'Housing',
    categoryType: 'expense',
    categories: ['Rent / Mortgage', 'Property Taxes', 'Home Insurance', 'Maintenance & Repairs', 'HOA Fees'],
  },
  {
    name: 'Utilities',
    categoryType: 'expense',
    categories: ['Electricity', 'Water', 'Gas', 'Internet', 'Mobile Phone'],
  },
  {
    name: 'Food & Dining',
    categoryType: 'expense',
    categories: ['Groceries', 'Restaurants', 'Coffee & Snacks', 'Food Delivery'],
  },
  {
    name: 'Transportation',
    categoryType: 'expense',
    categories: ['Fuel', 'Public Transit', 'Ride Share / Taxi', 'Vehicle Maintenance', 'Parking & Tolls', 'Vehicle Insurance'],
  },
  {
    name: 'Shopping',
    categoryType: 'expense',
    categories: ['Clothing', 'Electronics', 'Household Items', 'Personal Purchases'],
  },
  // Financial
  {
    name: 'Debt & Credit',
    categoryType: 'expense',
    categories: ['Credit Card Payments', 'Personal Loans', 'Student Loans', 'Auto Loans'],
  },
  {
    name: 'Savings & Investments',
    categoryType: 'savings',
    categories: ['Emergency Fund', 'Retirement Contributions', 'Investments', 'High-Yield Savings'],
  },
  // Business
  {
    name: 'Business Expenses',
    categoryType: 'expense',
    categories: [
      'Software & Tools',
      'Hardware & Equipment',
      'Subscriptions',
      'Hosting / Domains',
      'Coworking / Office Rent',
      'Marketing & Advertising',
      'Professional Services',
    ],
  },
  // Taxes
  {
    name: 'Taxes',
    categoryType: 'expense',
    categories: ['Income Tax', 'Self-Employment Tax', 'VAT / GST', 'Estimated Taxes'],
  },
  // Lifestyle
  {
    name: 'Health & Wellness',
    categoryType: 'expense',
    categories: ['Health Insurance', 'Medical', 'Dental', 'Vision', 'Fitness'],
  },
  {
    name: 'Personal & Family',
    categoryType: 'expense',
    categories: ['Childcare', 'Education', 'Personal Care', 'Pet Expenses'],
  },
  {
    name: 'Entertainment',
    categoryType: 'expense',
    categories: ['Streaming Services', 'Events & Hobbies', 'Games'],
  },
  {
    name: 'Travel',
    categoryType: 'expense',
    categories: ['Flights', 'Accommodation', 'Local Transport'],
  },
  // Miscellaneous
  {
    name: DEFAULT_MISC_SUPER_CATEGORY,
    categoryType: 'expense',
    categories: ['Cash Withdrawals', 'Transfers', 'Fees & Charges', 'Charitable Donations', 'Uncategorized'],
  },
];

/**
 * Get all budget super-categories for a user
 */
export async function getBudgetSuperCategories(userId: string): Promise<BudgetSuperCategory[]> {
  const { data, error } = await supabase
    .from('budget_super_categories')
    .select('*')
    .eq('user_id', userId)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to get budget super-categories: ${error.message}`);
  }

  return data || [];
}

/**
 * Get super-categories and categories together for a user
 */
export async function getBudgetCategoryHierarchy(userId: string): Promise<{
  superCategories: BudgetSuperCategory[];
  categories: BudgetCategory[];
}> {
  let [superCategories, categories] = await Promise.all([
    getBudgetSuperCategories(userId),
    getBudgetCategories(userId),
  ]);

  if (superCategories.length === 0 && categories.length === 0) {
    await ensureDefaultBudgetHierarchy(userId);
    [superCategories, categories] = await Promise.all([
      getBudgetSuperCategories(userId),
      getBudgetCategories(userId),
    ]);
  }

  return { superCategories, categories };
}

async function getMiscSuperCategoryId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('budget_super_categories')
    .select('id')
    .eq('user_id', userId)
    .eq('name', DEFAULT_MISC_SUPER_CATEGORY)
    .single();

  if (!error && data?.id) {
    return data.id as string;
  }

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get "${DEFAULT_MISC_SUPER_CATEGORY}" super-category: ${error.message}`);
  }

  const { data: maxOrderData, error: maxOrderError } = await supabase
    .from('budget_super_categories')
    .select('display_order')
    .eq('user_id', userId)
    .order('display_order', { ascending: false })
    .limit(1);

  if (maxOrderError) {
    throw new Error(`Failed to determine super-category order: ${maxOrderError.message}`);
  }

  const nextOrder = (maxOrderData?.[0]?.display_order ?? 0) + 1;
  const { data: inserted, error: insertError } = await supabase
    .from('budget_super_categories')
    .insert({
      user_id: userId,
      name: DEFAULT_MISC_SUPER_CATEGORY,
      display_order: nextOrder,
      category_type: 'expense',
    })
    .select()
    .single();

  if (insertError || !inserted) {
    throw new Error(`Failed to create "${DEFAULT_MISC_SUPER_CATEGORY}" super-category: ${insertError?.message}`);
  }

  return inserted.id as string;
}

async function ensureDefaultBudgetHierarchy(userId: string): Promise<void> {
  const superCategoryRecords = DEFAULT_CATEGORY_HIERARCHY.map((superCategory, index) => ({
    user_id: userId,
    name: superCategory.name,
    display_order: index,
    category_type: superCategory.categoryType,
  }));

  const { error: superCategoryError } = await supabase
    .from('budget_super_categories')
    .upsert(superCategoryRecords, {
      onConflict: 'user_id,name',
      ignoreDuplicates: true,
    });

  if (superCategoryError) {
    throw new Error(`Failed to initialize budget super-categories: ${superCategoryError.message}`);
  }

  const superCategories = await getBudgetSuperCategories(userId);
  const superCategoryMap = new Map(
    superCategories.map(superCategory => [superCategory.name, superCategory.id as string])
  );

  const categoryRecords: Omit<BudgetCategory, 'id' | 'created_at'>[] = [];
  for (const superCategory of DEFAULT_CATEGORY_HIERARCHY) {
    const superCategoryId = superCategoryMap.get(superCategory.name);
    if (!superCategoryId) continue;
    superCategory.categories.forEach((name, index) => {
      categoryRecords.push({
        user_id: userId,
        name,
        is_custom: false,
        display_order: index,
        super_category_id: superCategoryId,
        is_fixed_expense_category: guessIsFixedExpenseCategoryName(name),
        category_type: superCategory.categoryType,
      });
    });
  }

  if (categoryRecords.length === 0) {
    return;
  }

  const { error: categoryError } = await supabase
    .from('budget_categories')
    .upsert(categoryRecords, {
      onConflict: 'user_id,name',
      ignoreDuplicates: true,
    });

  if (categoryError) {
    throw new Error(`Failed to initialize budget categories: ${categoryError.message}`);
  }
}

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
 * Get the names of categories that are marked as fixed expenses.
 */
export async function getFixedExpenseCategoryNames(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('budget_categories')
    .select('name, is_fixed_expense_category')
    .eq('user_id', userId)
    .eq('is_fixed_expense_category', true)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to get fixed expense categories: ${error.message}`);
  }

  return (data || [])
    .map((row) => (row as BudgetCategory).name)
    .filter((name): name is string => typeof name === 'string' && name.trim().length > 0);
}

function getMonthRange(month: string): { start: string; end: string; endDay: number } {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const startDate = new Date(Date.UTC(year, monthIndex, 1));
  const endDate = new Date(Date.UTC(year, monthIndex + 1, 0));
  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];
  return { start, end, endDay: endDate.getUTCDate() };
}

export function getPreviousMonth(month: string): string {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const d = new Date(Date.UTC(year, monthIndex - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function hasFullMonthExpenseData(userId: string, month: string): Promise<boolean> {
  const { start, end, endDay } = getMonthRange(month);

  const { data: datesData, error: datesError } = await supabase
    .from('transactions')
    .select('date')
    .eq('user_id', userId)
    .gte('date', start)
    .lte('date', end);

  if (datesError || !datesData || datesData.length === 0) {
    return false;
  }

  const days = datesData
    .map(row => new Date(row.date).getUTCDate())
    .filter(day => Number.isFinite(day));

  const distinctDays = new Set(days);
  const minDay = Math.min(...days);
  const maxDay = Math.max(...days);
  const minDistinctDays = 10;

  // Treat a month as "full" only if it spans most of the month
  // and has enough distinct transaction days to avoid partial imports.
  return minDay <= 3 && maxDay >= endDay - 3 && distinctDays.size >= minDistinctDays;
}

export async function getFixedExpensePrefillByCategory(
  userId: string,
  month: string
): Promise<Record<string, number>> {
  const fixedExpenseCategories = await getFixedExpenseCategoryNames(userId);
  console.log('[FixedExpensePrefill] Fixed expense categories:', fixedExpenseCategories.length);
  if (fixedExpenseCategories.length === 0) {
    console.log('[FixedExpensePrefill] No fixed expense categories found.');
  }

  const lastMonth = getPreviousMonth(month);
  const useLastMonth = await hasFullMonthExpenseData(userId, lastMonth);
  const targetMonth = useLastMonth ? lastMonth : month;
  const { start, end } = getMonthRange(targetMonth);
  console.log('[FixedExpensePrefill] Target month:', targetMonth, 'range:', start, end);

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('category, amount, fixed_expense_status, is_fixed_expense, transaction_type')
    .eq('user_id', userId)
    .gte('date', start)
    .lte('date', end)
    .or('fixed_expense_status.eq.fixed,fixed_expense_status.eq.maybe,is_fixed_expense.eq.true')
    .in('transaction_type', ['expense', 'other'])
    .not('category', 'is', null);

  if (error || !transactions) {
    console.error('[getFixedExpensePrefillByCategory] Error:', error?.message || error);
    return {};
  }
  console.log('[FixedExpensePrefill] Candidate fixed-expense txns:', transactions.length);

  const fixedSet = new Set(fixedExpenseCategories.map((name) => name.toLowerCase()));
  const totals: Record<string, number> = {};
  for (const txn of transactions) {
    if (!txn.category || typeof txn.category !== 'string') continue;
    const categoryName = txn.category.trim();
    if (!categoryName) continue;
    if (fixedSet.size > 0 && !fixedSet.has(categoryName.toLowerCase())) continue;
    const amount = Math.abs(Number(txn.amount)) || 0;
    totals[categoryName] = (totals[categoryName] || 0) + amount;
  }
  if (fixedSet.size === 0) {
    const distinctCategories = new Set<string>();
    const statusCounts = { fixed: 0, maybe: 0, legacy: 0 };
    for (const txn of transactions) {
      if (txn.category && typeof txn.category === 'string') {
        distinctCategories.add(txn.category.trim());
      }
      if (txn.fixed_expense_status === 'fixed') statusCounts.fixed += 1;
      else if (txn.fixed_expense_status === 'maybe') statusCounts.maybe += 1;
      else if (txn.is_fixed_expense) statusCounts.legacy += 1;
    }
    console.log('[FixedExpensePrefill] Fallback fixed-expense categories:', distinctCategories.size);
    console.log('[FixedExpensePrefill] Fallback status counts:', statusCounts);
  }
  console.log('[FixedExpensePrefill] Prefill categories:', Object.keys(totals).length);

  return totals;
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
  startDate: string,
  endDate?: string
): Promise<Array<{ date: string; amount: number }>> {
  const PAGE_SIZE = 1000;
  const MAX_TRANSACTIONS = 5000; // Cap at 5000 transactions to prevent memory issues
  let all: Array<{ date: string; amount: number }> = [];
  let page = 0;
  let hasMore = true;

  while (hasMore && all.length < MAX_TRANSACTIONS) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('transactions')
      .select('date, amount')
      .eq('user_id', userId)
      .eq('transaction_type', 'income')
      // Exclude synthetic "user provided" income rows from median calculation.
      .neq('merchant', USER_PROVIDED_INCOME_MERCHANT)
      .gte('date', startDate)
      .lte('date', endDate ?? new Date().toISOString().split('T')[0])
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
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  const endDate = end.toISOString().split('T')[0];
  const start = new Date(end.getFullYear(), end.getMonth() - monthsBack + 1, 1);
  const startDate = start.toISOString().split('T')[0];

  const txns = await fetchAllIncomeTransactionsInRange(userId, startDate, endDate);
  if (txns.length === 0) {
    return { medianMonthlyIncome: 0, monthsIncluded: 0 };
  }

  // Group transactions by month and sum them up
  // This ensures bi-weekly/weekly salaries are properly aggregated into monthly totals
  const monthlyTotals = new Map<string, number>();
  for (const txn of txns) {
    const d = new Date(txn.date);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const current = monthlyTotals.get(monthKey) || 0;
    monthlyTotals.set(monthKey, current + Math.abs(Number(txn.amount)));
  }

  const totals = Array.from(monthlyTotals.values()).filter(v => Number.isFinite(v) && v >= 0);
  
  // Debug logging to verify monthly aggregation
  if (process.env.NODE_ENV === 'development') {
    console.log('[getMedianMonthlyIncome] Monthly income totals:', Object.fromEntries(monthlyTotals));
    console.log('[getMedianMonthlyIncome] Median of monthly totals:', median(totals));
  }
  
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
  await ensureDefaultBudgetHierarchy(userId);

  return getBudgetCategories(userId);
}

/**
 * Add a custom category for a user
 */
export async function addCustomCategory(userId: string, name: string): Promise<BudgetCategory> {
  const superCategoryId = await getMiscSuperCategoryId(userId);

  // Get max display order
  const { data: maxOrderData } = await supabase
    .from('budget_categories')
    .select('display_order')
    .eq('user_id', userId)
    .eq('super_category_id', superCategoryId)
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
      super_category_id: superCategoryId,
      is_fixed_expense_category: guessIsFixedExpenseCategoryName(name),
      category_type: 'expense',
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
 * Sync new transaction categories to budget_categories table
 * Ensures budget categories stay in sync with transaction categories
 */
export async function syncTransactionCategoriesToBudget(
  userId: string,
  transactionCategories: string[]
): Promise<void> {
  if (transactionCategories.length === 0) return;
  
  const miscSuperCategoryId = await getMiscSuperCategoryId(userId);

  // Get existing budget categories
  let existingCategories = await getBudgetCategories(userId);
  if (existingCategories.length === 0) {
    await ensureDefaultBudgetHierarchy(userId);
    existingCategories = await getBudgetCategories(userId);
  }
  const existingByKey = new Map<string, string>(
    existingCategories.map(c => [normalizeCategoryNameKey(c.name), c.name])
  );
  
  // Find new categories that don't exist in budget
  const candidates = uniqueCategoryNamesByKey(transactionCategories);
  const newCategories = candidates.filter(name => {
    const key = normalizeCategoryNameKey(name);
    return !existingByKey.has(key);
  });
  
  if (newCategories.length === 0) return;
  
  // Insert new categories
  const maxOrder = existingCategories
    .filter(c => c.super_category_id === miscSuperCategoryId)
    .reduce((max, c) => Math.max(max, c.display_order || 0), 0);
  const categoryRecords = newCategories.map((rawName, idx) => ({
    user_id: userId,
    name: normalizeCategoryDisplayName(rawName),
    is_custom: false,
    display_order: maxOrder + idx + 1,
    super_category_id: miscSuperCategoryId,
    is_fixed_expense_category: guessIsFixedExpenseCategoryName(rawName),
    category_type: 'expense',
  }));
  
  const { error } = await supabase.from('budget_categories').upsert(categoryRecords, {
    onConflict: 'user_id,name',
    ignoreDuplicates: true,
  });
  
  if (error) {
    console.error('[syncTransactionCategoriesToBudget] Error:', error);
  }
}

/**
 * Check if a category has transactions
 */
export async function categoryHasTransactions(userId: string, categoryName: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('category', categoryName);

  if (error) {
    throw new Error(`Failed to check transactions: ${error.message}`);
  }

  return (count || 0) > 0;
}

/**
 * Get all categories that have transactions (batched check for performance)
 * Returns a Set of category names that have transactions
 */
export async function getCategoriesWithTransactions(userId: string): Promise<Set<string>> {
  // Load only unique categories, not all transaction rows
  const { data, error } = await supabase
    .from('transactions')
    .select('category')
    .eq('user_id', userId)
    .not('category', 'is', null)
    .neq('category', '')
    .limit(1000); // Reasonable limit - most users won't have > 1000 unique categories

  if (error) {
    throw new Error(`Failed to get categories with transactions: ${error.message}`);
  }

  const categories = new Set<string>();
  for (const txn of data || []) {
    if (txn.category && typeof txn.category === 'string') {
      categories.add(txn.category.trim());
    }
  }

  return categories;
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
    .eq('month', month)
    .not('category_id', 'is', null);

  if (error) {
    throw new Error(`Failed to get budgets: ${error.message}`);
  }

  return data || [];
}

/**
 * Get super-category budgets for a specific month
 */
export async function getSuperBudgetsForMonth(
  userId: string,
  month: string
): Promise<Budget[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .is('category_id', null)
    .not('super_category_id', 'is', null);

  if (error) {
    throw new Error(`Failed to get super-category budgets: ${error.message}`);
  }

  return data || [];
}

/**
 * Get all budgets (categories + super-categories) for a specific month
 */
export async function getAllBudgetsForMonth(
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
 * Save super-category budgets for a month (replace existing)
 */
export async function saveSuperBudgets(
  userId: string,
  month: string,
  budgets: Array<{ super_category_id: string; budgeted_amount: number }>
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('budgets')
    .delete()
    .eq('user_id', userId)
    .eq('month', month)
    .is('category_id', null);

  if (deleteError) {
    throw new Error(`Failed to clear super-category budgets: ${deleteError.message}`);
  }

  if (budgets.length === 0) {
    return;
  }

  const records = budgets.map(b => ({
    user_id: userId,
    category_id: null,
    super_category_id: b.super_category_id,
    month,
    budgeted_amount: b.budgeted_amount,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('budgets')
    .insert(records);

  if (error) {
    throw new Error(`Failed to save super-category budgets: ${error.message}`);
  }
}

/**
 * Get the most recent month that has budget records for a user
 * Useful for budget carryover to future months
 */
export async function getMostRecentBudgetMonth(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('budgets')
    .select('month')
    .eq('user_id', userId)
    .order('month', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to get most recent budget month: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0].month;
}

/**
 * Copy budgets from one month to another
 * Used for automatic budget carryover to future months
 */
export async function copyBudgetsToMonth(
  userId: string,
  fromMonth: string,
  toMonth: string
): Promise<void> {
  // Get source month budgets
  const sourceBudgets = await getAllBudgetsForMonth(userId, fromMonth);
  
  if (sourceBudgets.length === 0) {
    return; // Nothing to copy
  }

  // Create target month budget records
  const targetCategoryBudgets = sourceBudgets
    .filter(b => b.category_id)
    .map(b => ({
      category_id: b.category_id as string,
      budgeted_amount: b.budgeted_amount,
    }));

  const targetSuperBudgets = sourceBudgets
    .filter(b => b.super_category_id)
    .map(b => ({
      super_category_id: b.super_category_id as string,
      budgeted_amount: b.budgeted_amount,
    }));

  if (targetCategoryBudgets.length > 0) {
    await saveBudgets(userId, toMonth, targetCategoryBudgets);
  }

  await saveSuperBudgets(userId, toMonth, targetSuperBudgets);
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
    // Backward-compat: older ingestion paths stored rows without transaction_type.
    // Ingestion convention: negative = debits/charges (expense-like).
    .or('transaction_type.in.(expense,other),and(transaction_type.is.null,amount.lt.0)')
    .limit(10000); // Reasonable limit for one month of transactions

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

export async function getSpendingByCategoryForMonth(
  userId: string,
  month: string
): Promise<Record<string, number>> {
  return getSpendingByCategory(userId, month);
}

export async function getFixedExpenseTotalsForMonth(
  userId: string,
  month: string
): Promise<Record<string, number>> {
  const startDate = `${month}-01`;
  const [year, monthNum] = month.split('-').map(Number);
  const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('transactions')
    .select('category, amount, fixed_expense_status, is_fixed_expense, transaction_type')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .or('fixed_expense_status.eq.fixed,fixed_expense_status.eq.maybe,is_fixed_expense.eq.true')
    .in('transaction_type', ['expense', 'other'])
    .not('category', 'is', null);

  if (error) {
    throw new Error(`Failed to get fixed expenses: ${error.message}`);
  }

  const totals: Record<string, number> = {};
  for (const txn of data || []) {
    const category = (txn.category || 'Uncategorized').trim();
    totals[category] = (totals[category] || 0) + Math.abs(Number(txn.amount));
  }

  return totals;
}

export async function resolveFixBudgetMonth(
  userId: string,
  lastMonth: string,
  currentMonth: string
): Promise<string> {
  const lastMonthSpending = await getSpendingByCategory(userId, lastMonth);
  const hasLastMonthData = Object.values(lastMonthSpending).some((value) => value > 0);
  return hasLastMonthData ? lastMonth : currentMonth;
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
    // Exclude synthetic "user provided" income rows from derived income.
    .neq('merchant', USER_PROVIDED_INCOME_MERCHANT)
    // Backward-compat: older ingestion paths stored rows without transaction_type.
    // Ingestion convention: positive = credits/deposits (income-like).
    .or('transaction_type.eq.income,and(transaction_type.is.null,amount.gt.0)');

  if (error) {
    throw new Error(`Failed to get income: ${error.message}`);
  }

  return (data || []).reduce((sum, txn) => sum + Math.abs(Number(txn.amount)), 0);
}

/**
 * Get user-provided income specifically (manually entered via budget UI)
 * Returns 0 if no user-provided income exists for the month
 */
export async function getUserProvidedIncome(userId: string, month: string): Promise<number> {
  const date = `${month}-01`;
  
  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('transaction_type', 'income')
    .eq('merchant', USER_PROVIDED_INCOME_MERCHANT)
    .single();

  if (error) {
    // PGRST116 is "not found" error, which means no user-provided income
    if (error.code === 'PGRST116') {
      return 0;
    }
    throw new Error(`Failed to get user-provided income: ${error.message}`);
  }

  return Math.abs(Number(data?.amount || 0));
}

/**
 * Save user-provided income as a transaction for a specific month
 * This is used when users manually enter their income via the questionnaire
 */
export async function saveUserProvidedIncome(
  userId: string,
  month: string,
  amount: number
): Promise<void> {
  // Use the first day of the month as the transaction date
  const date = `${month}-01`;
  
  // Check if there's already a user-provided income transaction for this month
  const { data: existing, error: checkError } = await supabase
    .from('transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('transaction_type', 'income')
    .eq('merchant', USER_PROVIDED_INCOME_MERCHANT)
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    // PGRST116 is "not found" error, which is fine
    throw new Error(`Failed to check existing income: ${checkError.message}`);
  }

  if (existing) {
    // Update existing user-provided income
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ amount })
      .eq('id', existing.id);

    if (updateError) {
      throw new Error(`Failed to update income: ${updateError.message}`);
    }
  } else {
    // Create new income transaction
    const { error: insertError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        date,
        merchant: USER_PROVIDED_INCOME_MERCHANT,
        amount,
        transaction_type: 'income',
        category: 'Income',
        description: 'Manually entered income for budgeting',
        source: 'file_upload', // Mark as manual entry
      });

    if (insertError) {
      throw new Error(`Failed to save income: ${insertError.message}`);
    }
  }
}

/**
 * Find the most recent month with income transactions
 */
export async function findLastMonthWithIncome(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('date')
    .eq('user_id', userId)
    // Exclude synthetic "user provided" income rows from derived income discovery.
    .neq('merchant', USER_PROVIDED_INCOME_MERCHANT)
    .or('transaction_type.eq.income,and(transaction_type.is.null,amount.gt.0)')
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

  // Add limit to prevent memory issues with large datasets
  const { data, error } = await supabase
    .from('transactions')
    .select('date, category, amount, transaction_type')
    .eq('user_id', userId)
    .gte('date', startDateStr)
    .or('transaction_type.in.(expense,other),and(transaction_type.is.null,amount.lt.0)')
    .limit(10000); // Limit to 10k transactions max

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
  userProvidedIncome?: number; // User-entered income (if exists)
  hasUserProvidedIncome: boolean; // Whether user has manually set income
}> {
  // Check if categories exist
  let categories = await getBudgetCategories(userId);
  let isInitialized = categories.length > 0;

  // If no categories, initialize them
  if (!isInitialized) {
    categories = await initializeBudgetCategories(userId);
    isInitialized = true;
  }

  // Get budgets, spending, income, and user-provided income in parallel
  const [budgets, spending, income, userProvidedIncome] = await Promise.all([
    getBudgetsForMonth(userId, month),
    getSpendingByCategory(userId, month),
    getIncomeForMonth(userId, month),
    getUserProvidedIncome(userId, month),
  ]);

  // If no income in requested month, find the last month with income
  let incomeMonth = month;
  let finalIncome = income;
  const hasUserProvidedIncome = userProvidedIncome > 0;

  if (income === 0 && !hasUserProvidedIncome) {
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
    userProvidedIncome,
    hasUserProvidedIncome,
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

/**
 * Adjust budget allocations for specific categories
 * Used by chat LLM to make conversational budget changes
 */
export async function adjustBudgetAllocations(
  userId: string,
  month: string,
  adjustments: Array<{ categoryName: string; newAmount: number }>
): Promise<{
  success: boolean;
  updatedCategories: Array<{ name: string; oldAmount: number; newAmount: number }>;
  newTotalBudgeted: number;
  newReadyToAssign: number;
  error?: string;
}> {
  try {
    // Get current budget data to validate
    const budgetData = await getBudgetData(userId, month);
    const categories = budgetData.categories;
    
    // Find category IDs for the adjustments
    const updates: Array<{ categoryId: string; categoryName: string; oldAmount: number; newAmount: number }> = [];
    
    for (const adjustment of adjustments) {
      const category = categories.find(
        c => c.name.toLowerCase() === adjustment.categoryName.toLowerCase()
      );
      
      if (!category) {
        return {
          success: false,
          updatedCategories: [],
          newTotalBudgeted: 0,
          newReadyToAssign: 0,
          error: `Category "${adjustment.categoryName}" not found`,
        };
      }
      
      const currentBudget = budgetData.budgets.find(b => b.category_id === category.id);
      const oldAmount = currentBudget?.budgeted_amount || 0;
      
      updates.push({
        categoryId: category.id!,
        categoryName: category.name,
        oldAmount,
        newAmount: adjustment.newAmount,
      });
    }
    
    // Calculate new total
    let newTotalBudgeted = 0;
    for (const category of categories) {
      const update = updates.find(u => u.categoryId === category.id);
      if (update) {
        newTotalBudgeted += update.newAmount;
      } else {
        const currentBudget = budgetData.budgets.find(b => b.category_id === category.id);
        newTotalBudgeted += currentBudget?.budgeted_amount || 0;
      }
    }
    
    // Validate total doesn't exceed income
    if (newTotalBudgeted > budgetData.income) {
      return {
        success: false,
        updatedCategories: [],
        newTotalBudgeted: 0,
        newReadyToAssign: 0,
        error: `Total budget ($${newTotalBudgeted.toFixed(2)}) would exceed income ($${budgetData.income.toFixed(2)})`,
      };
    }
    
    // Save the updates
    for (const update of updates) {
      await supabase
        .from('budgets')
        .upsert({
          user_id: userId,
          category_id: update.categoryId,
          month,
          budgeted_amount: update.newAmount,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,category_id,month',
        });
    }
    
    const newReadyToAssign = budgetData.income - newTotalBudgeted;
    
    return {
      success: true,
      updatedCategories: updates.map(u => ({
        name: u.categoryName,
        oldAmount: u.oldAmount,
        newAmount: u.newAmount,
      })),
      newTotalBudgeted,
      newReadyToAssign,
    };
  } catch (error: any) {
    return {
      success: false,
      updatedCategories: [],
      newTotalBudgeted: 0,
      newReadyToAssign: 0,
      error: error.message,
    };
  }
}

/**
 * Analyze budget health for the current month
 * Returns detailed analysis including overspent categories, health status, and contributing transactions
 */
export async function analyzeBudgetHealth(userId: string, month: string): Promise<{
  healthStatus: 'on_track' | 'at_risk' | 'off_track';
  overspentCategories: Array<{
    name: string;
    budgeted: number;
    spent: number;
    overspent: number;
    firstOverspentDate?: string;
    transactionCount: number;
    largeTransactionsTotal: number;
    largeTransactionsCount: number;
    largeTransactions: Array<{
      date: string;
      merchant: string;
      amount: number;
      description?: string;
    }>;
  }>;
  totalBudgeted: number;
  totalSpent: number;
  utilizationPercentage: number;
  firstCategoryOverBudget?: string;
}> {
  // Get budget data
  const budgetData = await getBudgetData(userId, month);
  
  // Get all transactions for the month to analyze patterns
  const startDate = `${month}-01`;
  const [year, monthNum] = month.split('-').map(Number);
  const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0]; // last day of month
  
  const { data: transactions, error: txnError } = await supabase
    .from('transactions')
    .select('date, merchant, amount, category, description')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    // Backward-compat: older ingestion paths stored rows without transaction_type.
    // Ingestion convention: negative = debits/charges (expense-like).
    .or('transaction_type.in.(expense,other),and(transaction_type.is.null,amount.lt.0)')
    .order('date', { ascending: true });
  
  if (txnError) {
    throw new Error(`Failed to get transactions: ${txnError.message}`);
  }
  
  // Calculate category spending and identify overspent categories
  const overspentCategories: Array<{
    name: string;
    budgeted: number;
    spent: number;
    overspent: number;
    firstOverspentDate?: string;
    transactionCount: number;
    largeTransactionsTotal: number;
    largeTransactionsCount: number;
    largeTransactions: Array<{
      date: string;
      merchant: string;
      amount: number;
      description?: string;
    }>;
  }> = [];
  
  let totalBudgeted = 0;
  let totalSpent = 0;
  let firstCategoryOverBudget: string | undefined;
  let earliestOverspentDate: string | undefined;
  
  // Build category map for quick lookup
  const categorySpendingMap: Record<string, number> = budgetData.spending;
  
  for (const category of budgetData.categories) {
    const budget = budgetData.budgets.find(b => b.category_id === category.id);
    const budgetedAmount = budget?.budgeted_amount || 0;
    const spentAmount = categorySpendingMap[category.name] || 0;
    
    totalBudgeted += budgetedAmount;
    totalSpent += spentAmount;
    
    if (spentAmount > budgetedAmount && budgetedAmount > 0) {
      const overspent = spentAmount - budgetedAmount;
      
      // Find transactions for this category
      const categoryTransactions = (transactions || [])
        .filter(t => t.category === category.name)
        .map(t => ({
          date: t.date,
          merchant: t.merchant || 'Unknown',
          amount: Math.abs(Number(t.amount)),
          description: t.description,
        }));
      
      // Find large transactions (> 20% of budget or > $100)
      const largeThreshold = Math.max(budgetedAmount * 0.2, 100);
      const largeTransactions = categoryTransactions
        .filter(t => t.amount >= largeThreshold)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);
      const largeTransactionsTotal = largeTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      
      // Find when this category first went over budget
      let runningTotal = 0;
      let firstOverspentDate: string | undefined;
      for (const txn of categoryTransactions) {
        runningTotal += txn.amount;
        if (runningTotal > budgetedAmount && !firstOverspentDate) {
          firstOverspentDate = txn.date;
          
          // Track the earliest category to go over budget
          if (!earliestOverspentDate || txn.date < earliestOverspentDate) {
            earliestOverspentDate = txn.date;
            firstCategoryOverBudget = category.name;
          }
          break;
        }
      }
      
      overspentCategories.push({
        name: category.name,
        budgeted: budgetedAmount,
        spent: spentAmount,
        overspent,
        firstOverspentDate,
        transactionCount: categoryTransactions.length,
        largeTransactionsTotal,
        largeTransactionsCount: largeTransactions.length,
        largeTransactions,
      });
    }
  }
  
  // Sort overspent categories by overspent amount (descending)
  overspentCategories.sort((a, b) => b.overspent - a.overspent);
  
  // Calculate health status
  const overspentCount = overspentCategories.length;
  let healthStatus: 'on_track' | 'at_risk' | 'off_track';
  
  if (overspentCount === 0) {
    healthStatus = 'on_track';
  } else if (overspentCount <= 2) {
    healthStatus = 'at_risk';
  } else {
    healthStatus = 'off_track';
  }
  
  // Calculate utilization percentage
  const utilizationPercentage = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  
  return {
    healthStatus,
    overspentCategories,
    totalBudgeted,
    totalSpent,
    utilizationPercentage,
    firstCategoryOverBudget,
  };
}

