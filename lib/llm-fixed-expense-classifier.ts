import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { MerchantSummary, formatMerchantSummaryForLLM } from './merchant-summarizer';

// Lazy-initialize Gemini client to avoid memory usage at module load time
let _genAI: GoogleGenerativeAI | null = null;
let _model: GenerativeModel | null = null;

function getModel(): GenerativeModel {
  if (_model) return _model;
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable');
  }
  
  _genAI = new GoogleGenerativeAI(apiKey);
  _model = _genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1, // Low temperature for consistent classification
    }
  });
  
  return _model;
}

export interface LLMClassification {
  merchant_key: string; // Added to match merchants with their classifications
  label: 'fixed' | 'not_fixed' | 'maybe';
  confidence: number;
  llm_reasoning_score: number;
  primary_reasons: string[];
  explain: string;
}

const SYSTEM_PROMPT = `You are a financial transaction analyst. Given a list of merchant summaries with sample transactions, classify each merchant as either a "Fixed required payment" (bills, loans, subscriptions with autopay — must be paid), or a "Not fixed" repeating merchant (restaurants, groceries, retail).

Use only the provided evidence. Output strict JSON array matching this schema:
[
  {
    "merchant_key": "normalized merchant name",
    "label": "fixed" | "not_fixed" | "maybe",
    "confidence": 0.0-1.0,
    "llm_reasoning_score": 0.0-1.0,
    "primary_reasons": ["keyword1", "keyword2"],
    "explain": "one sentence <= 30 words"
  }
]

For "fixed" label, prefer confidence > 0.80. If uncertain, use "maybe" and confidence < 0.7.

Classification Guidelines:
- FIXED: Utilities (electric, gas, water), loans/mortgages, insurance, rent/lease, subscriptions with autopay, recurring fees, phone bills, internet, cable
- NOT FIXED: Restaurants, groceries, retail shopping, gas stations, entertainment, travel, discretionary purchases, coffee shops
- Key signals for FIXED: monthly cadence (~30 day intervals), consistent day-of-month, stable amounts, bill/payment keywords, ACH/autopay indicators
- Key signals for NOT FIXED: variable amounts, irregular timing, discretionary merchant types, no bill keywords, weekly purchases

IMPORTANT: You must return exactly one classification for each merchant provided in the input, in the same order.`;

// Few-shot example for batch classification
const FEW_SHOT_EXAMPLE = {
  input: [
    `PAYEE: "CITY ELECTRIC CO" (group key: city electric co)
SAMPLES (3):
  - 2025-10-05 debit $142.72 "CITY ELECTRIC 800-123-4567"
  - 2025-09-06 debit $138.45 "CITY ELECTRIC BILL"
  - 2025-08-05 debit $145.20 "CITY ELECTRIC ACCT"
STATS:
  - count: 12 in 12 months
  - median_interval: 30 days, interval_cv: 0.06
  - day concentration: 10/12 within ±3 days of day 5
  - amount_mean: $140.50, amount_rstd: 0.12
  - flags: ["utility", "contains_bill_keyword", "has_account_number"]`,
    `PAYEE: "PIZZA HUT" (group key: pizza hut)
SAMPLES (3):
  - 2025-11-07 debit $18.45 "PIZZA HUT #1234"
  - 2025-10-28 debit $24.12 "PIZZA HUT DELIVERY"
  - 2025-09-15 debit $32.67 "PIZZA HUT ORDER"
STATS:
  - count: 8 in 5 months
  - median_interval: 12 days, interval_cv: 0.65
  - day concentration: 2/8 within ±3 days of day 15
  - amount_mean: $25.30, amount_rstd: 0.35
  - flags: []`,
    `PAYEE: "WELLSFARGO MORTGAGE" (group key: wellsfargo mortgage)
SAMPLES (3):
  - 2025-11-01 debit $1850.00 "WELLSFARGO MORTGAGE PAYMENT"
  - 2025-10-01 debit $1850.00 "WELLSFARGO MTGE PMT"
  - 2025-09-01 debit $1850.00 "WELLSFARGO MORTGAGE"
STATS:
  - count: 24 in 24 months
  - median_interval: 30 days, interval_cv: 0.02
  - day concentration: 24/24 within ±3 days of day 1
  - amount_mean: $1850.00, amount_rstd: 0.00
  - flags: ["loan_mortgage", "contains_bill_keyword", "ach_autopay"]`
  ],
  output: [
    {
      merchant_key: 'city electric co',
      label: 'fixed',
      confidence: 0.95,
      llm_reasoning_score: 0.92,
      primary_reasons: ['monthly_cadence', 'utility_bill', 'day_concentration', 'bill_keywords'],
      explain: 'Electric utility with consistent monthly billing cycle and bill keywords'
    },
    {
      merchant_key: 'pizza hut',
      label: 'not_fixed',
      confidence: 0.95,
      llm_reasoning_score: 0.05,
      primary_reasons: ['discretionary', 'variable_amounts', 'irregular_timing', 'restaurant'],
      explain: 'Restaurant with irregular timing and varying amounts indicates discretionary spending'
    },
    {
      merchant_key: 'wellsfargo mortgage',
      label: 'fixed',
      confidence: 0.99,
      llm_reasoning_score: 0.98,
      primary_reasons: ['mortgage', 'perfect_regularity', 'exact_amounts', 'ach'],
      explain: 'Mortgage with perfect monthly regularity and exact amounts'
    }
  ]
};

