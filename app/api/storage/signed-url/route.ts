import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Extracts the storage path from a Supabase public URL
 * 
 * Example input:  https://xxx.supabase.co/storage/v1/object/public/statements/userId/timestamp_file.pdf
 * Example output: userId/timestamp_file.pdf
 */
function extractStoragePath(fileUrl: string): string | null {
  try {
    // If it's already just a path (no URL), return as-is (trim leading slash)
    if (!fileUrl.startsWith('http')) {
      const p = fileUrl.split('?')[0].replace(/^\/+/, '');
      return p || null;
    }

    const url = new URL(fileUrl);
    const pathname = decodeURIComponent(url.pathname);

    // Handle common Supabase formats:
    // - /storage/v1/object/public/statements/{path}
    // - /storage/v1/object/statements/{path}
    // - /storage/v1/object/sign/statements/{path}
    const prefixes = [
      '/storage/v1/object/public/statements/',
      '/storage/v1/object/statements/',
      '/storage/v1/object/sign/statements/',
    ];

    for (const prefix of prefixes) {
      if (pathname.startsWith(prefix)) {
        const p = pathname.slice(prefix.length).replace(/^\/+/, '');
        return p || null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * POST /api/storage/signed-url
 * 
 * Generates a signed URL for accessing private storage files.
 * This allows viewing files in private buckets without making them public.
 * 
 * Request body:
 *   - fileUrl: The stored file URL (public URL format) or storage path
 *   - expiresIn: (optional) Expiration time in seconds, default 3600 (1 hour)
 * 
 * Returns:
 *   - signedUrl: A temporary signed URL that can be used to access the file
 *   - expiresAt: When the signed URL expires
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileUrl, expiresIn = 3600 } = body;

    if (!fileUrl) {
      return NextResponse.json(
        { error: 'fileUrl is required' },
        { status: 400 }
      );
    }

    // Extract the storage path from the URL
    const storagePath = extractStoragePath(fileUrl);

    if (!storagePath) {
      return NextResponse.json(
        { error: 'Invalid file URL format' },
        { status: 400 }
      );
    }

    // Generate signed URL
    const { data, error } = await supabase.storage
      .from('statements')
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      console.error('[signed-url] Error generating signed URL:', error);
      const isNotFound = (error as any)?.statusCode === '404' || (error as any)?.status === 404;
      return NextResponse.json(
        { error: `Failed to generate signed URL: ${error.message}` },
        { status: isNotFound ? 404 : 500 }
      );
    }

    if (!data?.signedUrl) {
      return NextResponse.json(
        { error: 'No signed URL returned' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    });
  } catch (error: any) {
    console.error('[signed-url] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate signed URL' },
      { status: 500 }
    );
  }
}
