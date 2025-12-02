import { NextRequest, NextResponse } from 'next/server';
import { getMonthlySpendingTrend, getCategoryBreakdown, getIncomeVsExpenses } from '@/lib/db-tools';
import { 
  createSpendingTrendChart, 
  createCategoryBreakdownChart, 
  createIncomeVsExpensesChart 
} from '@/lib/chart-utils';
import { ChartConfig } from '@/lib/chart-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/charts?userId=X&type=Y&months=6
 * 
 * Returns chart configuration JSON for visualization
 * 
 * Chart types:
 * - spending-trend: Monthly spending line chart
 * - category-breakdown: Category pie chart
 * - income-vs-expenses: Income/expense bar chart
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || 'default-user';
    const type = searchParams.get('type');
    const months = parseInt(searchParams.get('months') || '6', 10);
    const monthFilter = searchParams.get('month'); // Optional: specific month filter (YYYY-MM)

    if (!type) {
      return NextResponse.json(
        { error: 'Chart type is required' },
        { status: 400 }
      );
    }

    let chartConfig: ChartConfig;

    switch (type) {
      case 'spending-trend': {
        const data = await getMonthlySpendingTrend(userId, months, monthFilter || undefined);
        chartConfig = createSpendingTrendChart(data);
        break;
      }

      case 'category-breakdown': {
        const data = await getCategoryBreakdown(userId, months, monthFilter || undefined);
        chartConfig = createCategoryBreakdownChart(data);
        break;
      }

      case 'income-vs-expenses': {
        const data = await getIncomeVsExpenses(userId, months, monthFilter || undefined);
        chartConfig = createIncomeVsExpensesChart(data);
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown chart type: ${type}` },
          { status: 400 }
        );
    }

    return NextResponse.json(chartConfig);

  } catch (error: any) {
    console.error('Error generating chart data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate chart data' },
      { status: 500 }
    );
  }
}

