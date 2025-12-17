import { NextRequest, NextResponse } from 'next/server';
import { saveUserProvidedIncome } from '@/lib/budget-utils';

export const runtime = 'nodejs';

/**
 * POST /api/budget/income
 * Save user-provided income for a specific month
 * Body: { userId, month, amount }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, month, amount } = body;

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

    if (typeof amount !== 'number' || amount < 0) {
      return NextResponse.json(
        { error: 'Valid amount is required (must be >= 0)' },
        { status: 400 }
      );
    }

    await saveUserProvidedIncome(userId, month, amount);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error saving user-provided income:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save income' },
      { status: 500 }
    );
  }
}

