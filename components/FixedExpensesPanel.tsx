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

  // Loading skeleton - Compact
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <div className="h-4 w-36 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
        </div>
        <div className="px-4 py-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between items-center py-1">
              <div className="h-3 w-28 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
              <div className="h-3 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
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

  // No data state - Compact
  if (!data || data.expenses.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <span className="text-sm">📌</span>
          <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
            Fixed Expenses
          </h4>
        </div>
        <div className="px-4 py-4 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Requires at least 3 months of data
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
      {/* Header - Compact */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">📌</span>
            <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
              Fixed Expenses
            </h4>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              ({data.expenses.length} recurring)
            </span>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {formatCurrency(data.total, currency)}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-0.5">
              /mo
            </span>
          </div>
        </div>
      </div>

      {/* Expenses List - Compact */}
      <div className="px-4 py-3">
        <div className="space-y-1">
          {displayedExpenses.map((expense, index) => (
            <div 
              key={`${expense.merchant_name}-${index}`}
              className="flex items-center justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/50 last:border-b-0"
            >
              <div className="flex-1 min-w-0 pr-3 flex items-center gap-2">
                <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                  {expense.merchant_name}
                </p>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                  Day {expense.avg_day_of_month}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white shrink-0">
                {formatCurrency(expense.median_amount, currency)}
              </p>
            </div>
          ))}
        </div>

        {/* Show More/Less Toggle - Compact */}
        {hasMore && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="mt-2 w-full py-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center justify-center gap-1"
          >
            {showAll ? (
              <>
                <span>Show Less</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </>
            ) : (
              <>
                <span>+{data.expenses.length - maxItemsToShow} more</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
