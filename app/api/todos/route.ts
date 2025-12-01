import { NextRequest, NextResponse } from 'next/server';
import { getUnclarifiedTransactions } from '@/lib/db-tools';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const todos = await getUnclarifiedTransactions(userId);

    return NextResponse.json({
      count: todos.length,
      todos,
    });
  } catch (error: any) {
    console.error('Error fetching todos:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch todos' },
      { status: 500 }
    );
  }
}

