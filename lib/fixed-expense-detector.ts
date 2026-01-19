import { supabase, Transaction } from '@/lib/supabase';
import { getBudgetCategoryHierarchy, getFixedExpenseCategoryNames } from '@/lib/budget-utils';
import { normalizeCategoryNameKey } from '@/lib/category-normalization';
import { tagFixedExpensesWithLLM } from '@/lib/llm-fixed-expense-transaction-tagger';
import { matchUserFixedExpensesToTransactions } from '@/lib/llm-fixed-expense-input-matcher';
import { classifyTransaction } from '@/lib/transaction-classifier';

/**
 * Checks if a transaction is potentially expense-like for fixed expense detection.
 * This is intentionally more inclusive than the standard expense classification
 * because we want to catch edge cases (refunds, adjustments) for LLM analysis.
 * Uses the unified classifier for core logic but allows more candidates.
 */
function isExpenseLike(t: Pick<Transaction, 'transaction_type' | 'amount' | 'merchant' | 'category'>): boolean {
  const classification = classifyTransaction(t);
  
  // Explicit income or transfers are never expense-like
  if (classification.type === 'income' || classification.type === 'transfer') return false;
  
  // Expense and other types are expense-like
  if (classification.type === 'expense' || classification.type === 'other') return true;
  
  // For unknown types with non-zero amounts, include as candidates for LLM analysis
  // This is more inclusive than standard classification because the LLM will determine
  // the actual nature of these transactions
  return classification.absAmount !== 0;
}

function normalizeCategoryKeySafe(category?: string | null): string | null {
  if (!category || typeof category !== 'string') return null;
  const trimmed = category.trim();
  if (!trimmed) return null;
  return normalizeCategoryNameKey(trimmed);
}

export function applyFixedExpenseFlagsByCategory(
  txns: Transaction[],
  fixedCategoryNameKeys: Set<string>
): Transaction[] {
  return txns.map((t) => {
    const key = normalizeCategoryKeySafe(t.category);
    if (key && fixedCategoryNameKeys.has(key)) {
      return {
        ...t,
        is_fixed_expense: true,
        fixed_expense_status: 'fixed',
        fixed_expense_source: 'category',
        fixed_expense_confidence: 1,
        fixed_expense_model: null,
        fixed_expense_explain: 'Category marked as fixed expense',
      };
    }
    return t;
  });
}

export async function applyFixedExpenseFlagsWithLLM(
  userId: string,
  txns: Transaction[]
): Promise<Transaction[]> {
  if (!process.env.GEMINI_API_KEY) {
    return txns;
  }

  // Only classify expense-like transactions that are not already fixed by category
  const candidates: Array<{ idx: number; t: Transaction }> = [];
  for (let i = 0; i < txns.length; i++) {
    const t = txns[i];
    if (!isExpenseLike(t)) continue;
    if (t.is_fixed_expense) continue;
    candidates.push({ idx: i, t });
  }

  // Even if we have no LLM classification candidates, still run the dedupe step
  // (it prevents duplicates between detected transactions and user-input fixed expenses).
  if (candidates.length === 0) {
    const detected = txns.filter((t) => t.is_fixed_expense && typeof t.id === 'string') as Required<
      Pick<Transaction, 'id' | 'merchant' | 'description' | 'amount' | 'date' | 'currency'>
    >[];
    await dedupeUserInputsAgainstTransactions(userId, detected);
    return txns;
  }

  const inputs = candidates.map(({ t }) => ({
    transaction_id: t.id,
    date: typeof t.date === 'string' ? t.date : new Date(t.date).toISOString().slice(0, 10),
    merchant: t.merchant,
    description: t.description || null,
    amount: typeof t.amount === 'number' ? t.amount : Number(t.amount),
    currency: t.currency || null,
    category: t.category || null,
  }));

  const results = await tagFixedExpensesWithLLM(inputs);

  const updated = [...txns];
  for (let i = 0; i < candidates.length; i++) {
    const { idx } = candidates[i];
    const r = results[i];
    if (!r) continue;

    if (r.label === 'fixed' || r.label === 'maybe') {
      updated[idx] = {
        ...updated[idx],
        is_fixed_expense: true,
        fixed_expense_status: r.label,
        fixed_expense_source: 'llm',
        fixed_expense_confidence: r.confidence,
        fixed_expense_model: 'gemini-2.0-flash-exp',
        fixed_expense_explain: r.explain,
      };
    }
  }

  // Dedupe pass: match user-input fixed expenses to newly detected fixed-expense transactions
  // (User-input feature is being expanded; table exists but may currently be empty.)
  const detected = updated.filter((t) => t.is_fixed_expense && typeof t.id === 'string') as Required<
    Pick<Transaction, 'id' | 'merchant' | 'description' | 'amount' | 'date' | 'currency'>
  >[];

  await dedupeUserInputsAgainstTransactions(userId, detected);

  return updated;
}

