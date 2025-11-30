/**
 * Utility functions for chart rendering and data formatting
 */

import { ChartConfig, ChartDataPoint, MonthlyData, CategoryData } from './chart-types';

/**
 * Format a number as currency
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a number as compact currency (e.g., $1.2K, $3.4M)
 */
export function formatCompactCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return formatCurrency(value);
}

/**
 * Format a date as a short month label (e.g., "Jan 2025")
 */
export function formatMonthLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Format a date as a full month label (e.g., "January 2025")
 */
export function formatFullMonthLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Get a theme-aware color palette for charts
 * Returns Tailwind color values that work in both light and dark modes
 */
export function getChartColors(count: number = 6): string[] {
  const baseColors = [
    'rgb(59, 130, 246)',   // blue-500
    'rgb(34, 197, 94)',    // green-500
    'rgb(239, 68, 68)',    // red-500
    'rgb(234, 179, 8)',    // yellow-500
    'rgb(168, 85, 247)',   // purple-500
    'rgb(236, 72, 153)',   // pink-500
    'rgb(20, 184, 166)',   // teal-500
    'rgb(249, 115, 22)',   // orange-500
    'rgb(139, 92, 246)',   // violet-500
    'rgb(6, 182, 212)',    // cyan-500
  ];
  
  // Repeat colors if needed
  const colors = [];
  for (let i = 0; i < count; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }
  
  return colors;
}

/**
 * Get specific colors for income and expenses
 */
export function getIncomeExpenseColors(): { income: string; expenses: string } {
  return {
    income: 'rgb(34, 197, 94)',   // green-500
    expenses: 'rgb(239, 68, 68)',  // red-500
  };
}

/**
 * Calculate percentage of total
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}

/**
 * Aggregate transactions by month
 * Expects transactions with date strings in YYYY-MM-DD format
 */
export function aggregateByMonth(
  transactions: Array<{ date: string | Date; amount: number }>,
  months: number = 6
): MonthlyData[] {
  const now = new Date();
  const monthsAgo = new Date(now);
  monthsAgo.setMonth(now.getMonth() - months);
  
  const monthlyMap = new Map<string, number>();
  
  for (const txn of transactions) {
    const date = typeof txn.date === 'string' ? new Date(txn.date) : txn.date;
    
    if (date >= monthsAgo) {
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const current = monthlyMap.get(monthKey) || 0;
      monthlyMap.set(monthKey, current + Math.abs(txn.amount));
    }
  }
  
  // Fill in missing months with 0
  const result: MonthlyData[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(now.getMonth() - i);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    
    result.push({
      month: monthKey,
      total: monthlyMap.get(monthKey) || 0,
    });
  }
  
  return result;
}

/**
 * Aggregate transactions by category
 */
export function aggregateByCategory(
  transactions: Array<{ category: string | null; amount: number }>
): CategoryData[] {
  const categoryMap = new Map<string, { total: number; count: number }>();
  let grandTotal = 0;
  
  for (const txn of transactions) {
    const category = txn.category || 'Uncategorized';
    const absAmount = Math.abs(txn.amount);
    
    const current = categoryMap.get(category) || { total: 0, count: 0 };
    categoryMap.set(category, {
      total: current.total + absAmount,
      count: current.count + 1,
    });
    
    grandTotal += absAmount;
  }
  
  // Convert to array and calculate percentages
  const result: CategoryData[] = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    total: data.total,
    count: data.count,
    percentage: calculatePercentage(data.total, grandTotal),
  }));
  
  // Sort by total descending
  result.sort((a, b) => b.total - a.total);
  
  return result;
}

/**
 * Convert MonthlyData to ChartDataPoint format
 */
export function monthlyDataToChartPoints(data: MonthlyData[]): ChartDataPoint[] {
  return data.map(d => ({
    label: formatMonthLabel(d.month + '-01'),
    value: d.total,
    value2: d.income !== undefined ? d.income : undefined,
  }));
}

/**
 * Convert CategoryData to ChartDataPoint format
 */
export function categoryDataToChartPoints(data: CategoryData[]): ChartDataPoint[] {
  return data.map(d => ({
    label: `${d.category} (${d.percentage.toFixed(1)}%)`,
    value: d.total,
  }));
}

/**
 * Generate a complete ChartConfig from raw data
 */
