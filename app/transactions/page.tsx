'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import AuthGuard from '@/components/AuthGuard';
import { Transaction, Account } from '@/lib/supabase';
import UserMenu from '@/components/UserMenu';

interface TransactionsResponse {
  transactions: Transaction[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  totals: {
    income: number;
    expenses: number;
    net: number;
  };
}

interface Category {
  id: string;
  name: string;
  category_type?: string;
}

export default function TransactionsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Data state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Totals state
  const [totals, setTotals] = useState({ income: 0, expenses: 0, net: 0 });

  // Filter state
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [uncategorizedOnly, setUncategorizedOnly] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Selection state
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Bulk action state
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'category' | 'type' | 'account' | null>(null);
  const [bulkActionValue, setBulkActionValue] = useState('');
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Filter dropdowns visibility
  const [showAccountFilter, setShowAccountFilter] = useState(false);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  // Sort state
  type SortColumn = 'merchant' | 'account_name' | 'category' | 'date' | 'amount';
  const [sortBy, setSortBy] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Currency formatting
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  }, []);

  // Generate month options (last 24 months)
  const monthOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    const now = new Date();
    
    for (let i = 0; i < 24; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      options.push({ value, label });
    }
    
    return options;
  }, []);

  // Handle month selection
  const handleMonthChange = useCallback((monthValue: string) => {
    setSelectedMonth(monthValue);
    
    if (!monthValue) {
      // Clear date filters when "All time" is selected
      setStartDate('');
      setEndDate('');
      return;
    }
    
    // Parse the month value (YYYY-MM) and set start/end dates
    const [year, month] = monthValue.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0); // Last day of month
    
    setStartDate(startOfMonth.toISOString().split('T')[0]);
    setEndDate(endOfMonth.toISOString().split('T')[0]);
  }, []);

  // Filtered and sorted categories for the dropdown
  const filteredSortedCategories = useMemo(() => {
    return categories
      .filter(c => c.category_type !== 'income') // Exclude income categories
      .filter(c => 
        !categorySearchQuery || 
        c.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
      )
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
  }, [categories, categorySearchQuery]);

  // Fetch accounts
  useEffect(() => {
    if (!user?.id) return;

    const fetchAccounts = async () => {
      try {
        const response = await fetch(`/api/accounts?userId=${user.id}`);
        const data = await response.json();
        if (data.accounts) {
          setAccounts(data.accounts);
        }
      } catch (err) {
        console.error('Failed to fetch accounts:', err);
      }
    };

    fetchAccounts();
  }, [user?.id]);

  // Fetch categories
  useEffect(() => {
    if (!user?.id) return;

    const fetchCategories = async () => {
      try {
        const response = await fetch(`/api/budget/categories?userId=${user.id}`);
        const data = await response.json();
        if (data.categories) {
          setCategories(data.categories);
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    };

    fetchCategories();
  }, [user?.id]);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        userId: user.id,
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortDirection,
      });

      if (selectedAccountIds.length > 0) {
        params.set('accountIds', selectedAccountIds.join(','));
      }
      if (startDate) {
        params.set('startDate', startDate);
      }
      if (endDate) {
        params.set('endDate', endDate);
      }
      if (selectedTypes.length > 0) {
        params.set('transactionTypes', selectedTypes.join(','));
      }
      if (uncategorizedOnly) {
        params.set('uncategorizedOnly', 'true');
      }
      if (selectedCategories.length > 0) {
        params.set('categories', selectedCategories.join(','));
      }
      if (searchQuery) {
        params.set('searchQuery', searchQuery);
      }

      const response = await fetch(`/api/transactions?${params}`);
      const data: TransactionsResponse = await response.json();

      if (response.ok) {
        setTransactions(data.transactions);
        setTotalCount(data.pagination.totalCount);
        setTotalPages(data.pagination.totalPages);
        setTotals(data.totals);
      } else {
        setError((data as any).error || 'Failed to fetch transactions');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  }, [user?.id, page, pageSize, selectedAccountIds, startDate, endDate, selectedTypes, uncategorizedOnly, selectedCategories, searchQuery, sortBy, sortDirection]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Reset page when filters or sort change
  useEffect(() => {
    setPage(1);
    setSelectedTransactionIds(new Set());
    setSelectAll(false);
  }, [selectedAccountIds, startDate, endDate, selectedTypes, uncategorizedOnly, selectedCategories, searchQuery, sortBy, sortDirection]);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedTransactionIds(new Set());
    } else {
      setSelectedTransactionIds(new Set(transactions.map(t => t.id!).filter(Boolean)));
    }
    setSelectAll(!selectAll);
  }, [selectAll, transactions]);

  // Handle individual selection
  const handleSelectTransaction = useCallback((transactionId: string) => {
    setSelectedTransactionIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  }, []);

  // Show bulk actions when items are selected
  useEffect(() => {
    setShowBulkActions(selectedTransactionIds.size > 0);
  }, [selectedTransactionIds.size]);

  // Handle bulk action
  const handleBulkAction = async () => {
    if (!user?.id || selectedTransactionIds.size === 0 || !bulkActionType || !bulkActionValue) {
      return;
    }

    setBulkActionLoading(true);

    try {
      const actionMap = {
        category: 'update_category',
        type: 'update_type',
        account: 'update_account',
      };

      const response = await fetch('/api/transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: Array.from(selectedTransactionIds),
          action: actionMap[bulkActionType],
          value: bulkActionValue,
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Refresh transactions
        await fetchTransactions();
        // Clear selection
        setSelectedTransactionIds(new Set());
        setSelectAll(false);
        setBulkActionType(null);
        setBulkActionValue('');
      } else {
        setError(data.error || 'Failed to update transactions');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update transactions');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!user?.id || selectedTransactionIds.size === 0) {
      return;
    }

    setDeleteLoading(true);

    try {
      const response = await fetch('/api/transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: Array.from(selectedTransactionIds),
          action: 'delete',
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Refresh transactions
        await fetchTransactions();
        // Clear selection
        setSelectedTransactionIds(new Set());
        setSelectAll(false);
        setShowDeleteConfirm(false);
      } else {
        setError(data.error || 'Failed to delete transactions');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete transactions');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedAccountIds([]);
    setSelectedMonth('');
    setStartDate('');
    setEndDate('');
    setSelectedTypes([]);
    setUncategorizedOnly(false);
    setSelectedCategories([]);
    setSearchQuery('');
  };

  // Handle column sort
  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      // Toggle direction if clicking the same column
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column with default descending order (except for merchant which defaults to asc)
      setSortBy(column);
      setSortDirection(column === 'merchant' ? 'asc' : 'desc');
    }
  };

  // Sort indicator component
  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortBy !== column) {
      return (
        <svg className="w-4 h-4 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  // Format date for display
  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Show loading or redirect
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <AuthGuard>
      <main className="flex flex-col h-screen bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
        {/* Top Bar */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
                A
              </div>
              <h1 className="font-semibold text-lg tracking-tight">Adphex</h1>
            </Link>
            <span className="text-slate-300 dark:text-slate-600 mx-2">/</span>
            <span className="text-slate-600 dark:text-slate-400 font-medium">Transactions</span>
          </div>
          
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <UserMenu />
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Total Income</p>
                    <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(totals.income)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Total Expenses</p>
                    <p className="text-xl font-semibold text-red-600 dark:text-red-400">
                      {formatCurrency(totals.expenses)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    totals.net >= 0 
                      ? 'bg-blue-100 dark:bg-blue-900/30' 
                      : 'bg-amber-100 dark:bg-amber-900/30'
                  }`}>
                    <svg className={`w-5 h-5 ${
                      totals.net >= 0 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-amber-600 dark:text-amber-400'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Net</p>
                    <p className={`text-xl font-semibold ${
                      totals.net >= 0 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {totals.net >= 0 ? '+' : ''}{formatCurrency(totals.net)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search merchant or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {/* Month Selector */}
                <select
                  value={selectedMonth}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className={`px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer ${
                    selectedMonth
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                      : 'bg-slate-50 dark:bg-gray-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <option value="">All time</option>
                  {monthOptions.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>

                {/* Custom Date Range */}
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setSelectedMonth(''); // Clear month selection when manually changing dates
                    }}
                    className="px-3 py-2 text-sm bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <span className="text-slate-400">to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setSelectedMonth(''); // Clear month selection when manually changing dates
                    }}
                    className="px-3 py-2 text-sm bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {/* Account Filter */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowAccountFilter(!showAccountFilter);
                      setShowCategoryFilter(false);
                    }}
                    className={`px-3 py-2 text-sm border rounded-lg flex items-center gap-2 transition-colors ${
                      selectedAccountIds.length > 0
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                        : 'bg-slate-50 dark:bg-gray-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Account {selectedAccountIds.length > 0 && `(${selectedAccountIds.length})`}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showAccountFilter && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
                      <div className="p-2">
                        {accounts.length === 0 ? (
                          <p className="text-sm text-slate-500 dark:text-slate-400 p-2">No accounts found</p>
                        ) : (
                          accounts.map(account => (
                            <label
                              key={account.id}
                              className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedAccountIds.includes(account.id!)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedAccountIds([...selectedAccountIds, account.id!]);
                                  } else {
                                    setSelectedAccountIds(selectedAccountIds.filter(id => id !== account.id));
                                  }
                                }}
                                className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                                {account.display_name}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Type Filter */}
                <div className="flex items-center gap-1">
                  {(['expense', 'income', 'transfer'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => {
                        if (selectedTypes.includes(type)) {
                          setSelectedTypes(selectedTypes.filter(t => t !== type));
                        } else {
                          setSelectedTypes([...selectedTypes, type]);
                        }
                      }}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                        selectedTypes.includes(type)
                          ? type === 'expense' 
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                            : type === 'income'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          : 'bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Uncategorized Filter */}
                <button
                  onClick={() => setUncategorizedOnly(!uncategorizedOnly)}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    uncategorizedOnly
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : 'bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  Uncategorized
                </button>

                {/* Category Filter */}
                <div className="relative">
                  <button
                    onClick={() => {
                      const newState = !showCategoryFilter;
                      setShowCategoryFilter(newState);
                      setShowAccountFilter(false);
                      if (!newState) {
                        setCategorySearchQuery(''); // Clear search when closing
                      }
                    }}
                    disabled={uncategorizedOnly}
                    className={`px-3 py-2 text-sm border rounded-lg flex items-center gap-2 transition-colors ${
                      uncategorizedOnly
                        ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-gray-800 border-slate-200 dark:border-slate-700 text-slate-400'
                        : selectedCategories.length > 0
                          ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                          : 'bg-slate-50 dark:bg-gray-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Category {selectedCategories.length > 0 && `(${selectedCategories.length})`}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showCategoryFilter && !uncategorizedOnly && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-20">
                      {/* Search input */}
                      <div className="p-2 border-b border-slate-200 dark:border-slate-700">
                        <div className="relative">
                          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <input
                            type="text"
                            placeholder="Search categories..."
                            value={categorySearchQuery}
                            onChange={(e) => setCategorySearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            autoFocus
                          />
                        </div>
                      </div>
                      {/* Category list */}
                      <div className="p-2 max-h-48 overflow-y-auto">
                        {categories.length === 0 ? (
                          <p className="text-sm text-slate-500 dark:text-slate-400 p-2">No categories found</p>
                        ) : filteredSortedCategories.length === 0 ? (
                          <p className="text-sm text-slate-500 dark:text-slate-400 p-2">No matching categories</p>
                        ) : (
                          filteredSortedCategories.map(category => (
                            <label
                              key={category.id}
                              className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedCategories.includes(category.name)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCategories([...selectedCategories, category.name]);
                                  } else {
                                    setSelectedCategories(selectedCategories.filter(c => c !== category.name));
                                  }
                                }}
                                className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                                {category.name}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Clear Filters */}
                {(selectedAccountIds.length > 0 || selectedMonth || startDate || endDate || selectedTypes.length > 0 || uncategorizedOnly || selectedCategories.length > 0 || searchQuery) && (
                  <button
                    onClick={clearFilters}
                    className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Bulk Actions Bar */}
            {showBulkActions && (
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    {selectedTransactionIds.size} selected
                  </span>

                  <div className="flex items-center gap-2">
                    {/* Re-assign Category */}
                    <div className="flex items-center gap-2">
                      <select
                        value={bulkActionType === 'category' ? bulkActionValue : ''}
                        onChange={(e) => {
                          setBulkActionType('category');
                          setBulkActionValue(e.target.value);
                        }}
                        className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="">Re-assign category...</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Mark as Type */}
                    <select
                      value={bulkActionType === 'type' ? bulkActionValue : ''}
                      onChange={(e) => {
                        setBulkActionType('type');
                        setBulkActionValue(e.target.value);
                      }}
                      className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">Mark as...</option>
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                      <option value="transfer">Transfer</option>
                    </select>

                    {/* Re-assign Account */}
                    <select
                      value={bulkActionType === 'account' ? bulkActionValue : ''}
                      onChange={(e) => {
                        setBulkActionType('account');
                        setBulkActionValue(e.target.value);
                      }}
                      className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">Re-assign account...</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.display_name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Apply Button */}
                  {bulkActionType && bulkActionValue && (
                    <button
                      onClick={handleBulkAction}
                      disabled={bulkActionLoading}
                      className="px-4 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {bulkActionLoading ? 'Applying...' : 'Apply'}
                    </button>
                  )}

                  {/* Separator */}
                  <div className="w-px h-6 bg-blue-200 dark:bg-blue-700"></div>

                  {/* Delete Button */}
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>

                  {/* Clear Selection */}
                  <button
                    onClick={() => {
                      setSelectedTransactionIds(new Set());
                      setSelectAll(false);
                      setBulkActionType(null);
                      setBulkActionValue('');
                    }}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Clear selection
                  </button>
                </div>
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-xl max-w-md w-full mx-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      Delete Transactions
                    </h3>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 mb-6">
                    Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-white">{selectedTransactionIds.size}</span> transaction{selectedTransactionIds.size !== 1 ? 's' : ''}? This action cannot be undone.
                  </p>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleteLoading}
                      className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleteLoading}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {deleteLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Deleting...
                        </>
                      ) : (
                        'Delete'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            {/* Transactions Table */}
            <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <svg className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">No transactions found</p>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Try adjusting your filters</p>
                </div>
              ) : (
                <>
                  {/* Table Header */}
                  <div className="grid grid-cols-[40px_1fr_140px_140px_140px_100px] gap-4 px-4 py-3 bg-slate-50 dark:bg-gray-900 border-b border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={() => handleSort('merchant')}
                      className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-left"
                    >
                      Transaction
                      <SortIndicator column="merchant" />
                    </button>
                    <button
                      onClick={() => handleSort('account_name')}
                      className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-left"
                    >
                      Account
                      <SortIndicator column="account_name" />
                    </button>
                    <button
                      onClick={() => handleSort('category')}
                      className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-left"
                    >
                      Category
                      <SortIndicator column="category" />
                    </button>
                    <button
                      onClick={() => handleSort('date')}
                      className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-left"
                    >
                      Date
                      <SortIndicator column="date" />
                    </button>
                    <button
                      onClick={() => handleSort('amount')}
                      className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors justify-end w-full"
                    >
                      Amount
                      <SortIndicator column="amount" />
                    </button>
                  </div>

                  {/* Table Body */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {transactions.map((txn) => {
                      const isExpense = txn.transaction_type === 'expense' || (txn.amount < 0 && txn.transaction_type !== 'income');
                      const isIncome = txn.transaction_type === 'income' || (txn.amount > 0 && txn.transaction_type !== 'expense');
                      const isTransfer = txn.transaction_type === 'transfer';
                      const isSelected = txn.id ? selectedTransactionIds.has(txn.id) : false;

                      return (
                        <div
                          key={txn.id}
                          className={`grid grid-cols-[40px_1fr_140px_140px_140px_100px] gap-4 px-4 py-3 items-center hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors ${
                            isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => txn.id && handleSelectTransaction(txn.id)}
                              className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                            />
                          </div>

                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 dark:text-white text-sm truncate">
                              {txn.merchant}
                            </p>
                            {txn.description && txn.description !== txn.merchant && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {txn.description}
                              </p>
                            )}
                          </div>

                          <div className="text-sm text-slate-600 dark:text-slate-400 truncate">
                            {txn.account_name || '-'}
                          </div>

                          <div>
                            {txn.category ? (
                              <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded truncate max-w-full">
                                {txn.category}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500">Uncategorized</span>
                            )}
                          </div>

                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            {formatDate(txn.date)}
                          </div>

                          <div className={`text-sm font-medium text-right ${
                            isIncome
                              ? 'text-green-600 dark:text-green-400'
                              : isExpense
                                ? 'text-red-600 dark:text-red-400'
                                : isTransfer
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-slate-900 dark:text-white'
                          }`}>
                            {isIncome ? '+' : isExpense ? '-' : ''}{formatCurrency(Math.abs(txn.amount))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalCount)} of {totalCount} transactions
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}
