import { NextRequest, NextResponse } from 'next/server';
import { executeToolCall } from '@/lib/chat-tool-executor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/dashboard/tools
 * Body: { userId: string, toolName: string, args?: object }
 *
 * Lightweight wrapper around the chat tool executor so dashboard
 * components can call the exact same data tools as the chatbot.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}));
    const userId = payload?.userId;
    const toolName = payload?.toolName;
    const args = payload?.args || {};

    if (!userId || !toolName) {
      return NextResponse.json(
        { error: 'userId and toolName are required' },
        { status: 400 }
      );
    }

    const result = await executeToolCall(toolName, args, userId, request.url);
    if (result?.error) {
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to execute tool' },
      { status: 500 }
    );
  }
}

