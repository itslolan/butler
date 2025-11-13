import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please set OPENAI_API_KEY in your environment variables.' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');
    const mimeType = file.type || 'image/png';

    // Call GPT-4o to extract financial information
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a financial statement analyzer. Extract financial information from bank and credit card statements. 
          
          Extract the following information and return it as JSON:
          
          1. **Carry-forward balance behavior**: Look for "Previous Balance", "Payments", "New Balance" in the statement summary. Compare balances to detect unpaid carry-over.
          
          2. **Cash advances**: Identify transactions containing "CASH ADVANCE" or "CASH ADVANCE FEE" in the transaction list.
          
          3. **Credit utilization ratio**: Find "Credit Limit" and "New Balance" in the statement header. Calculate utilization as new_balance / credit_limit.
          
          4. **Volatility of spending**: Calculate standard deviation of total monthly spend from all transactions.
          
          5. **Payment regularity**: Find "Payment - Thank You" entries and due dates. Check if minimum payments are made on time each cycle.
          
          6. **Category-level financial behavior**: Categorize merchants (Food, Travel, Utilities, Entertainment, Shopping, etc.) and sum spend by category.
          
          7. **Refunds & reversals**: Flag transactions with "REFUND" or negative amounts.
          
          8. **Subscription creep**: Detect recurring charges from the same merchant with similar amounts across statements.
          
          Return a JSON object with this structure:
          {
            "carryForwardBalance": {
              "previousBalance": number,
              "payments": number,
              "newBalance": number,
              "hasCarryOver": boolean
            },
            "cashAdvances": {
              "transactions": [{"date": "string", "description": "string", "amount": number, "fee": number}],
              "totalAmount": number,
              "totalFees": number
            },
            "creditUtilization": {
              "creditLimit": number,
              "newBalance": number,
              "utilizationRatio": number,
              "percentage": number
            },
            "spendingVolatility": {
              "monthlySpends": [number],
              "standardDeviation": number,
              "averageSpend": number
            },
            "paymentRegularity": {
              "payments": [{"date": "string", "amount": number, "dueDate": "string", "onTime": boolean}],
              "onTimePercentage": number
            },
            "categorySpending": {
              "categories": {"category": amount},
              "total": number
            },
            "refunds": {
              "transactions": [{"date": "string", "description": "string", "amount": number}],
              "totalAmount": number
            },
            "subscriptions": {
              "recurringCharges": [{"merchant": "string", "amount": number, "frequency": "string", "occurrences": number}]
            }
          }
          
          If information is not available, use null or empty arrays/objects. Always return valid JSON.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    let extractedData;
    try {
      extractedData = JSON.parse(content);
    } catch (parseError) {
      // If JSON parsing fails, try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse JSON response');
      }
    }

    // Ensure all data structures exist and have proper defaults
    if (!extractedData) {
      extractedData = {};
    }

    // Calculate standard deviation if not provided
    if (extractedData.spendingVolatility?.monthlySpends && Array.isArray(extractedData.spendingVolatility.monthlySpends)) {
      const spends = extractedData.spendingVolatility.monthlySpends.filter((s: any) => typeof s === 'number');
      if (spends.length > 0 && !extractedData.spendingVolatility.standardDeviation) {
        const avg = spends.reduce((a: number, b: number) => a + b, 0) / spends.length;
        const variance = spends.reduce((sum: number, val: number) => sum + Math.pow(val - avg, 2), 0) / spends.length;
        extractedData.spendingVolatility.standardDeviation = Math.sqrt(variance);
        extractedData.spendingVolatility.averageSpend = avg;
      }
    }

    // Calculate credit utilization percentage if not provided
    if (extractedData.creditUtilization?.utilizationRatio != null && extractedData.creditUtilization.percentage == null) {
      extractedData.creditUtilization.percentage = Number(extractedData.creditUtilization.utilizationRatio) * 100;
    }

    // Calculate payment regularity percentage if not provided
    if (extractedData.paymentRegularity?.payments && Array.isArray(extractedData.paymentRegularity.payments) && extractedData.paymentRegularity.onTimePercentage === undefined) {
      const payments = extractedData.paymentRegularity.payments;
      const onTimeCount = payments.filter((p: any) => p?.onTime === true).length;
      extractedData.paymentRegularity.onTimePercentage = payments.length > 0 
        ? (onTimeCount / payments.length) * 100 
        : 0;
    }

    // Calculate category total if not provided
    if (extractedData.categorySpending?.categories && typeof extractedData.categorySpending.categories === 'object' && extractedData.categorySpending.total === undefined) {
      extractedData.categorySpending.total = Object.values(extractedData.categorySpending.categories)
        .reduce((sum: number, val: any) => sum + (typeof val === 'number' ? val : 0), 0);
    }

    // Ensure arrays exist for safety
    if (extractedData.cashAdvances && !Array.isArray(extractedData.cashAdvances.transactions)) {
      extractedData.cashAdvances.transactions = [];
    }
    if (extractedData.refunds && !Array.isArray(extractedData.refunds.transactions)) {
      extractedData.refunds.transactions = [];
    }
    if (extractedData.subscriptions && !Array.isArray(extractedData.subscriptions.recurringCharges)) {
      extractedData.subscriptions.recurringCharges = [];
    }
    if (extractedData.paymentRegularity && !Array.isArray(extractedData.paymentRegularity.payments)) {
      extractedData.paymentRegularity.payments = [];
    }

    const result = {
      id: `stmt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fileName: file.name,
      extractedAt: new Date().toISOString(),
      data: extractedData,
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error processing statement:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process statement' },
      { status: 500 }
    );
  }
}

