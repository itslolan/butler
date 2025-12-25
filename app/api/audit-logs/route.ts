import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getAuditLogs, getAuditLogCount } from '@/lib/audit-logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Fetch logs and total count
    const [logs, totalCount] = await Promise.all([
      getAuditLogs(userId, limit, offset),
      getAuditLogCount(userId),
    ]);

    return NextResponse.json({
      logs,
      total: totalCount,
      limit,
      offset,
      hasMore: offset + logs.length < totalCount,
    });

  } catch (error: any) {
    console.error('[audit-logs] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}

