import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  getBudgetCategories, 
  getHistoricalSpendingBreakdown,
  getIncomeForMonth,
  findLastMonthWithIncome
} from '@/lib/budget-utils';

export const runtime = 'nodejs';

const GEMINI_MODEL = 'gemini-2.0-flash-exp';
const MAX_RETRY_ATTEMPTS = 3;

/**
 * POST /api/budget/auto-assign
 * Use AI to automatically assign budget amounts based on historical spending
 * Body: { userId, month, income, rent?, existingAllocations?, isReassign? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, month, income, rent, existingAllocations, isReassign, userSetBudgets } = body;

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

    // Initialize AI client
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    // Retry loop for budget allocation
    let aiResponse: { allocations: Record<string, number>; explanation: string } | null = null;
    let lastTotalAssigned = 0;
    let attempts = 0;
    let notZeroBased = false;

    while (attempts < MAX_RETRY_ATTEMPTS) {
      attempts++;
      
      // Build the prompt (with correction hint on retries)
      const prompt = buildPrompt(
        budgetIncome,
        categoryNames,
        historicalAverages,
        historicalData.totalMonths,
        attempts > 1 ? lastTotalAssigned : null,
        rent,
        existingAllocations,
        isReassign,
        userSetBudgets
      );

      try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        aiResponse = JSON.parse(responseText);
        
        // Calculate total assigned
        lastTotalAssigned = Object.values(aiResponse!.allocations).reduce(
          (sum, amount) => sum + (Number(amount) || 0), 
          0
        );

        // Validate: total must equal income for zero-based budgeting
        const tolerance = 0.50; // Allow 50 cent tolerance for floating point issues
        const difference = Math.abs(lastTotalAssigned - budgetIncome);
        
        if (difference <= tolerance) {
          // Success! Total equals income (zero-based)
          notZeroBased = false;
          break;
        } else {
          // Total doesn't equal income, will retry if attempts remain
          notZeroBased = true;
          console.log(`Attempt ${attempts}: AI allocated $${lastTotalAssigned.toFixed(2)} but income is $${budgetIncome.toFixed(2)} (diff: $${difference.toFixed(2)}). ${attempts < MAX_RETRY_ATTEMPTS ? 'Retrying...' : 'Max retries reached.'}`);
        }
      } catch (parseError) {
        console.error(`Attempt ${attempts}: Failed to parse AI response`);
        if (attempts >= MAX_RETRY_ATTEMPTS) {
          return NextResponse.json(
            { error: 'AI returned invalid response after multiple attempts' },
            { status: 500 }
          );
        }
      }
    }

    if (!aiResponse) {
      return NextResponse.json(
        { error: 'Failed to get valid AI response' },
        { status: 500 }
      );
    }

    // Map AI allocations to category IDs (for frontend to apply)
    const categoryAllocations: Array<{ categoryId: string; categoryName: string; amount: number }> = [];
    const assignedCategories: Array<{ name: string; amount: number }> = [];

    for (const category of categories) {
      const amount = aiResponse.allocations[category.name] || 0;
      const numAmount = Number(amount) || 0;
      categoryAllocations.push({
        categoryId: category.id!,
        categoryName: category.name,
        amount: numAmount,
      });
      if (numAmount > 0) {
        assignedCategories.push({ name: category.name, amount: numAmount });
      }
    }

    // NOTE: We do NOT save budgets here - the frontend should save when user clicks "Save Budget"
    // This allows users to review and modify the AI allocations before committing

    // Build the chat message
    const totalAssigned = assignedCategories.reduce((sum, c) => sum + c.amount, 0);
    const chatMessage = buildChatMessage(
      budgetIncome,
      totalAssigned,
      assignedCategories,
      aiResponse.explanation,
      historicalData.totalMonths,
      notZeroBased
    );

    return NextResponse.json({
      success: true,
      allocations: aiResponse.allocations,
      categoryAllocations, // Include category ID mapping for frontend
      explanation: aiResponse.explanation,
      chatMessage,
      totalAssigned,
      income: budgetIncome,
      notZeroBased, // Flag to indicate if we couldn't achieve zero-based budgeting
      attempts,
    });

  } catch (error: any) {
    console.error('Error in auto-assign:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to auto-assign budget' },
      { status: 500 }
    );
  }
}

function buildPrompt(
  budgetIncome: number,
  categoryNames: string[],
  historicalAverages: Record<string, number>,
  totalMonths: number,
  previousTotal: number | null,
  userProvidedRent?: number | null,
  existingAllocations?: Record<string, number> | null,
  isReassign?: boolean,
  userSetBudgets?: Record<string, number>
): string {
  const retryWarning = previousTotal !== null 
    ? `\n\n**⚠️ CORRECTION NEEDED:** Your previous attempt allocated $${previousTotal.toFixed(2)}, but the income is $${budgetIncome.toFixed(2)} (difference: $${Math.abs(previousTotal - budgetIncome).toFixed(2)}). You MUST adjust allocations to make the total EXACTLY EQUAL TO the income.\n`
    : '';

  const rentInstruction = userProvidedRent && userProvidedRent > 0
    ? `\n\n**🏠 USER-PROVIDED RENT/HOUSING:** The user has specified their rent/mortgage is **$${userProvidedRent.toFixed(2)}**. You MUST allocate exactly this amount to the "Rent / Housing" category. Do not change this amount.\n`
    : '';

  const userSetInstruction = userSetBudgets && Object.keys(userSetBudgets).length > 0
    ? `\n\n**👤 USER-SET BUDGETS:** The user has manually set budgets for specific categories. You MUST preserve these EXACT amounts:\n${Object.entries(userSetBudgets)
        .filter(([, amount]) => amount >= 0)
        .map(([cat, amount]) => `- ${cat}: $${amount.toFixed(2)} (DO NOT CHANGE)`)
        .join('\n')}\n\nOnly adjust the OTHER categories (not listed above) to make the total equal EXACTLY $${budgetIncome.toFixed(2)}.\n`
    : '';

  const reassignInstruction = isReassign && existingAllocations
    ? `\n\n**🔄 RE-ASSIGNMENT REQUEST:** The user has already assigned budgets but the total doesn't equal the income. Here are the current allocations:\n${Object.entries(existingAllocations)
        .filter(([, amount]) => amount > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([cat, amount]) => `- ${cat}: $${amount.toFixed(2)}`)
        .join('\n')}\n\nPlease RE-DISTRIBUTE the amounts so that the total equals EXACTLY $${budgetIncome.toFixed(2)} (zero-based budgeting). Try to maintain the user's priorities by keeping larger categories relatively larger, but adjust as needed to reach the target.\n`
    : '';

  const taskDescription = isReassign 
    ? `Re-distribute the existing budget allocations to make the total equal EXACTLY $${budgetIncome.toFixed(2)}`
    : `Allocate income across the budget categories to equal EXACTLY $${budgetIncome.toFixed(2)}`;

  return `You are a financial advisor helping create a zero-based budget.
${retryWarning}${rentInstruction}${userSetInstruction}${reassignInstruction}
**Available Income to Budget:** $${budgetIncome.toFixed(2)}

**Budget Categories:** ${categoryNames.join(', ')}

**Historical Spending (6-month averages by category):**
${Object.entries(historicalAverages)
  .sort(([, a], [, b]) => b - a)
  .map(([cat, avg]) => `- ${cat}: $${avg.toFixed(2)}/month`)
  .join('\n')}

**Months of Data Analyzed:** ${totalMonths}

**⚠️ CRITICAL CONSTRAINT - ZERO-BASED BUDGETING:**
The SUM of all allocations MUST EQUAL EXACTLY $${budgetIncome.toFixed(2)}. Every dollar must be assigned to a category. The total cannot be more or less than the income.

**Your Task:**
1. ${taskDescription}
2. ${userProvidedRent && userProvidedRent > 0 ? `Use EXACTLY $${userProvidedRent.toFixed(2)} for Rent / Housing as specified by the user` : 'Base allocations on historical spending patterns but optimize for financial health'}
3. ${userSetBudgets && Object.keys(userSetBudgets).length > 0 ? 'PRESERVE all user-set budget amounts EXACTLY as specified above' : 'Adjust all categories as needed'}
4. The total of all allocations MUST EQUAL EXACTLY $${budgetIncome.toFixed(2)} (zero-based budgeting)
5. For categories with no historical data and not set by user, assign reasonable amounts
6. ${isReassign ? 'Maintain the relative priorities from existing allocations while adjusting to hit the exact target' : 'Distribute remaining funds after preserving user-set amounts'}

**Response Format (JSON only, no markdown):**
{
  "allocations": {
    "Category Name": 123.45,
    ...
  },
  "explanation": "A 2-3 sentence explanation of the budgeting strategy used and any notable adjustments made${isReassign ? ' during re-assignment' : ' from historical spending'}."
}

Return ONLY valid JSON. Do not wrap in code blocks.`;
}

function buildChatMessage(
  income: number,
  totalAssigned: number,
  categories: Array<{ name: string; amount: number }>,
  explanation: string,
  monthsAnalyzed: number,
  notZeroBased: boolean
): string {
  const formatCurrency = (n: number) => `$${n.toFixed(2)}`;

  let message = `🤖 **AI Budget Assignment Complete**\n\n`;
  message += `I've analyzed your spending patterns over the last **${monthsAnalyzed} months** and created a zero-based budget for you.\n\n`;
  
  message += `**Income:** ${formatCurrency(income)}\n`;
  message += `**Total Budgeted:** ${formatCurrency(totalAssigned)}\n`;
  
  if (notZeroBased) {
    const difference = Math.abs(totalAssigned - income);
    message += `\n⚠️ *Note: The allocated amounts are off by ${formatCurrency(difference)}. You may want to manually adjust some categories to achieve perfect zero-based budgeting (Ready to Assign = $0).*\n`;
  }
  
  message += `\n**Budget Allocations:**\n`;
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
