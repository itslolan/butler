/**
 * Assistant Functions - Canonical Data Layer
 * 
 * This module provides the single source of truth for all data operations.
 * Both chat tools and dashboard components use these functions to ensure consistency.
 * 
 * Design principles:
 * - Consistent parameter interfaces ({ month?, months? })
 * - Default to current month when no time period specified
 * - Type-safe return values
 * - Well-documented behavior
 * - Testable and maintainable
 */

import {
  getCategoryBreakdown as dbGetCategoryBreakdown,
  getMonthlySpendingTrend as dbGetMonthlySpendingTrend,
  getIncomeVsExpenses as dbGetIncomeVsExpenses,
  getCashFlowSankeyData as dbGetCashFlowSankeyData,
} from './db-tools';
import {
  getBudgetData,
  analyzeBudgetHealth,
} from './budget-utils';
import {
  getCachedFixedExpenses,
  getFixedExpensesByCategory as getFixedExpensesByCategoryFromBudget,
} from './fixed-expenses';

/**
 * Common time period parameters for all functions
 */
export interface TimePeriodParams {
  /** Specific month in YYYY-MM format */
  month?: string;
  /** Number of months to analyze (e.g., 3, 6, 12) */
  months?: number;
  // If neither is specified, defaults to current month
}

/**
 * Category breakdown data structure
 */
export interface CategoryBreakdownData {
  category: string;
  total: number;
  percentage: number;
  count: number;
  spend_classification?: string | null;
}

/**
 * Monthly spending trend data structure
 */
export interface MonthlySpendingData {
  month: string;
  total: number;
}

/**
 * Income vs expenses data structure
 */
export interface IncomeVsExpensesData {
  month: string;
  income: number;
  expenses: number;
}

/**
 * Budget category data structure
 */
export interface BudgetCategoryData {
  id: string;
  name: string;
  budgeted: number;
  spent: number;
  available: number;
  isOverBudget: boolean;
}

/**
 * Fixed expense data structure
 */
export interface FixedExpenseData {
  merchant_name: string;
  median_amount: number;
  occurrence_count: number;
  months_tracked: number;
  avg_day_of_month: number;
  last_occurrence_date: string;
  is_subscription?: boolean;
  is_maybe?: boolean;
  merchant_key?: string;
}

/**
 * Get spending breakdown by category
 * 
 * @param userId - User ID
 * @param params - Time period parameters (defaults to current month)
 * @returns Array of category spending data
 * 
 * @example
 * // Get current month's categories
 * const data = await getCategoryBreakdown(userId);
 * 
 * @example
 * // Get specific month
 * const data = await getCategoryBreakdown(userId, { month: '2025-12' });
 * 
 * @example
 * // Get last 6 months
 * const data = await getCategoryBreakdown(userId, { months: 6 });
 */
export async function getCategoryBreakdown(
  userId: string,
  params: TimePeriodParams = {}
): Promise<CategoryBreakdownData[]> {
  const { month, months } = params;
  
  // Apply default: current month if no params specified
  const currentMonth = new Date().toISOString().slice(0, 7);
  const specificMonth = month || (months ? undefined : currentMonth);
  const monthsToUse = months;
  
  console.log('[assistant-functions getCategoryBreakdown] Called with:', {
    userId,
    inputParams: params,
    resolvedMonth: specificMonth,
    resolvedMonths: monthsToUse,
    currentMonth,
  });
  
  const result = await dbGetCategoryBreakdown(userId, monthsToUse, specificMonth);
  
  console.log('[assistant-functions getCategoryBreakdown] Returned:', {
    count: result.length,
    foodAndDining: result.find(r => r.category.toLowerCase().includes('food'))
  });
  
  return result;
}

/**
 * Get monthly spending trend over time
 * 
 * @param userId - User ID
 * @param params - Time period parameters (defaults to current month)
 * @returns Array of monthly spending totals
 */
export async function getMonthlySpendingTrend(
  userId: string,
  params: TimePeriodParams = {}
): Promise<MonthlySpendingData[]> {
  const { month, months } = params;
  
  // Apply default: current month if no params specified
  const currentMonth = new Date().toISOString().slice(0, 7);
  const specificMonth = month || (months ? undefined : currentMonth);
  const monthsToUse = months;
  
  return await dbGetMonthlySpendingTrend(userId, monthsToUse, specificMonth);
}

