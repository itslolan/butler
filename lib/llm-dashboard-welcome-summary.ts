import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// Keep this lightweight/cost-effective; summary is short.
const GEMINI_MODEL = 'gemini-2.0-flash-exp';

export interface WelcomeSummaryMetrics {
  currentMonth: string; // YYYY-MM
  lastMonth?: string; // YYYY-MM
  incomeVsExpensesLast3?: Array<{ month: string; income: number; expenses: number }>;
  currentBudget?: {
    income: number;
    totalBudgeted: number;
    totalSpent: number;
    readyToAssign: number;
    overspentCount: number;
  };
  budgetIsSet?: boolean;
  categoryBreakdownCurrent?: Array<{ category: string; total: number; count: number }>;
  categoryBreakdownLastMonth?: Array<{ category: string; total: number; count: number }>;
  overspentCategories?: Array<{
    name: string;
    budgeted: number;
    spent: number;
    overspent: number;
    transactionCount: number;
    largeTransactionsTotal: number;
    largeTransactionsCount: number;
  }>;
}

// Lazy init (avoid throwing during build trace)
let _model: GenerativeModel | null = null;
function getModel(): GenerativeModel {
  if (_model) return _model;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY environment variable');

  const genAI = new GoogleGenerativeAI(apiKey);
  _model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      // We want a crisp, punchy summary
      temperature: 0.4,
      maxOutputTokens: 220,
    },
  });
  return _model;
}

function safeNum(n: any): number {
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) ? x : 0;
}

