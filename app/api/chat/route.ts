import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
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
  getCategoryBreakdown,
  getMonthlySpendingTrend,
  getAllMemories,
  upsertMemory
} from '@/lib/db-tools';
import { getBudgetData, analyzeBudgetHealth, adjustBudgetAllocations } from '@/lib/budget-utils';

export const runtime = 'nodejs';

const GEMINI_MODEL = 'gemini-3-pro-preview';

const BASE_SYSTEM_PROMPT = `You are Adphex, an AI financial assistant. You help users understand their financial data by querying structured databases.

You have access to four data sources:

1. **Documents Collection**: Stores metadata about uploaded bank/credit card statements
   - Fields: documentType, issuer, accountId, accountName, currency, statementDate, previousBalance, newBalance, creditLimit, minimumPayment, dueDate, fileName, uploadedAt
   
2. **Transactions Collection**: Stores individual transactions extracted from statements
   - Fields: date, merchant, amount, currency, category, description, accountName, transactionType (income/expense/transfer/other), documentId
   
3. **Account Snapshots**: Monthly balance snapshots for each account at month start/end
   - Fields: accountName, balance, currency, snapshotDate, snapshotType
   - Use this to track net worth over time
   
4. **Metadata Text**: A markdown document containing all metadata summaries from uploaded statements (may be noisy or duplicate structured data)

5. **User Memories**: Contextual information about the user's financial patterns, preferences, and notable facts (e.g., salary amounts, spending patterns, account relationships)

**Currency Handling:**
- Each transaction, document, and account snapshot includes a currency field (ISO 4217 code like USD, EUR, GBP, INR, etc.)
- ALWAYS use the appropriate currency symbol when displaying amounts in your responses
- Common currencies: $ (USD), € (EUR), £ (GBP), ¥ (JPY), ₹ (INR)
- When analyzing data with mixed currencies, mention the currency for each amount
- If the currency field is missing or null, default to USD ($)

**Transaction Types:**
- **income**: Salary, wages, business income, refunds, reimbursements
- **expense**: Purchases, bills, fees, charges
- **transfer**: Transfers between own accounts
- **other**: Uncategorized

**Tool Usage Guidelines:**
- ALWAYS prefer structured data (documents/transactions) when answering questions about balances, specific amounts, dates, merchants, etc.
- Use metadata text ONLY when structured queries don't provide enough context or for general summaries
- When filtering data, be flexible with date ranges and partial string matches
- If you need to calculate aggregates (totals, averages), retrieve the relevant transactions and compute them
- For TODO workflows, use resolve_todo to resolve or dismiss the TODO item.
- Only call resolve_todo once the user has provided everything required for the resolution.

**Tool Reasoning:**
- When calling any function, ALWAYS include a "reasoning" parameter (max 50 words)
- Explain WHY you're calling this function and WHAT you intend to do with the results
- Be specific about your plan (e.g., "Searching transactions from Jan-Dec 2024 to calculate total spending and identify top categories")

**Transaction Clarification - MANDATORY WORKFLOW:**
- When a system message includes "TRANSACTION_ID: [uuid]", a TODO item is active and MUST be resolved
- Do NOT search for the transaction - the ID is already provided in the context
- After the user provides their answer about the transaction type:
  1. Determine the transaction type from their response (income, expense, transfer, or other)
  2. **YOU MUST IMMEDIATELY call resolve_todo** with:
     - todo_type: "transaction_clarification"
     - todo_id: [the transaction UUID from the system message]
     - action: "resolve"
     - transaction_type: [determined from user's answer]
  3. Do NOT just acknowledge - the resolve_todo tool call is REQUIRED
- If the user's answer is unclear, ask ONE focused follow-up question, then call resolve_todo with their clarified answer
- CRITICAL: Every active transaction clarification MUST end with a resolve_todo call

**Available Tools:**

1. search_documents(filters): Query documents collection
   - Filters: documentType, issuer, accountName, startDate, endDate, minBalance, maxBalance
   
2. search_transactions(filters): Query transactions collection
   - Filters: accountName, transactionType, startDate, endDate, merchant, category, minAmount, maxAmount
   
3. get_all_metadata(): Retrieve the full metadata text blob

4. resolve_todo(todo_type, action, todo_id, ...): **PRIMARY TOOL** for resolving TODO items
   - **REQUIRED for transaction clarifications**: When a TRANSACTION_ID is in context and user answers, call this
   - **REQUIRED for account selections**: When user chooses an account for uploaded documents
   - Use action="resolve" with required fields (transaction_type for clarifications, account_id for selections)
   - Use action="dismiss" when user wants to skip/dismiss the item
   - You MUST call this tool - do not just acknowledge the user's answer

4b. categorize_transaction(transaction_id, transaction_type): Legacy tool for direct categorization
   - Only use if NOT in a TODO workflow (no active TRANSACTION_ID in system message)
   - For standalone categorization requests outside of TODO items

5. get_account_snapshots(accountName?, startDate?, endDate?): Get monthly balance snapshots

6. calculate_net_worth(date): Calculate net worth at a specific date across all accounts

7. render_chart(config): Render a visual chart/graph
   - Use when user asks for trends, breakdowns, comparisons, or wants to "see" data visually
   - Types: line (trends over time), bar (comparisons), pie (breakdowns), area (cumulative)
   - Always provide data as an array of {label, value, value2?}
   - Include descriptive title and insights in description field

8. get_current_budget(): Get current month's budget with all categories and spending
   - Returns budgeted amounts, spent amounts, and available for each category
   - Use when user asks about their budget or wants to see budget status

9. get_budget_health_analysis(): Analyze budget health and identify issues
   - Returns detailed analysis including overspent categories, large transactions, which category broke first
   - Use when user asks about budget problems, why they're over budget, or how to get back on track
   - Provides data needed to explain what caused budget issues and recommend adjustments

10. adjust_budget_allocations(adjustments): Modify budget allocations based on user requests
   - Use when user wants to move funds between categories, increase/decrease budgets, or reallocate
   - Saves changes immediately to database and updates the budget UI automatically
   - Validates that total doesn't exceed income before saving

**When to Use Charts:**
- User asks about "trends", "over time", "changes"
- User wants to "see", "visualize", "show me a graph"
- Comparing multiple values (e.g., income vs expenses)
- Category breakdowns or distributions
- Any question that would benefit from visual representation

**Financial Health Analysis:**
When analyzing financial data, automatically provide:
- Income vs. Expenses comparison
- Savings rate (if income data available)
- Income-to-expense ratio
- Month-over-month balance changes
- Warning if expenses exceed income
- Net worth trends when available

**Budget Analysis:**
When user asks about budget health or budget problems:
1. Use get_budget_health_analysis() to get detailed analysis
2. Explain the root causes:
   - Identify which categories are overspent and by how much
   - Determine if overspending was caused by a few large transactions or many small ones
   - Point out the first category that went over budget (chronologically)
   - Highlight any unusual spending patterns
3. Provide actionable recommendations:
   - Suggest specific spending adjustments to get back on track
   - Recommend which categories to focus on first (highest overspend)
   - If large transactions caused the issue, mention reviewing those specific purchases
   - If many small transactions, suggest tracking daily spending more closely
4. Be empathetic and constructive - focus on solutions, not blame

**Budget Adjustments:**
When user requests budget changes (e.g., "Move $100 from Entertainment to Groceries"):
1. First use get_current_budget() to see current allocations
2. Understand exactly what the user wants (be specific about amounts and categories)
3. Calculate new allocations ensuring total doesn't exceed income
4. Use adjust_budget_allocations() to apply the changes
5. Confirm what was changed and show the new "Ready to Assign" amount
6. If total would exceed income, explain the constraint and suggest alternatives
7. The budget UI will automatically update when you make changes

**Response Format Guidelines:**

ALWAYS provide detailed, data-rich responses with supporting evidence:

1. **Include Data Tables**: When discussing transactions, spending, or any numerical data, ALWAYS present the underlying data in a markdown table format.

2. **Show Your Work**: Don't just give totals - show the breakdown:
   - List individual transactions in a table
   - Show subtotals by category
   - Include dates, merchants, amounts, and categories
   - Separate income vs. expenses

3. **Use Markdown Formatting**:
   - Tables for transaction lists
   - Bold for totals and key figures
   - Bullet points for summaries
   - Headers to organize sections

4. **Example Response Structure**:
   """
   You spent **$1,234.56** (USD) from September 1-12, 2025.
   
   Here's the breakdown by category:
   
   ### Transactions
   
   | Date | Merchant | Category | Amount | Type |
   |------|----------|----------|--------|------|
   | 2025-09-12 | Starbucks | Food | $15.50 | expense |
   | 2025-09-11 | Amazon | Shopping | $89.99 | expense |
   | 2025-09-10 | Payroll | Salary | $5,000.00 | income |
   
   ### Summary by Category
   - **Food & Dining**: $234.50 (4.7%)
   - **Shopping**: $567.89 (11.4%)
   - **Transportation**: $432.17 (8.7%)
   
   **Total Expenses**: $1,234.56
   **Total Income**: $5,000.00
   **Net Savings**: $3,765.44 (75.3% savings rate)
   
   Note: Use the correct currency symbol based on the data's currency field.
   """

5. **Always Be Comprehensive**: Even if the user asks a simple question, provide context and details. Users want to see the data, not just summaries.

6. **Handle Empty Results Gracefully**: If no data is found, explain what you searched for and suggest alternatives.

Provide clear, detailed, data-rich answers with tables and breakdowns based on the data retrieved.`;


