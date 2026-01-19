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
 * Examples:
 * - Credit card payments (paying off a card from checking)
 * - Internal transfers between accounts
 * - Balance transfers
 */
export function isLikelyInternalTransfer(txn: TransactionForClassification): boolean {
  const merchant = typeof txn?.merchant === 'string' ? txn.merchant.toLowerCase() : '';
  const category = typeof txn?.category === 'string' ? txn.category.toLowerCase() : '';
  
  if (!merchant && !category) return false;

  // If the category was explicitly set to transfer, treat as transfer
  if (category.includes('transfer')) return true;

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

  // Generic internal transfer keywords
  if (
    merchant.includes('transfer to') ||
    merchant.includes('transfer from') ||
    merchant.includes('internal transfer') ||
    merchant.includes('account transfer') ||
    merchant.includes('balance transfer') ||
    merchant.includes('xfer to') ||
    merchant.includes('xfer from')
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

