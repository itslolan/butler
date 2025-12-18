import { NextRequest, NextResponse } from 'next/server';
import { updateUploadStatus } from '@/lib/db-tools';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/uploads/[id]/status - Update upload status
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    if (!['processing', 'completed', 'failed'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be one of: processing, completed, failed' },
        { status: 400 }
      );
    }

    await updateUploadStatus(id, status);

    return NextResponse.json({
      success: true,
      message: `Upload status updated to ${status}`,
    });
  } catch (error: any) {
    console.error('[uploads/[id]/status] PATCH Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to update upload status' },
      { status: 500 }
    );
  }
}