/**
 * Get income vs expenses comparison
 * 
 * @param userId - User ID
 * @param params - Time period parameters (defaults to current month)
 * @returns Array of monthly income and expense data
 */
export async function getIncomeVsExpenses(
  userId: string,
  params: TimePeriodParams = {}
): Promise<IncomeVsExpensesData[]> {
  const { month, months } = params;
  
  // Apply default: current month if no params specified
  const currentMonth = new Date().toISOString().slice(0, 7);
  const specificMonth = month || (months ? undefined : currentMonth);
  const monthsToUse = months;
  
  return await dbGetIncomeVsExpenses(userId, monthsToUse, specificMonth);
}

/**
 * Get cash flow sankey data
 * 
 * @param userId - User ID
 * @param params - Time period parameters (defaults to current month)
 * @returns Cash flow data for sankey diagram
 */
export async function getCashFlowData(
  userId: string,
  params: TimePeriodParams = {}
): Promise<any> {
  const { month, months } = params;
  
  // Apply default: current month if no params specified
  const currentMonth = new Date().toISOString().slice(0, 7);
  const specificMonth = month || (months ? undefined : currentMonth);
  const monthsToUse = months;
  
  return await dbGetCashFlowSankeyData(userId, monthsToUse, specificMonth);
}

/**
 * Get current budget with all categories
 * 
 * @param userId - User ID
 * @param month - Month in YYYY-MM format (defaults to current month)
 * @returns Budget data including categories, budgeted amounts, and spending
 */
export async function getCurrentBudget(
  userId: string,
  month?: string
): Promise<{
  income: number;
  totalBudgeted: number;
  totalSpent: number;
  readyToAssign: number;
  categories: BudgetCategoryData[];
}> {
  const currentMonth = month || new Date().toISOString().slice(0, 7);
  const budgetData = await getBudgetData(userId, currentMonth);
  
  // Transform to assistant function format
  const categories = budgetData.categories.map(cat => {
    const budget = budgetData.budgets.find(b => b.category_id === cat.id);
    const budgeted = budget?.budgeted_amount || 0;
    const spent = budgetData.spending[cat.name] || 0;
    
    return {
      id: cat.id || '',
      name: cat.name,
      budgeted,
      spent,
      available: budgeted - spent,
      isOverBudget: spent > budgeted,
    };
  }).filter(cat => cat.budgeted > 0 || cat.spent > 0);
  
  const totalBudgeted = categories.reduce((sum, cat) => sum + cat.budgeted, 0);
  const totalSpent = categories.reduce((sum, cat) => sum + cat.spent, 0);
  
  return {
    income: budgetData.income,
    totalBudgeted,
    totalSpent,
    readyToAssign: budgetData.income - totalBudgeted,
    categories,
  };
}

/**
 * Get budget health analysis
 * 
 * @param userId - User ID
 * @param month - Month in YYYY-MM format (defaults to current month)
 * @returns Detailed budget health analysis
 */
export async function getBudgetHealthAnalysis(
  userId: string,
  month?: string
): Promise<any> {
  const currentMonth = month || new Date().toISOString().slice(0, 7);
  return await analyzeBudgetHealth(userId, currentMonth);
}

/**
 * Get fixed expenses and subscriptions
 * 
 * @param userId - User ID
 * @returns Fixed expenses data with subscription detection
 */
export async function getFixedExpenses(
  userId: string
): Promise<{
  total: number;
  expenses: FixedExpenseData[];
  subscriptions: FixedExpenseData[];
  calculated_at: string;
  from_cache: boolean;
}> {
  const data = await getCachedFixedExpenses(userId);
  if (!data) {
    return {
      total: 0,
      expenses: [],
      subscriptions: [],
      calculated_at: new Date().toISOString(),
      from_cache: false,
    };
  }
  
  // Separate subscriptions from other fixed expenses
  const subscriptions = data.expenses.filter(e => e.is_subscription === true);
  
  return {
    total: data.total,
    expenses: data.expenses,
    subscriptions,
    calculated_at: data.calculated_at,
    from_cache: data.from_cache,
  };
}

/**
 * Get fixed expenses by category
 * 
 * @param userId - User ID
 * @returns Map of category name to fixed expense amount
 */
export async function getFixedExpensesByCategory(
  userId: string
): Promise<Record<string, number>> {
  return await getFixedExpensesByCategoryFromBudget(userId);
}

