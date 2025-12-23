import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { calculateFixedExpenses, getCachedFixedExpenses, cacheFixedExpenses } from '@/lib/fixed-expenses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * GET - Return fixed expenses from DB cache by default.
 * Recalculate (and rewrite DB cache) only when:
 * - cache is empty, OR
 * - ?refresh=1 is provided (user clicked refresh button)
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabaseAuth = createClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      console.error('[fixed-expenses] Authentication failed:', authError?.message);
      return NextResponse.json(
        { error: 'Unauthorized', expenses: [], total: 0 },
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const userId = user.id;

    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === '1';

    // Normal path: read from DB cache
    if (!refresh) {
      const cached = await getCachedFixedExpenses(userId);
      if (cached) {
        return NextResponse.json(
          cached,
          {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
              Pragma: 'no-cache',
              Expires: '0',
              'Surrogate-Control': 'no-store',
            },
          }
        );
      }
    }

    // Refresh path (or cache miss): recalculate and rewrite DB cache
    const expenses = await calculateFixedExpenses(userId);
    await cacheFixedExpenses(userId, expenses);
    const total = expenses.reduce((sum, exp) => sum + exp.median_amount, 0);

    return NextResponse.json(
      {
        total: Math.round(total * 100) / 100,
        expenses,
        calculated_at: new Date().toISOString(),
        from_cache: false,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
          'Surrogate-Control': 'no-store',
        },
      }
    );

  } catch (error: any) {
    console.error('[fixed-expenses] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get fixed expenses', expenses: [], total: 0 },
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
          'Surrogate-Control': 'no-store',
        }
      }
    );
  }
}
