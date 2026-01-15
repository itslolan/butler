import { NextRequest, NextResponse } from 'next/server';
import { 
  getMostRecentBudgetMonth,
  copyBudgetsToMonth,
  getAllBudgetsForMonth,
} from '@/lib/budget-utils';

export const runtime = 'nodejs';

/**
 * POST /api/budget/carryover
 * Automatically copy budgets from the most recent month to a target month
 * Body: { userId, targetMonth }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, targetMonth } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
      return NextResponse.json(
        { error: 'Valid targetMonth is required (format: YYYY-MM)' },
        { status: 400 }
      );
    }

    // Check if target month already has budgets
    const existingBudgets = await getAllBudgetsForMonth(userId, targetMonth);
    if (existingBudgets.length > 0) {
      return NextResponse.json({ 
        success: true, 
        copied: false,
        message: 'Target month already has budgets' 
      });
    }

    // Find the most recent month with budgets
    const sourceMonth = await getMostRecentBudgetMonth(userId);
    
    if (!sourceMonth) {
      return NextResponse.json({ 
        success: true, 
        copied: false,
        message: 'No source budgets found to copy from' 
      });
    }

    // Copy budgets to target month
    await copyBudgetsToMonth(userId, sourceMonth, targetMonth);

    return NextResponse.json({ 
      success: true, 
      copied: true,
      sourceMonth,
      targetMonth,
      message: `Copied budgets from ${sourceMonth} to ${targetMonth}` 
    });

  } catch (error: any) {
    console.error('Error in budget carryover:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to carry over budgets' },
      { status: 500 }
    );
  }
}

