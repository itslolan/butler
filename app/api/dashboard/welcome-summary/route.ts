import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCategoryBreakdown, getIncomeVsExpenses } from '@/lib/assistant-functions';
import { getFixedExpenseCategoryNames } from '@/lib/budget-utils';
import {
  getDashboardWelcomeSummaryCache,
  upsertDashboardWelcomeSummaryCache,
} from '@/lib/db-tools';
import {
  generateWelcomeSummaryFallback,
  generateWelcomeSummaryLLM,
  type WelcomeSummaryMetrics,
} from '@/lib/llm-dashboard-welcome-summary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Availability = {
  startMonth: string | null; // YYYY-MM
  endMonth: string | null;   // YYYY-MM
  missingMonths: string[];   // YYYY-MM
  startDate: string | null;  // YYYY-MM-DD
  endDate: string | null;    // YYYY-MM-DD
};

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function addMonths(d: Date, delta: number): Date {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + delta);
  return x;
}

function monthKeyFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthStartEnd(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0)); // last day of month
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

async function getTransactionDateRange(userId: string): Promise<{ startDate: string | null; endDate: string | null }> {
  const { data: earliest, error: e1 } = await supabase
    .from('transactions')
    .select('date')
    .eq('user_id', userId)
    .order('date', { ascending: true })
    .limit(1);

  if (e1) throw new Error(`Failed to fetch earliest transaction date: ${e1.message}`);

  const { data: latest, error: e2 } = await supabase
    .from('transactions')
    .select('date')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1);

  if (e2) throw new Error(`Failed to fetch latest transaction date: ${e2.message}`);

  const startDate = (earliest && earliest[0]?.date) ? String(earliest[0].date) : null;
  const endDate = (latest && latest[0]?.date) ? String(latest[0].date) : null;
  return { startDate, endDate };
}

async function hasTransactionsInMonth(userId: string, month: string): Promise<boolean> {
  const { start, end } = monthStartEnd(month);
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', userId)
    .gte('date', start)
    .lte('date', end);

  if (error) throw new Error(`Failed to count transactions for ${month}: ${error.message}`);
  return (count || 0) > 0;
}

async function computeAvailability(userId: string): Promise<Availability> {
  const { startDate, endDate } = await getTransactionDateRange(userId);
  if (!startDate || !endDate) {
    return { startMonth: null, endMonth: null, missingMonths: [], startDate: null, endDate: null };
  }

  const [startY, startM, startD] = startDate.split('-').map(Number);
  const [endY, endM, endD] = endDate.split('-').map(Number);
  const start = new Date(Date.UTC(startY, startM - 1, startD));
  const end = new Date(Date.UTC(endY, endM - 1, endD));
  const startMonth = monthKey(start);
  const endMonth = monthKey(end);

  // Walk month-by-month and find gaps.
  const missing: string[] = [];
  let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMarker = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  // Safety cap (10 years) to avoid accidental runaway loops.
  let guard = 0;
  while (cur <= endMarker && guard++ < 120) {
    const m = monthKey(new Date(cur));
    // eslint-disable-next-line no-await-in-loop
    const ok = await hasTransactionsInMonth(userId, m);
    if (!ok) missing.push(m);
    cur = addMonths(cur, 1);
  }

  return { startMonth, endMonth, missingMonths: missing, startDate, endDate };
}

function formatMonthForLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatDurationLabel(startDate: string | null, endDate: string | null): string {
  if (!startDate || !endDate) return '0 days';
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  const msPerDay = 24 * 60 * 60 * 1000;
  const rawDays = Math.max(0, Math.ceil((end - start) / msPerDay));
  const days = Math.max(1, rawDays + 1); // inclusive-ish of start/end dates

  if (days < 14) {
    return `${days} day${days === 1 ? '' : 's'}`;
  }

  if (days < 56) {
    const weeks = Math.max(1, Math.round(days / 7));
    return `${weeks} week${weeks === 1 ? '' : 's'}`;
  }

  if (days < 730) {
    const months = Math.max(1, Math.round(days / 30.44));
    return `${months} month${months === 1 ? '' : 's'}`;
  }

  const years = Math.max(1, Math.round(days / 365.25));
  return `${years} year${years === 1 ? '' : 's'}`;
}

function buildAvailabilityOneLiner(a: Availability): string {
  const duration = formatDurationLabel(a.startDate, a.endDate);
  return `Based on ${duration} of your data.`;
}

function normalizeCategoryName(name: string | null | undefined): string {
  return (name || '').trim().toLowerCase();
}

type DayPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

