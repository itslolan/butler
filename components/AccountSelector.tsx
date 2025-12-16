'use client';

import { useState, useEffect } from 'react';
import { Account } from '@/lib/supabase';

interface AccountSelectorProps {
  accounts: Account[];
  onSelectExisting: (account: Account) => void;
  onCreateNew: (displayName: string, last4?: string) => void;
  isLoading?: boolean;
  transactionCount?: number;
  dateRange?: { start?: string; end?: string };
}

export default function AccountSelector({
  accounts,
  onSelectExisting,
  onCreateNew,
  isLoading = false,
  transactionCount,
  dateRange,
}: AccountSelectorProps) {
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountLast4, setNewAccountLast4] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__new__') {
      setMode('create');
      setSelectedAccountId('');
    } else {
      setMode('select');
      setSelectedAccountId(value);
    }
  };

  const handleSubmit = () => {
    if (mode === 'select' && selectedAccount) {
      setShowConfirmation(true);
    } else if (mode === 'create' && newAccountName.trim()) {
      setShowConfirmation(true);
    }
  };

  const handleConfirm = () => {
    if (mode === 'select' && selectedAccount) {
      onSelectExisting(selectedAccount);
    } else if (mode === 'create' && newAccountName.trim()) {
      onCreateNew(newAccountName.trim(), newAccountLast4.trim() || undefined);
    }
    setShowConfirmation(false);
  };

  const formatDateRange = () => {
    if (!dateRange?.start && !dateRange?.end) return null;
    const format = (d: string) => new Date(d).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    if (dateRange.start && dateRange.end) {
      return `${format(dateRange.start)} - ${format(dateRange.end)}`;
    }
    return dateRange.start ? `From ${format(dateRange.start)}` : `Until ${format(dateRange.end!)}`;
  };

  // Confirmation dialog
  if (showConfirmation) {
    const accountDisplay = mode === 'select' 
      ? selectedAccount?.display_name 
      : `${newAccountName}${newAccountLast4 ? ` (****${newAccountLast4})` : ''}`;
    
    return (
      <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h4 className="font-semibold text-slate-900 dark:text-white">Confirm Account Assignment</h4>
        </div>
        
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Map <strong>{transactionCount || 'all'} transaction{transactionCount !== 1 ? 's' : ''}</strong> to:
        </p>
        
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 mb-4">
          <p className="font-medium text-slate-900 dark:text-white">{accountDisplay}</p>
          {mode === 'create' && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              This will create a new account
            </p>
          )}
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowConfirmation(false)}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Assigning...
              </>
            ) : (
              'Confirm'
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <h4 className="font-semibold text-slate-900 dark:text-white">Account Selection Required</h4>
      </div>

      {/* Transaction info */}
      {(transactionCount || dateRange) && (
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 mb-4 text-sm">
          {transactionCount && (
            <p className="text-slate-700 dark:text-slate-300">
              <strong>{transactionCount}</strong> transaction{transactionCount !== 1 ? 's' : ''} found
            </p>
          )}
          {formatDateRange() && (
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              {formatDateRange()}
            </p>
          )}
        </div>
      )}

      {/* Account dropdown */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Which account do these transactions belong to?
        </label>
        <select
          value={mode === 'create' ? '__new__' : selectedAccountId}
          onChange={handleSelectChange}
          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        >
          <option value="">Select an account...</option>
          {accounts.map(account => (
            <option key={account.id} value={account.id}>
              {account.display_name}
              {account.account_number_last4 && ` (****${account.account_number_last4})`}
            </option>
          ))}
          <option value="__new__">➕ Create new account...</option>
        </select>
      </div>

      {/* Create new account form */}
      {mode === 'create' && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <strong className="text-slate-900 dark:text-white">Don&apos;t see your account?</strong> Enter a name below.
          </p>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Account Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="e.g., My Checking, Chase Card"
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Last 4 Digits <span className="text-slate-400">(recommended)</span>
            </label>
            <input
              type="text"
              value={newAccountLast4}
              onChange={(e) => setNewAccountLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="e.g., 1234"
              maxLength={4}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              💡 <strong>Tip:</strong> Including the last 4 digits helps match transactions when you upload bank statements later.
            </p>
          </div>
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={
          isLoading || 
          (mode === 'select' && !selectedAccountId) || 
          (mode === 'create' && !newAccountName.trim())
        }
        className="w-full mt-4 px-4 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {mode === 'select' ? 'Assign to Selected Account' : 'Create Account & Assign'}
      </button>
    </div>
  );
}

