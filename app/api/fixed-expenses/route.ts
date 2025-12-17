import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { 
  calculateFixedExpenses, 
  getCachedFixedExpenses, 
  cacheFixedExpenses 
} from '@/lib/fixed-expenses';

export const runtime = 'nodejs';

/**
 * GET - Get fixed expenses (from cache or calculate)
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

    // Check URL params for force refresh
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Try to get from cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await getCachedFixedExpenses(userId);
      if (cached) {
        return NextResponse.json(cached);
      }
    }

    // Calculate fresh data
    const expenses = await calculateFixedExpenses(userId);
    
    // Cache the results
    await cacheFixedExpenses(userId, expenses);

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

/**
 * POST - Force recalculate and cache fixed expenses
 */
export async function POST(request: NextRequest) {
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

    // Calculate and cache
    const expenses = await calculateFixedExpenses(userId);
    await cacheFixedExpenses(userId, expenses);

    const total = expenses.reduce((sum, exp) => sum + exp.median_amount, 0);

    return NextResponse.json({
      success: true,
      total: Math.round(total * 100) / 100,
      expenses,
      calculated_at: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[fixed-expenses] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate fixed expenses' },
      { status: 500 }
    );
  }
}
