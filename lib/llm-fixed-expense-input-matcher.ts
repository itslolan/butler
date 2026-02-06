import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

let _genAI: GoogleGenerativeAI | null = null;
let _model: GenerativeModel | null = null;

function getModel(): GenerativeModel {
  if (_model) return _model;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY environment variable');

  _genAI = new GoogleGenerativeAI(apiKey);
  _model = _genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });
  return _model;
}

export interface UserFixedExpenseInput {
  id: string;
  name: string;
  expected_amount?: number | null;
  expected_day_of_month?: number | null;
  expected_cadence?: string | null;
  currency?: string | null;
}

export interface DetectedFixedExpenseTxn {
  transaction_id: string;
  merchant: string;
  description?: string | null;
  amount?: number;
  date?: string;
  currency?: string | null;
}

export interface FixedExpenseInputMatch {
  user_input_id: string;
  matched_transaction_id: string | null;
  confidence: number; // 0..1
  explain: string; // <= 35 words
}

const SYSTEM_PROMPT = `You are deduplicating fixed expenses.

You will receive:
1) A list of USER-INPUT fixed expenses (user expectations).
2) A list of DETECTED fixed-expense TRANSACTIONS (real bank data).

Goal:
For each user input, decide if it is equivalent to any detected transaction, even if:
- merchant/name differs slightly
- amount differs slightly (tax, proration, fees)
- date/day differs (weekends/holidays)

You must do fuzzy matching and return a mapping per user input.

Rules:
- Prefer matching to the most likely transaction if multiple candidates exist.
- If no good match exists, return matched_transaction_id = null.
- Use confidence to indicate match strength.

Return ONLY valid JSON array (no markdown) with this schema:
[
  {
    "user_input_id": "uuid",
    "matched_transaction_id": "uuid | null",
    "confidence": 0.0-1.0,
    "explain": "one sentence <= 35 words"
  }
]

Return exactly one result per user input, in the same order as inputs.`;

function buildPrompt(userInputs: UserFixedExpenseInput[], detected: DetectedFixedExpenseTxn[]): string {
  const uiText = userInputs
    .map((u, i) => {
      return [
        `USER_INPUT ${i + 1}:`,
        `id: "${u.id}"`,
        `name: "${(u.name || '').slice(0, 140)}"`,
        `expected_amount: ${typeof u.expected_amount === 'number' ? u.expected_amount : null}`,
        `expected_day_of_month: ${typeof u.expected_day_of_month === 'number' ? u.expected_day_of_month : null}`,
        `expected_cadence: "${(u.expected_cadence || '').slice(0, 20)}"`,
        `currency: "${(u.currency || '').slice(0, 10)}"`,
      ].join('\n');
    })
    .join('\n\n---\n\n');

  const detText = detected
    .map((t, i) => {
      return [
        `DETECTED_TXN ${i + 1}:`,
        `transaction_id: "${t.transaction_id}"`,
        `merchant: "${(t.merchant || '').slice(0, 140)}"`,
        `description: "${((t.description || '') as string).slice(0, 160)}"`,
        `amount: ${typeof t.amount === 'number' ? t.amount : null}`,
        `currency: "${(t.currency || '').slice(0, 10)}"`,
        `date: "${(t.date || '').slice(0, 16)}"`,
      ].join('\n');
    })
    .join('\n\n---\n\n');

  return `${SYSTEM_PROMPT}\n\nUSER INPUTS:\n\n${uiText}\n\n====\n\nDETECTED TRANSACTIONS:\n\n${detText}`;
}

export async function matchUserFixedExpensesToTransactions(
  userInputs: UserFixedExpenseInput[],
  detectedFixedExpenseTxns: DetectedFixedExpenseTxn[]
): Promise<FixedExpenseInputMatch[]> {
  if (userInputs.length === 0) return [];
  if (detectedFixedExpenseTxns.length === 0) {
    return userInputs.map((u) => ({
      user_input_id: u.id,
      matched_transaction_id: null,
      confidence: 0,
      explain: 'No detected fixed-expense transactions available',
    }));
  }

  const model = getModel();
  const prompt = buildPrompt(userInputs, detectedFixedExpenseTxns);
  const res = await model.generateContent(prompt);
  let text = res.response.text();

  text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (e: any) {
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) throw new Error(`Fixed expense matcher returned invalid JSON: ${e?.message || e}`);
    parsed = JSON.parse(m[0]);
  }

  if (!Array.isArray(parsed)) throw new Error('Fixed expense matcher response is not an array');

  const out: FixedExpenseInputMatch[] = parsed.map((r: any, idx: number) => ({
    user_input_id: typeof r.user_input_id === 'string' ? r.user_input_id : userInputs[idx]?.id,
    matched_transaction_id: typeof r.matched_transaction_id === 'string' ? r.matched_transaction_id : null,
    confidence: typeof r.confidence === 'number' ? Math.max(0, Math.min(1, r.confidence)) : 0.5,
    explain: typeof r.explain === 'string' ? r.explain : '',
  }));

  // Normalize & fix length mismatch
  const fixed: FixedExpenseInputMatch[] = [];
  for (let i = 0; i < userInputs.length; i++) {
    fixed.push(
      out[i] || {
        user_input_id: userInputs[i].id,
        matched_transaction_id: null,
        confidence: 0.5,
        explain: 'Missing match result',
      }
    );
  }

  return fixed;
}