export async function applyFixedExpenseDetectionToTransactions(
  userId: string,
  txns: Transaction[]
): Promise<Transaction[]> {
  // Ensure default budget categories exist so fixed-category tagging can work immediately.
  await getBudgetCategoryHierarchy(userId).catch(() => null);

  const fixedNames = await getFixedExpenseCategoryNames(userId).catch(() => []);
  const fixedKeys = new Set(fixedNames.map((n) => normalizeCategoryNameKey(n)));

  const byCategory = applyFixedExpenseFlagsByCategory(txns, fixedKeys);
  const byLLM = await applyFixedExpenseFlagsWithLLM(userId, byCategory);
  return byLLM;
}

export async function persistFixedExpenseFlags(
  userId: string,
  txns: Transaction[]
): Promise<void> {
  // Persist per-row updates for items that have an id and fixed-expense fields.
  const updates = txns.filter((t) => typeof t.id === 'string');
  if (updates.length === 0) return;

  // Update in small batches to avoid query limits
  const BATCH_SIZE = 100;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    for (const t of batch) {
      await supabase
        .from('transactions')
        .update({
          is_fixed_expense: !!t.is_fixed_expense,
          fixed_expense_status: t.fixed_expense_status || null,
          fixed_expense_source: t.fixed_expense_source || null,
          fixed_expense_confidence:
            typeof t.fixed_expense_confidence === 'number' ? t.fixed_expense_confidence : null,
          fixed_expense_model: t.fixed_expense_model || null,
          fixed_expense_explain: t.fixed_expense_explain || null,
          fixed_expense_user_input_id: t.fixed_expense_user_input_id || null,
        })
        .eq('id', t.id as string)
        .eq('user_id', userId);
    }
  }
}

async function dedupeUserInputsAgainstTransactions(
  userId: string,
  detectedFixedExpenseTxns: Array<{
    id: string;
    merchant: string;
    description?: string | null;
    amount: number;
    date: any;
    currency?: string;
  }>
): Promise<void> {
  const { data: userInputs, error } = await supabase
    .from('fixed_expense_user_inputs')
    .select('id, name, expected_amount, expected_day_of_month, expected_cadence, currency, is_active')
    .eq('user_id', userId)
    .eq('is_active', true);

  // If table isn't migrated yet or empty, fail gracefully.
  if (error) {
    if ((error as any).code === '42P01') return;
    console.warn('[fixed-expense-detector] Could not fetch user inputs:', error.message);
    return;
  }

  if (!userInputs || userInputs.length === 0) return;
  if (!process.env.GEMINI_API_KEY) return;

  const detected = detectedFixedExpenseTxns
    .slice(0, 80) // keep prompt bounded
    .map((t) => ({
      transaction_id: t.id,
      merchant: t.merchant,
      description: t.description || null,
      amount: Number(t.amount),
      date: typeof t.date === 'string' ? t.date : new Date(t.date).toISOString().slice(0, 10),
      currency: t.currency || null,
    }));

  const matches = await matchUserFixedExpensesToTransactions(
    (userInputs as any[]).map((u) => ({
      id: String(u.id),
      name: String(u.name || ''),
      expected_amount: typeof u.expected_amount === 'number' ? Number(u.expected_amount) : null,
      expected_day_of_month:
        typeof u.expected_day_of_month === 'number' ? Number(u.expected_day_of_month) : null,
      expected_cadence: typeof u.expected_cadence === 'string' ? u.expected_cadence : null,
      currency: typeof u.currency === 'string' ? u.currency : null,
    })),
    detected
  );

  // Persist matches:
  // - If confidence is high, mark user input matched to transaction and deactivate it (prevents duplicates later).
  // - Always store match metadata for transparency.
  for (const m of matches) {
    const high = m.matched_transaction_id && m.confidence >= 0.8;

    await supabase
      .from('fixed_expense_user_inputs')
      .update({
        matched_transaction_id: high ? m.matched_transaction_id : null,
        match_confidence: m.confidence,
        match_explain: m.explain,
        is_active: high ? false : true,
      })
      .eq('id', m.user_input_id)
      .eq('user_id', userId);

    if (high) {
      await supabase
        .from('transactions')
        .update({
          fixed_expense_user_input_id: m.user_input_id,
        })
        .eq('id', m.matched_transaction_id as string)
        .eq('user_id', userId);
    }
  }
}

