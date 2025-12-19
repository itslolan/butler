'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import AuthGuard from '@/components/AuthGuard';

export default function ProfilePage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteResult, setDeleteResult] = useState<{
    success: boolean;
    message: string;
    deletedCounts?: Record<string, number>;
  } | null>(null);

  const handleDeleteAllData = async () => {
    if (deleteConfirmText !== 'DELETE') {
      return;
    }

    setIsDeleting(true);
    setDeleteResult(null);

    try {
      const response = await fetch('/api/user/delete-data', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete data');
      }

      setDeleteResult({
        success: true,
        message: data.message,
        deletedCounts: data.deletedCounts,
      });

      // Reset states
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');

      // Reload the page after 2 seconds to clear all cached data
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);

    } catch (error: any) {
      setDeleteResult({
        success: false,
        message: error.message || 'An error occurred while deleting data',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
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
              Profile Settings
            </h1>
            <div className="w-24" />
          </div>
        </header>

        {/* Content */}
        <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          {/* User Info Card */}
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {user?.email || 'User'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Member since {formatDate(user?.created_at)}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Email</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
                </div>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">User ID</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">{user?.id}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => router.push('/uploads')}
                className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Upload History</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">View all uploaded files</p>
                </div>
              </button>

              <button
                onClick={() => router.push('/budget')}
                className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Budget</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Manage your budget</p>
                </div>
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
                Danger Zone
              </h3>
            </div>

            {/* Delete Result Message */}
            {deleteResult && (
              <div className={`mb-4 p-4 rounded-lg ${
                deleteResult.success 
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}>
                <p className={`font-medium ${
                  deleteResult.success 
                    ? 'text-green-800 dark:text-green-200' 
                    : 'text-red-800 dark:text-red-200'
                }`}>
                  {deleteResult.success ? '✓ ' : '✗ '}{deleteResult.message}
                </p>
                {deleteResult.deletedCounts && (
                  <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                    <p>Deleted:</p>
                    <ul className="list-disc list-inside ml-2">
                      {Object.entries(deleteResult.deletedCounts)
                        .filter(([_, count]) => count > 0)
                        .map(([key, count]) => (
                          <li key={key}>{count} {key.replace(/_/g, ' ')}</li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-lg">
                <h4 className="font-medium text-slate-900 dark:text-white mb-2">
                  Delete All Data
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  This will permanently delete all your data including transactions, documents, 
                  accounts, budgets, and uploaded files. This action cannot be undone.
                </p>

                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Delete All My Data
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                      Type <strong>DELETE</strong> to confirm:
                    </p>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="Type DELETE to confirm"
                      className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteConfirmText('');
                        }}
                        disabled={isDeleting}
                        className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteAllData}
                        disabled={isDeleting || deleteConfirmText !== 'DELETE'}
                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isDeleting ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Deleting...
                          </>
                        ) : (
                          'Confirm Delete'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <h4 className="font-medium text-slate-900 dark:text-white mb-2">
                  Sign Out
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Sign out of your account on this device.
                </p>
                <button
                  onClick={async () => {
                    await signOut();
                    router.push('/');
                  }}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium rounded-lg transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
