import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAllMemories, upsertMemory } from '@/lib/db-tools';

const GEMINI_MODEL = 'gemini-2.0-flash';

interface RawTransaction {
  date: string;
  merchant: string;
  amount: number;
  category?: string | null;
  description?: string | null;
  transactionType?: 'income' | 'expense' | 'transfer' | 'other' | null;
}

interface CategorizedTransaction extends RawTransaction {
  transactionType: 'income' | 'expense' | 'transfer' | 'other';
  category: string | null;
  spendClassification: 'essential' | 'discretionary' | null;
  confidence: number;
  clarificationNeeded: boolean;
  clarificationQuestion: string | null;
  suggestedActions: string[] | null;
}

interface CategorizationResult {
  transactions: CategorizedTransaction[];
  incomeTransactions: {
    date: string;
    source: string;
    amount: number;
    frequency: 'monthly' | 'biweekly' | 'weekly' | 'irregular' | null;
    confidence: number;
  }[];
}

const CATEGORIZATION_PROMPT = `You are a financial transaction categorizer. Analyze the provided transactions and enhance them with detailed categorization.

**CRITICAL**: Return ONLY valid JSON. Do NOT wrap your response in markdown code blocks.

For each transaction, determine:
1. **transactionType**: "income" | "expense" | "transfer" | "other"
2. **category**: Specific category like "Food & Dining", "Groceries", "Transportation", "Utilities", "Entertainment", "Shopping", "Healthcare", "Income", "Transfer", etc.
3. **spendClassification**: "essential" | "discretionary" | null
4. **confidence**: 0.0 to 1.0
5. **clarificationNeeded**: true if confidence < 0.7
6. **clarificationQuestion**: A specific question if clarification needed
7. **suggestedActions**: Array of actionable suggestions (or null)

**Transaction Type Rules:**
- **income**: Salary, wages, deposits, refunds, interest, dividends
  - Negative amounts in Plaid format (money coming in)
- **expense**: Purchases, bills, fees, charges
  - Positive amounts in Plaid format (money going out)
- **transfer**: Between own accounts, Zelle, Venmo, PayPal to self, credit card payments
- **other**: Unclear transactions

**Spend Classification:**
- **essential**: Rent, mortgage, utilities, groceries, healthcare, insurance, gas, basic transportation
- **discretionary**: Dining out, entertainment, shopping, subscriptions, travel, hobbies

**Suggested Actions Examples:**
- "Consider negotiating this subscription for a lower rate"
- "This merchant offers a 5% cashback card - consider switching"
- "Set up autopay to avoid late fees"
- "Track this recurring expense in your budget"

Return JSON:
{
  "transactions": [
    {
      "index": 0,
      "transactionType": "expense",
      "category": "Food & Dining",
      "spendClassification": "discretionary",
      "confidence": 0.95,
      "clarificationNeeded": false,
      "clarificationQuestion": null,
      "suggestedActions": ["This restaurant visit was $45 - consider cooking at home to save"]
    }
  ],
  "incomeTransactions": [
    {
      "date": "2024-01-15",
      "source": "Employer Inc",
      "amount": 3500,
      "frequency": "biweekly",
      "confidence": 0.95
    }
  ]
}`;

/**
 * Use LLM to categorize and enhance transactions with rich metadata
 */
