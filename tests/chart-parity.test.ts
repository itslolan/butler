/**
 * Chart Parity Tests
 * 
 * Validates that /api/charts returns consistent data structures and that
 * the same params produce identical rawData across multiple calls.
 * 
 * This ensures Dashboard and Chat visuals stay aligned.
 */

import { describe, it, expect } from '@jest/globals';

// Test user ID (you can adjust for your test setup)
const TEST_USER_ID = 'test-user';
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

/**
 * Helper to fetch chart envelope
 */
async function fetchChartEnvelope(type: string, params: Record<string, string> = {}) {
  const queryParams = new URLSearchParams({
    userId: TEST_USER_ID,
    type,
    ...params,
  });
  
  const response = await fetch(`${BASE_URL}/api/charts?${queryParams}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${type}: ${response.statusText}`);
  }
  
  return response.json();
}

describe('Chart Parity Tests', () => {
  describe('Envelope Structure', () => {
    it('should return chartConfig, rawData, and params for spending-trend', async () => {
      const envelope = await fetchChartEnvelope('spending-trend', { months: '6' });
      
      expect(envelope).toHaveProperty('chartConfig');
      expect(envelope).toHaveProperty('rawData');
      expect(envelope).toHaveProperty('params');
      
      expect(envelope.params.type).toBe('spending-trend');
      expect(envelope.params.months).toBe(6);
    });
    
    it('should return chartConfig, rawData, and params for category-breakdown', async () => {
      const envelope = await fetchChartEnvelope('category-breakdown', { months: '6' });
      
      expect(envelope).toHaveProperty('chartConfig');
      expect(envelope).toHaveProperty('rawData');
      expect(envelope).toHaveProperty('params');
      
      expect(envelope.params.type).toBe('category-breakdown');
    });
    
    it('should return chartConfig, rawData, and params for income-vs-expenses', async () => {
      const envelope = await fetchChartEnvelope('income-vs-expenses', { months: '6' });
      
      expect(envelope).toHaveProperty('chartConfig');
      expect(envelope).toHaveProperty('rawData');
      expect(envelope).toHaveProperty('params');
    });
    
    it('should return chartConfig, rawData, and params for cash-flow', async () => {
      const envelope = await fetchChartEnvelope('cash-flow', { months: '6' });
      
      expect(envelope).toHaveProperty('chartConfig');
      expect(envelope).toHaveProperty('rawData');
      expect(envelope).toHaveProperty('params');
    });
  });
  
  describe('Data Consistency', () => {
    it('should return identical rawData for the same params (category-breakdown)', async () => {
      const params = { months: '3' };
      
      const envelope1 = await fetchChartEnvelope('category-breakdown', params);
      const envelope2 = await fetchChartEnvelope('category-breakdown', params);
      
      // Raw data should be identical
      expect(envelope1.rawData).toEqual(envelope2.rawData);
    });
    
    it('should handle month-specific queries consistently', async () => {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const params = { month: currentMonth };
      
      const envelope1 = await fetchChartEnvelope('spending-trend', params);
      const envelope2 = await fetchChartEnvelope('spending-trend', params);
      
      expect(envelope1.rawData).toEqual(envelope2.rawData);
      expect(envelope1.params.month).toBe(currentMonth);
      expect(envelope2.params.month).toBe(currentMonth);
    });
  });
  
  describe('ChartConfig Validity', () => {
    it('should return valid chartConfig for each type', async () => {
      const types = ['spending-trend', 'category-breakdown', 'income-vs-expenses', 'cash-flow'];
      
      for (const type of types) {
        const envelope = await fetchChartEnvelope(type, { months: '6' });
        
        expect(envelope.chartConfig).toHaveProperty('type');
        expect(envelope.chartConfig).toHaveProperty('data');
        expect(Array.isArray(envelope.chartConfig.data)).toBe(true);
      }
    });
  });
  
  describe('Params Reproducibility', () => {
    it('should include all necessary params to reproduce the query', async () => {
      const envelope = await fetchChartEnvelope('category-breakdown', { 
        months: '6',
      });
      
      expect(envelope.params).toHaveProperty('type');
      expect(envelope.params).toHaveProperty('userId');
      expect(envelope.params).toHaveProperty('generatedAt');
      expect(envelope.params.months).toBe(6);
      
      // Should NOT have month if months was provided
      expect(envelope.params.month).toBeUndefined();
    });
    
    it('should include month param when specific month is queried', async () => {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const envelope = await fetchChartEnvelope('spending-trend', { 
        month: currentMonth,
      });
      
      expect(envelope.params.month).toBe(currentMonth);
      // Should NOT have months if month was provided
      expect(envelope.params.months).toBeUndefined();
    });
  });
});

export {};

