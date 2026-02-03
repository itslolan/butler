'use client';

import { useState, useEffect, ReactNode, useCallback } from 'react';
import ChartRenderer from './ChartRenderer';
import FixedExpensesPanel, { type FixedExpensesData } from './FixedExpensesPanel';
import BudgetStatusPanel from './BudgetStatusPanel';
import { ChartConfig } from '@/lib/chart-types';
import { formatCompactCurrency } from '@/lib/chart-utils';

interface VisualizationPanelProps {
  userId?: string;
  refreshTrigger?: number;
  fixedExpensesDemoData?: FixedExpensesData | null;
  dateRange?: number | null;
  selectedMonth?: string;
  customDateRange?: { start: string; end: string } | null;
  chatInterfaceRef?: React.RefObject<any>;
  onOpenMobileChat?: () => void;
}

export default function VisualizationPanel({ 
  userId = 'default-user', 
  refreshTrigger = 0, 
  fixedExpensesDemoData = null,
  dateRange: externalDateRange,
  selectedMonth: externalSelectedMonth,
  customDateRange: externalCustomDateRange,
  chatInterfaceRef,
  onOpenMobileChat,
}: VisualizationPanelProps) {
  const [charts, setCharts] = useState<{
    spendingTrend: ChartConfig | null;
    categoryBreakdown: ChartConfig | null;
    incomeVsExpenses: ChartConfig | null;
    cashFlow: ChartConfig | null;
  }>({
    spendingTrend: null,
    categoryBreakdown: null,
    incomeVsExpenses: null,
    cashFlow: null,
  });

  const [metrics, setMetrics] = useState<{
    totalIncome: number;
    totalExpenses: number;
    netResult: number;
    currency?: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use external state if provided, otherwise use internal state
  // Default to current month
  const [internalDateRange, setInternalDateRange] = useState<number | null>(null);
  const [internalSelectedMonth, setInternalSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [internalCustomDateRange, setInternalCustomDateRange] = useState<{ start: string; end: string } | null>(null);
  
  const dateRange = externalDateRange !== undefined ? externalDateRange : internalDateRange;
  const selectedMonth = externalSelectedMonth !== undefined ? externalSelectedMonth : internalSelectedMonth;
  const customDateRange = externalCustomDateRange !== undefined ? externalCustomDateRange : internalCustomDateRange;
  const customActive = Boolean(customDateRange?.start && customDateRange?.end);

  // Generate last 12 months for dropdown
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return {
      value: d.toISOString().slice(0, 7), // YYYY-MM
      label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    };
  });

  const fetchCharts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        userId,
      });

      // Priority: custom date range > specific month > relative months
      if (customActive && customDateRange) {
        queryParams.append('start', customDateRange.start);
        queryParams.append('end', customDateRange.end);
      } else if (selectedMonth !== 'all') {
        queryParams.append('month', selectedMonth);
      } else if (dateRange !== null) {
        queryParams.append('months', dateRange.toString());
      }

      // Fetch from API (which calls canonical assistant functions)
      const [spendingRes, categoryRes, incomeRes, cashFlowRes] = await Promise.all([
        fetch(`/api/charts?${queryParams}&type=spending-trend`),
        fetch(`/api/charts?${queryParams}&type=category-breakdown`),
        fetch(`/api/charts?${queryParams}&type=income-vs-expenses`),
        fetch(`/api/charts?${queryParams}&type=cash-flow`),
      ]);

      if (!spendingRes.ok || !categoryRes.ok || !incomeRes.ok || !cashFlowRes.ok) {
        throw new Error('Failed to fetch chart data');
      }

      const [spendingData, categoryData, incomeData, cashFlowData] = await Promise.all([
        spendingRes.json(),
        categoryRes.json(),
        incomeRes.json(),
        cashFlowRes.json(),
      ]);

      // Parse envelope format: { chartConfig, rawData, params }
      setCharts({
        spendingTrend: spendingData.chartConfig,
        categoryBreakdown: categoryData.chartConfig,
        incomeVsExpenses: incomeData.chartConfig,
        cashFlow: cashFlowData.chartConfig,
      });

      // Calculate KPIs from rawData (not chartConfig) for accuracy
      if (incomeData.rawData && Array.isArray(incomeData.rawData)) {
        const totalIncome = incomeData.rawData.reduce((sum: number, d: any) => sum + (d.income || 0), 0);
        const totalExpenses = incomeData.rawData.reduce((sum: number, d: any) => sum + (d.expenses || 0), 0);
        
        // Extract currency from params or chartConfig
        const currencyCode = incomeData.params?.currency || 
                            incomeData.chartConfig?.currency || 
                            'USD';
        
        setMetrics({
          totalIncome,
          totalExpenses,
          netResult: totalIncome - totalExpenses,
          currency: typeof currencyCode === 'string' ? currencyCode : 'USD'
        });
      }

    } catch (err: any) {
      console.error('Error fetching charts:', err);
      setError(err.message || 'Failed to load charts');
    } finally {
      setLoading(false);
    }
  }, [userId, dateRange, selectedMonth, customActive, customDateRange]);

  useEffect(() => {
    fetchCharts();
  }, [fetchCharts, refreshTrigger]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          ))}
        </div>
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-800 text-sm font-medium dark:bg-red-900/20 dark:border-red-800 dark:text-red-200">
        {error}
        <button onClick={fetchCharts} className="ml-2 underline hover:text-red-900">Retry</button>
      </div>
    );
  }

  const hasData = charts.spendingTrend || charts.categoryBreakdown || charts.incomeVsExpenses || charts.cashFlow;

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900/50">
        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
          <span className="text-xl">📊</span>
        </div>
        <h3 className="text-slate-900 dark:text-white font-medium">No Data Available</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-xs">
          Upload a statement to start visualizing your finances.
        </p>
      </div>
    );
  }

  const KPICard = ({ label, value, trend, color }: { label: string, value: number, trend?: string, color: string }) => (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
      <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mt-1 tracking-tight">
        {formatCompactCurrency(value, metrics?.currency || 'USD')}
      </h3>
      {trend && (
        <p className={`text-xs font-medium mt-1 ${color === 'green' ? 'text-emerald-600' : color === 'red' ? 'text-rose-600' : 'text-blue-600'}`}>
          {trend}
        </p>
      )}
    </div>
  );

  const periodLabel = (() => {
    if (customActive && customDateRange) {
      const fmt = (iso: string) =>
        new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${fmt(customDateRange.start)} – ${fmt(customDateRange.end)}`;
    }
    if (selectedMonth !== 'all') {
      return monthOptions.find(m => m.value === selectedMonth)?.label || 'selected';
    }
    return `${dateRange}M`;
  })();

  const ChartCard = ({ title, children, className }: { title: string, children: ReactNode, className?: string }) => (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col ${className}`}>
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{title}</h4>
      </div>
      <div className="p-5 flex-1 min-h-0">
        {children}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Row 1: Cash Flow - Full Width */}
        {charts.cashFlow && (
          <div className="lg:col-span-2">
            <ChartCard title="Cash Flow" className="h-[700px]">
              <div className="flex flex-col h-full">
                {/* KPI Summary Row integrated into Cash Flow panel */}
                {metrics && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 shrink-0">
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-700/50">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Total Income ({periodLabel})
                      </p>
                      <h3 className="text-xl font-semibold text-slate-900 dark:text-white mt-1 tracking-tight">
                        {formatCompactCurrency(metrics.totalIncome, metrics?.currency || 'USD')}
                      </h3>
                      <p className="text-xs font-medium mt-1 text-emerald-600">
                        + Income
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-700/50">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Total Expenses ({periodLabel})
                      </p>
                      <h3 className="text-xl font-semibold text-slate-900 dark:text-white mt-1 tracking-tight">
                        {formatCompactCurrency(metrics.totalExpenses, metrics?.currency || 'USD')}
                      </h3>
                      <p className="text-xs font-medium mt-1 text-rose-600">
                        - Expenses
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-700/50">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Net Result</p>
                      <h3 className="text-xl font-semibold text-slate-900 dark:text-white mt-1 tracking-tight">
                        {formatCompactCurrency(metrics.netResult, metrics?.currency || 'USD')}
                      </h3>
                      <p className={`text-xs font-medium mt-1 ${metrics.netResult >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {metrics.netResult >= 0 ? '+ Positive Cashflow' : '- Negative Cashflow'}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex-1 min-h-0">
                  <ChartRenderer config={charts.cashFlow} height="100%" />
                </div>
              </div>
            </ChartCard>
          </div>
        )}

        {/* Row 2: Budget Summary | Fixed Expenses */}
        <BudgetStatusPanel 
          userId={userId} 
          chatInterfaceRef={chatInterfaceRef}
          onOpenMobileChat={onOpenMobileChat}
        />

        <FixedExpensesPanel 
          userId={userId} 
          refreshTrigger={refreshTrigger}
          maxItemsToShow={5}
          currency={metrics?.currency || 'USD'}
          demoData={fixedExpensesDemoData}
        />

        {/* Row 3: Category Breakdown - Full Width */}
        {charts.categoryBreakdown && (
          <div className="lg:col-span-2">
            <ChartCard title="Category Breakdown" className="min-h-[450px]">
              <ChartRenderer config={charts.categoryBreakdown} height={380} showLegend={true} />
            </ChartCard>
          </div>
        )}

        {/* Row 4: Income vs Expenses | Monthly Spending Trend */}
        {charts.incomeVsExpenses && (
          <ChartCard title="Income vs Expenses" className="h-80">
            <ChartRenderer config={charts.incomeVsExpenses} height="100%" />
          </ChartCard>
        )}

        {charts.spendingTrend && (
          <ChartCard title="Monthly Spending Trend" className="h-80">
            <ChartRenderer config={charts.spendingTrend} height="100%" />
          </ChartCard>
        )}
      </div>
    </div>
  );
}
