import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, todoId, todoType } = body;

    if (!userId || !todoId || !todoType) {
      return NextResponse.json(
        { error: 'userId, todoId, and todoType are required' },
        { status: 400 }
      );
    }

    if (todoType === 'account_selection') {
      // Extract document ID from the todo ID format: "account-selection-{uuid}"
      const documentId = todoId.replace('account-selection-', '');
      
      // Update the document to mark it as dismissed
      const { error } = await supabase
        .from('documents')
        .update({ is_dismissed: true })
        .eq('id', documentId)
        .eq('user_id', userId);

      if (error) {
        console.error('[dismiss] Error dismissing account selection:', error);
        return NextResponse.json(
          { error: 'Failed to dismiss account selection' },
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        success: true,
        message: 'Account selection dismissed successfully'
      });
    } else if (todoType === 'transaction_clarification') {
      // todoId is the transaction UUID
      const { error } = await supabase
        .from('transactions')
        .update({ is_dismissed: true })
        .eq('id', todoId)
        .eq('user_id', userId);

      if (error) {
        console.error('[dismiss] Error dismissing transaction:', error);
        return NextResponse.json(
          { error: 'Failed to dismiss transaction clarification' },
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        success: true,
        message: 'Transaction clarification dismissed successfully'
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid todoType' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[dismiss] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to dismiss todo' },
      { status: 500 }
    );
  }
}
