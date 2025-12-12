import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  getBudgetCategories, 
  getHistoricalSpendingBreakdown,
  saveBudgets,
  getIncomeForMonth,
  findLastMonthWithIncome
} from '@/lib/budget-utils';

export const runtime = 'nodejs';

const GEMINI_MODEL = 'gemini-2.0-flash-exp';

/**
 * POST /api/budget/auto-assign
 * Use AI to automatically assign budget amounts based on historical spending
 * Body: { userId, month, income }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, month, income } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Valid month is required (format: YYYY-MM)' },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }

    // Get categories and historical spending
    const [categories, historicalData] = await Promise.all([
      getBudgetCategories(userId),
      getHistoricalSpendingBreakdown(userId, 6),
    ]);

    if (categories.length === 0) {
      return NextResponse.json(
        { error: 'No budget categories found' },
        { status: 400 }
      );
    }

    // Get the income to work with
    let budgetIncome = income;
    if (!budgetIncome || budgetIncome === 0) {
      // Try to get income from the requested month or last month with income
      budgetIncome = await getIncomeForMonth(userId, month);
      if (budgetIncome === 0) {
        const lastIncomeMonth = await findLastMonthWithIncome(userId);
        if (lastIncomeMonth) {
          budgetIncome = await getIncomeForMonth(userId, lastIncomeMonth);
        }
      }
    }

    if (budgetIncome === 0) {
      return NextResponse.json(
        { error: 'No income data found to base budget on' },
        { status: 400 }
      );
    }

    // Prepare data for the AI
    const categoryNames = categories.map(c => c.name);
    const historicalAverages = historicalData.categoryAverages;

    // Build the prompt
    const prompt = `You are a financial advisor helping create a zero-based budget. 

**Available Income to Budget:** $${budgetIncome.toFixed(2)}

**Budget Categories:** ${categoryNames.join(', ')}

**Historical Spending (6-month averages by category):**
${Object.entries(historicalAverages)
  .sort(([, a], [, b]) => b - a)
  .map(([cat, avg]) => `- ${cat}: $${avg.toFixed(2)}/month`)
  .join('\n')}

**Months of Data Analyzed:** ${historicalData.totalMonths}

**Your Task:**
1. Allocate the entire income ($${budgetIncome.toFixed(2)}) across the budget categories
2. Base allocations on historical spending patterns but optimize for financial health
3. The total of all allocations MUST equal exactly $${budgetIncome.toFixed(2)} (zero-based budgeting)
4. For categories with no historical data, assign reasonable amounts or $0
5. Consider that some historical overspending might need to be reduced

**Response Format (JSON only, no markdown):**
{
  "allocations": {
    "Category Name": 123.45,
    ...
  },
  "explanation": "A 2-3 sentence explanation of the budgeting strategy used and any notable adjustments made from historical spending."
}

Return ONLY valid JSON. Do not wrap in code blocks.`;

    // Call the AI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    let aiResponse: { allocations: Record<string, number>; explanation: string };
    try {
      aiResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText);
      return NextResponse.json(
        { error: 'AI returned invalid response' },
        { status: 500 }
      );
    }

    // Map AI allocations to category IDs
    const budgetRecords: Array<{ category_id: string; budgeted_amount: number }> = [];
    const assignedCategories: Array<{ name: string; amount: number }> = [];

    for (const category of categories) {
      const amount = aiResponse.allocations[category.name] || 0;
      budgetRecords.push({
        category_id: category.id!,
        budgeted_amount: Number(amount) || 0,
      });
      if (amount > 0) {
        assignedCategories.push({ name: category.name, amount });
      }
    }

    // Save the budgets
    await saveBudgets(userId, month, budgetRecords);

    // Build the chat message
    const totalAssigned = assignedCategories.reduce((sum, c) => sum + c.amount, 0);
    const chatMessage = buildChatMessage(
      budgetIncome,
      totalAssigned,
      assignedCategories,
      aiResponse.explanation,
      historicalData.totalMonths
    );

    return NextResponse.json({
      success: true,
      allocations: aiResponse.allocations,
      explanation: aiResponse.explanation,
      chatMessage,
      totalAssigned,
      income: budgetIncome,
    });

  } catch (error: any) {
    console.error('Error in auto-assign:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to auto-assign budget' },
      { status: 500 }
    );
  }
}

function buildChatMessage(
  income: number,
  totalAssigned: number,
  categories: Array<{ name: string; amount: number }>,
  explanation: string,
  monthsAnalyzed: number
): string {
  const formatCurrency = (n: number) => `$${n.toFixed(2)}`;

  let message = `🤖 **AI Budget Assignment Complete**\n\n`;
  message += `I've analyzed your spending patterns over the last **${monthsAnalyzed} months** and created a zero-based budget for you.\n\n`;
  
  message += `**Income:** ${formatCurrency(income)}\n`;
  message += `**Total Budgeted:** ${formatCurrency(totalAssigned)}\n\n`;

  message += `**Budget Allocations:**\n`;
  message += `| Category | Budgeted |\n`;
  message += `|----------|----------|\n`;
  
  // Sort by amount descending and show top categories
  const sortedCategories = [...categories].sort((a, b) => b.amount - a.amount);
  const topCategories = sortedCategories.slice(0, 10);
  
  for (const cat of topCategories) {
    message += `| ${cat.name} | ${formatCurrency(cat.amount)} |\n`;
  }
  
  if (sortedCategories.length > 10) {
    const otherCount = sortedCategories.length - 10;
    const otherTotal = sortedCategories.slice(10).reduce((sum, c) => sum + c.amount, 0);
    message += `| *(${otherCount} more categories)* | ${formatCurrency(otherTotal)} |\n`;
  }

  message += `\n**Strategy:** ${explanation}\n\n`;
  message += `Feel free to adjust any amounts that don't fit your current priorities. Just edit the values in the budget table and click Save.`;

  return message;
}

