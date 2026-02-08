import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { createLLMSession, logLLMCall } from '@/lib/llm-logger';

// Keep this lightweight/cost-effective; summary is short.
const GEMINI_MODEL = 'gemini-3-flash-preview';

export interface WelcomeSummaryMetrics {
  currentMonth: string; // YYYY-MM
  lastMonth?: string; // YYYY-MM
  incomeVsExpensesLast3?: Array<{ month: string; income: number; expenses: number }>;
  categoryBreakdownCurrent?: Array<{ category: string; total: number; count: number }>;
  categoryBreakdownLastMonth?: Array<{ category: string; total: number; count: number }>;
}

export type WelcomeSummaryContext = {
  displayName?: string | null;
  dayPeriod?: string | null;
  localTimeISO?: string | null;
};

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

function getTop<T>(items: T[], n: number, score: (x: T) => number): T[] {
  return [...items].sort((a, b) => score(b) - score(a)).slice(0, n);
}

function normalizeCategoryName(name: string | null | undefined): string {
  return (name || '').trim().toLowerCase();
}

function normalizeDayPeriod(dayPeriod?: string | null): 'morning' | 'afternoon' | 'evening' | 'night' | null {
  const value = (dayPeriod || '').trim().toLowerCase();
  if (value === 'morning' || value === 'afternoon' || value === 'evening' || value === 'night') {
    return value;
  }
  return null;
}

function buildGreeting(context?: WelcomeSummaryContext): string {
  const dayPeriod = normalizeDayPeriod(context?.dayPeriod);
  const name = (context?.displayName || '').trim();
  const greetingByPeriod: Record<'morning' | 'afternoon' | 'evening' | 'night', string> = {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
    night: 'Good evening',
  };
  const greeting = dayPeriod ? greetingByPeriod[dayPeriod] : 'Hello';
  return name ? `${greeting}, ${name}.` : `${greeting}.`;
}

export function generateWelcomeSummaryFallback(
  metrics: WelcomeSummaryMetrics,
  context?: WelcomeSummaryContext
): string {
  const greeting = buildGreeting(context);
  const curCats = (metrics.categoryBreakdownCurrent || []).filter(c => safeNum(c.total) > 0);
  const lastCats = metrics.categoryBreakdownLastMonth || [];
  const lastByName = new Map(lastCats.map(c => [normalizeCategoryName(c.category), safeNum(c.total)]));

  const hasAnySpend = curCats.length > 0;
  if (!hasAnySpend) {
    return `${greeting} I don't see any transactions yet this month. Connect an account or upload a statement to get your personalized snapshot.`;
  }

  const totalSpent = curCats.reduce((sum, c) => sum + safeNum(c.total), 0);
  const topCur = getTop(curCats, 2, c => safeNum(c.total));
  const topPhrase = topCur
    .map((c) => `${c.category} (${formatUsd0(safeNum(c.total))})`)
    .join(topCur.length === 2 ? ' and ' : '');

  const sentences: string[] = [];
  const firstSentence = topPhrase
    ? `${greeting} You've spent about ${formatUsd0(totalSpent)} so far this month, with ${topPhrase} leading the way.`
    : `${greeting} You've spent about ${formatUsd0(totalSpent)} so far this month.`;
  sentences.push(firstSentence);

  const leadCat = topCur[0];
  if (leadCat) {
    const prevTotal = safeNum(lastByName.get(normalizeCategoryName(leadCat.category)) ?? 0);
    const delta = safeNum(leadCat.total) - prevTotal;
    const deltaAbs = Math.abs(delta);
    if (prevTotal > 0 || deltaAbs > 0) {
      const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
      const compareSentence =
        direction === 'flat'
          ? `${leadCat.category} is flat versus last month at ${formatUsd0(prevTotal)}.`
          : `${leadCat.category} is ${direction} ${formatUsd0(deltaAbs)} vs last month (${formatUsd0(prevTotal)}).`;
      sentences.push(compareSentence);
    }
  }

  const increased = topCur
    .map((c) => {
      const prev = safeNum(lastByName.get(normalizeCategoryName(c.category)) ?? 0);
      return safeNum(c.total) - prev > 0 ? c.category : null;
    })
    .filter((c): c is string => Boolean(c));
  if (increased.length > 0 && sentences.length < 3) {
    const list = increased.slice(0, 2).join(increased.length > 1 ? ' and ' : '');
    sentences.push(`Keep an eye on ${list} if it keeps trending up.`);
  }

  return sentences.join(' ');
}

/**
 * Generate a short, bold welcome summary using Gemini.
 * Returns a plain-text string (UI controls styling).
 */
export async function generateWelcomeSummaryLLM(
  metrics: WelcomeSummaryMetrics,
  context: WelcomeSummaryContext = {},
  userId?: string
): Promise<{ text: string; model: string }> {
  const model = getModel();
  const dayPeriod = normalizeDayPeriod(context.dayPeriod);
  const name = (context.displayName || '').trim();
  const dayPeriodInstruction = dayPeriod
    ? `Start with a greeting that matches the user's local time of day (${dayPeriod}).`
    : 'Start with a friendly greeting.';
  const nameInstruction = name
    ? `Address the user by name (${name}).`
    : 'If the name is missing, use a generic greeting.';

  const prompt = `You are a financial dashboard assistant.

Write a brief, conversational "welcome summary" for the user's dashboard in markdown.

Constraints:
- 1–3 sentences total.
- No emojis.
- No bullet points.
- ${dayPeriodInstruction}
- ${nameInstruction}
- Use only the provided transaction metrics; do not mention budgets or user-entered values.
- Be concrete with numbers when present.
- If data is sparse, say what to do next (upload/sync).

Data (JSON):
${JSON.stringify(metrics)}
`;

  const sessionId = createLLMSession();
  const llmStartTime = Date.now();
  const res = await model.generateContent(prompt);
  const llmDuration = Date.now() - llmStartTime;
  const text = (res.response.text() || '').trim();
  
  // Log the LLM call
  logLLMCall({
    sessionId,
    userId,
    flowName: 'welcome_summary',
    model: GEMINI_MODEL,
    systemPrompt: 'Generate welcome summary',
    userMessage: prompt,
    llmResult: text,
    durationMs: llmDuration,
  });

  // Basic sanitization (remove markdown fences if any)
  const cleaned = text.replace(/```[\s\S]*?```/g, '').trim();
  return { text: cleaned, model: GEMINI_MODEL };
}

