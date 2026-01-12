/**
 * Tests for Assistant Functions
 * 
 * These tests verify that the canonical data layer functions work correctly
 * and maintain consistency across dashboard and chat interfaces.
 */

import {
  getCategoryBreakdown,
  getMonthlySpendingTrend,
  getIncomeVsExpenses,
  getCurrentBudget,
} from '../lib/assistant-functions';

// Test user ID - replace with valid test user in your environment
const TEST_USER_ID = process.env.TEST_USER_ID || 'test-user';

describe('getCategoryBreakdown', () => {
  it('should return an array of category data', async () => {
    const result = await getCategoryBreakdown(TEST_USER_ID);
    
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('category');
      expect(result[0]).toHaveProperty('total');
      expect(result[0]).toHaveProperty('percentage');
      expect(result[0]).toHaveProperty('count');
    }
  });
  
  it('should default to current month when no params provided', async () => {
    const result = await getCategoryBreakdown(TEST_USER_ID);
    
    // Result should be for current month only
    // (This is implicit - we're testing that it doesn't error)
    expect(Array.isArray(result)).toBe(true);
  });
  
  it('should handle specific month parameter', async () => {
    const result = await getCategoryBreakdown(TEST_USER_ID, { month: '2025-12' });
    
    expect(Array.isArray(result)).toBe(true);
    // Verify data is for December 2025
  });
  
  it('should handle months range parameter', async () => {
    const result = await getCategoryBreakdown(TEST_USER_ID, { months: 6 });
    
    expect(Array.isArray(result)).toBe(true);
    // Verify data spans 6 months
  });
  
  it('should sort categories by total descending', async () => {
    const result = await getCategoryBreakdown(TEST_USER_ID);
    
    if (result.length > 1) {
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].total).toBeGreaterThanOrEqual(result[i + 1].total);
      }
    }
  });
  
  it('should calculate percentages correctly', async () => {
    const result = await getCategoryBreakdown(TEST_USER_ID);
    
    if (result.length > 0) {
      const totalPercentage = result.reduce((sum, cat) => sum + cat.percentage, 0);
      // Should be approximately 100% (allowing for floating point rounding)
      expect(Math.abs(totalPercentage - 100)).toBeLessThan(0.1);
    }
  });
});

describe('getMonthlySpendingTrend', () => {
  it('should return an array of monthly data', async () => {
    const result = await getMonthlySpendingTrend(TEST_USER_ID);
    
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('month');
      expect(result[0]).toHaveProperty('total');
      expect(typeof result[0].month).toBe('string');
      expect(typeof result[0].total).toBe('number');
    }
  });
  
  it('should handle specific month parameter', async () => {
    const result = await getMonthlySpendingTrend(TEST_USER_ID, { month: '2025-12' });
    
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0].month).toBe('2025-12');
    }
  });
  
  it('should handle months range parameter', async () => {
    const result = await getMonthlySpendingTrend(TEST_USER_ID, { months: 6 });
    
    expect(Array.isArray(result)).toBe(true);
    // Should have data points for recent months
  });
  
  it('should return months in chronological order', async () => {
    const result = await getMonthlySpendingTrend(TEST_USER_ID, { months: 6 });
    
    if (result.length > 1) {
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].month).toBeLessThan(result[i + 1].month);
      }
    }
  });
});

describe('getIncomeVsExpenses', () => {
  it('should return an array of income and expense data', async () => {
    const result = await getIncomeVsExpenses(TEST_USER_ID);
    
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('month');
      expect(result[0]).toHaveProperty('income');
      expect(result[0]).toHaveProperty('expenses');
      expect(typeof result[0].income).toBe('number');
      expect(typeof result[0].expenses).toBe('number');
    }
  });
  
  it('should handle specific month parameter', async () => {
    const result = await getIncomeVsExpenses(TEST_USER_ID, { month: '2025-12' });
    
    expect(Array.isArray(result)).toBe(true);
  });
  
  it('should have non-negative values', async () => {
    const result = await getIncomeVsExpenses(TEST_USER_ID);
    
    result.forEach(month => {
      expect(month.income).toBeGreaterThanOrEqual(0);
      expect(month.expenses).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('getCurrentBudget', () => {
  it('should return budget structure with required fields', async () => {
    const result = await getCurrentBudget(TEST_USER_ID);
    
    expect(result).toHaveProperty('income');
    expect(result).toHaveProperty('totalBudgeted');
    expect(result).toHaveProperty('totalSpent');
    expect(result).toHaveProperty('readyToAssign');
    expect(result).toHaveProperty('categories');
    expect(Array.isArray(result.categories)).toBe(true);
  });
  
  it('should calculate readyToAssign correctly', async () => {
    const result = await getCurrentBudget(TEST_USER_ID);
    
    expect(result.readyToAssign).toBe(result.income - result.totalBudgeted);
  });
  
  it('should have valid category data', async () => {
    const result = await getCurrentBudget(TEST_USER_ID);
    
    result.categories.forEach(cat => {
      expect(cat).toHaveProperty('id');
      expect(cat).toHaveProperty('name');
      expect(cat).toHaveProperty('budgeted');
      expect(cat).toHaveProperty('spent');
      expect(cat).toHaveProperty('available');
      expect(cat).toHaveProperty('isOverBudget');
      
      // Available should equal budgeted minus spent
      expect(cat.available).toBe(cat.budgeted - cat.spent);
      
      // isOverBudget should be correct
      expect(cat.isOverBudget).toBe(cat.spent > cat.budgeted);
    });
  });
  
  it('should sum categories correctly', async () => {
    const result = await getCurrentBudget(TEST_USER_ID);
    
    const sumBudgeted = result.categories.reduce((sum, cat) => sum + cat.budgeted, 0);
    const sumSpent = result.categories.reduce((sum, cat) => sum + cat.spent, 0);
    
    expect(result.totalBudgeted).toBe(sumBudgeted);
    expect(result.totalSpent).toBe(sumSpent);
  });
});

describe('Consistency Tests', () => {
  it('should return identical data when called with same parameters', async () => {
    const params = { month: '2025-12' };
    
    const result1 = await getCategoryBreakdown(TEST_USER_ID, params);
    const result2 = await getCategoryBreakdown(TEST_USER_ID, params);
    
    expect(result1).toEqual(result2);
  });
  
  it('should have matching data between category breakdown and spending trend', async () => {
    const params = { month: '2025-12' };
    
    const categories = await getCategoryBreakdown(TEST_USER_ID, params);
    const spending = await getMonthlySpendingTrend(TEST_USER_ID, params);
    
    if (categories.length > 0 && spending.length > 0) {
      // Total of categories should match spending total
      const categoryTotal = categories.reduce((sum, cat) => sum + cat.total, 0);
      const spendingTotal = spending[0].total;
      
      // Allow small rounding differences
      expect(Math.abs(categoryTotal - spendingTotal)).toBeLessThan(0.01);
    }
  });
});

describe('Parameter Validation', () => {
  it('should handle empty user ID gracefully', async () => {
    const result = await getCategoryBreakdown('');
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
  
  it('should handle invalid month format gracefully', async () => {
    // Should not throw, might return empty or use default
    await expect(getCategoryBreakdown(TEST_USER_ID, { month: 'invalid' })).resolves.toBeDefined();
  });
  
  it('should handle zero months parameter', async () => {
    await expect(getCategoryBreakdown(TEST_USER_ID, { months: 0 })).resolves.toBeDefined();
  });
});

export {};

