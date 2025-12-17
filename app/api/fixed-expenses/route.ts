import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { calculateFixedExpenses } from '@/lib/fixed-expenses';

export const runtime = 'nodejs';

/**
 * GET - Calculate and return fixed expenses
 * No caching - always calculates fresh data
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabaseAuth = createClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Calculate fresh data (no caching)
    const expenses = await calculateFixedExpenses(userId);
    const total = expenses.reduce((sum, exp) => sum + exp.median_amount, 0);

    return NextResponse.json({
      total: Math.round(total * 100) / 100,
      expenses,
      calculated_at: new Date().toISOString(),
      from_cache: false,
    });

  } catch (error: any) {
    console.error('[fixed-expenses] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get fixed expenses' },
      { status: 500 }
    );
  }
}
