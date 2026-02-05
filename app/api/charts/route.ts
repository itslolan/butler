import { NextRequest, NextResponse } from 'next/server';
import { executeToolCall } from '@/lib/chat-tool-executor';
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
 * - This endpoint → calls chat tool executor for data-only tools
 * - This endpoint → renders charts locally from that data
 * - Chat tools → use the same data tools for answers
 *
 * This ensures Dashboard and Chat always show identical data for the same time ranges.
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
    const start = searchParams.get('start'); // Optional: custom start date (YYYY-MM-DD)
    const end = searchParams.get('end'); // Optional: custom end date (YYYY-MM-DD)

    if (!type) {
      return NextResponse.json(
        { error: 'Chart type is required' },
        { status: 400 }
      );
    }

    // Build time period params (assistant functions handle defaults)
    // Priority: custom start/end > month > months
    const timePeriodParams: { startDate?: string; endDate?: string; month?: string; months?: number } = {};
    if (start || end) {
      timePeriodParams.startDate = start || undefined;
      timePeriodParams.endDate = end || undefined;
    } else if (monthFilter) {
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

    const toolArgs = {
      specificMonth: timePeriodParams.month,
      months: timePeriodParams.months,
      startDate: timePeriodParams.startDate,
      endDate: timePeriodParams.endDate,
    };

    switch (type) {
      case 'spending-trend': {
        // Call canonical chat data tool
        rawData = await executeToolCall(
          'get_monthly_spending_trend',
          toolArgs,
          userId,
          request.url
        );
        if (rawData?.error) {
          throw new Error(rawData.error);
        }
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
        // Call canonical chat data tool
        console.log('[DASHBOARD category-breakdown] Calling with:', { userId, timePeriodParams });
        rawData = await executeToolCall(
          'get_category_breakdown',
          toolArgs,
          userId,
          request.url
        );
        if (rawData?.error) {
          throw new Error(rawData.error);
        }
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
        // Call canonical chat data tool
        rawData = await executeToolCall(
          'get_income_vs_expenses',
          toolArgs,
          userId,
          request.url
        );
        if (rawData?.error) {
          throw new Error(rawData.error);
        }
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
        // Call canonical chat data tool
        rawData = await executeToolCall(
          'get_cash_flow_data',
          toolArgs,
          userId,
          request.url
        );
        if (rawData?.error) {
          throw new Error(rawData.error);
        }
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

