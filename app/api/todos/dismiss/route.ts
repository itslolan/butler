import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Backwards-compatible wrapper: route all dismisses through the unified resolver.
    const body = await request.json();
    const { userId, todoId, todoType } = body;

    const res = await fetch(new URL('/api/todos/resolve', request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, todoId, todoType, action: 'dismiss' }),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('[dismiss] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to dismiss todo' },
      { status: 500 }
    );
  }
}
