import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentBudget, getIncomeVsExpenses } from '@/lib/assistant-functions';
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
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(d: Date, delta: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + delta);
  return x;
}

function monthStartEnd(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0); // last day of month
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
    return { startMonth: null, endMonth: null, missingMonths: [] };
  }

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
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

  return { startMonth, endMonth, missingMonths: missing };
}

function formatMonthForLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function buildAvailabilityOneLiner(a: Availability): string {
  if (!a.startMonth || !a.endMonth) return 'Data availability: no transactions yet';
  const range = `${formatMonthForLabel(a.startMonth)}–${formatMonthForLabel(a.endMonth)}`;
  const gaps = a.missingMonths.length;
  if (gaps === 0) return `Data availability: ${range} (no gaps)`;
  return `Data availability: ${range} · ${gaps} gap${gaps === 1 ? '' : 's'}`;
}

async function buildMetrics(userId: string): Promise<WelcomeSummaryMetrics> {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [ive3, budget] = await Promise.all([
    getIncomeVsExpenses(userId, { months: 3 }),
    getCurrentBudget(userId, currentMonth).catch(() => null),
  ]);

  const overspentCount = budget?.categories?.filter((c: any) => c.isOverBudget)?.length || 0;

  return {
    currentMonth,
    incomeVsExpensesLast3: Array.isArray(ive3)
      ? ive3.map((r: any) => ({
          month: String(r.month),
          income: Number(r.income) || 0,
          expenses: Number(r.expenses) || 0,
        }))
      : undefined,
    currentBudget: budget
      ? {
          income: Number(budget.income) || 0,
          totalBudgeted: Number(budget.totalBudgeted) || 0,
          totalSpent: Number(budget.totalSpent) || 0,
          readyToAssign: Number(budget.readyToAssign) || 0,
          overspentCount,
        }
      : undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const userId = sp.get('userId') || '';
    const force = sp.get('force') === '1' || sp.get('force') === 'true';

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const [cache, availability] = await Promise.all([
      getDashboardWelcomeSummaryCache(userId),
      computeAvailability(userId),
    ]);

    const availabilityOneLiner = buildAvailabilityOneLiner(availability);

    // Serve cache if present and not forcing regen.
    if (cache?.summary_text && !force) {
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
      const llm = await generateWelcomeSummaryLLM(metrics);
      summaryText = llm.text;
      model = llm.model;
    } catch (e: any) {
      // No GEMINI key in env, rate limit, etc.
      summaryText = generateWelcomeSummaryFallback(metrics);
      model = null;
    }

    // Ensure we always have something reasonable
    if (!summaryText) {
      summaryText = generateWelcomeSummaryFallback(metrics);
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

