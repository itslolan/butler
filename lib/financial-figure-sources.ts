/**
 * Financial Figure Sources
 *
 * We sometimes persist user-provided "figures" (income overrides, etc.) in the same
 * storage layer as real transactions. When computing "derived from data" metrics
 * (cash flow charts, income vs expenses, welcome summary, etc.) we must exclude
 * these synthetic rows so we don't double-count.
 *
 * Budgeting / "safe to spend" surfaces intentionally use user-provided figures.
 */

export const USER_PROVIDED_INCOME_MERCHANT = 'User Provided Income';

export function isUserProvidedIncomeTransaction(txn: {
  merchant?: unknown;
  transaction_type?: unknown;
}): boolean {
  return (
    txn?.transaction_type === 'income' &&
    typeof txn?.merchant === 'string' &&
    txn.merchant === USER_PROVIDED_INCOME_MERCHANT
  );
}

