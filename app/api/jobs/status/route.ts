import { NextRequest, NextResponse } from 'next/server';
import { getJobsByIds, getJobsByUploadId, updateUploadStatusFromJobs } from '@/lib/db-tools';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

function summarize(jobs: any[]) {
  const summary = { total: jobs.length, pending: 0, processing: 0, completed: 0, failed: 0 };
  for (const j of jobs) {
    if (j.status === 'pending') summary.pending++;
    else if (j.status === 'processing') summary.processing++;
    else if (j.status === 'completed') summary.completed++;
    else if (j.status === 'failed') summary.failed++;
  }
  return summary;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uploadId = searchParams.get('uploadId');
    const jobIdsParam = searchParams.getAll('jobId');
    const jobIdsCsv = (searchParams.get('jobIds') || '').trim();

    let jobs: any[] = [];

    if (uploadId) {
      jobs = await getJobsByUploadId(uploadId);
      // Keep uploads.status in sync with jobs
      await updateUploadStatusFromJobs(uploadId);
    } else {
      const jobIds = [
        ...jobIdsParam,
        ...(jobIdsCsv ? jobIdsCsv.split(',').map(s => s.trim()).filter(Boolean) : []),
      ];

      if (jobIds.length === 0) {
        return NextResponse.json(
          { error: 'uploadId or jobIds is required' },
          { status: 400 }
        );
      }

      jobs = await getJobsByIds(jobIds);
    }

    const summary = summarize(jobs);
    const allDone = summary.total > 0 && (summary.pending + summary.processing) === 0;

    return NextResponse.json(
      { jobs, summary, allDone },
      {
        headers: {
          // Be extremely explicit to defeat any intermediate caches/CDNs/browsers.
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
          'Surrogate-Control': 'no-store',
        },
      }
    );
  } catch (error: any) {
    console.error('[jobs/status] Error:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch job status' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
          'Surrogate-Control': 'no-store',
        },
      }
    );
  }
}
