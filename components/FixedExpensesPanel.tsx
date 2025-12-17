'use client';

import { useState, useEffect, useCallback } from 'react';

interface FixedExpense {
  merchant_name: string;
  median_amount: number;
  occurrence_count: number;
  months_tracked: number;
  avg_day_of_month: number;
  last_occurrence_date: string;
}

interface FixedExpensesData {
  total: number;
  expenses: FixedExpense[];
  calculated_at: string;
  from_cache: boolean;
}

interface FixedExpensesPanelProps {
  userId?: string;
  refreshTrigger?: number;
  maxItemsToShow?: number;
  currency?: string;
}

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function FixedExpensesPanel({
  userId = 'default-user',
  refreshTrigger = 0,
  maxItemsToShow = 5,
  currency = 'USD',
}: FixedExpensesPanelProps) {
  const [data, setData] = useState<FixedExpensesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/fixed-expenses');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch fixed expenses');
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      console.error('Error fetching fixed expenses:', err);
      setError(err.message || 'Failed to load fixed expenses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="h-5 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
        </div>
        <div className="p-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between items-center">
              <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
              <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        <button 
          onClick={fetchData} 
          className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // No data state - show message without subtitle (to avoid redundancy)
  if (!data || data.expenses.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h4 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <span className="text-base">📌</span>
            Fixed Expenses & Loans
          </h4>
        </div>
        <div className="p-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Requires at least 2 months of data
          </p>
        </div>
      </div>
    );
  }

  // Calculate how many items to display
  const displayedExpenses = showAll 
    ? data.expenses 
    : data.expenses.slice(0, maxItemsToShow);
  const hasMore = data.expenses.length > maxItemsToShow;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <span className="text-base">📌</span>
              Fixed Expenses & Loans
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Requires at least 2 months of data
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {formatCurrency(data.total, currency)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              /month
            </p>
          </div>
        </div>
      </div>

      {/* Expenses List */}
      <div className="p-5">
        <div className="space-y-3">
          {displayedExpenses.map((expense, index) => (
            <div 
              key={`${expense.merchant_name}-${index}`}
              className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
            >
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {expense.merchant_name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ~Day {expense.avg_day_of_month} · {expense.occurrence_count} occurrence{expense.occurrence_count !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(expense.median_amount, currency)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Show More/Less Toggle */}
        {hasMore && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="mt-4 w-full py-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center justify-center gap-1"
          >
            {showAll ? (
              <>
                <span>Show Less</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </>
            ) : (
              <>
                <span>Show {data.expenses.length - maxItemsToShow} More</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
