import { NextRequest, NextResponse } from 'next/server';
import { 
  getBudgetData, 
  saveBudgets, 
  hasBudgets 
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

    const data = await getBudgetData(userId, month);
    
    // Transform data for frontend
    const categoryBudgets = data.categories.map(category => {
      const budget = data.budgets.find(b => b.category_id === category.id);
      const spent = data.spending[category.name] || 0;
      const budgeted = budget?.budgeted_amount || 0;
      
      return {
        id: category.id,
        name: category.name,
        isCustom: category.is_custom,
        budgeted,
        spent,
        available: budgeted - spent,
      };
    });

    // Sort by spent amount (highest first)
    categoryBudgets.sort((a, b) => b.spent - a.spent);

    // Calculate ready to assign
    const totalBudgeted = categoryBudgets.reduce((sum, c) => sum + c.budgeted, 0);
    const readyToAssign = data.income - totalBudgeted;

    return NextResponse.json({
      month,
      income: data.income,
      totalBudgeted,
      readyToAssign,
      categories: categoryBudgets,
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

