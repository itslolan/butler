import { NextRequest, NextResponse } from 'next/server';
import {
  getCategoryBreakdown,
  getMonthlySpendingTrend,
  getIncomeVsExpenses,
  getCashFlowData,
} from '@/lib/assistant-functions';
import {
  getPieChart,
  getLineChart,
  getBarChart,
  getSankeyChart,
  transformCategoryBreakdownToChartData,
  transformMonthlySpendingToChartData,
  transformIncomeVsExpensesToChartData,
} from '@/lib/visualization-functions';
import { ChartConfig } from '@/lib/chart-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/charts?userId=X&type=Y&months=6&month=YYYY-MM
 * 
 * Server-side API endpoint that wraps canonical assistant functions.
 * Used by client components (dashboard) to fetch chart data.
 * 
 * Architecture:
 * - Client components (VisualizationPanel) → call this API endpoint
 * - This endpoint → calls @/lib/assistant-functions (canonical data)
 * - This endpoint → calls @/lib/visualization-functions (canonical charts)
 * - Chat tools → directly call the same canonical functions
 * 
 * This ensures Dashboard and Chat always show identical data!
 * 
 * Response format:
 * {
 *   chartConfig: ChartConfig (for rendering),
 *   rawData: underlying aggregates (for explanations/tables),
 *   params: { type, month?, months?, userId, generatedAt }
 * }
 * 
 * Chart types:
 * - spending-trend: Monthly spending line chart
 * - category-breakdown: Category pie chart
 * - income-vs-expenses: Income/expense bar chart
 * - cash-flow: Cash flow sankey diagram
 * 
 * Note: Server components can import assistant-functions directly without using this API.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || 'default-user';
    const type = searchParams.get('type');
    const monthsParam = searchParams.get('months');
    const months = monthsParam ? parseInt(monthsParam, 10) : null;
    const monthFilter = searchParams.get('month'); // Optional: specific month filter (YYYY-MM)

    if (!type) {
      return NextResponse.json(
        { error: 'Chart type is required' },
        { status: 400 }
      );
    }

    // Build time period params (assistant functions handle defaults)
    const timePeriodParams: { month?: string; months?: number } = {};
    if (monthFilter) {
      timePeriodParams.month = monthFilter;
    } else if (months !== null) {
      timePeriodParams.months = months;
    }
    // If neither specified, assistant functions default to current month
    
    // Build params object for reproducibility
    const params: any = {
      type,
      userId,
      generatedAt: new Date().toISOString(),
      ...timePeriodParams,
    };

    let chartConfig: ChartConfig;
    let rawData: any;

    switch (type) {
      case 'spending-trend': {
        // Call canonical assistant function
        rawData = await getMonthlySpendingTrend(userId, timePeriodParams);
        // Transform and create chart using pure visualization function
        const chartData = transformMonthlySpendingToChartData(rawData);
        chartConfig = getLineChart(chartData, {
          title: 'Monthly Spending Trend',
          description: 'Your spending over time',
          currency: true,
        });
        break;
      }

      case 'category-breakdown': {
        // Call canonical assistant function
        console.log('[DASHBOARD category-breakdown] Calling with:', { userId, timePeriodParams });
        rawData = await getCategoryBreakdown(userId, timePeriodParams);
        console.log('[DASHBOARD category-breakdown] Result count:', rawData?.length);
        const foodResult = rawData?.find((c: any) => c.category?.toLowerCase().includes('food'));
        console.log('[DASHBOARD category-breakdown] Food & Dining result:', foodResult);
        // Transform and create chart using pure visualization function
        const chartData = transformCategoryBreakdownToChartData(rawData);
        chartConfig = getPieChart(chartData, {
          title: 'Spending by Category',
          description: 'Breakdown of expenses by category',
          currency: true,
        });
        break;
      }

      case 'income-vs-expenses': {
        // Call canonical assistant function
        rawData = await getIncomeVsExpenses(userId, timePeriodParams);
        // Transform and create chart using pure visualization function
        const chartData = transformIncomeVsExpensesToChartData(rawData);
        chartConfig = getBarChart(chartData, {
          title: 'Income vs Expenses',
          description: 'Comparison of income and expenses',
          currency: true,
        });
        break;
      }

      case 'cash-flow': {
        // Call canonical assistant function
        rawData = await getCashFlowData(userId, timePeriodParams);
        // Create chart using pure visualization function
        chartConfig = getSankeyChart(
          rawData.nodes || [],
          rawData.links || [],
          {
            title: 'Cash Flow',
            description: 'Flow of money through your accounts',
            currency: true,
          }
        );
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown chart type: ${type}` },
          { status: 400 }
        );
    }

    // Return unified envelope
    return NextResponse.json({
      chartConfig,
      rawData,
      params,
    });

  } catch (error: any) {
    console.error('Error generating chart data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate chart data' },
      { status: 500 }
    );
  }
}