function formatUsd0(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function getTop<T>(items: T[], n: number, score: (x: T) => number): T[] {
  return [...items].sort((a, b) => score(b) - score(a)).slice(0, n);
}

function classifyOverspendPattern(cat: {
  spent: number;
  transactionCount: number;
  largeTransactionsTotal: number;
  largeTransactionsCount: number;
}): 'few_large' | 'many_small' | 'mixed' {
  const spent = Math.max(0, safeNum(cat.spent));
  const txCount = Math.max(0, Math.floor(safeNum(cat.transactionCount)));
  const largeTotal = Math.max(0, safeNum(cat.largeTransactionsTotal));
  const largeCount = Math.max(0, Math.floor(safeNum(cat.largeTransactionsCount)));

  if (spent <= 0) return 'mixed';

  const largeShare = largeTotal / spent;
  const looksFewLarge =
    (largeCount > 0 && largeShare >= 0.5) ||
    (largeCount > 0 && largeCount <= 3 && largeShare >= 0.35);

  const looksManySmall =
    (txCount >= 10 && largeShare <= 0.2) ||
    (txCount >= 14 && largeCount === 0);

  if (looksFewLarge && !looksManySmall) return 'few_large';
  if (looksManySmall && !looksFewLarge) return 'many_small';
  return 'mixed';
}

export function generateWelcomeSummaryFallback(metrics: WelcomeSummaryMetrics): string {
  const cur = metrics.currentBudget;
  const ive = metrics.incomeVsExpensesLast3 || [];
  const last = ive.length ? ive[ive.length - 1] : undefined;
  const income = safeNum(last?.income ?? cur?.income ?? 0);
  const expenses = safeNum(last?.expenses ?? cur?.totalSpent ?? 0);
  const savings = income - expenses;

  const parts: string[] = [];

  const budgetIsSet = Boolean(metrics.budgetIsSet ?? (cur && safeNum(cur.totalBudgeted) > 0));
  const overspent = (metrics.overspentCategories || []).filter(c => safeNum(c.overspent) > 0);

  // If no spending data at all, keep it simple.
  const hasAnySpend =
    expenses > 0 ||
    (metrics.categoryBreakdownCurrent || []).some(c => safeNum(c.total) > 0);
  if (!hasAnySpend) {
    return `Upload more transaction data to unlock your personalized spending snapshot.`;
  }

  // 1) Budget set: focus ONLY on categories that breached budget.
  if (budgetIsSet) {
    if (overspent.length === 0) {
      parts.push(`No categories have breached your budget yet this month — nice work staying on track.`);
      return parts.join(' ');
    }

    const top = getTop(overspent, 3, c => safeNum(c.overspent));
    const lines = top.map(c => {
      const name = c.name;
      const spentStr = formatUsd0(safeNum(c.spent));
      const budgetStr = formatUsd0(safeNum(c.budgeted));
      const overStr = formatUsd0(safeNum(c.overspent));

      const pattern = classifyOverspendPattern({
        spent: safeNum(c.spent),
        transactionCount: safeNum(c.transactionCount),
        largeTransactionsTotal: safeNum(c.largeTransactionsTotal),
        largeTransactionsCount: safeNum(c.largeTransactionsCount),
      });

      const txCount = Math.max(0, Math.floor(safeNum(c.transactionCount)));
      const largeCount = Math.max(0, Math.floor(safeNum(c.largeTransactionsCount)));
      const largeTotal = safeNum(c.largeTransactionsTotal);
      const largeSharePct = spentStr && safeNum(c.spent) > 0 ? Math.round((largeTotal / safeNum(c.spent)) * 100) : 0;

      let why = '';
      if (pattern === 'few_large') {
        why =
          largeCount > 0
            ? `mostly from ${largeCount} larger purchase${largeCount === 1 ? '' : 's'} (~${clamp(largeSharePct, 0, 100)}% of the category spend).`
            : `mostly from a few larger purchases.`;
      } else if (pattern === 'many_small') {
        why = txCount > 0 ? `mostly from many smaller charges (${txCount} transactions).` : `mostly from many smaller charges.`;
      } else {
        why = `a mix of bigger and smaller purchases.`;
      }

      return `${name} is over budget: ${spentStr} spent vs ${budgetStr} budgeted (${overStr} over) — ${why}`;
    });

    parts.push(lines.join(' '));
    return parts.join(' ');
  }

  // 2) No budget set: compare current vs last month for top categories.
  const curCats = (metrics.categoryBreakdownCurrent || []).filter(c => safeNum(c.total) > 0);
  const lastCats = metrics.categoryBreakdownLastMonth || [];
  const lastByName = new Map(lastCats.map(c => [c.category, safeNum(c.total)]));

  const topCur = getTop(curCats, 3, c => safeNum(c.total));
  if (topCur.length === 0) {
    parts.push(`This month you’ve spent about ${formatUsd0(expenses)} so far — set up a budget to see which categories are trending up.`);
    return parts.join(' ');
  }

  const increased: string[] = [];
  const comparisons = topCur.map(c => {
    const name = c.category;
    const curTotal = safeNum(c.total);
    const prevTotal = safeNum(lastByName.get(name) ?? 0);
    const delta = curTotal - prevTotal;
    const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    const deltaAbs = Math.abs(delta);
    if (delta > 0) increased.push(name);
    return `${name}: ${formatUsd0(curTotal)} this month, ${direction} ${formatUsd0(deltaAbs)} vs last month (${formatUsd0(prevTotal)}).`;
  });

  parts.push(comparisons.join(' '));
  if (increased.length > 0) {
    parts.push(`A few categories are trending up — set up your budget for this month to keep those increases in check.`);
  }

  return parts.join(' ');
}

/**
 * Generate a short, bold welcome summary using Gemini.
 * Returns a plain-text string (UI controls styling).
 */
export async function generateWelcomeSummaryLLM(metrics: WelcomeSummaryMetrics): Promise<{ text: string; model: string }> {
  const model = getModel();

  const prompt = `You are a financial dashboard assistant.

Write a brief, bold, motivating "welcome summary" for the user's dashboard.

Constraints:
- 1–3 sentences total.
- No emojis.
- No bullet points.
- Mention expenses, savings, and budgets if possible.
- Be concrete with numbers when present.
- If data is sparse, say what to do next (upload/sync).

Data (JSON):
${JSON.stringify(metrics)}
`;

  const res = await model.generateContent(prompt);
  const text = (res.response.text() || '').trim();

  // Basic sanitization (remove markdown fences if any)
  const cleaned = text.replace(/```[\s\S]*?```/g, '').trim();
  return { text: cleaned, model: GEMINI_MODEL };
}

