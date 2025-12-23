/**
 * Chart configuration types for Butler visualization system
 */

export type ChartType = 'line' | 'bar' | 'pie' | 'area' | 'treemap' | 'sankey';

export interface ChartDataPoint {
  label: string;      // e.g., "January 2025" or "Food & Dining"
  value: number;      // e.g., 1234.56
  value2?: number;    // For multi-series (e.g., income vs expenses)
  color?: string;     // Optional custom color for this data point
  children?: ChartDataPoint[]; // For hierarchical data (treemap)
  group?: string;     // For grouping (e.g., "Essentials", "Discretionary")
}

export interface SankeyNode {
  name: string;
  value?: number; // Calculated by chart usually, but good to have
  color?: string;
  depth?: number; // Column index (0, 1, 2)
}

export interface SankeyLink {
  source: number; // Index in nodes array
  target: number; // Index in nodes array
  value: number;
  color?: string; // Link color (usually semi-transparent source color)
}

export interface ChartConfig {
  type: ChartType;
  title: string;
  description: string;
  data: ChartDataPoint[];
  sankeyData?: {
    nodes: SankeyNode[];
    links: SankeyLink[];
  };
  xAxisLabel?: string;
  yAxisLabel?: string;
  currency?: boolean;
  colors?: string[];  // Custom color palette
}

/**
 * Validate a chart configuration
 */
export function validateChartConfig(config: any): config is ChartConfig {
  if (!config || typeof config !== 'object') return false;
  
  if (!['line', 'bar', 'pie', 'area', 'treemap', 'sankey'].includes(config.type)) return false;
  if (typeof config.title !== 'string' || !config.title) return false;
  if (typeof config.description !== 'string') return false;
  
  // For sankey, validate sankeyData
  if (config.type === 'sankey') {
    if (!config.sankeyData || !Array.isArray(config.sankeyData.nodes) || !Array.isArray(config.sankeyData.links)) return false;
    return true;
  }

  if (!Array.isArray(config.data) || config.data.length === 0) return false;
  
  // Validate data points
  for (const point of config.data) {
    if (typeof point.label !== 'string' || !point.label) return false;
    if (typeof point.value !== 'number') return false;
    if (point.value2 !== undefined && typeof point.value2 !== 'number') return false;
  }
  
  return true;
}

/**
 * Chart type for aggregated monthly data
 */
export interface MonthlyData {
  month: string;      // e.g., "2025-11" or "Nov 2025"
  total: number;
  income?: number;
  expenses?: number;
}

/**
 * Chart type for category breakdown
 */
export interface CategoryData {
  category: string;
  total: number;
  percentage: number;
  count: number;
  spend_classification?: string | null;
}

