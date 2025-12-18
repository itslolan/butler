'use client';

import { Transaction } from '@/lib/supabase';

interface TransactionsListProps {
  transactions: Transaction[];
  currency?: string;
  className?: string;
}

export default function TransactionsList({ 
  transactions, 
  currency = 'USD',
  className = '' 
}: TransactionsListProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(Math.abs(amount));
  };

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Empty state
  if (transactions.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
        <svg className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          No transactions found
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {transactions.map((txn, index) => {
        const isExpense = txn.amount < 0 || txn.transaction_type === 'expense';
        const isIncome = txn.amount > 0 || txn.transaction_type === 'income';

        return (
          <div
            key={txn.id || index}
            className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 dark:text-white text-sm truncate">
                  {txn.merchant}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {formatDate(txn.date)}
                  {txn.category && (
                    <span className="ml-2 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px]">
                      {txn.category}
                    </span>
                  )}
                </p>
              </div>
              <span className={`font-mono text-sm font-medium whitespace-nowrap ${
                isIncome 
                  ? 'text-green-600 dark:text-green-400' 
                  : isExpense 
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-slate-900 dark:text-white'
              }`}>
                {isIncome ? '+' : isExpense ? '-' : ''}{formatCurrency(txn.amount)}
              </span>
            </div>

            {/* Description if available */}
            {txn.description && txn.description !== txn.merchant && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                {txn.description}
              </p>
            )}

            {/* Clarification indicator */}
            {txn.needs_clarification && (
              <div className="flex items-center gap-1 mt-2 text-amber-600 dark:text-amber-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-[10px] font-medium">Needs clarification</span>
              </div>
            )}
          </div>
        );
      })}

      {/* Summary */}
      <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400">
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
          </span>
          <span className="font-medium text-slate-900 dark:text-white">
            Total: {formatCurrency(transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0))}
          </span>
        </div>
      </div>
    </div>
  );
}
