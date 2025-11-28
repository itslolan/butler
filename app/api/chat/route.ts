import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { searchDocuments, searchTransactions, getAllMetadata } from '@/lib/db-tools';

export const runtime = 'nodejs';

const GEMINI_MODEL = 'gemini-2.0-flash-exp';

const SYSTEM_PROMPT = `You are Butler, an AI financial assistant. You help users understand their financial data by querying structured databases.

You have access to three data sources:

1. **Documents Collection**: Stores metadata about uploaded bank/credit card statements
   - Fields: documentType, issuer, accountId, statementDate, previousBalance, newBalance, creditLimit, minimumPayment, dueDate, fileName, uploadedAt
   
2. **Transactions Collection**: Stores individual transactions extracted from statements
   - Fields: date, merchant, amount, category, description, documentId
   
3. **Metadata Text**: A markdown document containing all metadata summaries from uploaded statements (may be noisy or duplicate structured data)

**Tool Usage Guidelines:**
- ALWAYS prefer structured data (documents/transactions) when answering questions about balances, specific amounts, dates, merchants, etc.
- Use metadata text ONLY when structured queries don't provide enough context or for general summaries
- When filtering data, be flexible with date ranges and partial string matches
- If you need to calculate aggregates (totals, averages), retrieve the relevant transactions and compute them

**Available Tools:**

1. search_documents(filters): Query documents collection
   - Filters: documentType, issuer, startDate, endDate, minBalance, maxBalance
   
2. search_transactions(filters): Query transactions collection
   - Filters: startDate, endDate, merchant, category, minAmount, maxAmount
   
3. get_all_metadata(): Retrieve the full metadata text blob

**Response Format Guidelines:**

ALWAYS provide detailed, data-rich responses with supporting evidence:

1. **Include Data Tables**: When discussing transactions, spending, or any numerical data, ALWAYS present the underlying data in a markdown table format.

2. **Show Your Work**: Don't just give totals - show the breakdown:
   - List individual transactions in a table
   - Show subtotals by category
   - Include dates, merchants, amounts, and categories

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
   
   | Date | Merchant | Category | Amount |
   |------|----------|----------|--------|
   | 2025-09-12 | Starbucks | Food | $15.50 |
   | 2025-09-11 | Amazon | Shopping | $89.99 |
   | 2025-09-10 | Shell Gas | Transportation | $45.00 |
   
   ### Summary by Category
   - **Food & Dining**: $234.50 (19%)
   - **Shopping**: $567.89 (46%)
   - **Transportation**: $432.17 (35%)
   
   **Total**: $1,234.56
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
              type: 'OBJECT' as const,
              properties: {
                documentType: {
                  type: 'STRING' as const,
                  description: 'Filter by document type: bank_statement, credit_card_statement, or unknown',
                },
                issuer: {
                  type: 'STRING' as const,
                  description: 'Filter by issuer name (partial match, case-insensitive)',
                },
                startDate: {
                  type: 'STRING' as const,
                  description: 'Filter statements on or after this date (YYYY-MM-DD)',
                },
                endDate: {
                  type: 'STRING' as const,
                  description: 'Filter statements on or before this date (YYYY-MM-DD)',
                },
                minBalance: {
                  type: 'NUMBER' as const,
                  description: 'Filter by minimum new balance',
                },
                maxBalance: {
                  type: 'NUMBER' as const,
                  description: 'Filter by maximum new balance',
                },
              },
            },
          },
          {
            name: 'search_transactions',
            description: 'Search individual transactions from all uploaded statements with optional filters',
            parameters: {
              type: 'OBJECT' as const,
              properties: {
                startDate: {
                  type: 'STRING' as const,
                  description: 'Filter transactions on or after this date (YYYY-MM-DD)',
                },
                endDate: {
                  type: 'STRING' as const,
                  description: 'Filter transactions on or before this date (YYYY-MM-DD)',
                },
                merchant: {
                  type: 'STRING' as const,
                  description: 'Filter by merchant name (partial match, case-insensitive)',
                },
                category: {
                  type: 'STRING' as const,
                  description: 'Filter by category (partial match, case-insensitive)',
                },
                minAmount: {
                  type: 'NUMBER' as const,
                  description: 'Filter by minimum transaction amount',
                },
                maxAmount: {
                  type: 'NUMBER' as const,
                  description: 'Filter by maximum transaction amount',
                },
              },
            },
          },
          {
            name: 'get_all_metadata',
            description: 'Retrieve the full metadata text blob containing markdown summaries from all uploaded statements. Use sparingly.',
            parameters: {
              type: 'OBJECT' as const,
              properties: {},
            },
          },
        ],
      },
    ];

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: SYSTEM_PROMPT,
      tools,
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

    while (result.response.functionCalls() && functionCallCount < maxFunctionCalls) {
      functionCallCount++;
      const functionCalls = result.response.functionCalls();
      
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

    return NextResponse.json({
      message: responseText,
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

