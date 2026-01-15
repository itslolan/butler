import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * GET - Return fixed-expense transactions.
 *
 * Note:
 * The older cadence-based fixed-expense computation + caching is intentionally disabled for now.
 * This endpoint returns transactions with `is_fixed_expense = true`.
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

    // Fetch fixed-expense transactions (including "maybe" candidates).
    const { data, error } = await supabase
      .from('transactions')
      .select(
        [
          'id',
          'date',
          'merchant',
          'amount',
          'category',
          'description',
          'currency',
          'fixed_expense_status',
          'fixed_expense_source',
          'fixed_expense_confidence',
          'fixed_expense_explain',
        ].join(',')
      )
      .eq('user_id', userId)
      .eq('is_fixed_expense', true)
      .order('date', { ascending: false })
      .limit(200);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data || []) as any[];

    // Total = sum of fixed-expense transactions in the current month (best-effort from fetched rows).
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const total = rows
      .filter((t) => {
        const d = new Date(t.date);
        return Number.isFinite(d.getTime()) && d.getTime() >= startOfMonth.getTime();
      })
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    return NextResponse.json(
      {
        total: Math.round(total * 100) / 100,
        expenses: rows.map((t) => ({
          id: t.id,
          merchant: t.merchant,
          amount: Math.abs(Number(t.amount)),
          date: t.date,
          category: t.category || null,
          description: t.description || null,
          currency: t.currency || null,
          is_maybe: t.fixed_expense_status === 'maybe',
          fixed_expense_source: t.fixed_expense_source || null,
          fixed_expense_confidence:
            typeof t.fixed_expense_confidence === 'number' ? t.fixed_expense_confidence : null,
          fixed_expense_explain: t.fixed_expense_explain || null,
        })),
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
