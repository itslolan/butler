import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// Keep this lightweight/cost-effective; summary is short.
const GEMINI_MODEL = 'gemini-2.0-flash-exp';

export interface WelcomeSummaryMetrics {
  currentMonth: string; // YYYY-MM
  incomeVsExpensesLast3?: Array<{ month: string; income: number; expenses: number }>;
  currentBudget?: {
    income: number;
    totalBudgeted: number;
    totalSpent: number;
    readyToAssign: number;
    overspentCount: number;
  };
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

export function generateWelcomeSummaryFallback(metrics: WelcomeSummaryMetrics): string {
  const cur = metrics.currentBudget;
  const ive = metrics.incomeVsExpensesLast3 || [];
  const last = ive.length ? ive[ive.length - 1] : undefined;
  const income = safeNum(last?.income ?? cur?.income ?? 0);
  const expenses = safeNum(last?.expenses ?? cur?.totalSpent ?? 0);
  const savings = income - expenses;

  const parts: string[] = [];
  if (income > 0 && expenses > 0) {
    const rate = income > 0 ? Math.round((savings / income) * 100) : 0;
    parts.push(`This month you’re spending about $${expenses.toFixed(0)} with ~$${Math.max(0, savings).toFixed(0)} left over (${Math.max(0, rate)}% savings rate).`);
  } else if (expenses > 0) {
    parts.push(`This month you’ve spent about $${expenses.toFixed(0)} so far — keep an eye on the categories that are creeping up.`);
  } else {
    parts.push(`Upload more transaction data to unlock your personalized spending + budget snapshot.`);
  }

  if (cur) {
    if (cur.overspentCount > 0) {
      parts.push(`${cur.overspentCount} budget categor${cur.overspentCount === 1 ? 'y is' : 'ies are'} currently overspent — a quick rebalance can fix it.`);
    } else if (cur.totalBudgeted > 0) {
      parts.push(`Budgets look stable — you have $${safeNum(cur.readyToAssign).toFixed(0)} ready to assign.`);
    }
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

