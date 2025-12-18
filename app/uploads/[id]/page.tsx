'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import AuthGuard from '@/components/AuthGuard';
import DocumentViewer from '@/components/DocumentViewer';
import TransactionsList from '@/components/TransactionsList';
import { UploadDetails, DocumentWithTransactions } from '@/lib/supabase';

export default function UploadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const uploadId = params.id as string;
  const { user } = useAuth();

  const [uploadDetails, setUploadDetails] = useState<UploadDetails | null>(null);
  const [selectedDocIndex, setSelectedDocIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const fetchUploadDetails = async () => {
      if (!user?.id || !uploadId) return;

      try {
        const res = await fetch(`/api/uploads/${uploadId}?userId=${user.id}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('Upload not found');
          }
          throw new Error('Failed to fetch upload details');
        }
        const data = await res.json();
        setUploadDetails(data);
      } catch (err: any) {
        console.error('Error fetching upload details:', err);
        setError(err.message || 'Failed to load upload');
      } finally {
        setLoading(false);
      }
    };

    fetchUploadDetails();
  }, [user?.id, uploadId]);

  const handleDelete = async () => {
    if (!user?.id || !uploadId) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/uploads/${uploadId}?userId=${user.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete upload');
      }

      // Navigate back to uploads list
      router.push('/uploads');
    } catch (err: any) {
      console.error('Error deleting upload:', err);
      setError(err.message || 'Failed to delete upload');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const selectedDocument: DocumentWithTransactions | undefined = 
    uploadDetails?.documents?.[selectedDocIndex];

  const formatDate = (dateString: string | Date | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col">
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/uploads')}
                  className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span className="hidden sm:inline">Back</span>
                </button>
              </div>

              {!loading && uploadDetails && (
                <div className="text-center flex-1">
                  <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {uploadDetails.upload.upload_name}
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(uploadDetails.upload.uploaded_at)}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={loading || isDeleting}
                  className="flex items-center gap-2 px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span className="hidden sm:inline">Undo Upload</span>
                </button>
              </div>
            </div>

            {/* Document selector (if multiple documents) */}
            {uploadDetails && uploadDetails.documents.length > 1 && (
              <div className="mt-4">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Select Document
                </label>
                <select
                  value={selectedDocIndex}
                  onChange={(e) => setSelectedDocIndex(Number(e.target.value))}
                  className="w-full sm:w-auto px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {uploadDetails.documents.map((doc, index) => (
                    <option key={doc.id} value={index}>
                      {doc.file_name} ({doc.transactions.length} transactions)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
          {loading ? (
            // Loading skeleton
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
              <div className="bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          ) : error ? (
            // Error state
            <div className="flex flex-col items-center justify-center py-16">
              <svg className="w-16 h-16 text-red-300 dark:text-red-800 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-red-600 dark:text-red-400 text-lg mb-4">{error}</p>
              <button
                onClick={() => router.push('/uploads')}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
              >
                Back to Uploads
              </button>
            </div>
          ) : !selectedDocument ? (
            // No document state
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-slate-600 dark:text-slate-400">No documents found in this upload</p>
            </div>
          ) : (
            // Side-by-side layout
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)] lg:h-[calc(100vh-180px)]">
              {/* Left panel: Document viewer */}
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col min-h-[400px] lg:min-h-0">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                  <h2 className="font-medium text-slate-900 dark:text-white text-sm truncate">
                    {selectedDocument.file_name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {selectedDocument.source_type === 'screenshot' ? 'Screenshot' : 'Statement'}
                  </p>
                </div>
                <div className="flex-1 p-4 overflow-auto">
                  <DocumentViewer
                    fileUrl={selectedDocument.file_url}
                    fileName={selectedDocument.file_name}
                    className="h-full min-h-[300px]"
                  />
                </div>
              </div>

              {/* Right panel: Transactions list */}
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col min-h-[400px] lg:min-h-0">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                  <h2 className="font-medium text-slate-900 dark:text-white text-sm">
                    Transactions
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {selectedDocument.transactions.length} extracted from this document
                  </p>
                </div>
                <div className="flex-1 p-4 overflow-auto">
                  <TransactionsList
                    transactions={selectedDocument.transactions}
                    currency="USD"
                  />
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Delete confirmation modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Undo Upload?
                </h3>
              </div>

              <p className="text-slate-600 dark:text-slate-400 mb-6">
                This will permanently delete{' '}
                <strong>{uploadDetails?.documents.length || 0} file{(uploadDetails?.documents.length || 0) !== 1 ? 's' : ''}</strong>{' '}
                and{' '}
                <strong>
                  {uploadDetails?.documents.reduce((sum, d) => sum + d.transactions.length, 0) || 0} transaction
                  {(uploadDetails?.documents.reduce((sum, d) => sum + d.transactions.length, 0) || 0) !== 1 ? 's' : ''}
                </strong>
                . This action cannot be undone.
              </p>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isDeleting ? (
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
