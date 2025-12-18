'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import AuthGuard from '@/components/AuthGuard';
import UploadHistoryCard from '@/components/UploadHistoryCard';
import { UploadWithStats } from '@/lib/supabase';

export default function UploadsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [uploads, setUploads] = useState<UploadWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUploads = async () => {
      if (!user?.id) return;

      try {
        const res = await fetch(`/api/uploads?userId=${user.id}`);
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

  const handleUploadClick = (uploadId: string) => {
    router.push(`/uploads/${uploadId}`);
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
                  />
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
