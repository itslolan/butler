'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import AuthGuard from '@/components/AuthGuard';
import UploadHistoryCard from '@/components/UploadHistoryCard';
import { UploadWithStats } from '@/lib/supabase';

export default function UploadsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [uploads, setUploads] = useState<UploadWithStats[]>([]);
  const [jobStatusByUploadId, setJobStatusByUploadId] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [uploadToDelete, setUploadToDelete] = useState<UploadWithStats | null>(null);
  const [deleting, setDeleting] = useState(false);

  const processingUploads = useMemo(
    () => uploads.filter(u => u.status === 'processing'),
    [uploads]
  );

  useEffect(() => {
    const fetchUploads = async () => {
      if (!user?.id) return;

      try {
        const res = await fetch(`/api/uploads?userId=${user.id}&_ts=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!res.ok) {
          throw new Error('Failed to fetch uploads');
        }
        const data = await res.json();
        setUploads(data.uploads || []);
      } catch (err: any) {
        console.error('Error fetching uploads:', err);
        setError(err.message || 'Failed to load upload history');
      } finally {
        setLoading(false);
      }
    };

    fetchUploads();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (processingUploads.length === 0) return;

    let cancelled = false;
    let interval: any;

    const poll = async () => {
      try {
        const results = await Promise.all(
          processingUploads.map(async (u) => {
            const res = await fetch(
              `/api/jobs/status?uploadId=${encodeURIComponent(u.id!)}&_ts=${Date.now()}`,
              { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }
            );
            if (!res.ok) return [u.id!, null] as const;
            const data = await res.json();
            return [u.id!, data] as const;
          })
        );

        if (cancelled) return;

        setJobStatusByUploadId(prev => {
          const next = { ...prev };
          for (const [uploadId, data] of results) {
            if (data) next[uploadId] = data;
          }
          return next;
        });

        // Refresh uploads list occasionally so completed uploads show document stats
        const anyDone = results.some(([, data]) => data?.allDone);
        if (anyDone) {
          const res = await fetch(`/api/uploads?userId=${user.id}&_ts=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' },
          });
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) setUploads(data.uploads || []);
          }
        }
      } catch (e) {
        // ignore polling errors
      }
    };

    poll();
    interval = setInterval(poll, 2500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [processingUploads, user?.id]);

  const handleUploadClick = (uploadId: string) => {
    router.push(`/uploads/${uploadId}`);
  };

  const handleDeleteClick = (uploadId: string) => {
    const upload = uploads.find(u => u.id === uploadId);
    if (upload) {
      setUploadToDelete(upload);
      setDeleteModalOpen(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!uploadToDelete || !user?.id) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/uploads/${uploadToDelete.id}?userId=${user.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete upload');
      }

      // Remove from local state
      setUploads(prev => prev.filter(u => u.id !== uploadToDelete.id));
      setDeleteModalOpen(false);
      setUploadToDelete(null);
    } catch (err: any) {
      console.error('Error deleting upload:', err);
      alert('Failed to delete upload: ' + (err.message || 'Unknown error'));
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setUploadToDelete(null);
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="hidden sm:inline">Back to Dashboard</span>
              </button>
            </div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Upload History
            </h1>
            <div className="w-24" /> {/* Spacer for centering */}
          </div>
        </header>

        {/* Content */}
        <main className="max-w-6xl mx-auto px-4 py-6">
          {loading ? (
            // Loading skeleton
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 animate-pulse"
                >
                  <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
                  <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
                  <div className="flex gap-2 mb-3">
                    <div className="h-6 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                  <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              ))}
            </div>
          ) : error ? (
            // Error state
            <div className="flex flex-col items-center justify-center py-16">
              <svg className="w-16 h-16 text-red-300 dark:text-red-800 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-red-600 dark:text-red-400 text-lg mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : uploads.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-16">
              <svg className="w-20 h-20 text-slate-300 dark:text-slate-700 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                No uploads yet
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-center max-w-md mb-6">
                Upload your bank statements or screenshots to get started. We&apos;ll automatically extract transactions and help you track your finances.
              </p>
              <button
                onClick={() => router.push('/')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload Your First Statement
              </button>
            </div>
          ) : (
            // Upload grid
            <>
              {processingUploads.length > 0 && (
                <div className="mb-6 p-4 bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Processing in background
                    </h2>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Updates every ~2.5s
                    </span>
                  </div>

                  <div className="space-y-4">
                    {processingUploads.map((upload) => {
                      const jobStatus = jobStatusByUploadId[upload.id!];
                      const jobs = jobStatus?.jobs || [];
                      const summary = jobStatus?.summary;
                      const completed = summary?.completed || 0;
                      const total = summary?.total || jobs.length || 0;
                      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

                      return (
                        <div key={upload.id} className="border border-slate-200 dark:border-slate-800 rounded-lg p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {upload.upload_name}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {completed}/{total} files complete
                              </div>
                            </div>
                            <button
                              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                              onClick={() => handleUploadClick(upload.id!)}
                            >
                              Open →
                            </button>
                          </div>

                          <div className="mt-2 h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 dark:bg-blue-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          {jobs.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {jobs.map((job: any) => {
                                const jp = job.progress || {};
                                const jobPct = typeof jp.percent === 'number' ? jp.percent : (job.status === 'completed' ? 100 : 0);
                                return (
                                  <div key={job.id} className="text-xs">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="text-slate-700 dark:text-slate-300 truncate">
                                        {job.file_name}
                                      </div>
                                      <div className="text-slate-500 dark:text-slate-400 shrink-0">
                                        {job.status}{typeof jobPct === 'number' ? ` • ${Math.round(jobPct)}%` : ''}
                                      </div>
                                    </div>
                                    {jp.message && (
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                        {jp.message}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {uploads.length} upload{uploads.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {uploads.map((upload) => (
                  <UploadHistoryCard
                    key={upload.id}
                    upload={upload}
                    onClick={() => handleUploadClick(upload.id!)}
                    onDelete={handleDeleteClick}
                  />
                ))}
              </div>
            </>
          )}
        </main>

        {/* Delete Confirmation Modal */}
        {deleteModalOpen && uploadToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    Delete Upload?
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    Are you sure you want to delete <strong>{uploadToDelete.upload_name}</strong>? This will permanently delete:
                  </p>
                  <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1 mb-4">
                    <li>• {uploadToDelete.document_count} document{uploadToDelete.document_count !== 1 ? 's' : ''}</li>
                    <li>• {uploadToDelete.total_transactions} transaction{uploadToDelete.total_transactions !== 1 ? 's' : ''}</li>
                    <li>• All associated files from storage</li>
                  </ul>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleDeleteCancel}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {deleting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    'Delete Upload'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
