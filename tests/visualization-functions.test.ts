/**
 * Tests for Visualization Functions
 * 
 * These tests verify that visualization functions correctly transform data
 * into chart configurations.
 */

import {
  getPieChart,
  getLineChart,
  getBarChart,
  getAreaChart,
  getSankeyChart,
  transformCategoryBreakdownToChartData,
  transformMonthlySpendingToChartData,
  transformIncomeVsExpensesToChartData,
} from '../lib/visualization-functions';
import { validateChartConfig } from '../lib/chart-types';

describe('getPieChart', () => {
  it('should create valid pie chart config', () => {
    const data = [
      { label: 'Food & Dining', value: 1184.90 },
      { label: 'Housing', value: 2350.00 },
    ];
    
    const config = getPieChart(data, { title: 'Test Chart' });
    
    expect(validateChartConfig(config)).toBe(true);
    expect(config.type).toBe('pie');
    expect(config.title).toBe('Test Chart');
    expect(config.data.length).toBe(2);
  });
  
  it('should sort data by value descending', () => {
    const data = [
      { label: 'Small', value: 100 },
      { label: 'Large', value: 1000 },
      { label: 'Medium', value: 500 },
    ];
    
    const config = getPieChart(data);
    
    expect(config.data[0].label).toBe('Large');
    expect(config.data[1].label).toBe('Medium');
    expect(config.data[2].label).toBe('Small');
  });
  
  it('should default currency to true', () => {
    const data = [{ label: 'Test', value: 100 }];
    const config = getPieChart(data);
    
    expect(config.currency).toBe(true);
  });
  
  it('should accept custom options', () => {
    const data = [{ label: 'Test', value: 100 }];
    const config = getPieChart(data, {
      title: 'Custom Title',
      description: 'Custom Description',
      currency: false,
    });
    
    expect(config.title).toBe('Custom Title');
    expect(config.description).toBe('Custom Description');
    expect(config.currency).toBe(false);
  });
});

describe('getLineChart', () => {
  it('should create valid line chart config', () => {
    const data = [
      { label: 'Jan 2025', value: 3421 },
      { label: 'Feb 2025', value: 3987 },
    ];
    
    const config = getLineChart(data, { title: 'Trend' });
    
    expect(validateChartConfig(config)).toBe(true);
    expect(config.type).toBe('line');
    expect(config.title).toBe('Trend');
  });
  
  it('should handle multi-series data', () => {
    const data = [
      { label: 'Jan', value: 100, value2: 80 },
      { label: 'Feb', value: 120, value2: 90 },
    ];
    
    const config = getLineChart(data);
    
    expect(config.data[0].value2).toBe(80);
    expect(config.data[1].value2).toBe(90);
  });
  
  it('should accept axis labels', () => {
    const data = [{ label: 'Test', value: 100 }];
    const config = getLineChart(data, {
      xAxisLabel: 'Time',
      yAxisLabel: 'Amount',
    });
    
    expect(config.xAxisLabel).toBe('Time');
    expect(config.yAxisLabel).toBe('Amount');
  });
});

describe('getBarChart', () => {
  it('should create valid bar chart config', () => {
    const data = [
      { label: 'Category A', value: 100 },
      { label: 'Category B', value: 200 },
    ];
    
    const config = getBarChart(data);
    
    expect(validateChartConfig(config)).toBe(true);
    expect(config.type).toBe('bar');
  });
  
  it('should support comparison data with value2', () => {
    const data = [
      { label: 'Jan', value: 5000, value2: 3000 },
      { label: 'Feb', value: 5200, value2: 3200 },
    ];
    
    const config = getBarChart(data, {
      title: 'Income vs Expenses',
    });
    
    expect(config.data[0].value).toBe(5000);
    expect(config.data[0].value2).toBe(3000);
  });
});

describe('getAreaChart', () => {
  it('should create valid area chart config', () => {
    const data = [
      { label: 'Q1', value: 10000 },
      { label: 'Q2', value: 15000 },
    ];
    
    const config = getAreaChart(data);
    
    expect(validateChartConfig(config)).toBe(true);
    expect(config.type).toBe('area');
  });
});

