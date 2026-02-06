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
    model: 'gemini-3-flash-preview',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  return _model;
}

export interface SubscriptionTagInput {
  merchant_name: string;
  samples?: Array<{ amount?: number; description?: string; date?: string }>;
}

export interface SubscriptionTagResult {
  merchant_name: string;
  is_subscription: boolean;
  confidence: number; // 0..1
  explain: string; // <= 25 words
}

const SYSTEM_PROMPT = `You are a subscription merchant classifier for US and Canada.

Given a list of merchant names (and optional sample transaction descriptors), classify whether each merchant is a subscription service (recurring digital service, membership, streaming, SaaS, news, cloud storage, etc.).

You may use general knowledge of popular subscription services prevalent in the US and Canada.

Return ONLY a valid JSON array (no markdown). Schema:
[
  {
    "merchant_name": "string (exactly as input)",
    "is_subscription": true|false,
    "confidence": 0.0-1.0,
    "explain": "one sentence <= 25 words"
  }
]

Rules:
- is_subscription=true for recognizable subscription brands (Netflix, Spotify, YouTube Premium, Disney+, Amazon Prime, iCloud, Google One, Adobe, Microsoft 365, etc.)
- is_subscription=false for utilities, rent, insurance, loan payments, taxes, grocery, restaurants, retail, gas, travel, one-off purchases
- If unsure, set is_subscription=false with confidence <= 0.6

IMPORTANT: Return exactly one result per input item, in the same order.`;

function buildPrompt(inputs: SubscriptionTagInput[]): string {
  const lines = inputs.map((i, idx) => {
    const samples = (i.samples || [])
      .slice(0, 3)
      .map(s => `- ${s.date || 'date?'} $${typeof s.amount === 'number' ? s.amount.toFixed(2) : '??'} "${(s.description || '').slice(0, 80)}"`)
      .join('\n');

    return `ITEM ${idx + 1}:\nMERCHANT: "${i.merchant_name}"\nSAMPLES:\n${samples || '- (none)'}`;
  });

  return `${SYSTEM_PROMPT}\n\n${lines.join('\n\n---\n\n')}`;
}

export async function tagSubscriptionsWithLLM(inputs: SubscriptionTagInput[]): Promise<SubscriptionTagResult[]> {
  if (inputs.length === 0) return [];

  // Batch to reduce JSON truncation risk
  const BATCH_SIZE = 30;
  const model = getModel();
  const all: SubscriptionTagResult[] = [];

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
      // Fallback: try to extract JSON array
      const m = text.match(/\[[\s\S]*\]/);
      if (!m) throw new Error(`Subscription tagger returned invalid JSON: ${e?.message || e}`);
      parsed = JSON.parse(m[0]);
    }

    if (!Array.isArray(parsed)) {
      throw new Error('Subscription tagger response is not an array');
    }

    // Normalize & pad/truncate
    const out: SubscriptionTagResult[] = parsed.map((r: any, idx: number) => ({
      merchant_name: typeof r.merchant_name === 'string' ? r.merchant_name : batch[idx]?.merchant_name,
      is_subscription: !!r.is_subscription,
      confidence: typeof r.confidence === 'number' ? Math.max(0, Math.min(1, r.confidence)) : 0.5,
      explain: typeof r.explain === 'string' ? r.explain : '',
    }));

    if (out.length !== batch.length) {
      // Fix length mismatch
      const fixed: SubscriptionTagResult[] = [];
      for (let j = 0; j < batch.length; j++) {
        fixed.push(out[j] || {
          merchant_name: batch[j].merchant_name,
          is_subscription: false,
          confidence: 0.5,
          explain: 'Missing classification',
        });
      }
      all.push(...fixed);
    } else {
      all.push(...out);
    }
  }

  return all;
}