export function createSpendingTrendChart(monthlyData: MonthlyData[]): ChartConfig {
  return {
    type: 'line',
    title: 'Monthly Spending Trend',
    description: `Your spending over the last ${monthlyData.length} months`,
    data: monthlyDataToChartPoints(monthlyData),
    xAxisLabel: 'Month',
    yAxisLabel: 'Amount',
    currency: true,
  };
}

/**
 * Category grouping definitions
 */
const CATEGORY_GROUPS: Record<string, 'Essentials' | 'Discretionary'> = {
  // Essentials - necessary expenses
  'Groceries': 'Essentials',
  'Housing': 'Essentials',
  'Utilities': 'Essentials',
  'Gas/Automotive': 'Essentials',
  'Transportation': 'Essentials',
  'Health/Wellness': 'Essentials',
  'Insurance': 'Essentials',
  'Interest': 'Essentials',
  'Loans': 'Essentials',
  'Fees': 'Essentials',
  
  // Discretionary - optional/lifestyle expenses
  'Food & Dining': 'Discretionary',
  'Alcohol/Bars': 'Discretionary',
  'Entertainment': 'Discretionary',
  'Shopping': 'Discretionary',
  'Travel': 'Discretionary',
  'Electronics': 'Discretionary',
  'Electronics/Software': 'Discretionary',
  'Software': 'Discretionary',
  'Home Improvement': 'Discretionary',
  'Subscription': 'Discretionary',
};

/**
 * Group color schemes
 */
const GROUP_COLORS = {
  'Essentials': {
    main: '#3b82f6',      // blue-500
    shades: [
      '#60a5fa', // blue-400
      '#3b82f6', // blue-500
      '#2563eb', // blue-600
      '#1d4ed8', // blue-700
      '#1e40af', // blue-800
    ]
  },
  'Discretionary': {
    main: '#f59e0b',      // amber-500
    shades: [
      '#fbbf24', // amber-400
      '#f59e0b', // amber-500
      '#d97706', // amber-600
      '#b45309', // amber-700
      '#92400e', // amber-800
    ]
  },
};

/**
 * Generate category breakdown pie chart config
 */
export function createCategoryBreakdownChart(categoryData: CategoryData[]): ChartConfig {
  // Group categories by Essentials vs Discretionary
  const grouped: Record<string, CategoryData[]> = {
    'Essentials': [],
    'Discretionary': [],
  };

  categoryData.forEach(cat => {
    const group = CATEGORY_GROUPS[cat.category] || 'Discretionary';
    grouped[group].push(cat);
  });

  // Create hierarchical data structure
  const hierarchicalData: ChartDataPoint[] = [];

  Object.entries(grouped).forEach(([groupName, categories]) => {
    if (categories.length === 0) return;

    const groupTotal = categories.reduce((sum, cat) => sum + cat.total, 0);
    const groupColor = GROUP_COLORS[groupName as keyof typeof GROUP_COLORS];
    
    // Sort categories by amount (largest first)
    const sortedCategories = [...categories].sort((a, b) => b.total - a.total);
    
    // Create children with varying shades
    const children = sortedCategories.map((cat, idx) => ({
      label: cat.category,
      value: cat.total,
      group: groupName,
      color: groupColor.shades[idx % groupColor.shades.length],
    }));

    hierarchicalData.push({
      label: groupName,
      value: groupTotal,
      group: groupName,
      color: groupColor.main,
      children,
    });
  });

  return {
    type: 'treemap',
    title: 'Spending by Category',
    description: `Breakdown of expenses: Essentials vs Discretionary`,
    data: hierarchicalData,
    currency: true,
  };
}

/**
 * Generate income vs expenses bar chart config
 */
export function createIncomeVsExpensesChart(
  data: Array<{ month: string; income: number; expenses: number }>
): ChartConfig {
  const { income: incomeColor, expenses: expensesColor } = getIncomeExpenseColors();
  
  return {
    type: 'bar',
    title: 'Income vs Expenses',
    description: `Monthly comparison of income and expenses`,
    data: data.map(d => ({
      label: formatMonthLabel(d.month + '-01'),
      value: d.income,
      value2: d.expenses,
    })),
    xAxisLabel: 'Month',
    yAxisLabel: 'Amount',
    currency: true,
    colors: [incomeColor, expensesColor],
  };
}