interface Message {
  role: 'user' | 'model';
  parts: { text: string }[];
}

// Helper function to execute a tool call
async function executeToolCall(name: string, args: any, effectiveUserId: string, requestUrl?: string) {
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
      // Unified TODO resolver (resolve or dismiss)
      let fullApiUrl: string;

      if (requestUrl) {
        const url = new URL(requestUrl);
        fullApiUrl = `${url.protocol}//${url.host}/api/todos/resolve`;
      } else {
        const baseUrl =
          process.env.NEXT_PUBLIC_SITE_URL ||
          process.env.NEXT_PUBLIC_BASE_URL ||
          'http://localhost:3000';
        fullApiUrl = `${baseUrl}/api/todos/resolve`;
      }

      try {
        const response = await fetch(fullApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: effectiveUserId,
            todoType: args.todo_type,
            todoId: args.todo_id,
            action: args.action,
            transaction_type: args.transaction_type,
            document_ids: args.document_ids,
            account_id: args.account_id,
            new_account: args.new_account,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[chat API] resolve_todo failed:', response.status, errorText);
          functionResult = {
            error: `API error: ${response.status} ${response.statusText}`,
            details: errorText,
          };
        } else {
          functionResult = await response.json();
        }
      } catch (fetchError: any) {
        console.error('[chat API] resolve_todo fetch error:', fetchError.message);
        functionResult = {
          error: `Fetch failed: ${fetchError.message}`,
          error_type: fetchError.name,
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
          message: 'Chart configuration is valid and will be rendered'
        };
      } else {
        functionResult = { 
          success: false, 
          error: 'Invalid chart configuration'
        };
      }
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
      functionResult = await getCategoryBreakdown(
        effectiveUserId,
        args.months || 6,
        args.specificMonth
      );
    } else if (name === 'get_monthly_spending_trend') {
      functionResult = await getMonthlySpendingTrend(
        effectiveUserId,
        args.months || 6,
        args.specificMonth
      );
    } else if (name === 'get_current_budget') {
      // Get current month budget data
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const budgetData = await getBudgetData(effectiveUserId, currentMonth);
      
      // Transform to a format that's easy for the LLM to understand
      const categories = budgetData.categories.map(cat => {
        const budget = budgetData.budgets.find(b => b.category_id === cat.id);
        const budgeted = budget?.budgeted_amount || 0;
        const spent = budgetData.spending[cat.name] || 0;
        
        return {
          name: cat.name,
          budgeted,
          spent,
          available: budgeted - spent,
          isOverBudget: spent > budgeted,
        };
      }).filter(cat => cat.budgeted > 0 || cat.spent > 0);
      
      const totalBudgeted = categories.reduce((sum, cat) => sum + cat.budgeted, 0);
      const totalSpent = categories.reduce((sum, cat) => sum + cat.spent, 0);
      
      functionResult = {
        month: currentMonth,
        income: budgetData.income,
        totalBudgeted,
        totalSpent,
        readyToAssign: budgetData.income - totalBudgeted,
        categories,
      };
    } else if (name === 'get_budget_health_analysis') {
      // Get detailed budget health analysis
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const analysis = await analyzeBudgetHealth(effectiveUserId, currentMonth);
      
      functionResult = {
        healthStatus: analysis.healthStatus,
        healthLabel: analysis.healthStatus === 'on_track' ? 'On Track' : 
                     analysis.healthStatus === 'at_risk' ? 'At Risk' : 'Off Track',
        totalBudgeted: analysis.totalBudgeted,
        totalSpent: analysis.totalSpent,
        utilizationPercentage: Math.round(analysis.utilizationPercentage),
        firstCategoryOverBudget: analysis.firstCategoryOverBudget,
        overspentCategories: analysis.overspentCategories.map(cat => ({
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
    } else {
      functionResult = { error: 'Unknown function' };
    }
  } catch (error: any) {
    functionResult = { error: error.message };
  }

  return functionResult;
}

/**
 * Extract memories from chat conversation and save them
 * Uses LLM to identify memory-worthy information and detect corrections
 */
async function extractAndSaveMemories(
  userId: string,
  messages: Array<{ role: string; content: string }>,
  assistantResponse: string
): Promise<void> {
  if (!process.env.GEMINI_API_KEY) {
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    // Get recent conversation context (last 5 messages)
    const recentMessages = messages.slice(-5);
    const conversationText = recentMessages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    // Get existing memories to help detect conflicts
    const existingMemories = await getAllMemories(userId);

    const prompt = `Analyze this conversation and extract any notable memories about the user's financial situation. Also detect if the user is correcting or updating existing information.

Conversation:
${conversationText}

Assistant's latest response:
${assistantResponse}

${existingMemories ? `Existing memories:\n${existingMemories}\n` : ''}

Extract memories that are:
1. Notable facts (e.g., "User receives monthly salary of $5000", "User had many guests in June-July")
2. Corrections/updates (e.g., "User's salary increased to $6000" - this should UPDATE existing salary memory)
3. Pattern changes (e.g., "User no longer transfers money between accounts")

For corrections: If user says something like "my salary increased to $5000" or "salary is now $5000", this should UPDATE the existing salary memory, not create a new one.

Return a JSON object:
{
  "memories": [
    {
      "content": "Memory text in bullet point format (e.g., '- User receives monthly salary of $5000 from Company ABC')",
      "isCorrection": true/false,
      "conflictsWith": "existing memory content if this is a correction"
    }
  ]
}

If no memories found, return {"memories": []}.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);

    if (parsed.memories && Array.isArray(parsed.memories)) {
      for (const memory of parsed.memories) {
        if (memory.content && memory.content.trim()) {
          // Use upsertMemory which handles conflicts automatically
          await upsertMemory(userId, memory.content);
          console.log(`[Memory] Extracted from chat: ${memory.content}`);
        }
      }
    }
  } catch (error: any) {
    // Don't throw - memory extraction is non-critical
    console.error('[chat] Error extracting memories:', error.message);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    const { messages, userId } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    const effectiveUserId = userId || 'default-user';

    // Retrieve user memories to inject into system prompt
    let memoriesText = '';
    try {
      memoriesText = await getAllMemories(effectiveUserId);
    } catch (error: any) {
      console.error('[chat] Error retrieving memories:', error.message);
    }

    // Build system prompt with memories
    const SYSTEM_PROMPT = memoriesText 
      ? `${BASE_SYSTEM_PROMPT}

**User Memories:**
${memoriesText}

When answering questions, use these memories to provide context-aware responses. If the user provides corrections or updates to information in memories, acknowledge the update.`
      : BASE_SYSTEM_PROMPT;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Function declarations for Gemini
    const tools = [
      {
        functionDeclarations: [
          {
            name: 'search_documents',
            description: 'Search uploaded financial documents (bank/credit card statements) with optional filters',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                reasoning: {
                  type: SchemaType.STRING,
                  description: 'Explain why you are calling this function and what you plan to do with the results (max 50 words)',
                },
                documentType: {
                  type: SchemaType.STRING,
                  description: 'Filter by document type: bank_statement, credit_card_statement, or unknown',
                },
                issuer: {
                  type: SchemaType.STRING,
                  description: 'Filter by issuer name (partial match, case-insensitive)',
                },
                accountName: {
                  type: SchemaType.STRING,
                  description: 'Filter by account name/nickname (partial match, case-insensitive). Use this to query transactions from a specific account across multiple statement periods.',
                },
                startDate: {
                  type: SchemaType.STRING,
                  description: 'Filter statements on or after this date (YYYY-MM-DD)',
                },
                endDate: {
                  type: SchemaType.STRING,
                  description: 'Filter statements on or before this date (YYYY-MM-DD)',
                },
                minBalance: {
                  type: SchemaType.NUMBER,
                  description: 'Filter by minimum new balance',
                },
                maxBalance: {
                  type: SchemaType.NUMBER,
                  description: 'Filter by maximum new balance',
                },
              },
              required: ['reasoning'],
            },
          },
          {
            name: 'search_transactions',
            description: 'Search individual transactions from all uploaded statements with optional filters',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                reasoning: {
                  type: SchemaType.STRING,
                  description: 'Explain why you are calling this function and what you plan to do with the results (max 50 words)',
                },
                accountName: {
                  type: SchemaType.STRING,
                  description: 'Filter by account name/nickname (partial match, case-insensitive). IMPORTANT: Use this to query transactions from a specific account across multiple statement periods.',
                },
                transactionType: {
                  type: SchemaType.STRING,
                  description: 'Filter by transaction type: income, expense, transfer, or other',
                },
                startDate: {
                  type: SchemaType.STRING,
                  description: 'Filter transactions on or after this date (YYYY-MM-DD)',
                },
                endDate: {
                  type: SchemaType.STRING,
                  description: 'Filter transactions on or before this date (YYYY-MM-DD)',
                },
                merchant: {
                  type: SchemaType.STRING,
                  description: 'Filter by merchant name (partial match, case-insensitive)',
                },
                category: {
                  type: SchemaType.STRING,
                  description: 'Filter by category (partial match, case-insensitive)',
                },
                minAmount: {
                  type: SchemaType.NUMBER,
                  description: 'Filter by minimum transaction amount',
                },
                maxAmount: {
                  type: SchemaType.NUMBER,
                  description: 'Filter by maximum transaction amount',
                },
              },
              required: ['reasoning'],
            },
          },
          {
            name: 'get_all_metadata',
            description: 'Retrieve the full metadata text blob containing markdown summaries from all uploaded statements. Use sparingly.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                reasoning: {
                  type: SchemaType.STRING,
                  description: 'Explain why you are calling this function and what you plan to do with the results (max 50 words)',
                },
              },
              required: ['reasoning'],
            },
          },
          {
            name: 'categorize_transaction',
            description: 'Categorize a transaction as income, expense, transfer, or other. Use when user clarifies the type of a transaction.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                reasoning: {
                  type: SchemaType.STRING,
                  description: 'Explain why you are calling this function and what you plan to do with the results (max 50 words)',
                },
                transaction_id: {
                  type: SchemaType.STRING,
                  description: 'The ID of the transaction to categorize',
                },
                transaction_type: {
                  type: SchemaType.STRING,
                  description: 'The transaction type: income, expense, transfer, or other',
                },
              },
              required: ['reasoning', 'transaction_id', 'transaction_type'],
            },
          },
          {
            name: 'resolve_todo',
            description:
              'REQUIRED: Resolve or dismiss a TODO item. For transaction clarifications, you MUST call this after the user answers. For account selections, call after user chooses an account. Use action="resolve" with required fields, or action="dismiss" to skip.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                reasoning: {
                  type: SchemaType.STRING,
                  description: 'Explain why you are calling this function (max 50 words)',
                },
                todo_type: {
                  type: SchemaType.STRING,
                  description: 'transaction_clarification or account_selection',
                },
                action: {
                  type: SchemaType.STRING,
                  description: 'resolve or dismiss',
                },
                todo_id: {
                  type: SchemaType.STRING,
                  description:
                    'For transaction_clarification: transaction UUID. For account_selection: todo id like "account-selection-{documentId}" or document UUID.',
                },
                transaction_type: {
                  type: SchemaType.STRING,
                  description: 'Required when resolving transaction_clarification: income, expense, transfer, or other',
                },
                document_ids: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING },
                  description: 'Optional for account_selection: list of document UUIDs to assign/dismiss',
                },
                account_id: {
                  type: SchemaType.STRING,
                  description: 'Required when resolving account_selection with an existing account',
                },
                new_account: {
                  type: SchemaType.OBJECT,
                  description: 'Required when resolving account_selection by creating a new account',
                  properties: {
                    display_name: { type: SchemaType.STRING },
                    last4: { type: SchemaType.STRING },
                    account_type: { type: SchemaType.STRING },
                    issuer: { type: SchemaType.STRING },
                  },
                },
              },
              required: ['reasoning', 'todo_type', 'action', 'todo_id'],
            },
          },
          {
            name: 'get_account_snapshots',
            description: 'Get monthly balance snapshots for accounts. Shows balances at month start and month end.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                reasoning: {
                  type: SchemaType.STRING,
                  description: 'Explain why you are calling this function and what you plan to do with the results (max 50 words)',
                },
                accountName: {
                  type: SchemaType.STRING,
                  description: 'Optional: Filter by account name',
                },
                startDate: {
                  type: SchemaType.STRING,
                  description: 'Optional: Start date (YYYY-MM-DD)',
                },
                endDate: {
                  type: SchemaType.STRING,
                  description: 'Optional: End date (YYYY-MM-DD)',
                },
              },
              required: ['reasoning'],
            },
          },
          {
            name: 'calculate_net_worth',
            description: 'Calculate total net worth at a specific date across all accounts with uploaded data.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                reasoning: {
                  type: SchemaType.STRING,
                  description: 'Explain why you are calling this function and what you plan to do with the results (max 50 words)',
                },
                date: {
                  type: SchemaType.STRING,
                  description: 'The date to calculate net worth for (YYYY-MM-DD)',
                },
              },
              required: ['reasoning', 'date'],
            },
          },
          {
            name: 'render_chart',
            description: 'Render a chart or graph to visualize financial data. Use this when the user asks for trends, breakdowns, comparisons, or visual representations. Choose chart type based on data: line for trends over time, pie for category breakdowns, bar for comparisons.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                reasoning: {
                  type: SchemaType.STRING,
                  description: 'Explain why you are calling this function and what you plan to do with the results (max 50 words)',
                },
                type: {
                  type: SchemaType.STRING,
                  description: 'Chart type: line (for trends over time), bar (for comparisons), pie (for breakdowns/percentages), area (for cumulative trends)',
                },
                title: {
                  type: SchemaType.STRING,
                  description: 'Chart title (e.g., "Monthly Spending Trend")',
                },
                description: {
                  type: SchemaType.STRING,
                  description: 'Brief description or insight about the chart (e.g., "Your spending has been relatively stable")',
                },
                data: {
                  type: SchemaType.ARRAY,
                  description: 'Array of data points for the chart',
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      label: {
                        type: SchemaType.STRING,
                        description: 'Label for this data point (e.g., "January 2025" or "Food & Dining")',
                      },
                      value: {
                        type: SchemaType.NUMBER,
                        description: 'Primary value (e.g., 1234.56)',
                      },
                      value2: {
                        type: SchemaType.NUMBER,
                        description: 'Optional secondary value for multi-series charts (e.g., income vs expenses)',
                      },
                    },
                    required: ['label', 'value'],
                  },
                },
                xAxisLabel: {
                  type: SchemaType.STRING,
                  description: 'Optional X-axis label (e.g., "Month")',
                },
                yAxisLabel: {
                  type: SchemaType.STRING,
                  description: 'Optional Y-axis label (e.g., "Amount")',
                },
                currency: {
                  type: SchemaType.BOOLEAN,
                  description: 'Whether to format values as currency (true for monetary amounts)',
                },
              },
              required: ['reasoning', 'type', 'title', 'description', 'data'],
            },
          },
          {
            name: 'get_distinct_categories',
            description: 'Get a list of all distinct transaction categories with counts. Useful for discovering what categories exist.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                reasoning: {
                  type: SchemaType.STRING,
                  description: 'Explain why you are calling this function and what you plan to do with the results (max 50 words)',
                },
                startDate: {
                  type: SchemaType.STRING,
                  description: 'Optional: Filter categories from transactions on or after this date (YYYY-MM-DD)',
                },
                endDate: {
                  type: SchemaType.STRING,
                  description: 'Optional: Filter categories from transactions on or before this date (YYYY-MM-DD)',
                },
                transactionType: {
                  type: SchemaType.STRING,
                  description: 'Optional: Filter by transaction type (income, expense, transfer, other)',
                },
              },
              required: ['reasoning'],
            },
          },
          {
            name: 'get_distinct_merchants',
            description: 'Get a list of all distinct merchants with transaction counts. Useful for discovering what merchants exist.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                reasoning: {
                  type: SchemaType.STRING,
                  description: 'Explain why you are calling this function and what you plan to do with the results (max 50 words)',
                },
                startDate: {
                  type: SchemaType.STRING,
                  description: 'Optional: Filter merchants from transactions on or after this date (YYYY-MM-DD)',
                },
                endDate: {
                  type: SchemaType.STRING,
                  description: 'Optional: Filter merchants from transactions on or before this date (YYYY-MM-DD)',
                },
                category: {
                  type: SchemaType.STRING,
                  description: 'Optional: Filter by category',
                },
              },
              required: ['reasoning'],
            },
          },
          {
            name: 'get_distinct_account_names',
            description: 'Get a list of all distinct account names. Useful for discovering what accounts the user has.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                reasoning: {
                  type: SchemaType.STRING,
                  description: 'Explain why you are calling this function and what you plan to do with the results (max 50 words)',
                },
              },
              required: ['reasoning'],
            },
          },
          {
            name: 'bulk_update_transactions_by_merchant',
            description: 'Bulk update all transactions from a specific merchant. Useful for recategorizing all transactions from a merchant at once.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                reasoning: {
                  type: SchemaType.STRING,
                  description: 'Explain why you are calling this function and what you plan to do with the results (max 50 words)',
                },
                merchant: {
                  type: SchemaType.STRING,
                  description: 'The merchant name to match (partial match, case-insensitive)',
                },
                category: {
                  type: SchemaType.STRING,
                  description: 'Optional: New category to set',
                },
                transactionType: {
                  type: SchemaType.STRING,
                  description: 'Optional: New transaction type to set (income, expense, transfer, other)',
                },
                spendClassification: {
                  type: SchemaType.STRING,
                  description: 'Optional: New spend classification (essential, discretionary)',
                },
                startDate: {
                  type: SchemaType.STRING,
                  description: 'Optional: Only update transactions on or after this date (YYYY-MM-DD)',
                },
                endDate: {
                  type: SchemaType.STRING,
                  description: 'Optional: Only update transactions on or before this date (YYYY-MM-DD)',
                },
              },
              required: ['reasoning', 'merchant'],
            },
          },
          {
            name: 'bulk_update_transactions_by_category',
            description: 'Bulk update all transactions in a specific category to a new category. Useful for renaming or merging categories.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                reasoning: {
                  type: SchemaType.STRING,
                  description: 'Explain why you are calling this function and what you plan to do with the results (max 50 words)',
                },
                oldCategory: {
                  type: SchemaType.STRING,
                  description: 'The current category to match (partial match, case-insensitive)',
                },
                newCategory: {
                  type: SchemaType.STRING,
                  description: 'The new category name to set',
                },
                startDate: {
                  type: SchemaType.STRING,
                  description: 'Optional: Only update transactions on or after this date (YYYY-MM-DD)',
                },
                endDate: {
                  type: SchemaType.STRING,
                  description: 'Optional: Only update transactions on or before this date (YYYY-MM-DD)',
                },
              },
              required: ['reasoning', 'oldCategory', 'newCategory'],
            },
          },
          {
            name: 'bulk_update_transactions_by_filters',
            description: 'Bulk update transactions matching multiple filter criteria. Most flexible option for complex bulk updates.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                reasoning: {
                  type: SchemaType.STRING,
                  description: 'Explain why you are calling this function and what you plan to do with the results (max 50 words)',
                },
                filters: {
                  type: SchemaType.OBJECT,
                  description: 'Filter criteria to match transactions',
                  properties: {
                    merchant: {
                      type: SchemaType.STRING,
                      description: 'Filter by merchant name (partial match)',
                    },
                    category: {
                      type: SchemaType.STRING,
                      description: 'Filter by category (partial match)',
                    },
                    transactionType: {
                      type: SchemaType.STRING,
                      description: 'Filter by transaction type',
                    },
                    startDate: {
                      type: SchemaType.STRING,
                      description: 'Filter transactions on or after this date (YYYY-MM-DD)',
                    },
                    endDate: {
                      type: SchemaType.STRING,
                      description: 'Filter transactions on or before this date (YYYY-MM-DD)',
                    },
                    minAmount: {
                      type: SchemaType.NUMBER,
                      description: 'Filter by minimum amount',
                    },
                    maxAmount: {
                      type: SchemaType.NUMBER,
                      description: 'Filter by maximum amount',
                    },
                    accountName: {
                      type: SchemaType.STRING,
                      description: 'Filter by account name (partial match)',
                    },
                  },
                },
                updates: {
                  type: SchemaType.OBJECT,
                  description: 'Fields to update on matching transactions',
                  properties: {
                    category: {
                      type: SchemaType.STRING,
                      description: 'New category to set',
                    },
                    transactionType: {
                      type: SchemaType.STRING,
                      description: 'New transaction type to set',
                    },
                    spendClassification: {
                      type: SchemaType.STRING,
                      description: 'New spend classification to set',
                    },
                  },
                },
              },
              required: ['reasoning', 'filters', 'updates'],
            },
          },
          {
            name: 'get_category_breakdown',
            description: 'Get spending breakdown by category with totals, counts, and percentages. More detailed than get_distinct_categories.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                reasoning: {
                  type: SchemaType.STRING,
                  description: 'Explain why you are calling this function and what you plan to do with the results (max 50 words)',
                },
                months: {
                  type: SchemaType.NUMBER,
                  description: 'Number of months to analyze (default: 6)',
                },
                specificMonth: {
                  type: SchemaType.STRING,
                  description: 'Optional: Analyze a specific month (YYYY-MM format)',
                },
              },
              required: ['reasoning'],
            },
          },
          {
            name: 'get_monthly_spending_trend',
            description: 'Get monthly spending totals over time. Useful for trend analysis.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                reasoning: {
                  type: SchemaType.STRING,
                  description: 'Explain why you are calling this function and what you plan to do with the results (max 50 words)',
                },
                months: {
                  type: SchemaType.NUMBER,
                  description: 'Number of months to analyze (default: 6)',
                },
                specificMonth: {
                  type: SchemaType.STRING,
                  description: 'Optional: Get spending for a specific month (YYYY-MM format)',
                },
              },
              required: ['reasoning'],
            },
          },
          {
            name: 'get_current_budget',
            description: 'Get the user\'s current month budget with all categories, budgeted amounts, and spent amounts. Use this when the user asks about their budget status or wants to see how they\'re tracking against their budget.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                reasoning: {
                  type: SchemaType.STRING,
                  description: 'Explain why you are calling this function and what you plan to do with the results (max 50 words)',
                },
              },
              required: ['reasoning'],
            },
          },
          {
            name: 'get_budget_health_analysis',
            description: 'Analyze budget health and identify problem areas. Returns detailed analysis including overspent categories, large transactions that contributed to overspending, which category went over budget first, and health status. Use this when user asks about budget problems or wants to understand why their budget is off track.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                reasoning: {
                  type: SchemaType.STRING,
                  description: 'Explain why you are calling this function and what you plan to do with the results (max 50 words)',
                },
              },
              required: ['reasoning'],
            },
          },
          {
            name: 'adjust_budget_allocations',
            description: 'Adjust budget allocations for one or more categories based on user\'s request. Use this when user wants to move funds between categories, increase/decrease specific budgets, or reallocate their budget. The adjustments will be saved immediately to the database.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                reasoning: {
                  type: SchemaType.STRING,
                  description: 'Explain why you are calling this function and what you plan to do with the results (max 50 words)',
                },
                adjustments: {
                  type: SchemaType.ARRAY,
                  description: 'Array of budget adjustments to make',
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      categoryName: {
                        type: SchemaType.STRING,
                        description: 'The exact name of the category to adjust (e.g., "Food & Dining", "Transportation")',
                      },
                      newAmount: {
                        type: SchemaType.NUMBER,
                        description: 'The new budget amount for this category',
                      },
                    },
                    required: ['categoryName', 'newAmount'],
                  },
                },
              },
              required: ['reasoning', 'adjustments'],
            },
          },
        ],
      },
    ];

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: SYSTEM_PROMPT,
      tools: tools as any,
      generationConfig: {
        temperature: 0.7,
      },
    });

    // Convert messages to Gemini format
    const history: Message[] = messages
      .slice(0, -1)
      .filter((msg: any, index: number) => {
        if (index === 0 && msg.role === 'assistant') {
          return false;
        }
        return true;
      })
      .map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

    const chat = model.startChat({ history });

    const lastMessage = messages[messages.length - 1];

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Helper to send event
          const sendEvent = (type: string, data: any) => {
            const event = { type, data };
            controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
          };

          let result = await chat.sendMessage(lastMessage.content);
          let functionCallCount = 0;
          const maxFunctionCalls = 10;
          let chartConfig = null;

          // Handle function calls in a loop
          while (result.response.functionCalls && result.response.functionCalls() && functionCallCount < maxFunctionCalls) {
            functionCallCount++;
            const functionCalls = result.response.functionCalls()!;
            const functionResponses = [];

            for (const call of functionCalls) {
              const { name, args } = call;
              
              // Send tool call event
              sendEvent('tool_call', { 
                name, 
                args,
                reasoning: (args as any)?.reasoning 
              });

              const startTime = Date.now();
              const functionResult = await executeToolCall(name, args, effectiveUserId, request.url);
              const duration = Date.now() - startTime;

              // Send tool result event
              sendEvent('tool_result', { 
                name, 
                result: functionResult,
                duration: `${duration}ms`,
                resultCount: Array.isArray(functionResult) ? functionResult.length : null,
              });

              // Check for chart config
              if (name === 'render_chart' && functionResult?.success && functionResult?.chartConfig) {
                chartConfig = functionResult.chartConfig;
                sendEvent('chart_config', { config: chartConfig });
              }

              functionResponses.push({
                functionResponse: {
                  name: name,
                  response: {
                    name: name,
                    content: functionResult,
                  },
                },
              });
            }

            // Send function responses back to model
            result = await chat.sendMessage(functionResponses);
          }

          // Stream the final text response
          const responseText = result.response.text();
          
          // Split text into chunks and stream them
          const CHUNK_SIZE = 50; // Characters per chunk
          for (let i = 0; i < responseText.length; i += CHUNK_SIZE) {
            const chunk = responseText.slice(i, i + CHUNK_SIZE);
            sendEvent('text_delta', { text: chunk });
            // Small delay to simulate streaming
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          // Send done event
          sendEvent('done', { 
            totalToolCalls: functionCallCount,
            chartConfig,
          });

          // Extract memories from the conversation (async, don't block response)
          extractAndSaveMemories(effectiveUserId, messages, responseText).catch((error: any) => {
            console.error('[chat] Error extracting memories:', error.message);
          });

          controller.close();
        } catch (error: any) {
          console.error('Error in streaming chat:', error);
          const errorEvent = { type: 'error', data: { message: error.message } };
          controller.enqueue(encoder.encode(JSON.stringify(errorEvent) + '\n'));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error: any) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
