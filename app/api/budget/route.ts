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
} from '@/lib/budget-utils';

export const runtime = 'nodejs';

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

    const [data, transactionsExist, incomeStats, categoriesWithTransactions] = await Promise.all([
      getBudgetData(userId, month),
      hasTransactions(userId),
      getMedianMonthlyIncome(userId, 12),
      getCategoriesWithTransactions(userId),
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
      
      // Use actual budget if exists, otherwise use baseline budget for past months
      // (use nullish coalescing so a valid 0 budget doesn't fall back)
      const budgeted = budget?.budgeted_amount ??
        (isBaselineData ? (baselineBudgets[categoryId] ?? 0) : 0);
      
      return {
        id: categoryId,
        name: category.name,
        isCustom: category.is_custom,
        hasTransactions: categoriesWithTransactions.has(category.name),
        budgeted,
        spent,
        available: budgeted - spent,
      };
    });

    // Sort by spent amount (highest first)
    categoryBudgets.sort((a, b) => b.spent - a.spent);

    // Determine effective income: prefer median, then month-specific, then 0
    const medianIncome = incomeStats?.medianMonthlyIncome || 0;
    const effectiveIncome = medianIncome > 0 ? medianIncome : data.income;
    const effectiveIncomeMonth = medianIncome > 0 ? 'median' : data.incomeMonth;

    // Calculate ready to assign using effective income
    const totalBudgeted = categoryBudgets.reduce((sum, c) => sum + c.budgeted, 0);
    const readyToAssign = effectiveIncome - totalBudgeted;

    return NextResponse.json({
      month,
      income: effectiveIncome,
      incomeMonth: effectiveIncomeMonth, // 'median' if using median, otherwise actual month
      totalBudgeted,
      readyToAssign,
      categories: categoryBudgets,
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

