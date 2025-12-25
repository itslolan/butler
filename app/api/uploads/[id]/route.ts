import { NextRequest, NextResponse } from 'next/server';
import { getUploadDetails, deleteUpload } from '@/lib/db-tools';
import { logFromRequest } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/uploads/[id] - Get upload details with documents and transactions
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const details = await getUploadDetails(id, userId);

    if (!details) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }

    return NextResponse.json(details);
  } catch (error: any) {
    console.error('[uploads/[id]] GET Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch upload details' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/uploads/[id] - Delete an upload and all associated data
 * Documents and transactions cascade delete via FK constraints
 * Also deletes files from Supabase Storage
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const result = await deleteUpload(id, userId);

    // Log the deletion event
    logFromRequest(request, userId, 'upload.deleted', {
      upload_id: id,
      deleted_documents: result.deletedDocuments,
      deleted_transactions: result.deletedTransactions,
    });

    return NextResponse.json({
      success: true,
      message: `Upload deleted successfully`,
      deletedDocuments: result.deletedDocuments,
      deletedTransactions: result.deletedTransactions,
    });
  } catch (error: any) {
    console.error('[uploads/[id]] DELETE Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to delete upload' },
      { status: 500 }
    );
  }
}
