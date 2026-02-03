import { createClient } from '@supabase/supabase-js';
import {
  searchDocuments,
  searchTransactions,
  getAllMetadata,
  getAccountSnapshots,
  calculateNetWorth,
  getDistinctCategories,
  getDistinctMerchants,
  getDistinctAccountNames,
  bulkUpdateTransactionsByMerchant,
  bulkUpdateTransactionsByCategory,
  bulkUpdateTransactionsByFilters,
} from '@/lib/db-tools';
import { adjustBudgetAllocations } from '@/lib/budget-utils';
import {
  getCategoryBreakdown as getAssistantCategoryBreakdown,
  getMonthlySpendingTrend as getAssistantMonthlySpending,
  getIncomeVsExpenses as getAssistantIncomeVsExpenses,
  getCashFlowData as getAssistantCashFlow,
  getCurrentBudget as getAssistantCurrentBudget,
  getBudgetHealthAnalysis as getAssistantBudgetHealth,
} from '@/lib/assistant-functions';
import {
  getPieChart,
  getLineChart,
  getBarChart,
  getAreaChart,
  getSankeyChart,
  transformCategoryBreakdownToChartData,
  transformMonthlySpendingToChartData,
  transformIncomeVsExpensesToChartData,
} from '@/lib/visualization-functions';

/**
 * Lazy Supabase admin client.
 *
 * Next.js may import/trace route files during build ("Collecting page data").
 * Avoid creating clients (or throwing) at module load time.
 */
let _supabaseAdmin: ReturnType<typeof createClient<any>> | null = null;
function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  _supabaseAdmin = createClient<any>(url, key);
  return _supabaseAdmin;
}

