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
  getMonthlySpendingTrend
} from '@/lib/db-tools';

export const runtime = 'nodejs';

const GEMINI_MODEL = 'gemini-3-pro-preview';

const SYSTEM_PROMPT = `You are Adphex, an AI financial assistant. You help users understand their financial data by querying structured databases.

You have access to four data sources:

1. **Documents Collection**: Stores metadata about uploaded bank/credit card statements
   - Fields: documentType, issuer, accountId, accountName, statementDate, previousBalance, newBalance, creditLimit, minimumPayment, dueDate, fileName, uploadedAt
   
2. **Transactions Collection**: Stores individual transactions extracted from statements
   - Fields: date, merchant, amount, category, description, accountName, transactionType (income/expense/transfer/other), documentId
   
3. **Account Snapshots**: Monthly balance snapshots for each account at month start/end
   - Use this to track net worth over time
   
4. **Metadata Text**: A markdown document containing all metadata summaries from uploaded statements (may be noisy or duplicate structured data)

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
- Use categorize_transaction tool when user clarifies a transaction type

**Tool Reasoning:**
- When calling any function, ALWAYS include a "reasoning" parameter (max 50 words)
- Explain WHY you're calling this function and WHAT you intend to do with the results
- Be specific about your plan (e.g., "Searching transactions from Jan-Dec 2024 to calculate total spending and identify top categories")

**Transaction Clarification Optimization:**
- When a system message includes "TRANSACTION_ID: [uuid]", use that ID directly with categorize_transaction
- Do NOT search for the transaction - the ID is already provided in the context
- This applies to todo/clarification workflows where the transaction is already identified
- Simply extract the transaction_id from the message and call categorize_transaction immediately

**Available Tools:**

1. search_documents(filters): Query documents collection
   - Filters: documentType, issuer, accountName, startDate, endDate, minBalance, maxBalance
   
2. search_transactions(filters): Query transactions collection
   - Filters: accountName, transactionType, startDate, endDate, merchant, category, minAmount, maxAmount
   
3. get_all_metadata(): Retrieve the full metadata text blob

4. categorize_transaction(transaction_id, transaction_type): Categorize a transaction as income, expense, transfer, or other
   - Use when user clarifies the type of a transaction

5. get_account_snapshots(accountName?, startDate?, endDate?): Get monthly balance snapshots

6. calculate_net_worth(date): Calculate net worth at a specific date across all accounts

7. render_chart(config): Render a visual chart/graph
   - Use when user asks for trends, breakdowns, comparisons, or wants to "see" data visually
   - Types: line (trends over time), bar (comparisons), pie (breakdowns), area (cumulative)
   - Always provide data as an array of {label, value, value2?}
   - Include descriptive title and insights in description field

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
   You spent **$1,234.56** from September 1-12, 2025.
   
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
   """

5. **Always Be Comprehensive**: Even if the user asks a simple question, provide context and details. Users want to see the data, not just summaries.

6. **Handle Empty Results Gracefully**: If no data is found, explain what you searched for and suggest alternatives.

Provide clear, detailed, data-rich answers with tables and breakdowns based on the data retrieved.`;


interface Message {
  role: 'user' | 'model';
  parts: { text: string }[];
}

// Helper function to execute a tool call
async function executeToolCall(name: string, args: any, effectiveUserId: string) {
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
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                     process.env.NEXT_PUBLIC_BASE_URL || 
                     'http://localhost:3000';
      const apiUrl = `${baseUrl}/api/clarify-transaction`;
      
      console.log(`[chat API] Calling categorize_transaction - URL: ${apiUrl}, TxnID: ${args.transaction_id}, Type: ${args.transaction_type}`);

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transaction_id: args.transaction_id,
            transaction_type: args.transaction_type,
          }),
        });

        console.log(`[chat API] categorize_transaction response - Status: ${response.status}, OK: ${response.ok}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[chat API] categorize_transaction failed - Status: ${response.status} ${response.statusText}, Body: ${errorText}`);
          functionResult = { 
            error: `API error: ${response.status} ${response.statusText}`,
            details: errorText,
          };
        } else {
          functionResult = await response.json();
          console.log(`[chat API] categorize_transaction success - Result: ${JSON.stringify(functionResult)}`);
        }
      } catch (fetchError: any) {
        console.error(`[chat API] categorize_transaction fetch error - ${fetchError.name}: ${fetchError.message}`);
        console.error(`[chat API] Fetch error details - URL: ${apiUrl}, Stack: ${fetchError.stack}`);
        functionResult = { 
          error: `Fetch failed: ${fetchError.message}`,
          error_type: fetchError.name,
          details: fetchError.stack,
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
    } else {
      functionResult = { error: 'Unknown function' };
    }
  } catch (error: any) {
    functionResult = { error: error.message };
  }

  return functionResult;
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
              const functionResult = await executeToolCall(name, args, effectiveUserId);
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
