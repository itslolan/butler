import { NextRequest, NextResponse } from 'next/server';
import { 
  getBudgetData, 
  saveBudgets, 
  saveSuperBudgets,
  hasBudgets,
  hasBudgetCategories,
  hasTransactions,
  getMedianMonthlyIncome,
  getCategoriesWithTransactions,
  getMostRecentBudgetMonth,
  getAllBudgetsForMonth,
  getSuperBudgetsForMonth,
  getBudgetSuperCategories,
  getHistoricalSpendingBreakdown,
  getCategoriesFromTransactions,
  syncTransactionCategoriesToBudget,
  initializeBudgetCategories,
  DEFAULT_MISC_SUPER_CATEGORY,
} from '@/lib/budget-utils';
import { getFixedExpensesByCategory } from '@/lib/fixed-expenses';

export const runtime = 'nodejs';
export const maxDuration = 30; // 30 second timeout
export const dynamic = 'force-dynamic'; // Don't cache, but set reasonable timeout

/**
 * GET /api/budget
 * Get budget data for a specific month
 * Query params: userId, month (YYYY-MM)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log('[Budget API] Request started');
  
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const month = searchParams.get('month');
    const checkOnly = searchParams.get('checkOnly'); // Just check if budgets exist

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // If just checking existence, return quickly
    if (checkOnly === 'true') {
      const exists = await hasBudgets(userId);
      return NextResponse.json({ hasBudgets: exists });
    }

    if (!month) {
      return NextResponse.json(
        { error: 'month is required (format: YYYY-MM)' },
        { status: 400 }
      );
    }

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Invalid month format. Use YYYY-MM' },
        { status: 400 }
      );
    }

    // Ensure default hierarchy exists before syncing transaction categories
    const categoriesExist = await hasBudgetCategories(userId);
    if (!categoriesExist) {
      await initializeBudgetCategories(userId);
    }

    // Sync transaction categories (adds any new categories under Miscellaneous)
    const transactionCategories = await getCategoriesFromTransactions(userId);
    if (transactionCategories.length > 0) {
      await syncTransactionCategoriesToBudget(userId, transactionCategories);
    }

    // Get basic data first
    const data = await getBudgetData(userId, month);
    
    // Then fetch supplementary data in parallel
    // Reduce months for historical data to save memory
    const [
      transactionsExist,
      incomeStats,
      categoriesWithTransactions,
      historicalSpending,
      fixedExpensesByCategory,
      superCategories,
      superBudgets,
    ] = await Promise.all([
      hasTransactions(userId),
      getMedianMonthlyIncome(userId, 6), // Reduced from 12 to 6 months
      getCategoriesWithTransactions(userId),
      getHistoricalSpendingBreakdown(userId, 3), // Reduced from 6 to 3 months
      getFixedExpensesByCategory(userId),
      getBudgetSuperCategories(userId),
      getSuperBudgetsForMonth(userId, month),
    ]);
    
    // Check if this is a past month with no budgets - use baseline data
    const currentMonth = new Date().toISOString().slice(0, 7);
    const isPastMonth = month < currentMonth;
    const hasBudgetsForMonth = data.budgets.length > 0 || superBudgets.length > 0;
    let isBaselineData = false;
    let baselineMonth: string | null = null;
    let baselineBudgets: Record<string, number> = {};
    let baselineSuperBudgets: Record<string, number> = {};
    
    if (isPastMonth && !hasBudgetsForMonth) {
      // Try to get the most recent month's budgets as baseline
      const recentBudgetMonth = await getMostRecentBudgetMonth(userId);
      if (recentBudgetMonth) {
        const recentBudgets = await getAllBudgetsForMonth(userId, recentBudgetMonth);
        isBaselineData = true;
        baselineMonth = recentBudgetMonth;
        baselineBudgets = recentBudgets.reduce((acc, b) => {
          if (b.category_id) {
            acc[b.category_id] = b.budgeted_amount;
          }
          return acc;
        }, {} as Record<string, number>);
        baselineSuperBudgets = recentBudgets.reduce((acc, b) => {
          if (b.super_category_id) {
            acc[b.super_category_id] = b.budgeted_amount;
          }
          return acc;
        }, {} as Record<string, number>);
      }
    }
    
    // Build explicit super-category budget overrides
    const superBudgetOverrides = new Map<string, number>();
    for (const budget of superBudgets) {
      if (budget.super_category_id) {
        superBudgetOverrides.set(budget.super_category_id, Number(budget.budgeted_amount) || 0);
      }
    }

    if (isBaselineData) {
      for (const [superCategoryId, amount] of Object.entries(baselineSuperBudgets)) {
        if (!superBudgetOverrides.has(superCategoryId)) {
          superBudgetOverrides.set(superCategoryId, Number(amount) || 0);
        }
      }
    }

    const superCategoryList = [...superCategories];
    let miscSuperCategoryId =
      superCategoryList.find(sc => sc.name === DEFAULT_MISC_SUPER_CATEGORY)?.id || null;

    if (!miscSuperCategoryId) {
      miscSuperCategoryId = 'miscellaneous';
      superCategoryList.push({
        id: miscSuperCategoryId,
        user_id: userId,
        name: DEFAULT_MISC_SUPER_CATEGORY,
        display_order: superCategoryList.length,
      });
    }

    // Transform data for frontend
    const categoryBudgets = data.categories.map((category) => {
      const categoryId = category.id ?? '';
      const resolvedSuperCategoryId = category.super_category_id || miscSuperCategoryId || '';
      const hasSuperOverride =
        resolvedSuperCategoryId ? superBudgetOverrides.has(resolvedSuperCategoryId) : false;
      const budget = data.budgets.find(b => b.category_id === categoryId);
      const spent = data.spending[category.name] || 0;
      const historicalAverage = historicalSpending.categoryAverages[category.name] || 0;
      const fixedExpenseAmount = fixedExpensesByCategory[category.name] || 0;
      
      // Suggested budget: max of historical average and fixed expenses
      // This ensures fixed expenses are always covered
      const suggestedBudget = Math.max(historicalAverage, fixedExpenseAmount);
      
      // Use actual budget if exists, otherwise use baseline budget for past months
      // For current/future months with no budget, pre-fill with suggested budget
      let budgeted = budget?.budgeted_amount ??
        (isBaselineData ? (baselineBudgets[categoryId] ?? 0) : 0);

      if (!hasSuperOverride) {
        // Pre-fill with suggested budget if no budget is set and we have a suggestion
        // Round UP to whole dollars for cleaner budgeting
        if (budgeted === 0 && suggestedBudget > 0 && !isPastMonth) {
          budgeted = Math.ceil(suggestedBudget);
        }
      } else {
        budgeted = 0;
      }

      const roundedBudgeted = Math.round(Number(budgeted)) || 0;
      
      return {
        id: categoryId,
        name: category.name,
        superCategoryId: resolvedSuperCategoryId,
        displayOrder: category.display_order ?? 0,
        isCustom: category.is_custom,
        hasTransactions: categoriesWithTransactions.has(category.name),
        budgeted: roundedBudgeted, // Round to whole dollars
        spent: Number(spent),       // Ensure number
        available: roundedBudgeted - Number(spent),
        // Pre-fill data for reference
        historicalAverage: Math.round(historicalAverage * 100) / 100,
        fixedExpenseAmount: Math.round(fixedExpenseAmount * 100) / 100,
        suggestedBudget: Math.ceil(suggestedBudget), // Round up suggested budget too
      };
    });

    const categoriesBySuperCategory = new Map<string, typeof categoryBudgets>();
    for (const category of categoryBudgets) {
      const superCategoryId = category.superCategoryId || miscSuperCategoryId;
      if (!superCategoryId) continue;
      const current = categoriesBySuperCategory.get(superCategoryId) || [];
      current.push(category);
      categoriesBySuperCategory.set(superCategoryId, current);
    }

    const superCategoryBudgets = superCategoryList.map((superCategory) => {
      const superCategoryId = superCategory.id || '';
      const categories = categoriesBySuperCategory.get(superCategoryId) || [];

      categories.sort((a, b) => {
        if (a.displayOrder !== b.displayOrder) {
          return a.displayOrder - b.displayOrder;
        }
        return a.name.localeCompare(b.name);
      });

      const spent = categories.reduce((sum, c) => sum + c.spent, 0);
      const isOverride = superCategoryId ? superBudgetOverrides.has(superCategoryId) : false;
      const overrideAmount = superCategoryId ? superBudgetOverrides.get(superCategoryId) : 0;
      const budgeted = isOverride
        ? Math.round(Number(overrideAmount) || 0)
        : categories.reduce((sum, c) => sum + c.budgeted, 0);

      return {
        id: superCategoryId,
        name: superCategory.name,
        displayOrder: superCategory.display_order ?? 0,
        budgeted,
        spent,
        available: budgeted - spent,
        isOverride,
        categories,
      };
    });

    // Determine effective income with proper priority:
    // 1. User-provided income (highest priority - user's explicit choice)
    // 2. Other income from transactions (salary deposits, etc.)
    // 3. Median income (calculated from history)
    // 4. Zero (fallback)
    const medianIncome = incomeStats?.medianMonthlyIncome || 0;
    let effectiveIncome = 0;
    let effectiveIncomeMonth = month;
    let incomeSource = 'none';
    
    if (data.hasUserProvidedIncome && data.userProvidedIncome && data.userProvidedIncome > 0) {
      // User has explicitly set income - this takes highest priority
      effectiveIncome = data.userProvidedIncome;
      effectiveIncomeMonth = month;
      incomeSource = 'user_entered';
    } else if (data.income > 0) {
      // User has income from transactions (deposits, salary, etc.)
      effectiveIncome = data.income;
      effectiveIncomeMonth = data.incomeMonth;
      incomeSource = 'transactions';
    } else if (medianIncome > 0) {
      // Fall back to median income calculated from history
      effectiveIncome = medianIncome;
      effectiveIncomeMonth = 'median';
      incomeSource = 'median';
    }

    // Calculate ready to assign using effective income (use super-categories for calculation)
    const totalBudgeted = superCategoryBudgets.reduce((sum, c) => sum + c.budgeted, 0);
    const readyToAssign = effectiveIncome - totalBudgeted;

    const duration = Date.now() - startTime;
    console.log(`[Budget API] Request completed in ${duration}ms, returned ${categoryBudgets.length} categories`);
    
    return NextResponse.json({
      month,
      income: effectiveIncome,
      incomeMonth: effectiveIncomeMonth, // 'median' if using median, otherwise actual month
      incomeSource, // 'user_entered', 'transactions', 'median', or 'none'
      totalBudgeted,
      readyToAssign,
      categories: categoryBudgets,
      superCategories: superCategoryBudgets,
      hasTransactions: transactionsExist,
      incomeStats: incomeStats,
      isBaselineData,
      baselineMonth,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Budget API] Error after ${duration}ms:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to get budget data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/budget
 * Save budgets for a month
 * Body: { userId, month, budgets: [{ categoryId, amount }] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, month, budgets, superBudgets } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Valid month is required (format: YYYY-MM)' },
        { status: 400 }
      );
    }

    if (!budgets || !Array.isArray(budgets)) {
      return NextResponse.json(
        { error: 'budgets array is required' },
        { status: 400 }
      );
    }

    // Transform and save
    const budgetRecords = budgets.map((b: { categoryId: string; amount: number }) => ({
      category_id: b.categoryId,
      budgeted_amount: Number(b.amount) || 0,
    }));

    await saveBudgets(userId, month, budgetRecords);

    if (Array.isArray(superBudgets)) {
      const superBudgetRecords = superBudgets.map((b: { superCategoryId: string; amount: number }) => ({
        super_category_id: b.superCategoryId,
        budgeted_amount: Number(b.amount) || 0,
      }));
      await saveSuperBudgets(userId, month, superBudgetRecords);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error saving budgets:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save budgets' },
      { status: 500 }
    );
  }
}

