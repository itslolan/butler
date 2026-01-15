'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface FixedExpenseItem {
  id: string;
  merchant: string;
  monthly_amount: number;
  mtd_amount: number;
  month_dates: string[]; // YYYY-MM-DD dates in current month (may be empty if upcoming)
  currency?: string | null;
  is_maybe?: boolean;
  fixed_expense_source?: string | null;
  fixed_expense_confidence?: number | null;
  fixed_expense_explain?: string | null;
}

export interface FixedExpensesData {
  month: string; // YYYY-MM
  monthly_total: number; // estimated monthly total from latest month of txns per merchant
  mtd_total: number; // how much has occurred so far this month
  expenses: FixedExpenseItem[];
  calculated_at: string;
  from_cache: boolean;
}

interface FixedExpensesPanelProps {
  userId?: string;
  refreshTrigger?: number;
  maxItemsToShow?: number;
  currency?: string;
  demoData?: FixedExpensesData | null;
}

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildDatesIndicator(dates: string[]): { short: string; full: string } {
  const formatted = (dates || []).filter(Boolean).map(formatShortDate);
  const full = formatted.length > 0 ? `on ${formatted.join(', ')}` : '';
  // Short version is same as full; UI will truncate with CSS.
  return { short: full, full };
}

export default function FixedExpensesPanel({
  userId = 'default-user',
  refreshTrigger = 0,
  maxItemsToShow = 5,
  currency = 'USD',
  demoData = null,
}: FixedExpensesPanelProps) {
  const [data, setData] = useState<FixedExpensesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [confirmingIndex, setConfirmingIndex] = useState<number | null>(null);
  
  // Track previous refreshTrigger to detect changes
  const previousRefreshTrigger = useRef(refreshTrigger);

  // Fetch from API
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch from API
      const response = await fetch(`/api/fixed-expenses?_ts=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorMessage = 'Failed to fetch fixed expenses';
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            // Couldn't parse JSON error, use default message
          }
        }
        
        throw new Error(errorMessage);
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

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/fixed-expenses?_ts=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorMessage = 'Failed to refresh fixed expenses';
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // ignore
          }
        }
        throw new Error(errorMessage);
      }
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      console.error('Error refreshing fixed expenses:', err);
      setError(err.message || 'Failed to refresh fixed expenses');
    } finally {
      setLoading(false);
    }
    setIsRefreshing(false);
  }, []);

  // Handle confirming a "maybe" transaction as fixed
  const handleConfirmFixedExpense = useCallback(async (expense: FixedExpenseItem, index: number) => {
    if (!expense.id) return;

    setConfirmingIndex(index);

    try {
      const response = await fetch('/api/confirm-fixed-expense', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction_id: expense.id,
          merchant_name: expense.merchant,
          amount: expense.monthly_amount,
          action: 'confirm',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to confirm fixed expense');
      }

      // Update UI locally: remove "maybe" badge
      setData(current => {
        if (!current) return null;
        return {
          ...current,
          expenses: current.expenses.map(e => 
            e.id === expense.id
              ? { ...e, is_maybe: false } 
              : e
          )
        };
      });
      
    } catch (err: any) {
      console.error('Error confirming fixed expense:', err);
      setError(err.message || 'Failed to confirm fixed expense');
    } finally {
      setConfirmingIndex(null);
    }
  }, []);

  // Handle rejecting an expense as NOT fixed
  const handleRejectFixedExpense = useCallback(async (expense: FixedExpenseItem, index: number) => {
    if (!expense.id) return;

    setConfirmingIndex(index);

    try {
      const response = await fetch('/api/confirm-fixed-expense', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction_id: expense.id,
          merchant_name: expense.merchant,
          amount: expense.monthly_amount,
          action: 'reject',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reject fixed expense');
      }

      // Update UI locally: remove the rejected transaction from the list
      setData(current => {
        if (!current) return null;
        const newExpenses = current.expenses.filter(e => e.id !== expense.id);
        const newMonthlyTotal = newExpenses.reduce((sum, e) => sum + (e.monthly_amount || 0), 0);
        const newMtdTotal = newExpenses.reduce((sum, e) => sum + (e.mtd_amount || 0), 0);
        
        return {
          ...current,
          expenses: newExpenses,
          monthly_total: newMonthlyTotal,
          mtd_total: newMtdTotal,
        };
      });
      
    } catch (err: any) {
      console.error('Error rejecting fixed expense:', err);
      setError(err.message || 'Failed to reject fixed expense');
    } finally {
      setConfirmingIndex(null);
    }
  }, []);

  useEffect(() => {
    // If demo data is provided, use it directly and skip API calls
    if (demoData) {
      setData(demoData);
      setLoading(false);
      return;
    }

    // Don't fetch if userId is default-user (not authenticated)
    if (userId === 'default-user') {
      setLoading(false);
      setError('Please log in to view fixed expenses');
      return;
    }

    // Check if refreshTrigger has actually changed (indicating bank upload or Plaid sync)
    const hasRefreshTriggerChanged = previousRefreshTrigger.current !== refreshTrigger;
    
    if (hasRefreshTriggerChanged && refreshTrigger > 0) {
      // Clear cache and fetch fresh data when new transactions are added
      console.log('[Fixed Expenses Panel] Refresh trigger changed - recalculating');
      fetchData();
      previousRefreshTrigger.current = refreshTrigger;
    } else {
      // Normal load - always fetch fresh (no browser cache)
      fetchData();
    }
  }, [refreshTrigger, fetchData, demoData, userId]);

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
          onClick={() => fetchData()} 
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
            Automatically detected from your transactions
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
              ({data.expenses.length} items)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh fixed expenses"
            >
              <svg 
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
            </button>
            <div className="text-right leading-tight">
              <div className="flex items-baseline justify-end gap-1">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {formatCurrency(data.monthly_total, currency)}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  /mo
                </span>
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                {formatCurrency(data.mtd_total, currency)} so far
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expenses List - Compact */}
      <div className="px-4 py-3">
        <div className="space-y-1">
          {displayedExpenses.map((expense, index) => (
            <div 
              key={expense.id || `${expense.merchant}-${index}`}
              className={`relative flex items-center justify-between h-10 px-2 border-b border-slate-50 dark:border-slate-800/50 last:border-b-0 ${
                expense.is_maybe 
                  ? 'bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors' 
                  : ''
              }`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div className="flex-1 min-w-0 pr-3 flex items-center gap-2">
                <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                  {expense.merchant}
                </p>
                {expense.is_maybe && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded shrink-0">
                    maybe
                  </span>
                )}
                {expense.month_dates?.length ? (
                  <span
                    className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 max-w-[140px] truncate"
                    title={buildDatesIndicator(expense.month_dates).full}
                  >
                    {buildDatesIndicator(expense.month_dates).short}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                    later this month
                  </span>
                )}
              </div>
              <div className="flex items-center justify-end min-w-[80px]">
                {hoveredIndex === index ? (
                  <div className="flex items-center gap-1 animate-in fade-in duration-200">
                    {expense.is_maybe && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConfirmFixedExpense(expense, index);
                        }}
                        disabled={confirmingIndex === index}
                        className="text-[10px] px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 whitespace-nowrap"
                        title="Confirm as fixed expense"
                      >
                        {confirmingIndex === index ? '...' : 'Confirm'}
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRejectFixedExpense(expense, index);
                      }}
                      disabled={confirmingIndex === index}
                      className="text-[10px] px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 whitespace-nowrap"
                      title="Reject as fixed expense"
                    >
                      {confirmingIndex === index ? '...' : 'Reject'}
                    </button>
                  </div>
                ) : (
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white shrink-0">
                      {formatCurrency(expense.monthly_amount, currency)}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      {formatCurrency(expense.mtd_amount, currency)} so far
                    </p>
                  </div>
                )}
              </div>
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
