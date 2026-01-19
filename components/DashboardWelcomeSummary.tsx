'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ConnectedAccounts from './ConnectedAccounts';

type Availability = {
  startMonth: string | null; // YYYY-MM
  endMonth: string | null;   // YYYY-MM
  missingMonths: string[];   // YYYY-MM
};

type WelcomeSummaryResponse = {
  summaryText: string;
  fromCache: boolean;
  generatedAt: string | null;
  availability: Availability;
  availabilityOneLiner: string;
  error?: string;
};

function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function displayNameFallback(displayName?: string | null) {
  const trimmed = (displayName || '').trim();
  if (!trimmed) return null;
  // Keep just first token for a tight greeting
  return trimmed.split(/\s+/)[0];
}

type DayPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

function getDayPeriod(date: Date): DayPeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export default function DashboardWelcomeSummary({
  userId,
  displayName,
  refreshTrigger,
  dateRange,
  selectedMonth,
  onDateRangeChange,
  onMonthChange,
  monthOptions,
  showAccountsPanel,
  onSyncComplete,
  onFileUpload,
  isProcessing,
}: {
  userId: string;
  displayName?: string | null;
  refreshTrigger?: number;
  dateRange?: number | null;
  selectedMonth?: string;
  onDateRangeChange?: (months: number) => void;
  onMonthChange?: (month: string) => void;
  monthOptions?: Array<{ value: string; label: string }>;
  showAccountsPanel?: boolean;
  onSyncComplete?: () => void;
  onFileUpload?: (files: File[]) => void;
  isProcessing?: boolean;
}) {
  const [data, setData] = useState<WelcomeSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = useMemo(() => displayNameFallback(displayName), [displayName]);

  const fetchSummary = useCallback(async (force: boolean) => {
    setError(null);
    const now = new Date();
    const dayPeriod = getDayPeriod(now);
    const qs = new URLSearchParams({
      userId,
      ...(name ? { displayName: name } : {}),
      dayPeriod,
      localTimeISO: now.toISOString(),
      tzOffsetMinutes: String(now.getTimezoneOffset()),
      ...(force ? { force: '1' } : {}),
      _ts: String(Date.now()),
    });
    const res = await fetch(`/api/dashboard/welcome-summary?${qs.toString()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    const body: WelcomeSummaryResponse = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      throw new Error(body?.error || `HTTP ${res.status}`);
    }
    setData(body);
  }, [userId, name]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await fetchSummary(false);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load summary');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchSummary, refreshTrigger]);

  const onRegenerate = async () => {
    try {
      setRegenerating(true);
      await fetchSummary(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to regenerate summary');
    } finally {
      setRegenerating(false);
    }
  };

  const availability = data?.availability;
  const missingMonths = availability?.missingMonths || [];
  const hasGaps = missingMonths.length > 0;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6">
        {/* Date Range Controls with Regenerate button - Float on the right */}
        {monthOptions && onDateRangeChange && onMonthChange && (
          <div className="float-right ml-4 mb-2 flex flex-wrap items-center gap-2">
            {/* Regenerate button - first in the ribbon */}
            <button
              onClick={onRegenerate}
              disabled={loading || regenerating}
              aria-label="Regenerate summary"
              title="Regenerate summary"
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
            <svg
              className={`w-4 h-4 text-slate-700 dark:text-slate-200 ${regenerating ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-2.64-6.36M21 3v6h-6"
              />
            </svg>
            </button>
            
            {/* Month Dropdown */}
            <select
              value={selectedMonth || 'all'}
              onChange={(e) => {
                onMonthChange(e.target.value);
              }}
              className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <option value="all">All Time</option>
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>

            {/* Date Range Selector */}
            <div className="inline-flex bg-white dark:bg-gray-900 rounded-lg p-1 border border-slate-200 dark:border-slate-800 shadow-sm">
              {[3, 6, 12].map((months) => (
                <button
                  key={months}
                  onClick={() => onDateRangeChange(months)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    dateRange === months && selectedMonth === 'all'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {months}M
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Summary text - no wrapper div so it can wrap around float */}
        {loading ? (
          <div className="space-y-2 text-base sm:text-lg clear-none">
            <div className="h-5 w-11/12 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-5 w-9/12 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        ) : error ? (
          <p className="text-base sm:text-lg text-red-600 dark:text-red-400 clear-none">
            {error}
          </p>
        ) : data?.summaryText ? (
          <div className="prose prose-slate dark:prose-invert max-w-none text-base sm:text-lg leading-relaxed prose-p:clear-none prose-p:mt-0 prose-p:mb-4 [&>*]:text-slate-900 [&>*]:dark:text-white">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {data.summaryText}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-base sm:text-lg leading-relaxed text-slate-900 dark:text-white clear-none">
            Your dashboard summary will appear here once we have data.
          </p>
        )}
        
        {/* Clear floats */}
        <div className="clear-both"></div>

        <div className="mt-4">
          <details className="group">
            <summary className="cursor-pointer list-none rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between gap-3 hover:bg-slate-100/60 dark:hover:bg-slate-800 transition-colors">
              <span className="min-w-0 truncate">
                {data?.availabilityOneLiner || 'Data availability'}
              </span>
              <span className="inline-flex items-center gap-2 shrink-0">
                {hasGaps && (
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-full px-2 py-0.5">
                    Gaps detected
                  </span>
                )}
                <svg
                  className="w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </summary>

            <div className="mt-3 px-1 text-sm text-slate-600 dark:text-slate-300">
              {!availability?.startMonth || !availability?.endMonth ? (
                <div className="text-slate-600 dark:text-slate-300">
                  No transactions found yet. Upload a statement or connect an account to populate your dashboard.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-white">Range:</span>
                    <span className="text-slate-700 dark:text-slate-300">
                      {formatMonth(availability.startMonth)} → {formatMonth(availability.endMonth)}
                    </span>
                    {data?.generatedAt && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        • summary {data.fromCache ? 'cached' : 'generated'} {new Date(data.generatedAt).toLocaleString()}
                      </span>
                    )}
                  </div>

                  {hasGaps ? (
                    <div className="mt-3">
                      <div className="font-medium text-slate-900 dark:text-white">
                        Missing months (no transactions found):
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {missingMonths.slice(0, 18).map((m) => (
                          <span
                            key={m}
                            className="text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-full px-2 py-0.5"
                          >
                            {formatMonth(m)}
                          </span>
                        ))}
                        {missingMonths.length > 18 && (
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-0.5">
                            +{missingMonths.length - 18} more
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        These gaps usually mean statements/syncs for those periods haven’t been uploaded yet.
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      No gaps detected in this range.
                    </div>
                  )}
                </>
              )}
            </div>
          </details>
        </div>

        {showAccountsPanel && (
          <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
            <ConnectedAccounts
              onSyncComplete={onSyncComplete}
              onFileUpload={onFileUpload}
              isProcessing={isProcessing}
            />
          </div>
        )}
      </div>

      {/* Subtle emphasis bar */}
      <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />
    </div>
  );
}