function dayPeriodFromHour(hour: number): DayPeriod {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function dayPeriodFromIsoWithOffset(iso: string, tzOffsetMinutes: number): DayPeriod | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const localMs = d.getTime() - tzOffsetMinutes * 60 * 1000;
  const localHour = new Date(localMs).getUTCHours();
  return dayPeriodFromHour(localHour);
}

async function buildMetrics(userId: string): Promise<WelcomeSummaryMetrics> {
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const lastMonth = addMonths(now, -1).toISOString().slice(0, 7);

  const [ive3, currentBreakdown, lastBreakdown, fixedCategories] = await Promise.all([
    getIncomeVsExpenses(userId, { months: 3 }),
    getCategoryBreakdown(userId, { month: currentMonth }).catch(() => []),
    getCategoryBreakdown(userId, { month: lastMonth }).catch(() => []),
    getFixedExpenseCategoryNames(userId).catch(() => []),
  ]);

  const fixedSet = new Set(
    (fixedCategories || []).map((name) => normalizeCategoryName(name))
  );
  const filterFixed = (items: Array<{ category: string; total: number; count: number }>) =>
    items.filter((c) => !fixedSet.has(normalizeCategoryName(c.category)));

  return {
    currentMonth,
    lastMonth,
    incomeVsExpensesLast3: Array.isArray(ive3)
      ? ive3.map((r: any) => ({
          month: String(r.month),
          income: Number(r.income) || 0,
          expenses: Number(r.expenses) || 0,
        }))
      : undefined,
    categoryBreakdownCurrent: Array.isArray(currentBreakdown)
      ? filterFixed(
          currentBreakdown.map((c: any) => ({
            category: String(c.category),
            total: Number(c.total) || 0,
            count: Number(c.count) || 0,
          }))
        )
      : [],
    categoryBreakdownLastMonth: Array.isArray(lastBreakdown)
      ? filterFixed(
          lastBreakdown.map((c: any) => ({
            category: String(c.category),
            total: Number(c.total) || 0,
            count: Number(c.count) || 0,
          }))
        )
      : [],
  };
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const userId = sp.get('userId') || '';
    const force = sp.get('force') === '1' || sp.get('force') === 'true';
    const displayName = sp.get('displayName') || '';
    const dayPeriod = (sp.get('dayPeriod') || '').toLowerCase();
    const localTimeISO = sp.get('localTimeISO') || '';
    const tzOffsetMinutes = Number(sp.get('tzOffsetMinutes') || '0');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const [cache, availability] = await Promise.all([
      getDashboardWelcomeSummaryCache(userId),
      computeAvailability(userId),
    ]);

    const availabilityOneLiner = buildAvailabilityOneLiner(availability);

    // Serve cache if present and not forcing regen.
    const cacheMonth = cache?.generated_at ? monthKeyFromIso(cache.generated_at) : '';
    const currentMonth = new Date().toISOString().slice(0, 7);
    const cacheIsFreshForThisMonth = cacheMonth === currentMonth;
    const cacheDayPeriod = cache?.generated_at
      ? dayPeriodFromIsoWithOffset(cache.generated_at, tzOffsetMinutes)
      : null;
    const cacheMatchesDayPeriod = dayPeriod ? cacheDayPeriod === dayPeriod : true;

    if (cache?.summary_text && !force && cacheIsFreshForThisMonth && cacheMatchesDayPeriod) {
      return NextResponse.json({
        summaryText: cache.summary_text,
        fromCache: true,
        generatedAt: cache.generated_at || cache.updated_at || null,
        availability,
        availabilityOneLiner,
      });
    }

    const metrics = await buildMetrics(userId);

    let summaryText = '';
    let model: string | null = null;
    try {
      const llm = await generateWelcomeSummaryLLM(metrics, {
        displayName,
        dayPeriod,
        localTimeISO,
      });
      summaryText = llm.text;
      model = llm.model;
    } catch (e) {
      summaryText = generateWelcomeSummaryFallback(metrics, {
        displayName,
        dayPeriod,
        localTimeISO,
      });
      model = null;
    }

    // Ensure we always have something reasonable
    if (!summaryText) {
      summaryText = generateWelcomeSummaryFallback(metrics, {
        displayName,
        dayPeriod,
        localTimeISO,
      });
    }

    await upsertDashboardWelcomeSummaryCache(userId, summaryText, model);

    return NextResponse.json({
      summaryText,
      fromCache: false,
      generatedAt: new Date().toISOString(),
      availability,
      availabilityOneLiner,
    });
  } catch (error: any) {
    console.error('[welcome-summary] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate welcome summary' },
      { status: 500 }
    );
  }
}

