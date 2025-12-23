import { NextRequest, NextResponse } from 'next/server';
import { 
  getBudgetData, 
  saveBudgets, 
  hasBudgets,
  hasTransactions,
  getMedianMonthlyIncome,
  getCategoriesWithTransactions,
  getMostRecentBudgetMonth,
  getBudgetsForMonth,
  getHistoricalSpendingBreakdown,
  getCategoriesFromTransactions,
  syncTransactionCategoriesToBudget,
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

    // First, ensure budget categories are synced with transaction categories
    const transactionCategories = await getCategoriesFromTransactions(userId);
    if (transactionCategories.length > 0) {
      await syncTransactionCategoriesToBudget(userId, transactionCategories);
    }

    // Get basic data first
    const data = await getBudgetData(userId, month);
    
    // Then fetch supplementary data in parallel
    // Reduce months for historical data to save memory
    const [transactionsExist, incomeStats, categoriesWithTransactions, historicalSpending, fixedExpensesByCategory] = await Promise.all([
      hasTransactions(userId),
      getMedianMonthlyIncome(userId, 6), // Reduced from 12 to 6 months
      getCategoriesWithTransactions(userId),
      getHistoricalSpendingBreakdown(userId, 3), // Reduced from 6 to 3 months
      getFixedExpensesByCategory(userId),
    ]);
    
    // Check if this is a past month with no budgets - use baseline data
    const currentMonth = new Date().toISOString().slice(0, 7);
    const isPastMonth = month < currentMonth;
    const hasBudgetsForMonth = data.budgets.length > 0;
    let isBaselineData = false;
    let baselineMonth: string | null = null;
    let baselineBudgets: Record<string, number> = {};
    
    if (isPastMonth && !hasBudgetsForMonth) {
      // Try to get the most recent month's budgets as baseline
      const recentBudgetMonth = await getMostRecentBudgetMonth(userId);
      if (recentBudgetMonth) {
        const recentBudgets = await getBudgetsForMonth(userId, recentBudgetMonth);
        isBaselineData = true;
        baselineMonth = recentBudgetMonth;
        baselineBudgets = recentBudgets.reduce((acc, b) => {
          acc[b.category_id] = b.budgeted_amount;
          return acc;
        }, {} as Record<string, number>);
      }
    }
    
    // Transform data for frontend
    const categoryBudgets = data.categories.map((category) => {
      const categoryId = category.id ?? '';
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
      
      // Pre-fill with suggested budget if no budget is set and we have a suggestion
      // Round UP to whole dollars for cleaner budgeting
      if (budgeted === 0 && suggestedBudget > 0 && !isPastMonth) {
        budgeted = Math.ceil(suggestedBudget);
      }
      
      return {
        id: categoryId,
        name: category.name,
        isCustom: category.is_custom,
        hasTransactions: categoriesWithTransactions.has(category.name),
        budgeted: Math.round(Number(budgeted)), // Round to whole dollars
        spent: Number(spent),       // Ensure number
        available: Math.round(Number(budgeted)) - Number(spent),
        // Pre-fill data for reference
        historicalAverage: Math.round(historicalAverage * 100) / 100,
        fixedExpenseAmount: Math.round(fixedExpenseAmount * 100) / 100,
        suggestedBudget: Math.ceil(suggestedBudget), // Round up suggested budget too
      };
    });

    // Filter out categories that have no activity and no historical data
    // Keep categories that have:
    // 1. Transactions (spent > 0), OR
    // 2. Budget allocated (budgeted > 0), OR  
    // 3. Historical spending or fixed expenses (suggestedBudget > 0)
    const activeCategoryBudgets = categoryBudgets.filter(cat => 
      cat.spent > 0 || 
      cat.budgeted > 0 || 
      (cat.suggestedBudget && cat.suggestedBudget > 0) ||
      cat.hasTransactions
    );

    // Sort by: budgeted amount desc (budgeted > 0 first), then suggested budget, then spent, then name
    activeCategoryBudgets.sort((a, b) => {
      // Priority 1: Categories with budget allocated come first
      if ((a.budgeted > 0 ? 1 : 0) !== (b.budgeted > 0 ? 1 : 0)) {
        return (b.budgeted > 0 ? 1 : 0) - (a.budgeted > 0 ? 1 : 0);
      }
      
      // Priority 2: Within budgeted categories, sort by amount desc
      if (a.budgeted > 0 && b.budgeted > 0 && b.budgeted !== a.budgeted) {
        return b.budgeted - a.budgeted;
      }
      
      // Priority 3: For unbudgeted categories, sort by suggested budget desc
      const aSuggested = a.suggestedBudget || 0;
      const bSuggested = b.suggestedBudget || 0;
      if (aSuggested > 0 || bSuggested > 0) {
        if (bSuggested !== aSuggested) {
          return bSuggested - aSuggested;
        }
      }
      
      // Priority 4: Sort by spent amount desc
      if (b.spent !== a.spent) {
        return b.spent - a.spent;
      }
      
      // Priority 5: Alphabetically by name
      return a.name.localeCompare(b.name);
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

    // Calculate ready to assign using effective income (use all categories for calculation)
    const totalBudgeted = categoryBudgets.reduce((sum, c) => sum + c.budgeted, 0);
    const readyToAssign = effectiveIncome - totalBudgeted;

    return NextResponse.json({
      month,
      income: effectiveIncome,
      incomeMonth: effectiveIncomeMonth, // 'median' if using median, otherwise actual month
      incomeSource, // 'user_entered', 'transactions', 'median', or 'none'
      totalBudgeted,
      readyToAssign,
      categories: activeCategoryBudgets, // Return only active categories
      hasTransactions: transactionsExist,
      incomeStats: incomeStats,
      isBaselineData,
      baselineMonth,
    });

  } catch (error: any) {
    console.error('Error getting budget data:', error);
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
    const { userId, month, budgets } = body;

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

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error saving budgets:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save budgets' },
      { status: 500 }
    );
  }
}

