import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_MODEL = 'gemini-3-pro-preview';

const ACTION_GENERATION_PROMPT = `You are a financial assistant helping users categorize transactions.

Given a transaction that needs clarification, generate 2-4 concise, actionable response suggestions that the user can click to quickly categorize or explain the transaction.

Requirements:
1. Analyze the merchant name, amount, and clarification question
2. Generate 2-4 specific, contextually relevant action suggestions
3. Each action should be a complete sentence the user would say (e.g., "This is a transfer", "This is my salary")
4. Keep each action under 50 characters
5. Make actions specific to the transaction context (avoid generic categories unless nothing specific applies)
6. For transfers between accounts, suggest "This is a transfer"
7. For recurring deposits, suggest "This is income" or more specific like "This is my salary"
8. For ambiguous merchants, suggest clarifying actions based on common interpretations

Return a JSON object with this structure:
{
  "actions": ["Action 1", "Action 2", "Action 3", "Action 4"]
}

The actions array should contain 2-4 strings. If fewer than 4 actions make sense, return only the relevant ones.`;

interface ActionGenerationInput {
  merchant: string;
  amount: number;
  date: string;
  clarificationQuestion: string;
}

interface ActionGenerationResult {
  actions: string[];
}

/**
 * Generate contextual action suggestions for a transaction using LLM
 * @param transaction Transaction details
 * @returns Array of 2-4 action strings, or null if generation fails
 */
export async function generateSuggestedActions(
  transaction: ActionGenerationInput
): Promise<string[] | null> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not configured, cannot generate suggested actions');
      return null;
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: ACTION_GENERATION_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    });

    // Create a concise prompt with transaction details
    const prompt = `Transaction Details:
- Merchant: ${transaction.merchant}
- Amount: $${Math.abs(transaction.amount).toFixed(2)}
- Date: ${transaction.date}
- Question: ${transaction.clarificationQuestion}

Generate 2-4 contextual action suggestions for this transaction.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Parse the JSON response
    const parsed: ActionGenerationResult = JSON.parse(responseText);
    
    if (parsed.actions && Array.isArray(parsed.actions) && parsed.actions.length > 0) {
      // Validate that we have 2-4 actions and each is a reasonable length
      const validActions = parsed.actions
        .filter(action => typeof action === 'string' && action.length > 0 && action.length <= 100)
        .slice(0, 4); // Maximum 4 actions
      
      if (validActions.length >= 2) {
        console.log(`Generated ${validActions.length} suggested actions for transaction: ${transaction.merchant}`);
        return validActions;
      }
    }
    
    console.warn('LLM returned invalid actions format, falling back to null');
    return null;
  } catch (error: any) {
    console.error('Error generating suggested actions:', error.message);
    return null; // Fallback to generic actions in UI
  }
}

