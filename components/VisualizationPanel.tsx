'use client';

import { useState, useEffect, ReactNode, useCallback } from 'react';
import ChartRenderer from './ChartRenderer';
import FixedExpensesPanel from './FixedExpensesPanel';
import { ChartConfig } from '@/lib/chart-types';
import { formatCompactCurrency } from '@/lib/chart-utils';

interface FixedExpensesData {
  total: number;
  expenses: Array<{
    merchant_name: string;
    median_amount: number;
    occurrence_count: number;
    months_tracked: number;
    avg_day_of_month: number;
    last_occurrence_date: string;
    is_maybe?: boolean;
    merchant_key?: string;
  }>;
  calculated_at: string;
  from_cache: boolean;
}

interface VisualizationPanelProps {
  userId?: string;
  refreshTrigger?: number;
  fixedExpensesDemoData?: FixedExpensesData | null;
}

export default function VisualizationPanel({ userId = 'default-user', refreshTrigger = 0, fixedExpensesDemoData = null }: VisualizationPanelProps) {
  const [charts, setCharts] = useState<{
    spendingTrend: ChartConfig | null;
    categoryBreakdown: ChartConfig | null;
    incomeVsExpenses: ChartConfig | null;
  }>({
    spendingTrend: null,
    categoryBreakdown: null,
    incomeVsExpenses: null,
  });

  const [metrics, setMetrics] = useState<{
    totalIncome: number;
    totalExpenses: number;
    netResult: number;
    currency?: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<number | null>(6);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

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

      // If a specific month is selected, use it; otherwise use date range
      if (selectedMonth !== 'all') {
        queryParams.append('month', selectedMonth);
      } else if (dateRange !== null) {
        queryParams.append('months', dateRange.toString());
      }

      const [spendingRes, categoryRes, incomeRes] = await Promise.all([
        fetch(`/api/charts?${queryParams}&type=spending-trend`),
        fetch(`/api/charts?${queryParams}&type=category-breakdown`),
        fetch(`/api/charts?${queryParams}&type=income-vs-expenses`),
      ]);

      if (!spendingRes.ok || !categoryRes.ok || !incomeRes.ok) {
        throw new Error('Failed to fetch chart data');
      }

      const [spendingData, categoryData, incomeData] = await Promise.all([
        spendingRes.json(),
        categoryRes.json(),
        incomeRes.json(),
      ]);

      setCharts({
        spendingTrend: spendingData,
        categoryBreakdown: categoryData,
        incomeVsExpenses: incomeData,
      });

      // Calculate placeholder KPIs from chart data
      if (incomeData && incomeData.data) {
        const totalIncome = incomeData.data.reduce((sum: number, d: any) => sum + (d.value || 0), 0);
        const totalExpenses = incomeData.data.reduce((sum: number, d: any) => sum + (d.value2 || 0), 0);
        
        // Extract currency - handle both boolean (old format) and string (new format)
        let currencyCode = 'USD';
        const rawCurrency = incomeData.currency || spendingData.currency || categoryData.currency;
        if (typeof rawCurrency === 'string') {
          currencyCode = rawCurrency;
        }
        
        setMetrics({
          totalIncome,
          totalExpenses,
          netResult: totalIncome - totalExpenses,
          currency: currencyCode
        });
      }

    } catch (err: any) {
      console.error('Error fetching charts:', err);
      setError(err.message || 'Failed to load charts');
    } finally {
      setLoading(false);
    }
  }, [userId, dateRange, selectedMonth]);

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

  const hasData = charts.spendingTrend || charts.categoryBreakdown || charts.incomeVsExpenses;

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
      {/* Header Controls Row */}
      <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-3 mb-2">
        
        {/* Month Dropdown */}
        <select
          value={selectedMonth}
          onChange={(e) => {
            setSelectedMonth(e.target.value);
            // When a specific month is selected, clear the date range
            if (e.target.value !== 'all') {
              setDateRange(null);
            } else {
              // When "All Time" is selected, default to 6M
              setDateRange(6);
            }
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
              onClick={() => {
                setDateRange(months);
                // When a date range is selected, clear the month filter
                setSelectedMonth('all');
              }}
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

      {/* KPI Summary Row */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard 
            label={`Total Income (${selectedMonth !== 'all' ? monthOptions.find(m => m.value === selectedMonth)?.label || 'selected' : dateRange + 'M'})`} 
            value={metrics.totalIncome} 
            color="green" 
          />
          <KPICard 
            label={`Total Expenses (${selectedMonth !== 'all' ? monthOptions.find(m => m.value === selectedMonth)?.label || 'selected' : dateRange + 'M'})`} 
            value={metrics.totalExpenses} 
            color="red" 
          />
          <KPICard  
            label="Net Result" 
            value={metrics.netResult} 
            trend={metrics.netResult >= 0 ? '+ Positive Cashflow' : '- Negative Cashflow'}
            color={metrics.netResult >= 0 ? 'green' : 'red'} 
          />
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending Trend - Full Width on mobile, Half on large */}
        {charts.spendingTrend && (
          <ChartCard title="Monthly Spending Trend" className="lg:col-span-2 h-80">
            <ChartRenderer config={charts.spendingTrend} height="100%" />
          </ChartCard>
        )}

        {/* Fixed Expenses Panel - Full Width, below spending trend */}
        <div className="lg:col-span-2">
          <FixedExpensesPanel 
            userId={userId} 
            refreshTrigger={refreshTrigger}
            maxItemsToShow={5}
            currency={metrics?.currency || 'USD'}
            demoData={fixedExpensesDemoData}
          />
        </div>

        {/* Income vs Expenses - Half Width */}
        {charts.incomeVsExpenses && (
          <ChartCard title="Income vs Expenses" className="h-80">
            <ChartRenderer config={charts.incomeVsExpenses} height="100%" />
          </ChartCard>
        )}

        {/* Category Breakdown - Full Width */}
        {charts.categoryBreakdown && (
          <div className="lg:col-span-2">
            <ChartCard title="Category Breakdown" className="min-h-[400px]">
              <ChartRenderer config={charts.categoryBreakdown} height={300} showLegend={true} />
            </ChartCard>
          </div>
        )}
      </div>
    </div>
  );
}