describe('getSankeyChart', () => {
  it('should create valid sankey chart config', () => {
    const nodes = [
      { name: 'Income', value: 5000 },
      { name: 'Fixed', value: 2000 },
      { name: 'Variable', value: 3000 },
    ];
    
    const links = [
      { source: 0, target: 1, value: 2000 },
      { source: 0, target: 2, value: 3000 },
    ];
    
    const config = getSankeyChart(nodes, links, {
      title: 'Cash Flow',
    });
    
    expect(validateChartConfig(config)).toBe(true);
    expect(config.type).toBe('sankey');
    expect(config.sankeyData).toBeDefined();
    expect(config.sankeyData?.nodes.length).toBe(3);
    expect(config.sankeyData?.links.length).toBe(2);
  });
});

describe('Data Transformation Helpers', () => {
  describe('transformCategoryBreakdownToChartData', () => {
    it('should transform category data correctly', () => {
      const categories = [
        { category: 'Food', total: 1184.90 },
        { category: 'Housing', total: 2350.00 },
      ];
      
      const result = transformCategoryBreakdownToChartData(categories);
      
      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ label: 'Food', value: 1184.90 });
      expect(result[1]).toEqual({ label: 'Housing', value: 2350.00 });
    });
  });
  
  describe('transformMonthlySpendingToChartData', () => {
    it('should transform monthly data with formatted labels', () => {
      const months = [
        { month: '2025-01', total: 3421 },
        { month: '2025-02', total: 3987 },
      ];
      
      const result = transformMonthlySpendingToChartData(months);
      
      expect(result.length).toBe(2);
      expect(result[0].value).toBe(3421);
      expect(result[1].value).toBe(3987);
      // Labels should be formatted (e.g., "Jan 2025")
      expect(result[0].label).toContain('2025');
    });
  });
  
  describe('transformIncomeVsExpensesToChartData', () => {
    it('should transform income vs expenses with value2', () => {
      const data = [
        { month: '2025-01', income: 5000, expenses: 3421 },
        { month: '2025-02', income: 5200, expenses: 3987 },
      ];
      
      const result = transformIncomeVsExpensesToChartData(data);
      
      expect(result.length).toBe(2);
      expect(result[0].value).toBe(5000);
      expect(result[0].value2).toBe(3421);
      expect(result[1].value).toBe(5200);
      expect(result[1].value2).toBe(3987);
    });
  });
});

describe('Pure Function Properties', () => {
  it('should return identical output for identical input', () => {
    const data = [
      { label: 'Test', value: 100 },
    ];
    
    const config1 = getPieChart(data, { title: 'Test' });
    const config2 = getPieChart(data, { title: 'Test' });
    
    expect(config1).toEqual(config2);
  });
  
  it('should not mutate input data', () => {
    const data = [
      { label: 'B', value: 100 },
      { label: 'A', value: 200 },
    ];
    const originalData = JSON.parse(JSON.stringify(data));
    
    getPieChart(data); // This sorts internally
    
    // Original data should be unchanged
    expect(data).toEqual(originalData);
  });
});

describe('Edge Cases', () => {
  it('should handle empty data array', () => {
    const config = getPieChart([], { title: 'Empty' });
    
    expect(config.data.length).toBe(0);
  });
  
  it('should handle single data point', () => {
    const data = [{ label: 'Only', value: 100 }];
    const config = getPieChart(data);
    
    expect(validateChartConfig(config)).toBe(true);
    expect(config.data.length).toBe(1);
  });
  
  it('should handle zero values', () => {
    const data = [
      { label: 'Zero', value: 0 },
      { label: 'Non-zero', value: 100 },
    ];
    
    const config = getPieChart(data);
    
    expect(config.data[0].label).toBe('Non-zero');
    expect(config.data[1].label).toBe('Zero');
  });
  
  it('should handle negative values', () => {
    const data = [{ label: 'Negative', value: -100 }];
    const config = getBarChart(data);
    
    expect(validateChartConfig(config)).toBe(true);
  });
});

export {};