// Helper function to execute a tool call
export async function executeToolCall(
  name: string,
  args: any,
  effectiveUserId: string,
  requestUrl?: string,
  clientBudgetContext?: {
    month?: string;
    income?: number;
    totalBudgeted?: number;
    readyToAssign?: number;
    categories?: Array<{ id: string; name: string; budgeted: number; spent?: number }>;
  }
) {
  let functionResult;

  try {
    if (name === 'search_documents') {
      functionResult = await searchDocuments(effectiveUserId, args);
    } else if (name === 'search_transactions') {
      functionResult = await searchTransactions(effectiveUserId, args);
    } else if (name === 'get_all_metadata') {
      functionResult = await getAllMetadata(effectiveUserId);
    } else if (name === 'categorize_transaction') {
      // Call the clarify-transaction API
      // Construct URL from request to ensure we call the same server instance
      // This is critical - if we use an absolute URL, we might hit a different server/database
      let fullApiUrl: string;

      if (requestUrl) {
        // Use the provided request URL to construct the API endpoint
        const url = new URL(requestUrl);
        fullApiUrl = `${url.protocol}//${url.host}/api/clarify-transaction`;
      } else {
        // Fallback: try to construct from environment or use localhost
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ||
          process.env.NEXT_PUBLIC_BASE_URL ||
          'http://localhost:3000';
        fullApiUrl = `${baseUrl}/api/clarify-transaction`;
      }

      try {
        const response = await fetch(fullApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transaction_id: args.transaction_id,
            transaction_type: args.transaction_type,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[chat API] categorize_transaction failed:', response.status, errorText);
          functionResult = {
            error: `API error: ${response.status} ${response.statusText}`,
            details: errorText,
          };
        } else {
          functionResult = await response.json();
        }
      } catch (fetchError: any) {
        console.error('[chat API] categorize_transaction fetch error:', fetchError.message);
        functionResult = {
          error: `Fetch failed: ${fetchError.message}`,
          error_type: fetchError.name,
        };
      }
    } else if (name === 'resolve_todo') {
      // Call resolve logic directly instead of making HTTP request
      // This avoids URL construction issues in different deployment environments
      try {
        const supabase = getSupabaseAdmin();
        const { updateTransactionType } = await import('@/lib/db-tools');
        const todoType = args.todo_type;
        const todoId = args.todo_id;
        const action = args.action;

        if (todoType === 'transaction_clarification') {
          const transactionId = todoId;

          if (action === 'dismiss') {
            const { error } = await supabase
              .from('transactions')
              .update({
                is_dismissed: true,
                needs_clarification: false,
                clarification_question: null,
              })
              .eq('id', transactionId)
              .eq('user_id', effectiveUserId);

            if (error) {
              functionResult = { error: error.message, success: false };
            } else {
              functionResult = { success: true, dismissed: true };
            }
          } else {
            // resolve action
            const transactionType = args.transaction_type;
            if (!transactionType || !['income', 'expense', 'transfer', 'other'].includes(transactionType)) {
              functionResult = {
                error: 'transaction_type is required for resolving transaction_clarification todos',
                success: false,
              };
            } else {
              await updateTransactionType(transactionId, transactionType);
              functionResult = {
                success: true,
                resolved: true,
                transaction_id: transactionId,
                transaction_type: transactionType,
              };
            }
          }
        } else if (todoType === 'account_selection') {
          // Handle account selection todos
          functionResult = {
            error: 'Account selection not implemented in direct call yet. Use /api/todos/resolve endpoint.',
            success: false,
          };
        } else {
          functionResult = { error: 'Invalid todoType', success: false };
        }
      } catch (resolveError: any) {
        console.error('[chat API] resolve_todo error:', resolveError.message);
        functionResult = {
          error: `Resolution failed: ${resolveError.message}`,
          error_type: resolveError.name,
          success: false,
        };
      }
    } else if (name === 'get_account_snapshots') {
      functionResult = await getAccountSnapshots(
        effectiveUserId,
        args.accountName,
        args.startDate,
        args.endDate
      );
    } else if (name === 'calculate_net_worth') {
      functionResult = await calculateNetWorth(effectiveUserId, args.date);
    } else if (name === 'render_chart') {
      // Validate and return chart config
      const { validateChartConfig } = await import('@/lib/chart-types');
      if (validateChartConfig(args)) {
        functionResult = {
          success: true,
          chartConfig: args,
          message: 'Chart configuration is valid and will be rendered',
        };
      } else {
        functionResult = {
          success: false,
          error: 'Invalid chart configuration',
        };
      }
    } else if (name === 'get_pie_chart') {
      // Create pie chart from data
      const chartConfig = getPieChart(args.data || [], {
        title: args.title,
        description: args.description,
        currency: args.currency,
      });
      functionResult = {
        success: true,
        chartConfig,
      };
    } else if (name === 'get_line_chart') {
      // Create line chart from data
      const chartConfig = getLineChart(args.data || [], {
        title: args.title,
        description: args.description,
        currency: args.currency,
        xAxisLabel: args.xAxisLabel,
        yAxisLabel: args.yAxisLabel,
      });
      functionResult = {
        success: true,
        chartConfig,
      };
    } else if (name === 'get_bar_chart') {
      // Create bar chart from data
      const chartConfig = getBarChart(args.data || [], {
        title: args.title,
        description: args.description,
        currency: args.currency,
        xAxisLabel: args.xAxisLabel,
        yAxisLabel: args.yAxisLabel,
      });
      functionResult = {
        success: true,
        chartConfig,
      };
    } else if (name === 'get_area_chart') {
      // Create area chart from data
      const chartConfig = getAreaChart(args.data || [], {
        title: args.title,
        description: args.description,
        currency: args.currency,
        xAxisLabel: args.xAxisLabel,
        yAxisLabel: args.yAxisLabel,
      });
      functionResult = {
        success: true,
        chartConfig,
      };
    } else if (name === 'get_distinct_categories') {
      functionResult = await getDistinctCategories(effectiveUserId, {
        startDate: args.startDate,
        endDate: args.endDate,
        transactionType: args.transactionType,
      });
    } else if (name === 'get_distinct_merchants') {
      functionResult = await getDistinctMerchants(effectiveUserId, {
        startDate: args.startDate,
        endDate: args.endDate,
        category: args.category,
      });
    } else if (name === 'get_distinct_account_names') {
      functionResult = await getDistinctAccountNames(effectiveUserId);
    } else if (name === 'bulk_update_transactions_by_merchant') {
      functionResult = await bulkUpdateTransactionsByMerchant(
        effectiveUserId,
        args.merchant,
        {
          category: args.category,
          transactionType: args.transactionType,
          spendClassification: args.spendClassification,
        },
        {
          startDate: args.startDate,
          endDate: args.endDate,
        }
      );
    } else if (name === 'bulk_update_transactions_by_category') {
      functionResult = await bulkUpdateTransactionsByCategory(
        effectiveUserId,
        args.oldCategory,
        args.newCategory,
        {
          startDate: args.startDate,
          endDate: args.endDate,
        }
      );
    } else if (name === 'bulk_update_transactions_by_filters') {
      functionResult = await bulkUpdateTransactionsByFilters(
        effectiveUserId,
        args.filters || {},
        args.updates || {}
      );
    } else if (name === 'get_category_breakdown') {
      // Call canonical assistant function
      console.log('[CHAT get_category_breakdown] Args:', args);
      const params = {
        month: args.specificMonth,
        months: args.months,
        startDate: args.startDate,
        endDate: args.endDate,
      };
      console.log('[CHAT get_category_breakdown] Calling with params:', params);
      functionResult = await getAssistantCategoryBreakdown(
        effectiveUserId,
        params
      );
      console.log('[CHAT get_category_breakdown] Result count:', functionResult?.length);
      const foodResult = functionResult?.find((cat: any) => cat.category?.toLowerCase().includes('food'));
      console.log('[CHAT get_category_breakdown] Food & Dining result:', foodResult);
    } else if (name === 'get_monthly_spending_trend') {
      // Call canonical assistant function
      functionResult = await getAssistantMonthlySpending(
        effectiveUserId,
        {
          month: args.specificMonth,
          months: args.months,
          startDate: args.startDate,
          endDate: args.endDate,
        }
      );
    } else if (name === 'get_income_vs_expenses') {
      // Call canonical assistant function
      functionResult = await getAssistantIncomeVsExpenses(
        effectiveUserId,
        {
          month: args.specificMonth,
          months: args.months,
          startDate: args.startDate,
          endDate: args.endDate,
        }
      );
    } else if (name === 'get_cash_flow_data') {
      // Call canonical assistant function
      functionResult = await getAssistantCashFlow(
        effectiveUserId,
        {
          month: args.specificMonth,
          months: args.months,
          startDate: args.startDate,
          endDate: args.endDate,
        }
      );
    } else if (name === 'get_current_budget') {
      // Call canonical assistant function
      functionResult = await getAssistantCurrentBudget(effectiveUserId, args.month);
    } else if (name === 'get_budget_health_analysis') {
      // Call canonical assistant function
      const analysis = await getAssistantBudgetHealth(effectiveUserId, args.month);

      functionResult = {
        healthStatus: analysis.healthStatus,
        healthLabel: analysis.healthStatus === 'on_track' ? 'On Track' :
          analysis.healthStatus === 'at_risk' ? 'At Risk' : 'Off Track',
        totalBudgeted: analysis.totalBudgeted,
        totalSpent: analysis.totalSpent,
        utilizationPercentage: Math.round(analysis.utilizationPercentage),
        firstCategoryOverBudget: analysis.firstCategoryOverBudget,
        overspentCategories: analysis.overspentCategories.map((cat: any) => ({
          name: cat.name,
          budgeted: cat.budgeted,
          spent: cat.spent,
          overspent: cat.overspent,
          overspentPercentage: Math.round((cat.overspent / cat.budgeted) * 100),
          firstOverspentDate: cat.firstOverspentDate,
          largeTransactions: cat.largeTransactions,
        })),
      };
    } else if (name === 'adjust_budget_allocations') {
      // Adjust budget allocations based on user's conversational request
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const result = await adjustBudgetAllocations(
        effectiveUserId,
        currentMonth,
        args.adjustments || []
      );

      functionResult = result;
    } else if (name === 'get_current_ui_budget') {
      functionResult = clientBudgetContext || {
        error: 'No client budget context available for this request.',
      };
    } else if (name === 'set_ui_budget_allocations') {
      const allocations = args.allocations || {};
      const categories = clientBudgetContext?.categories || [];
      const categoryMap = new Map(
        categories.map((cat) => [cat.name.toLowerCase(), cat.id])
      );

      const categoryAllocations: Array<{ categoryId: string; categoryName: string; amount: number }> = [];
      for (const [name, amount] of Object.entries(allocations)) {
        const id = categoryMap.get(String(name).toLowerCase());
        if (!id) continue;
        categoryAllocations.push({
          categoryId: id,
          categoryName: String(name),
          amount: Number(amount) || 0,
        });
      }

      const totalBudgeted = categoryAllocations.reduce((sum, item) => sum + item.amount, 0);
      functionResult = {
        success: true,
        categoryAllocations,
        totalBudgeted,
      };
    } else if (name === 'get_visual') {
      const type = args.type || 'category-breakdown';
      const timePeriodParams: { month?: string; months?: number } = {};
      if (args.month) {
        timePeriodParams.month = args.month;
      } else if (args.months) {
        timePeriodParams.months = args.months;
      }

      const params: any = {
        type,
        userId: effectiveUserId,
        generatedAt: new Date().toISOString(),
        ...timePeriodParams,
      };

      let chartConfig;
      let rawData;

      switch (type) {
        case 'spending-trend': {
          rawData = await getAssistantMonthlySpending(effectiveUserId, timePeriodParams);
          const chartData = transformMonthlySpendingToChartData(rawData);
          chartConfig = getLineChart(chartData, {
            title: 'Monthly Spending Trend',
            description: 'Your spending over time',
            currency: true,
          });
          break;
        }
        case 'category-breakdown': {
          console.log('[CHAT get_visual category-breakdown] Calling with:', { effectiveUserId, timePeriodParams });
          rawData = await getAssistantCategoryBreakdown(effectiveUserId, timePeriodParams);
          console.log('[CHAT get_visual category-breakdown] Result count:', rawData?.length);
          const foodResult = rawData?.find((c: any) => c.category?.toLowerCase().includes('food'));
          console.log('[CHAT get_visual category-breakdown] Food & Dining result:', foodResult);
          const chartData = transformCategoryBreakdownToChartData(rawData);
          chartConfig = getPieChart(chartData, {
            title: 'Spending by Category',
            description: 'Breakdown of expenses by category',
            currency: true,
          });
          break;
        }
        case 'income-vs-expenses': {
          rawData = await getAssistantIncomeVsExpenses(effectiveUserId, timePeriodParams);
          const chartData = transformIncomeVsExpensesToChartData(rawData);
          chartConfig = getBarChart(chartData, {
            title: 'Income vs Expenses',
            description: 'Comparison of income and expenses',
            currency: true,
          });
          break;
        }
        case 'cash-flow': {
          rawData = await getAssistantCashFlow(effectiveUserId, timePeriodParams);
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
          functionResult = { error: `Unknown chart type: ${type}` };
          return functionResult;
      }

      functionResult = {
        chartConfig,
        rawData,
        params,
      };
    } else {
      functionResult = { error: 'Unknown function' };
    }
  } catch (error: any) {
    functionResult = { error: error.message };
  }

  return functionResult;
}

