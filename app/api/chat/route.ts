import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { 
  searchDocuments, 
  searchTransactions, 
  getAllMetadata,
  getAccountSnapshots,
  calculateNetWorth 
} from '@/lib/db-tools';

export const runtime = 'nodejs';

const GEMINI_MODEL = 'gemini-3-pro-preview';

const SYSTEM_PROMPT = `You are Butler, an AI financial assistant. You help users understand their financial data by querying structured databases.

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
            },
          },
          {
            name: 'search_transactions',
            description: 'Search individual transactions from all uploaded statements with optional filters',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
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
            },
          },
          {
            name: 'get_all_metadata',
            description: 'Retrieve the full metadata text blob containing markdown summaries from all uploaded statements. Use sparingly.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {},
            },
          },
          {
            name: 'categorize_transaction',
            description: 'Categorize a transaction as income, expense, transfer, or other. Use when user clarifies the type of a transaction.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                transaction_id: {
                  type: SchemaType.STRING,
                  description: 'The ID of the transaction to categorize',
                },
                transaction_type: {
                  type: SchemaType.STRING,
                  description: 'The transaction type: income, expense, transfer, or other',
                },
              },
              required: ['transaction_id', 'transaction_type'],
            },
          },
          {
            name: 'get_account_snapshots',
            description: 'Get monthly balance snapshots for accounts. Shows balances at month start and month end.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
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
            },
          },
          {
            name: 'calculate_net_worth',
            description: 'Calculate total net worth at a specific date across all accounts with uploaded data.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                date: {
                  type: SchemaType.STRING,
                  description: 'The date to calculate net worth for (YYYY-MM-DD)',
                },
              },
              required: ['date'],
            },
          },
          {
            name: 'render_chart',
            description: 'Render a chart or graph to visualize financial data. Use this when the user asks for trends, breakdowns, comparisons, or visual representations. Choose chart type based on data: line for trends over time, pie for category breakdowns, bar for comparisons.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
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
              required: ['type', 'title', 'description', 'data'],
            },
          },
        ],
      },
    ];

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: SYSTEM_PROMPT,
      tools: tools as any, // Type assertion to bypass strict typing
      generationConfig: {
        // Enable thinking/reasoning mode
        temperature: 0.7,
      },
    });

    // Convert messages to Gemini format
    // Filter out the initial assistant greeting and convert to Gemini format
    const history: Message[] = messages
      .slice(0, -1)
      .filter((msg: any, index: number) => {
        // Skip the first message if it's from assistant (the greeting)
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
    let result = await chat.sendMessage(lastMessage.content);

    // Track all function calls and reasoning for debugging
    const debugTrace: any[] = [];
    const reasoningSteps: string[] = [];

    // Capture initial reasoning if available
    try {
      const candidates = result.response.candidates;
      if (candidates && candidates[0]?.content?.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.text && !result.response.functionCalls()) {
            // This is reasoning/thinking before function calls
            reasoningSteps.push(part.text);
          }
        }
      }
    } catch (e) {
      // Ignore if reasoning extraction fails
    }

    // Handle function calls
    let functionCallCount = 0;
    const maxFunctionCalls = 10;

    while (result.response.functionCalls && result.response.functionCalls() && functionCallCount < maxFunctionCalls) {
      functionCallCount++;
      const functionCalls = result.response.functionCalls()!;
      
      // Capture reasoning before this function call iteration
      try {
        const candidates = result.response.candidates;
        if (candidates && candidates[0]?.content?.parts) {
          for (const part of candidates[0].content.parts) {
            if (part.text) {
              reasoningSteps.push(`[Iteration ${functionCallCount}] ${part.text}`);
            }
          }
        }
      } catch (e) {
        // Ignore if reasoning extraction fails
      }

      const functionResponses = [];
      
      for (const call of functionCalls) {
        const { name, args } = call;

        let functionResult;
        const startTime = Date.now();
        
        try {
          if (name === 'search_documents') {
            functionResult = await searchDocuments(effectiveUserId, args);
          } else if (name === 'search_transactions') {
            functionResult = await searchTransactions(effectiveUserId, args);
          } else if (name === 'get_all_metadata') {
            functionResult = await getAllMetadata(effectiveUserId);
          } else if (name === 'categorize_transaction') {
            // Call the clarify-transaction API
            const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/clarify-transaction`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                transaction_id: (args as any).transaction_id,
                transaction_type: (args as any).transaction_type,
              }),
            });
            functionResult = await response.json();
          } else if (name === 'get_account_snapshots') {
            functionResult = await getAccountSnapshots(
              effectiveUserId,
              (args as any).accountName,
              (args as any).startDate,
              (args as any).endDate
            );
          } else if (name === 'calculate_net_worth') {
            functionResult = await calculateNetWorth(effectiveUserId, (args as any).date);
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
          } else {
            functionResult = { error: 'Unknown function' };
          }
        } catch (error: any) {
          functionResult = { error: error.message };
        }

        const duration = Date.now() - startTime;

        // Log the function call for debugging
        debugTrace.push({
          function: name,
          arguments: args,
          result: functionResult,
          duration: `${duration}ms`,
          resultCount: Array.isArray(functionResult) ? functionResult.length : null,
        });

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

      result = await chat.sendMessage(functionResponses);
    }

    const responseText = result.response.text();

    // Capture final reasoning
    try {
      const candidates = result.response.candidates;
      if (candidates && candidates[0]?.content?.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.text && part.text !== responseText) {
            reasoningSteps.push(`[Final] ${part.text}`);
          }
        }
      }
    } catch (e) {
      // Ignore if reasoning extraction fails
    }

    // Extract chart configs from function calls
    let chartConfig = null;
    for (const trace of debugTrace) {
      if (trace.function === 'render_chart' && trace.result?.success && trace.result?.chartConfig) {
        chartConfig = trace.result.chartConfig;
        break; // Use the first chart
      }
    }

    return NextResponse.json({
      message: responseText,
      chartConfig, // Include chart config if present
      debug: {
        functionCalls: debugTrace,
        totalCalls: debugTrace.length,
        reasoning: reasoningSteps.length > 0 ? reasoningSteps : null,
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

