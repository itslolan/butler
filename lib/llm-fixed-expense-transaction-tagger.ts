import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// Lazy init
let _genAI: GoogleGenerativeAI | null = null;
let _model: GenerativeModel | null = null;

function getModel(): GenerativeModel {
  if (_model) return _model;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY environment variable');

  _genAI = new GoogleGenerativeAI(apiKey);
  _model = _genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  return _model;
}

export interface FixedExpenseTxnTagInput {
  transaction_id?: string; // optional; echoed back if present
  date?: string;
  merchant: string;
  description?: string | null;
  amount?: number;
  currency?: string | null;
  category?: string | null;
}

export interface FixedExpenseTxnTagResult {
  transaction_id?: string;
  label: 'fixed' | 'maybe' | 'not_fixed';
  confidence: number; // 0..1
  explain: string; // <= 30 words
  primary_type:
    | 'rent'
    | 'mortgage'
    | 'utility'
    | 'insurance'
    | 'loan'
    | 'subscription'
    | 'phone_internet'
    | 'tax'
    | 'other_fixed'
    | 'not_fixed'
    | 'unknown';
}

const SYSTEM_PROMPT = `You are a financial transaction classifier.

Task:
Given transactions (merchant + description + optional category/amount), label each one as:
- "fixed": recurring, required payments (rent, mortgage, utilities, insurance, loans, phone/internet, taxes, subscriptions with autopay)
- "maybe": likely fixed but not confident
- "not_fixed": discretionary or one-off spending (restaurants, groceries, retail, shopping, travel, entertainment), or ambiguous transfers

You may use general knowledge of popular services and billers prevalent in:
- USA
- Canada
- India

Examples of common SUBSCRIPTIONS:
- USA/Canada: Netflix, Spotify, Apple (APPLE.COM/BILL, iCloud, Apple One), Google (Google One, Google Play), Amazon Prime, Disney+, Hulu, Max/HBO, Peacock, Paramount+, Dropbox, Adobe, Microsoft 365, Zoom, GitHub, Patreon, NYTimes
- Canada: Crave, Sportsnet, TSN, Rogers, Bell, Telus (these may also be utilities/phone)
- India: Jio, Airtel, Vi (Vodafone Idea), BSNL, Tata Play/Sky, Hotstar/Disney+ Hotstar, SonyLIV, Zee5, JioSaavn

Examples of common UTILITIES/PHONE/INTERNET billers:
- USA/Canada: Hydro, Electric, Gas, Water, Comcast/Xfinity, AT&T, Verizon, T-Mobile, Spectrum, Rogers/Bell/Telus
- India: JioFiber, Airtel Broadband, electricity boards, gas cylinder providers (often labeled as gas/utility)

Examples of common LOANS/INSURANCE:
- USA/Canada: mortgage/loan servicers, insurance companies (GEICO, State Farm, Progressive), student loan servicers
- India: HDFC, ICICI, SBI, Axis, Bajaj Finance, LIC (insurance), other NBFCs

Important:
- If a transaction looks like a credit card payment / transfer between own accounts, label "not_fixed".
- Categories can help but are NOT required. Use merchant/description evidence.

Return ONLY a valid JSON array matching this schema (no markdown):
[
  {
    "transaction_id": "string | omitted",
    "label": "fixed" | "maybe" | "not_fixed",
    "confidence": 0.0-1.0,
    "primary_type": "rent"|"mortgage"|"utility"|"insurance"|"loan"|"subscription"|"phone_internet"|"tax"|"other_fixed"|"not_fixed"|"unknown",
    "explain": "one sentence <= 30 words"
  }
]

Return exactly one result per input item, in the same order.`;

function buildPrompt(inputs: FixedExpenseTxnTagInput[]): string {
  const lines = inputs.map((t, idx) => {
    const parts = [
      `ITEM ${idx + 1}:`,
      `merchant: "${(t.merchant || '').slice(0, 120)}"`,
      `description: "${((t.description || '') as string).slice(0, 160)}"`,
      `category: "${(t.category || '').slice(0, 80)}"`,
      `amount: ${typeof t.amount === 'number' ? t.amount : null}`,
      `currency: "${(t.currency || '').slice(0, 10)}"`,
      `date: "${(t.date || '').slice(0, 16)}"`,
      t.transaction_id ? `transaction_id: "${t.transaction_id}"` : 'transaction_id: null',
    ];
    return parts.join('\n');
  });

  return `${SYSTEM_PROMPT}\n\n${lines.join('\n\n---\n\n')}`;
}

export async function tagFixedExpensesWithLLM(
  inputs: FixedExpenseTxnTagInput[]
): Promise<FixedExpenseTxnTagResult[]> {
  if (inputs.length === 0) return [];

  const BATCH_SIZE = 30;
  const model = getModel();
  const all: FixedExpenseTxnTagResult[] = [];

  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, i + BATCH_SIZE);
    const prompt = buildPrompt(batch);

    const res = await model.generateContent(prompt);
    let text = res.response.text();

    // Remove possible markdown fences
    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (e: any) {
      const m = text.match(/\[[\s\S]*\]/);
      if (!m) throw new Error(`Fixed expense tagger returned invalid JSON: ${e?.message || e}`);
      parsed = JSON.parse(m[0]);
    }

    if (!Array.isArray(parsed)) {
      throw new Error('Fixed expense tagger response is not an array');
    }

    const out: FixedExpenseTxnTagResult[] = parsed.map((r: any, idx: number) => ({
      transaction_id:
        typeof r.transaction_id === 'string'
          ? r.transaction_id
          : typeof batch[idx]?.transaction_id === 'string'
            ? batch[idx]?.transaction_id
            : undefined,
      label: r?.label === 'fixed' || r?.label === 'maybe' || r?.label === 'not_fixed' ? r.label : 'maybe',
      confidence: typeof r.confidence === 'number' ? Math.max(0, Math.min(1, r.confidence)) : 0.5,
      primary_type:
        typeof r.primary_type === 'string'
          ? (r.primary_type as FixedExpenseTxnTagResult['primary_type'])
          : 'unknown',
      explain: typeof r.explain === 'string' ? r.explain : '',
    }));

    // Fix length mismatch
    if (out.length !== batch.length) {
      const fixed: FixedExpenseTxnTagResult[] = [];
      for (let j = 0; j < batch.length; j++) {
        fixed.push(
          out[j] || {
            transaction_id: batch[j].transaction_id,
            label: 'maybe',
            confidence: 0.5,
            primary_type: 'unknown',
            explain: 'Missing classification',
          }
        );
      }
      all.push(...fixed);
    } else {
      all.push(...out);
    }
  }

  return all;
}

