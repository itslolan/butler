import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { upsertMemory } from '@/lib/db-tools';

export const runtime = 'nodejs';

/**
 * POST - Confirm or reject an expense as a fixed expense
 * Stores the user's feedback in memories for future LLM classification
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabaseAuth = createClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const body = await request.json();
    const { merchant_key, merchant_name, action } = body;

    if (!merchant_key || !merchant_name) {
      return NextResponse.json(
        { error: 'merchant_key and merchant_name are required' },
        { status: 400 }
      );
    }

    if (!action || !['confirm', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "confirm" or "reject"' },
        { status: 400 }
      );
    }

    // Create a memory entry based on the action
    let memoryContent: string;
    
    if (action === 'confirm') {
      memoryContent = `Confirmed fixed expense: "${merchant_name}" (normalized: ${merchant_key}). User confirmed this as a recurring fixed payment.`;
      console.log(`[Fixed Expense Feedback] User ${userId} confirmed "${merchant_name}" as fixed expense`);
    } else {
      memoryContent = `Rejected fixed expense: "${merchant_name}" (normalized: ${merchant_key}). User indicated this is NOT a fixed recurring payment.`;
      console.log(`[Fixed Expense Feedback] User ${userId} rejected "${merchant_name}" as fixed expense`);
    }

    console.log(`[Fixed Expense Feedback] Saving memory: "${memoryContent}"`);
    await upsertMemory(userId, memoryContent);
    console.log(`[Fixed Expense Feedback] Memory saved successfully`);

    return NextResponse.json({
      success: true,
      message: `Fixed expense ${action}ed and saved to memory`,
      action,
    });

  } catch (error: any) {
    console.error('[confirm-fixed-expense] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save fixed expense feedback' },
      { status: 500 }
    );
  }
}

