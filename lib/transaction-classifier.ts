/**
 * Unified Transaction Classification Module
 * 
 * This module provides a single source of truth for classifying transactions
 * as income, expense, transfer, or other. All functions across the codebase
 * should use these helpers to ensure consistent behavior.
 * 
 * Classification Rules:
 * 1. Explicit transaction_type takes precedence
 * 2. For null/undefined types, infer from amount sign:
 *    - Positive amount → income
 *    - Negative amount → expense
 *    - Zero amount → other (not counted as income or expense)
 * 3. Transfers (explicit or detected internal transfers) are excluded from
 *    income/expense totals to avoid double-counting
 * 4. 'other' type transactions are treated as expenses (they're typically
 *    fees, adjustments, etc.)
 */

export type TransactionType = 'income' | 'expense' | 'transfer' | 'other';

export interface TransactionForClassification {
  transaction_type?: string | null;
  amount?: number | string | null;
  merchant?: string | null;
  category?: string | null;
}

export interface ClassificationResult {
  /** The canonical type: 'income', 'expense', 'transfer', or 'other' */
  type: TransactionType;
  /** Whether this transaction should be excluded from totals (transfers, internal movements) */
  isExcluded: boolean;
  /** The absolute value of the amount */
  absAmount: number;
  /** Original amount (can be negative) */
  amount: number;
}

/**
 * Detects if a transaction is likely an internal transfer that should be excluded
 * from income/expense totals to avoid double-counting.
 * 
 * IMPORTANT: Only INTERNAL transfers (between your own accounts) should be excluded.
 * External transfers like e-transfers from other people are real income/expenses.
 * 
 * Examples of INTERNAL transfers (should be excluded):
 * - Credit card payments (paying off a card from checking)
 * - Internal transfers between your own accounts
 * - Balance transfers
 * 
 * Examples of EXTERNAL transfers (should NOT be excluded):
 * - e-Transfer received from another person
 * - Interac e-Transfer sent to pay someone
 * - Wire transfers from/to external parties
 */
export function isLikelyInternalTransfer(txn: TransactionForClassification): boolean {
  const merchant = typeof txn?.merchant === 'string' ? txn.merchant.toLowerCase() : '';
  const category = typeof txn?.category === 'string' ? txn.category.toLowerCase() : '';
  
  if (!merchant && !category) return false;

  // DON'T exclude just because category contains "transfer" - that's too broad.
  // Many banks categorize incoming e-transfers as "Transfers" but they're real income.
  // Only exclude if category explicitly indicates INTERNAL transfer.
  if (
    category === 'internal transfer' ||
    category === 'account transfer' ||
    category.includes('internal transfer')
  ) {
    return true;
  }

  // Credit card payment keywords (conservative: require "payment" plus card/network context)
  const hasPaymentWord =
    merchant.includes('payment') ||
    merchant.includes('e-payment') ||
    merchant.includes('epayment') ||
    merchant.includes('auto payment') ||
    merchant.includes('autopay');
  const hasCardContext =
    merchant.includes('credit card') ||
    merchant.includes('card payment') ||
    merchant.includes('visa') ||
    merchant.includes('mastercard') ||
    merchant.includes('amex') ||
    merchant.includes('american express') ||
    merchant.includes('discover');

  if (hasPaymentWord && hasCardContext) return true;

  // Generic internal transfer keywords in MERCHANT name (not category)
  // These patterns typically indicate moving money between your own accounts
  if (
    merchant.includes('transfer to savings') ||
    merchant.includes('transfer to chequing') ||
    merchant.includes('transfer to checking') ||
    merchant.includes('transfer from savings') ||
    merchant.includes('transfer from chequing') ||
    merchant.includes('transfer from checking') ||
    merchant.includes('internal transfer') ||
    merchant.includes('account transfer') ||
    merchant.includes('balance transfer') ||
    merchant.includes('xfer to sav') ||
    merchant.includes('xfer to chq') ||
    merchant.includes('xfer from sav') ||
    merchant.includes('xfer from chq')
  ) {
    return true;
  }

  return false;
}

/**
 * Classifies a transaction and returns its canonical type and whether it should
 * be excluded from income/expense totals.
 * 
 * This is the single source of truth for transaction classification.
 */
export function classifyTransaction(txn: TransactionForClassification): ClassificationResult {
  const amount = Number(txn.amount) || 0;
  const absAmount = Math.abs(amount);
  const explicitType = txn.transaction_type?.toLowerCase() as TransactionType | undefined;

  // Check if this is a transfer that should be excluded
  const isExplicitTransfer = explicitType === 'transfer';
  const isInternalTransfer = isLikelyInternalTransfer(txn);
  const isExcluded = isExplicitTransfer || isInternalTransfer;

  // Determine the canonical type
  let type: TransactionType;

  if (isExplicitTransfer || isInternalTransfer) {
    // Transfers are always classified as 'transfer'
    type = 'transfer';
  } else if (explicitType === 'income') {
    type = 'income';
  } else if (explicitType === 'expense') {
    type = 'expense';
  } else if (explicitType === 'other') {
    // 'other' is treated as expense (fees, adjustments, etc.)
    type = 'expense';
  } else {
    // No explicit type - infer from amount sign
    if (amount > 0) {
      type = 'income';
    } else if (amount < 0) {
      type = 'expense';
    } else {
      // Zero amount - classify as 'other' and exclude
      type = 'other';
    }
  }

  return {
    type,
    isExcluded,
    absAmount,
    amount,
  };
}

/**
 * Convenience function: returns true if transaction should be counted as income
 */
export function isIncomeTransaction(txn: TransactionForClassification): boolean {
  const result = classifyTransaction(txn);
  return result.type === 'income' && !result.isExcluded;
}

/**
 * Convenience function: returns true if transaction should be counted as expense
 */
export function isExpenseTransaction(txn: TransactionForClassification): boolean {
  const result = classifyTransaction(txn);
  return result.type === 'expense' && !result.isExcluded;
}

/**
 * Convenience function: returns true if transaction is a transfer (should be excluded)
 */
export function isTransferTransaction(txn: TransactionForClassification): boolean {
  const result = classifyTransaction(txn);
  return result.type === 'transfer' || result.isExcluded;
}

/**
 * Helper for backward compatibility with code that checks transaction_type directly.
 * Returns the inferred type as a string that matches the old convention.
 */
export function getInferredTransactionType(txn: TransactionForClassification): string | null {
  const result = classifyTransaction(txn);
  return result.type;
}

/**
 * Helper specifically for expense-like checks in fixed expense detection.
 * Returns true for 'expense' or 'other' types, false for 'income' or 'transfer'.
 */
export function isExpenseLikeTransaction(txn: TransactionForClassification): boolean {
  const result = classifyTransaction(txn);
  // For fixed expense detection, we include both expense and other types
  // but exclude transfers
  return (result.type === 'expense' || result.type === 'other') && !result.isExcluded;
}

