'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import PlaidLinkButton from './PlaidLinkButton';
import ScreenshotHelpModal from './ScreenshotHelpModal';

interface Account {
  id: string;
  plaid_account_id: string;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  current_balance: number | null;
  available_balance: number | null;
  credit_limit: number | null;
  currency: string;
  last_synced_at: string | null;
}

interface Institution {
  id: string;
  institution_id: string | null;
  institution_name: string | null;
  status: string;
  created_at: string;
  accounts: Account[];
}

interface ConnectedAccountsProps {
  onSyncComplete?: () => void;
  onFileUpload?: (files: File[]) => void;
  isProcessing?: boolean;
}

export default function ConnectedAccounts({ onSyncComplete, onFileUpload, isProcessing = false }: ConnectedAccountsProps) {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect mobile on mount
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch connected accounts
  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch('/api/plaid/get-accounts');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch accounts');
      }

      setInstitutions(data.institutions || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load connected accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Sync transactions for an institution
  const handleSync = async (itemId: string) => {
    setSyncing(itemId);
    setError(null);

    try {
      const response = await fetch('/api/plaid/sync-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plaid_item_id: itemId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync transactions');
      }

      // Refresh accounts to update last_synced_at
      await fetchAccounts();
      onSyncComplete?.();
    } catch (err: any) {
      setError(err.message || 'Failed to sync transactions');
    } finally {
      setSyncing(null);
    }
  };

  // Refresh balances for an institution
  const handleRefreshBalance = async (itemId: string) => {
    setSyncing(itemId);
    setError(null);

    try {
      const response = await fetch('/api/plaid/refresh-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plaid_item_id: itemId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to refresh balances');
      }

      // Refresh accounts to show updated balances
      await fetchAccounts();
    } catch (err: any) {
      setError(err.message || 'Failed to refresh balances');
    } finally {
      setSyncing(null);
    }
  };

  // Disconnect an institution
  const handleDisconnect = async (itemId: string, institutionName: string) => {
    if (!confirm(`Are you sure you want to disconnect ${institutionName}? Your transaction history will be preserved.`)) {
      return;
    }

    setError(null);

    try {
      const response = await fetch('/api/plaid/remove-account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plaid_item_id: itemId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to disconnect account');
      }

      // Refresh accounts list
      await fetchAccounts();
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect account');
    }
  };

  // Format currency
  const formatCurrency = (amount: number | null, currency: string = 'USD') => {
    if (amount === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // File upload handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && onFileUpload) {
      onFileUpload(Array.from(files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && onFileUpload) {
      onFileUpload(Array.from(files));
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Get account type icon
  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'depository':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        );
      case 'credit':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        );
      case 'investment':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 text-slate-500">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading connected accounts...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Connect Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Connected Banks
        </h3>
        <PlaidLinkButton
          onSuccess={fetchAccounts}
          onError={(err) => setError(err)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Bank
        </PlaidLinkButton>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* No Accounts - Show upload area */}
      {institutions.length === 0 && (
        <div className="space-y-4">
          {/* Plaid empty state */}
          <div className="p-4 bg-slate-50 dark:bg-gray-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
            <svg className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Connect your bank for automatic sync
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">OR</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          </div>

          {/* Upload area */}
          <div
            onClick={handleUploadClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
              isDragOver
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <div className="flex flex-col items-center text-center">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                isDragOver 
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              
              {isProcessing ? (
                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {isMobile 
                      ? 'Tap to upload your bank statement or screenshot'
                      : 'Drag & drop your bank statement or screenshot'
                    }
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isMobile ? 'or take a photo' : 'or click to browse'}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Help link */}
          <button
            onClick={() => setShowHelpModal(true)}
            className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors mx-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Help me get this info?
          </button>
        </div>
      )}

      {/* Screenshot Help Modal */}
      <ScreenshotHelpModal 
        isOpen={showHelpModal} 
        onClose={() => setShowHelpModal(false)} 
      />

      {/* Institution List */}
      {institutions.map((institution) => (
        <div
          key={institution.id}
          className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        >
          {/* Institution Header */}
          <div className="px-4 py-3 bg-slate-50 dark:bg-gray-800 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-slate-900 dark:text-white">
                  {institution.institution_name || 'Unknown Bank'}
                </h4>
                <p className="text-xs text-slate-500">
                  {institution.accounts.length} account{institution.accounts.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSync(institution.id)}
                disabled={syncing === institution.id}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                title="Sync transactions"
              >
                {syncing === institution.id ? (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => handleRefreshBalance(institution.id)}
                disabled={syncing === institution.id}
                className="p-2 text-slate-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh balances"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button
                onClick={() => handleDisconnect(institution.id, institution.institution_name || 'this bank')}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Disconnect"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Accounts List */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {institution.accounts.map((account) => (
              <div key={account.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-slate-400 dark:text-slate-500">
                    {getAccountIcon(account.type)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white text-sm">
                      {account.name}
                      {account.mask && (
                        <span className="text-slate-400 ml-1">••{account.mask}</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 capitalize">
                      {account.subtype || account.type}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-slate-900 dark:text-white text-sm">
                    {formatCurrency(account.current_balance, account.currency)}
                  </p>
                  {account.available_balance !== null && account.available_balance !== account.current_balance && (
                    <p className="text-xs text-slate-500">
                      Available: {formatCurrency(account.available_balance, account.currency)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Last Synced Footer */}
          <div className="px-4 py-2 bg-slate-50 dark:bg-gray-800 border-t border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500">
              Last synced: {formatDate(institution.accounts[0]?.last_synced_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

