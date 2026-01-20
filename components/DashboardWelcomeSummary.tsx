'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ConnectedAccounts from './ConnectedAccounts';

type Availability = {
  startMonth: string | null; // YYYY-MM
  endMonth: string | null;   // YYYY-MM
  missingMonths: string[];   // YYYY-MM
  startDate: string | null;  // YYYY-MM-DD
  endDate: string | null;    // YYYY-MM-DD
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

  const [showAddDataModal, setShowAddDataModal] = useState(false);

  // Close modal when pressing Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAddDataModal(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const availability = data?.availability;
  const missingMonths = availability?.missingMonths || [];
  const hasGaps = missingMonths.length > 0;

  // Helper to format date strings (YYYY-MM-DD) to "MMM D, YYYY"
  const formatDateFull = (dateStr: string | null) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Helper to group consecutive missing months into ranges
  const getGapRanges = () => {
    if (!missingMonths.length) return [];
    
    const sorted = [...missingMonths].sort();
    const ranges: { start: string; end: string; count: number }[] = [];
    
    let currentStart = sorted[0];
    let currentEnd = sorted[0];
    let count = 1;
    
    for (let i = 1; i < sorted.length; i++) {
      const prev = currentEnd;
      const curr = sorted[i];
      
      const [py, pm] = prev.split('-').map(Number);
      const [cy, cm] = curr.split('-').map(Number);
      
      const prevDate = new Date(Date.UTC(py, pm - 1, 1));
      const nextMonthDate = new Date(Date.UTC(py, pm, 1)); // prev + 1 month
      
      // Check if current is consecutively next month
      if (cy === nextMonthDate.getUTCFullYear() && cm === nextMonthDate.getUTCMonth() + 1) {
        currentEnd = curr;
        count++;
      } else {
        ranges.push({ start: currentStart, end: currentEnd, count });
        currentStart = curr;
        currentEnd = curr;
        count = 1;
      }
    }
    ranges.push({ start: currentStart, end: currentEnd, count });
    
    return ranges.map(r => {
      const [sy, sm] = r.start.split('-').map(Number);
      const [ey, em] = r.end.split('-').map(Number);
      
      const startDate = new Date(Date.UTC(sy, sm - 1, 1));
      const endDate = new Date(Date.UTC(ey, em, 0)); // Last day of end month
      
      const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      
      const durationStr = r.count === 1 ? '1 month' : `${r.count} months`;
      
      return { text: `${startStr} to ${endStr}`, duration: durationStr };
    });
  };

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
          <details className="group bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <summary className="cursor-pointer list-none px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-100/60 dark:hover:bg-slate-800 transition-colors">
              <span className="min-w-0 truncate text-base font-semibold text-slate-800 dark:text-slate-100">
                {data?.availabilityOneLiner || 'Data availability'}
              </span>
              <div className="flex items-center gap-3 shrink-0">
                {hasGaps && (
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-full px-2 py-0.5">
                    Gaps detected
                  </span>
                )}
                
                {/* Add Data Button */}
                {showAccountsPanel && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setShowAddDataModal(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-500 text-sm font-bold px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all transform active:scale-95 flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Data
                  </button>
                )}

                <svg
                  className="w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </summary>

            <div className="px-4 pb-4 pt-2 border-t border-slate-200 dark:border-slate-700/50 text-sm text-slate-600 dark:text-slate-300">
              {!availability?.startMonth || !availability?.endMonth ? (
                <div className="text-slate-600 dark:text-slate-300">
                  No transactions found yet. Upload a statement or connect an account to populate your dashboard.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-slate-700 dark:text-slate-300">
                    You have provided data from <span className="font-semibold">{formatDateFull(availability.startDate)}</span> to <span className="font-semibold">{formatDateFull(availability.endDate)}</span>
                    {hasGaps ? ' with gaps in these date ranges -' : '.'}
                  </div>

                  {hasGaps && (
                    <ul className="list-disc ml-5 space-y-1">
                      {getGapRanges().map((range, idx) => (
                        <li key={idx} className="text-slate-700 dark:text-slate-300">
                          <span className="font-medium">{range.text}</span> - {range.duration}
                        </li>
                      ))}
                    </ul>
                  )}
                  
                  {hasGaps && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                      These gaps usually mean statements/syncs for those periods haven’t been uploaded yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          </details>
        </div>

        {/* Add Data Modal */}
        {showAddDataModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowAddDataModal(false)}
            />
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Add Data</h2>
                <button
                  onClick={() => setShowAddDataModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                <ConnectedAccounts
                  onSyncComplete={() => {
                    onSyncComplete?.();
                    // Optionally close modal on sync complete, but maybe keep open to show result
                  }}
                  onFileUpload={onFileUpload}
                  isProcessing={isProcessing}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Subtle emphasis bar */}
      <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />
    </div>
  );
}

