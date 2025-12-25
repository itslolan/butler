import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import { createUpload, generateUploadName, createProcessingJob, updateUploadStatus } from '@/lib/db-tools';
import { logFromRequest } from '@/lib/audit-logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sanitizeFileName(name: string): string {
  // Keep it simple and filesystem/url-safe
  return name
    .replace(/\\/g, '_')
    .replace(/\//g, '_')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const userId = (formData.get('userId') as string | null) || null;
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const sourceType = (formData.get('sourceType') as string | null) || 'manual_upload';

    // Support both `file` (single) and `files` (multiple)
    const files = [
      ...(formData.getAll('files') as File[]),
      ...(formData.getAll('file') as File[]),
    ].filter(Boolean);

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const uploadName = generateUploadName();
    const upload = await createUpload(userId, uploadName, sourceType as any);

    const bucket = 'statements';
    const jobIds: string[] = [];

    try {
      for (const file of files) {
        const safeName = sanitizeFileName(file.name || 'upload');
        const filePath = `${userId}/pending/${uuidv4()}-${safeName}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, buffer, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Storage upload failed for ${file.name}: ${uploadError.message}`);
        }

        const job = await createProcessingJob({
          user_id: userId,
          upload_id: upload.id || null,
          bucket,
          file_path: filePath,
          file_name: file.name,
          status: 'pending',
          priority: 0,
          attempts: 0,
          max_attempts: 3,
          progress: { step: 'queued', percent: 0, message: 'Queued for processing' },
        });

        if (job.id) jobIds.push(job.id);
      }
    } catch (innerErr: any) {
      await updateUploadStatus(upload.id as string, 'failed');
      const msg = innerErr?.message || String(innerErr);
      // Common Supabase error when migration wasn't applied or schema cache is stale.
      if (msg.includes("Could not find the table 'public.processing_jobs' in the schema cache")) {
        throw new Error(
          "Background job queue table is missing. Run the Supabase migration `supabase-migration-background-jobs.sql` to create `processing_jobs`, then reload PostgREST schema cache (SQL: `NOTIFY pgrst, 'reload schema';`)."
        );
      }
      throw innerErr;
    }

    // Log the upload creation event
    logFromRequest(request, userId, 'upload.created', {
      upload_name: uploadName,
      file_count: files.length,
      upload_id: upload.id,
      source_type: sourceType,
    });

    return NextResponse.json({
      uploadId: upload.id,
      uploadName: upload.upload_name,
      fileCount: files.length,
      jobIds,
      status: upload.status,
    });
  } catch (error: any) {
    console.error('[upload] Error:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Failed to queue upload' },
      { status: 500 }
    );
  }
}
