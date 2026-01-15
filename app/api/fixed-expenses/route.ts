import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * GET - Return fixed expenses aggregated to monthly + MTD views.
 *
 * Note:
 * The older cadence-based fixed-expense computation + caching is intentionally disabled for now.
 * We derive "monthly fixed" amounts from the most recent month of real transactions per merchant.
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

    // Fetch recent fixed-expense transactions (including "maybe" candidates).
    // We use a rolling window so we can estimate the monthly amount from last month even
    // if the current month’s deduction hasn't happened yet.
    const now = new Date();
    const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    windowStart.setUTCDate(windowStart.getUTCDate() - 120);
    const windowStartStr = windowStart.toISOString().slice(0, 10);

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
      .gte('date', windowStartStr)
      .order('date', { ascending: false })
      .limit(2000);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data || []) as any[];

    const monthKeyUTC = (d: string | Date) => {
      const dt = new Date(d);
      if (!Number.isFinite(dt.getTime())) return '';
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
    };
    const currentMonthKey = monthKeyUTC(now);

    type MerchantMonthAgg = {
      sum: number;
      dates: string[]; // YYYY-MM-DD
      anyMaybe: boolean;
      latestTxnId: string | null;
      latestSource: string | null;
      latestConfidence: number | null;
      latestExplain: string | null;
      latestCurrency: string | null;
      latestDate: string | null;
    };

    const byMerchant = new Map<string, Map<string, MerchantMonthAgg>>();

    for (const r of rows) {
      const merchant = typeof r.merchant === 'string' ? r.merchant : 'Unknown';
      const dateStr =
        typeof r.date === 'string' ? r.date : r.date ? new Date(r.date).toISOString().slice(0, 10) : '';
      const mKey = monthKeyUTC(dateStr);
      if (!mKey) continue;

      const absAmount = Math.abs(Number(r.amount));
      if (!Number.isFinite(absAmount) || absAmount <= 0) continue;

      if (!byMerchant.has(merchant)) byMerchant.set(merchant, new Map());
      const byMonth = byMerchant.get(merchant)!;
      if (!byMonth.has(mKey)) {
        byMonth.set(mKey, {
          sum: 0,
          dates: [],
          anyMaybe: false,
          latestTxnId: null,
          latestSource: null,
          latestConfidence: null,
          latestExplain: null,
          latestCurrency: null,
          latestDate: null,
        });
      }

      const agg = byMonth.get(mKey)!;
      agg.sum += absAmount;
      if (dateStr) agg.dates.push(dateStr);
      if (r.fixed_expense_status === 'maybe') agg.anyMaybe = true;

      // Track latest txn meta (within this month bucket)
      const existingLatest = agg.latestDate ? new Date(agg.latestDate).getTime() : -Infinity;
      const curTime = dateStr ? new Date(dateStr).getTime() : -Infinity;
      if (curTime >= existingLatest) {
        agg.latestDate = dateStr || agg.latestDate;
        agg.latestTxnId = typeof r.id === 'string' ? r.id : agg.latestTxnId;
        agg.latestSource = typeof r.fixed_expense_source === 'string' ? r.fixed_expense_source : agg.latestSource;
        agg.latestConfidence =
          typeof r.fixed_expense_confidence === 'number' ? r.fixed_expense_confidence : agg.latestConfidence;
        agg.latestExplain = typeof r.fixed_expense_explain === 'string' ? r.fixed_expense_explain : agg.latestExplain;
        agg.latestCurrency = typeof r.currency === 'string' ? r.currency : agg.latestCurrency;
      }
    }

    const items: Array<{
      id: string; // representative transaction id
      merchant: string;
      monthly_amount: number;
      mtd_amount: number;
      month_dates: string[]; // YYYY-MM-DD (in current month)
      is_maybe: boolean;
      currency: string | null;
      fixed_expense_source: string | null;
      fixed_expense_confidence: number | null;
      fixed_expense_explain: string | null;
    }> = [];

    for (const [merchant, monthsMap] of byMerchant.entries()) {
      const monthKeys = Array.from(monthsMap.keys()).sort(); // ascending
      const latestMonthKey = monthKeys[monthKeys.length - 1];
      const latestAgg = latestMonthKey ? monthsMap.get(latestMonthKey) : null;
      if (!latestAgg) continue;

      const currentAgg = monthsMap.get(currentMonthKey) || null;
      const monthlyAmount = latestAgg.sum;
      const mtdAmount = currentAgg ? currentAgg.sum : 0;

      // Representative id: prefer latest txn in current month, else latest txn in latest month
      const repId = (currentAgg?.latestTxnId || latestAgg.latestTxnId || '') as string;

      const monthDates = (currentAgg?.dates || [])
        .filter((d) => typeof d === 'string' && d)
        .sort((a, b) => a.localeCompare(b));

      items.push({
        id: repId,
        merchant,
        monthly_amount: Math.round(monthlyAmount * 100) / 100,
        mtd_amount: Math.round(mtdAmount * 100) / 100,
        month_dates: monthDates,
        is_maybe: !!(currentAgg?.anyMaybe || latestAgg.anyMaybe),
        currency: currentAgg?.latestCurrency || latestAgg.latestCurrency || null,
        fixed_expense_source: currentAgg?.latestSource || latestAgg.latestSource || null,
        fixed_expense_confidence: currentAgg?.latestConfidence ?? latestAgg.latestConfidence ?? null,
        fixed_expense_explain: currentAgg?.latestExplain || latestAgg.latestExplain || null,
      });
    }

    // Sort by monthly amount (highest first)
    items.sort((a, b) => (b.monthly_amount || 0) - (a.monthly_amount || 0) || a.merchant.localeCompare(b.merchant));

    const monthly_total = items.reduce((sum, i) => sum + (Number(i.monthly_amount) || 0), 0);
    const mtd_total = items.reduce((sum, i) => sum + (Number(i.mtd_amount) || 0), 0);

    return NextResponse.json(
      {
        month: currentMonthKey,
        monthly_total: Math.round(monthly_total * 100) / 100,
        mtd_total: Math.round(mtd_total * 100) / 100,
        expenses: items,
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
      {
        error: error.message || 'Failed to get fixed expenses',
        expenses: [],
        month: new Date().toISOString().slice(0, 7),
        monthly_total: 0,
        mtd_total: 0,
      },
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