/**
 * Build the prompt for batch LLM classification
 */
function buildBatchPrompt(summaries: MerchantSummary[], userMemories: string[] = []): string {
  // Format all merchant summaries
  const formattedSummaries = summaries.map((summary, index) => 
    `MERCHANT ${index + 1}:\n${formatMerchantSummaryForLLM(summary)}`
  ).join('\n\n---\n\n');
  
  // Build few-shot example string
  const exampleInput = FEW_SHOT_EXAMPLE.input.map((input, i) => 
    `MERCHANT ${i + 1}:\n${input}`
  ).join('\n\n---\n\n');
  
  const exampleOutput = JSON.stringify(FEW_SHOT_EXAMPLE.output, null, 2);
  
  // Build user memories section if available
  let memoriesSection = '';
  if (userMemories.length > 0) {
    const confirmed = userMemories.filter(m => m.toLowerCase().includes('confirmed'));
    const rejected = userMemories.filter(m => m.toLowerCase().includes('rejected'));
    
    let memoryText = '\n\n---\n\nUSER FEEDBACK ON FIXED EXPENSES:\n';
    
    if (confirmed.length > 0) {
      memoryText += '\nCONFIRMED as fixed expenses (give these HIGH confidence as "fixed"):\n';
      memoryText += confirmed.map((memory, i) => `${i + 1}. ${memory}`).join('\n');
    }
    
    if (rejected.length > 0) {
      memoryText += '\n\nREJECTED as fixed expenses (classify these as "not_fixed", do NOT mark as "maybe" or "fixed"):\n';
      memoryText += rejected.map((memory, i) => `${i + 1}. ${memory}`).join('\n');
    }
    
    memoryText += '\n\n---';
    memoriesSection = memoryText;
  }
  
  return `${SYSTEM_PROMPT}

---

Here is an example to guide your classification:

INPUT:
${exampleInput}

OUTPUT:
${exampleOutput}${memoriesSection}

---

Now classify these merchants:

${formattedSummaries}

Respond with a JSON array containing exactly ${summaries.length} classifications, one for each merchant above, in the same order. No additional text.`;
}

/**
 * Classify all merchants using a single LLM call
 * @throws Error if API call fails or response is invalid
 */
export async function classifyAllMerchantsWithLLM(
  summaries: MerchantSummary[],
  userMemories: string[] = []
): Promise<LLMClassification[]> {
  if (summaries.length === 0) {
    return [];
  }

  const prompt = buildBatchPrompt(summaries, userMemories);
  
  try {
    const model = getModel();
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    // Parse JSON response
    const classifications = JSON.parse(text) as LLMClassification[];
    
    // Validate response is an array
    if (!Array.isArray(classifications)) {
      throw new Error('LLM response is not an array');
    }
    
    // Validate we got the right number of classifications
    if (classifications.length !== summaries.length) {
      throw new Error(`Expected ${summaries.length} classifications but got ${classifications.length}`);
    }
    
    // Validate each classification
    for (let i = 0; i < classifications.length; i++) {
      const classification = classifications[i];
      const summary = summaries[i];
      
      if (!classification.merchant_key) {
        throw new Error(`Classification ${i} missing merchant_key`);
      }
      
      if (!classification.label || !['fixed', 'not_fixed', 'maybe'].includes(classification.label)) {
        throw new Error(`Classification ${i} has invalid label: ${classification.label}`);
      }
      
      if (typeof classification.confidence !== 'number' || classification.confidence < 0 || classification.confidence > 1) {
        throw new Error(`Classification ${i} has invalid confidence: ${classification.confidence}`);
      }
      
      if (typeof classification.llm_reasoning_score !== 'number' || classification.llm_reasoning_score < 0 || classification.llm_reasoning_score > 1) {
        throw new Error(`Classification ${i} has invalid llm_reasoning_score: ${classification.llm_reasoning_score}`);
      }
      
      if (!Array.isArray(classification.primary_reasons)) {
        throw new Error(`Classification ${i} has invalid primary_reasons`);
      }
      
      if (typeof classification.explain !== 'string') {
        throw new Error(`Classification ${i} has invalid explain`);
      }
    }
    
    return classifications;
  } catch (error: any) {
    console.error('[llm-fixed-expense-classifier] Batch classification error:', error);
    throw new Error(`LLM batch classification failed: ${error.message}`);
  }
}

