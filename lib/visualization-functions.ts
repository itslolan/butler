/**
 * Visualization Functions - Pure Chart Generation Layer
 * 
 * These functions transform data into ChartConfig objects for rendering.
 * They are pure functions with no side effects (no API calls, no database access).
 * 
 * Design principles:
 * - Pure functions: same input always produces same output
 * - No external dependencies (API calls, database queries)
 * - Type-safe inputs and outputs
 * - Flexible options for customization
 * - Used by both chat tools and dashboard components
 */

import { ChartConfig, ChartDataPoint, SankeyNode, SankeyLink } from './chart-types';

/**
 * Options for customizing chart appearance
 */
export interface ChartOptions {
  title?: string;
  description?: string;
  currency?: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
  colors?: string[];
}

/**
 * Create a pie chart configuration
 * 
 * @param data - Array of label/value pairs
 * @param options - Chart customization options
 * @returns ChartConfig for rendering
 * 
 * @example
 * const data = [
 *   { label: 'Food & Dining', value: 1184.90 },
 *   { label: 'Housing', value: 2350.00 }
 * ];
 * const config = getPieChart(data, { 
 *   title: 'Spending by Category',
 *   currency: true 
 * });
 */
export function getPieChart(
  data: Array<{ label: string; value: number }>,
  options: ChartOptions = {}
): ChartConfig {
  // Sort by value descending
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  
  return {
    type: 'pie',
    title: options.title || 'Breakdown',
    description: options.description || '',
    data: sortedData,
    currency: options.currency ?? true,
    colors: options.colors,
  };
}

/**
 * Create a line chart configuration
 * 
 * @param data - Array of label/value pairs (typically time series)
 * @param options - Chart customization options
 * @returns ChartConfig for rendering
 * 
 * @example
 * const data = [
 *   { label: 'Jan 2025', value: 3421 },
 *   { label: 'Feb 2025', value: 3987 }
 * ];
 * const config = getLineChart(data, { 
 *   title: 'Spending Trend',
 *   yAxisLabel: 'Amount' 
 * });
 */
export function getLineChart(
  data: Array<{ label: string; value: number; value2?: number }>,
  options: ChartOptions = {}
): ChartConfig {
  return {
    type: 'line',
    title: options.title || 'Trend',
    description: options.description || '',
    data,
    currency: options.currency ?? true,
    xAxisLabel: options.xAxisLabel,
    yAxisLabel: options.yAxisLabel,
    colors: options.colors,
  };
}

/**
 * Create a bar chart configuration
 * 
 * @param data - Array of label/value pairs (supports multi-series with value2)
 * @param options - Chart customization options
 * @returns ChartConfig for rendering
 * 
 * @example
 * const data = [
 *   { label: 'Jan 2025', value: 5000, value2: 3421 }, // income vs expenses
 *   { label: 'Feb 2025', value: 5200, value2: 3987 }
 * ];
 * const config = getBarChart(data, { 
 *   title: 'Income vs Expenses',
 *   currency: true 
 * });
 */
export function getBarChart(
  data: Array<{ label: string; value: number; value2?: number }>,
  options: ChartOptions = {}
): ChartConfig {
  return {
    type: 'bar',
    title: options.title || 'Comparison',
    description: options.description || '',
    data,
    currency: options.currency ?? true,
    xAxisLabel: options.xAxisLabel,
    yAxisLabel: options.yAxisLabel,
    colors: options.colors,
  };
}

/**
 * Create an area chart configuration
 * 
 * @param data - Array of label/value pairs (supports multi-series with value2)
 * @param options - Chart customization options
 * @returns ChartConfig for rendering
 * 
 * @example
 * const data = [
 *   { label: 'Jan 2025', value: 3421 },
 *   { label: 'Feb 2025', value: 3987 }
 * ];
 * const config = getAreaChart(data, { 
 *   title: 'Cumulative Spending',
 *   currency: true 
 * });
 */
export function getAreaChart(
  data: Array<{ label: string; value: number; value2?: number }>,
  options: ChartOptions = {}
): ChartConfig {
  return {
    type: 'area',
    title: options.title || 'Cumulative Trend',
    description: options.description || '',
    data,
    currency: options.currency ?? true,
    xAxisLabel: options.xAxisLabel,
    yAxisLabel: options.yAxisLabel,
    colors: options.colors,
  };
}

/**
 * Create a sankey diagram configuration
 * 
 * @param nodes - Array of node definitions
 * @param links - Array of links between nodes
 * @param options - Chart customization options
 * @returns ChartConfig for rendering
 * 
 * @example
 * const nodes = [
 *   { name: 'Income', value: 5000 },
 *   { name: 'Fixed Expenses', value: 2000 },
 *   { name: 'Discretionary', value: 3000 }
 * ];
 * const links = [
 *   { source: 0, target: 1, value: 2000 },
 *   { source: 0, target: 2, value: 3000 }
 * ];
 * const config = getSankeyChart(nodes, links, { 
 *   title: 'Cash Flow' 
 * });
 */
export function getSankeyChart(
  nodes: SankeyNode[],
  links: SankeyLink[],
  options: ChartOptions = {}
): ChartConfig {
  return {
    type: 'sankey',
    title: options.title || 'Flow Diagram',
    description: options.description || '',
    data: [], // Sankey uses sankeyData instead
    sankeyData: {
      nodes,
      links,
    },
    currency: options.currency ?? true,
  };
}

/**
 * Helper: Transform category breakdown data to chart data format
 * 
 * @param categories - Category breakdown from assistant functions
 * @returns Chart-ready data points
 */
export function transformCategoryBreakdownToChartData(
  categories: Array<{ category: string; total: number }>
): ChartDataPoint[] {
  return categories.map(cat => ({
    label: cat.category,
    value: cat.total,
  }));
}

/**
 * Helper: Transform monthly spending data to chart data format
 * 
 * @param months - Monthly spending from assistant functions
 * @returns Chart-ready data points
 */
export function transformMonthlySpendingToChartData(
  months: Array<{ month: string; total: number }>
): ChartDataPoint[] {
  return months.map(m => ({
    label: formatMonth(m.month),
    value: m.total,
  }));
}

/**
 * Helper: Transform income vs expenses data to chart data format
 * 
 * @param data - Income vs expenses from assistant functions
 * @returns Chart-ready data points with value2 for comparison
 */
export function transformIncomeVsExpensesToChartData(
  data: Array<{ month: string; income: number; expenses: number }>
): ChartDataPoint[] {
  return data.map(d => ({
    label: formatMonth(d.month),
    value: d.income,
    value2: d.expenses,
  }));
}

/**
 * Format month string for display
 * 
 * @param month - Month in YYYY-MM format
 * @returns Formatted month string (e.g., "Jan 2025")
 */
function formatMonth(month: string): string {
  try {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return month;
  }
}

