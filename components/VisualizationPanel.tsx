'use client';

import { useState, useEffect, ReactNode, useCallback } from 'react';
import ChartRenderer from './ChartRenderer';
import { ChartConfig } from '@/lib/chart-types';
import { formatCompactCurrency } from '@/lib/chart-utils';

interface VisualizationPanelProps {
  userId?: string;
  refreshTrigger?: number;
}

export default function VisualizationPanel({ userId = 'default-user', refreshTrigger = 0 }: VisualizationPanelProps) {
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
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCharts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [spendingRes, categoryRes, incomeRes] = await Promise.all([
        fetch(`/api/charts?userId=${userId}&type=spending-trend&months=6`),
        fetch(`/api/charts?userId=${userId}&type=category-breakdown&months=6`),
        fetch(`/api/charts?userId=${userId}&type=income-vs-expenses&months=6`),
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
        setMetrics({
          totalIncome,
          totalExpenses,
          netResult: totalIncome - totalExpenses
        });
      }

    } catch (err: any) {
      console.error('Error fetching charts:', err);
      setError(err.message || 'Failed to load charts');
    } finally {
      setLoading(false);
    }
  }, [userId]);

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
        {formatCompactCurrency(value)}
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
      {/* KPI Summary Row */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard 
            label="Total Income (6m)" 
            value={metrics.totalIncome} 
            color="green" 
          />
          <KPICard 
            label="Total Expenses (6m)" 
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

        {/* Income vs Expenses - Half Width */}
        {charts.incomeVsExpenses && (
          <ChartCard title="Income vs Expenses" className="h-80">
            <ChartRenderer config={charts.incomeVsExpenses} height="100%" />
          </ChartCard>
        )}

        {/* Category Breakdown - Half Width */}
        {charts.categoryBreakdown && (
          <ChartCard title="Category Breakdown" className="h-80">
            <ChartRenderer config={charts.categoryBreakdown} height="100%" />
          </ChartCard>
        )}
      </div>
    </div>
  );
}
