import { NextRequest, NextResponse } from 'next/server';
import { createUpload, getUploadsForUser, generateUploadName } from '@/lib/db-tools';

export const dynamic = 'force-dynamic';

/**
 * POST /api/uploads - Create a new upload record
 * Call this BEFORE processing files to get an upload_id
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, fileCount, sourceType } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Generate upload name based on current timestamp
    const uploadName = generateUploadName();

    const upload = await createUpload(
      userId,
      uploadName,
      sourceType || 'manual_upload'
    );

    return NextResponse.json({
      uploadId: upload.id,
      uploadName: upload.upload_name,
      status: upload.status,
    });
  } catch (error: any) {
    console.error('[uploads] POST Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to create upload' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/uploads - Get all uploads for a user with stats
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const uploads = await getUploadsForUser(userId);

    return NextResponse.json({
      uploads,
      count: uploads.length,
    });
  } catch (error: any) {
    console.error('[uploads] GET Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch uploads' },
      { status: 500 }
    );
  }
}
