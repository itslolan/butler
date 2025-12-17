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

  // Calculate total connected accounts
  const totalAccounts = institutions.reduce((sum, inst) => sum + inst.accounts.length, 0);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Bring your data
        </h3>
        {institutions.length > 0 && (
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            {totalAccounts} connected
          </span>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-800 dark:text-red-200">
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

      <div className="grid grid-cols-2 gap-2">
        {/* Connect Bank Button */}
        <PlaidLinkButton
          onSuccess={fetchAccounts}
          onError={(err) => setError(err)}
          className="w-full relative group flex flex-col items-center justify-center gap-2 p-3 h-28 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-2xl transition-all shadow-sm hover:shadow-md border border-blue-500/20 overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 transition-colors" />
          <div className="relative p-2 bg-white/20 rounded-xl backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
          </div>
          <div className="relative text-center">
            <span className="block text-xs font-bold tracking-wide">Connect Bank</span>
            <span className="block text-[10px] text-blue-100 mt-0.5 font-medium">Automatic sync</span>
          </div>
        </PlaidLinkButton>

        {/* Upload Button */}
        <button
          onClick={handleUploadClick}
          disabled={isProcessing}
          className="w-full relative group flex flex-col items-center justify-center gap-2 p-3 h-28 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300 rounded-2xl transition-all shadow-sm hover:shadow-md border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500/50 overflow-hidden"
        >
          {/* Badge */}
          <div className="absolute top-0 right-0 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-bl-xl border-l border-b border-blue-100 dark:border-blue-800">
            <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">AI Powered</span>
          </div>

          {isProcessing ? (
            <div className="flex flex-col items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">Processing...</span>
            </div>
          ) : (
            <>
              <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl group-hover:scale-110 transition-transform duration-300 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-600 dark:group-hover:text-blue-400 mt-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div className="text-center">
                <span className="block text-xs font-bold">Upload Statements</span>
                <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium leading-tight">
                  Supports PDF &<br/>Screenshots
                </span>
              </div>
            </>
          )}
        </button>
      </div>

      {/* Help Modal */}
      <ScreenshotHelpModal 
        isOpen={showHelpModal} 
        onClose={() => setShowHelpModal(false)} 
      />
    </div>
  );
}