export async function categorizeTransactions(
  userId: string,
  transactions: RawTransaction[]
): Promise<CategorizationResult> {
  if (!process.env.GEMINI_API_KEY || transactions.length === 0) {
    // Return basic categorization without LLM
    return {
      transactions: transactions.map(t => ({
        ...t,
        transactionType: t.transactionType || determineBasicType(t.amount, t.merchant),
        category: t.category || null,
        spendClassification: null,
        confidence: 0.5,
        clarificationNeeded: true,
        clarificationQuestion: 'What type of transaction is this?',
        suggestedActions: null,
      })),
      incomeTransactions: [],
    };
  }

  try {
    // Get user memories for context
    let memoriesText = '';
    try {
      memoriesText = await getAllMemories(userId);
    } catch (e) {
      console.warn('Could not fetch memories for categorization');
    }

    const systemPrompt = memoriesText
      ? `${CATEGORIZATION_PROMPT}\n\n**User Context/Memories:**\n${memoriesText}\n\nUse these memories to help classify transactions accurately.`
      : CATEGORIZATION_PROMPT;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: systemPrompt,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    // Prepare transactions for LLM
    const transactionsForLLM = transactions.map((t, index) => ({
      index,
      date: t.date,
      merchant: t.merchant,
      amount: t.amount,
      existingCategory: t.category,
      existingType: t.transactionType,
      description: t.description,
    }));

    const result = await model.generateContent(
      `Categorize these ${transactions.length} transactions:\n\n${JSON.stringify(transactionsForLLM, null, 2)}`
    );

    const response = result.response.text();
    const parsed = JSON.parse(response);

    // Merge LLM results back into transactions
    const categorizedTransactions: CategorizedTransaction[] = transactions.map((t, index) => {
      const llmResult = parsed.transactions?.find((r: any) => r.index === index);
      
      return {
        ...t,
        transactionType: llmResult?.transactionType || t.transactionType || determineBasicType(t.amount, t.merchant),
        category: llmResult?.category || t.category || null,
        spendClassification: llmResult?.spendClassification || null,
        confidence: llmResult?.confidence || 0.5,
        clarificationNeeded: llmResult?.clarificationNeeded || false,
        clarificationQuestion: llmResult?.clarificationQuestion || null,
        suggestedActions: llmResult?.suggestedActions || null,
      };
    });

    return {
      transactions: categorizedTransactions,
      incomeTransactions: parsed.incomeTransactions || [],
    };

  } catch (error: any) {
    console.error('[transaction-categorizer] LLM error:', error.message);
    
    // Fallback to basic categorization
    return {
      transactions: transactions.map(t => ({
        ...t,
        transactionType: t.transactionType || determineBasicType(t.amount, t.merchant),
        category: t.category || null,
        spendClassification: null,
        confidence: 0.5,
        clarificationNeeded: true,
        clarificationQuestion: 'What type of transaction is this?',
        suggestedActions: null,
      })),
      incomeTransactions: [],
    };
  }
}

/**
 * Basic transaction type determination without LLM
 */
function determineBasicType(amount: number, merchant: string): 'income' | 'expense' | 'transfer' | 'other' {
  const merchantLower = merchant.toLowerCase();
  
  // Check for transfers
  if (
    merchantLower.includes('transfer') ||
    merchantLower.includes('zelle') ||
    merchantLower.includes('venmo') ||
    merchantLower.includes('paypal') ||
    merchantLower.includes('payment to')
  ) {
    return 'transfer';
  }
  
  // Plaid uses positive for money out, negative for money in
  if (amount < 0) {
    // Money coming in
    if (
      merchantLower.includes('payroll') ||
      merchantLower.includes('salary') ||
      merchantLower.includes('deposit') ||
      merchantLower.includes('income')
    ) {
      return 'income';
    }
    return 'income'; // Default negative amounts to income
  }
  
  return 'expense'; // Default positive amounts to expense
}

/**
 * Monitor transaction patterns and update memories
 */
export async function monitorTransactionPatterns(
  userId: string,
  transactions: CategorizedTransaction[],
  incomeTransactions: CategorizationResult['incomeTransactions']
): Promise<void> {
  if (!process.env.GEMINI_API_KEY || transactions.length === 0) {
    return;
  }

  try {
    // Get existing memories
    const existingMemories = await getAllMemories(userId);
    
    // Analyze income patterns
    if (incomeTransactions.length > 0) {
      for (const income of incomeTransactions) {
        if (income.frequency && income.frequency !== 'irregular' && income.confidence > 0.7) {
          const memoryContent = `User receives ${income.frequency} income of $${Math.abs(income.amount).toFixed(2)} from ${income.source}`;
          
          // Check if we already have this memory or need to update it
          if (!existingMemories.includes(income.source)) {
            await upsertMemory(userId, memoryContent);
          }
        }
      }
    }

    // Detect recurring transfer patterns
    const transferTransactions = transactions.filter(t => t.transactionType === 'transfer');
    const transferAmounts = new Map<number, number>();
    
    for (const transfer of transferTransactions) {
      const amount = Math.abs(transfer.amount);
      transferAmounts.set(amount, (transferAmounts.get(amount) || 0) + 1);
    }

    // If same transfer amount appears multiple times, it might be a pattern
    for (const [amount, count] of transferAmounts) {
      if (count >= 2 && amount > 100) { // At least 2 occurrences, significant amount
        const memoryContent = `User regularly transfers $${amount.toFixed(2)} between accounts`;
        if (!existingMemories.includes(amount.toFixed(2))) {
          await upsertMemory(userId, memoryContent);
        }
      }
    }

  } catch (error: any) {
    console.error('[transaction-categorizer] Pattern monitoring error:', error.message);
    // Non-critical, don't throw
  }
}

