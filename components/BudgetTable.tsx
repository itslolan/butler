'use client';

import { useState, useEffect, useCallback } from 'react';

interface Category {
  id: string;
  name: string;
  superCategoryId: string;
  displayOrder?: number;
  isCustom: boolean;
  hasTransactions: boolean;
  budgeted: number;
  spent: number;
  available: number;
  lastMonthSpent?: number;
  // Pre-fill suggestions from API
  historicalAverage?: number;
  fixedExpenseAmount?: number;
  suggestedBudget?: number;
}

interface SuperCategory {
  id: string;
  name: string;
  displayOrder?: number;
  budgeted: number;
  spent: number;
  available: number;
  lastMonthSpent?: number;
  isOverride: boolean;
  categories: Category[];
}

interface BudgetTableProps {
  userId: string;
  month: string;
  onDataLoaded: (data: {
    income: number;
    incomeMonth?: string;
    totalBudgeted: number;
    readyToAssign: number;
    categories: Category[];
    superCategories: SuperCategory[];
    hasTransactions?: boolean;
    incomeStats?: { medianMonthlyIncome: number; monthsIncluded: number };
  } | null) => void;
  onBudgetChange: (data: {
    categories: Category[];
    superCategories: SuperCategory[];
    totalBudgeted: number;
    changedCategory?: { id: string; name: string; amount: number };
    changedSuperCategory?: { id: string; name: string; amount: number };
  }) => void;
  onCategoryAdded: () => void;
  onCategoryDeleted: () => void;
  budgetedOverrides?: Record<string, number> | null;
  isReadOnly?: boolean; // True for past months
}

export default function BudgetTable({
  userId,
  month,
  onDataLoaded,
  onBudgetChange,
  onCategoryAdded,
  onCategoryDeleted,
  budgetedOverrides = null,
  isReadOnly = false,
}: BudgetTableProps) {
  const [superCategories, setSuperCategories] = useState<SuperCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Add category modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Delete confirmation state
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [expandedSuperCategories, setExpandedSuperCategories] = useState<Record<string, boolean>>({});
  const [hasPreviousMonthData, setHasPreviousMonthData] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/budget?userId=${userId}&month=${month}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load budget data');
      }

      const data = await res.json();
      
      setSuperCategories(data.superCategories || []);
      setExpandedSuperCategories({});
      setHasPreviousMonthData(data.hasPreviousMonthData ?? false);
      onDataLoaded(data);
    } catch (err: any) {
      setError(err.message);
      onDataLoaded(null);
    } finally {
      setLoading(false);
    }
  }, [userId, month, onDataLoaded]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const flattenCategories = (groups: SuperCategory[]) =>
    groups.flatMap(group => group.categories);

  const emitBudgetChange = (
    updatedSuperCategories: SuperCategory[],
    changedCategory?: { id: string; name: string; amount: number },
    changedSuperCategory?: { id: string; name: string; amount: number }
  ) => {
    const totalBudgeted = updatedSuperCategories.reduce((sum, group) => sum + group.budgeted, 0);
    onBudgetChange({
      categories: flattenCategories(updatedSuperCategories),
      superCategories: updatedSuperCategories,
      totalBudgeted,
      changedCategory,
      changedSuperCategory,
    });
  };

  useEffect(() => {
    if (!budgetedOverrides) return;
    setSuperCategories(prev => prev.map(superCategory => {
      const updatedCategories = superCategory.categories.map(cat => {
        const overridden = budgetedOverrides[cat.id];
        if (overridden === undefined) return cat;
        return {
          ...cat,
          budgeted: overridden,
          available: overridden - cat.spent,
        };
      });
      const budgeted = updatedCategories.reduce((sum, cat) => sum + cat.budgeted, 0);
      const spent = updatedCategories.reduce((sum, cat) => sum + cat.spent, 0);
      return {
        ...superCategory,
        categories: updatedCategories,
        budgeted,
        spent,
        available: budgeted - spent,
        isOverride: false,
      };
    }));
  }, [budgetedOverrides]);

  const handleCategoryBudgetInput = (categoryId: string, value: string) => {
    const parsed = parseFloat(value);
    const numValue = Number.isFinite(parsed) ? roundCurrency(parsed) : 0;

    setSuperCategories(prev => {
      const updated = prev.map(superCategory => {
        const hasCategory = superCategory.categories.some(cat => cat.id === categoryId);
        if (!hasCategory) {
          return superCategory;
        }

        const updatedCategories = superCategory.categories.map(cat => {
          if (cat.id === categoryId) {
            return {
              ...cat,
              budgeted: numValue,
              available: numValue - cat.spent,
            };
          }
          return cat;
        });

        const budgeted = updatedCategories.reduce((sum, cat) => sum + cat.budgeted, 0);
        const spent = updatedCategories.reduce((sum, cat) => sum + cat.spent, 0);

        return {
          ...superCategory,
          categories: updatedCategories,
          budgeted,
          spent,
          available: budgeted - spent,
          isOverride: false,
        };
      });

      const changedCategory = updated
        .flatMap(group => group.categories)
        .find(cat => cat.id === categoryId);

      if (changedCategory) {
        emitBudgetChange(updated, {
          id: changedCategory.id,
          name: changedCategory.name,
          amount: numValue,
        });
      }

      return updated;
    });
  };

  const handleSuperCategoryBudgetInput = (superCategoryId: string, value: string) => {
    const parsed = parseFloat(value);
    const numValue = Number.isFinite(parsed) ? roundCurrency(parsed) : 0;

    setSuperCategories(prev => {
      const updated = prev.map(superCategory => {
        if (superCategory.id !== superCategoryId) {
          return superCategory;
        }

        const updatedCategories = superCategory.categories.map(cat => ({
          ...cat,
          budgeted: 0,
          available: 0 - cat.spent,
        }));

        const spent = updatedCategories.reduce((sum, cat) => sum + cat.spent, 0);

        return {
          ...superCategory,
          categories: updatedCategories,
          budgeted: numValue,
          spent,
          available: numValue - spent,
          isOverride: true,
        };
      });

      const changedSuperCategory = updated.find(group => group.id === superCategoryId);

      if (changedSuperCategory) {
        emitBudgetChange(updated, undefined, {
          id: changedSuperCategory.id,
          name: changedSuperCategory.name,
          amount: numValue,
        });
      }

      return updated;
    });
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    setAddingCategory(true);
    setAddError(null);

    try {
      const res = await fetch('/api/budget/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          name: newCategoryName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add category');
      }

      setNewCategoryName('');
      setShowAddModal(false);
      onCategoryAdded();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAddingCategory(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    setDeletingCategory(categoryId);
    setDeleteError(null);

    try {
      const res = await fetch(
        `/api/budget/categories?userId=${userId}&categoryId=${categoryId}`,
        { method: 'DELETE' }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete category');
      }

      onCategoryDeleted();
    } catch (err: any) {
      setDeleteError(err.message);
      // Clear error after 3 seconds
      setTimeout(() => setDeleteError(null), 3000);
    } finally {
      setDeletingCategory(null);
    }
  };

  const toggleSuperCategory = (superCategoryId: string) => {
    setExpandedSuperCategories(prev => ({
      ...prev,
      [superCategoryId]: !prev[superCategoryId],
    }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };
  const roundCurrency = (value: number) => Math.round(value * 100) / 100;

  const rows = superCategories.flatMap(superCategory => {
    const isExpanded = expandedSuperCategories[superCategory.id] ?? false;
    const items: Array<
      | { type: 'super'; superCategory: SuperCategory; isExpanded: boolean }
      | { type: 'category'; superCategory: SuperCategory; category: Category }
    > = [{ type: 'super', superCategory, isExpanded }];

    if (isExpanded) {
      superCategory.categories.forEach(category => {
        items.push({ type: 'category', superCategory, category });
      });
    }

    return items;
  });

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6">
        <p className="text-red-800 dark:text-red-200">{error}</p>
        <button
          onClick={fetchData}
          className="mt-3 text-sm text-red-600 dark:text-red-400 underline hover:text-red-800"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        <div className={`grid grid-cols-10 ${hasPreviousMonthData ? 'md:grid-cols-14' : 'md:grid-cols-12'} gap-2 md:gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider`}>
          <div className="col-span-4 md:col-span-5">Category</div>
          {hasPreviousMonthData && (
            <div className="hidden md:block md:col-span-2 text-right">Last Month</div>
          )}
          <div className="col-span-3 md:col-span-2 text-right">Budgeted</div>
          <div className="hidden md:block md:col-span-2 text-right">Spent</div>
          <div className="col-span-3 md:col-span-2 text-right">Available</div>
          <div className="hidden md:block md:col-span-1"></div>
        </div>
      </div>

      {/* Delete Error Toast */}
      {deleteError && (
        <div className="px-6 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <p className="text-sm text-red-800 dark:text-red-200">{deleteError}</p>
        </div>
      )}

      {/* Category Rows */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map(row => {
          if (row.type === 'super') {
            const budgeted = Number(row.superCategory.budgeted) || 0;
            const spent = Number(row.superCategory.spent) || 0;
            const available = Number(row.superCategory.available) || 0;

            return (
              <div
                key={`super-${row.superCategory.id}`}
                className="px-4 md:px-6 py-3 bg-slate-50/60 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <div className={`grid grid-cols-10 ${hasPreviousMonthData ? 'md:grid-cols-14' : 'md:grid-cols-12'} gap-2 md:gap-4 items-start`}>
                  {/* Super-category Name */}
                  <div className="col-span-4 md:col-span-5 flex items-center gap-2 pt-1.5">
                    <button
                      type="button"
                      onClick={() => toggleSuperCategory(row.superCategory.id)}
                      className="flex items-center justify-center w-5 h-5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                      aria-label={`${row.isExpanded ? 'Collapse' : 'Expand'} ${row.superCategory.name}`}
                    >
                      <svg
                        className={`w-3.5 h-3.5 transition-transform ${row.isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {row.superCategory.name}
                    </span>
                    {row.superCategory.isOverride && (
                      <span className="text-[10px] font-medium text-violet-600 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/30 px-1.5 py-0.5 rounded">
                        Override
                      </span>
                    )}
                  </div>

                  {/* Last Month (read-only) - Desktop only, conditional */}
                  {hasPreviousMonthData && (
                    <div className="hidden md:block md:col-span-2 text-right pt-1.5">
                      <span className="text-sm text-slate-500 dark:text-slate-500">
                        {formatCurrency(Number(row.superCategory.lastMonthSpent) || 0)}
                      </span>
                    </div>
                  )}

                  {/* Budgeted Input */}
                  <div className="col-span-3 md:col-span-2">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={budgeted ? budgeted.toFixed(2) : ''}
                        onChange={(e) => handleSuperCategoryBudgetInput(row.superCategory.id, e.target.value)}
                        placeholder="0.00"
                        disabled={isReadOnly}
                        className={`w-full pl-6 pr-2 py-1.5 text-sm text-right border rounded-lg focus:outline-none ${
                          isReadOnly 
                            ? 'bg-slate-100 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed' 
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Spent (read-only) - Desktop only */}
                  <div className="hidden md:block md:col-span-2 text-right pt-1.5">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {formatCurrency(spent)}
                    </span>
                  </div>

                  {/* Available */}
                  <div className="col-span-3 md:col-span-2 text-right pt-1.5">
                    <span
                      className={`text-sm font-semibold ${
                        available >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatCurrency(available)}
                    </span>
                  </div>

                  <div className="hidden md:block md:col-span-1"></div>
                </div>
              </div>
            );
          }

          const budgeted = Number(row.category.budgeted) || 0;
          const spent = Number(row.category.spent) || 0;
          const available = Number(row.category.available) || 0;

          return (
            <div
              key={row.category.id}
              className="px-4 md:px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
            >
              <div className={`grid grid-cols-10 ${hasPreviousMonthData ? 'md:grid-cols-14' : 'md:grid-cols-12'} gap-2 md:gap-4 items-start`}>
                {/* Category Name */}
                <div className="col-span-4 md:col-span-5 flex items-center gap-2 pt-1.5 pl-6">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {row.category.name}
                  </span>
                  {row.category.isCustom && (
                    <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                      Custom
                    </span>
                  )}
                </div>

                {/* Last Month (read-only) - Desktop only, conditional */}
                {hasPreviousMonthData && (
                  <div className="hidden md:block md:col-span-2 text-right pt-1.5">
                    <span className="text-sm text-slate-500 dark:text-slate-500">
                      {(row.category.lastMonthSpent ?? 0) > 0
                        ? formatCurrency(row.category.lastMonthSpent!)
                        : <span className="text-slate-300 dark:text-slate-600">—</span>
                      }
                    </span>
                  </div>
                )}

                {/* Budgeted Input */}
                <div className="col-span-3 md:col-span-2">
                  <div className="relative group/input">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={budgeted ? budgeted.toFixed(2) : ''}
                      onChange={(e) => handleCategoryBudgetInput(row.category.id, e.target.value)}
                      placeholder="0.00"
                      disabled={isReadOnly}
                      className={`w-full pl-6 pr-2 py-1.5 text-sm text-right border rounded-lg focus:outline-none ${
                        isReadOnly 
                          ? 'bg-slate-100 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed' 
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                      }`}
                    />
                    {/* Tooltip showing suggestion breakdown */}
                    {(!isReadOnly && (row.category.historicalAverage || row.category.fixedExpenseAmount) && budgeted > 0) ? (
                      <div className="absolute left-0 bottom-full mb-1 hidden group-hover/input:block z-10">
                        <div className="bg-slate-900 dark:bg-slate-700 text-white text-xs px-2 py-1.5 rounded shadow-lg whitespace-nowrap">
                          {(row.category.fixedExpenseAmount && row.category.fixedExpenseAmount > 0) ? (
                            <div>Fixed expenses: ${row.category.fixedExpenseAmount.toFixed(2)}</div>
                          ) : null}
                          {(row.category.historicalAverage && row.category.historicalAverage > 0) ? (
                            <div>Avg spent: ${row.category.historicalAverage.toFixed(2)}/mo</div>
                          ) : null}
                          {(row.category.suggestedBudget && row.category.suggestedBudget > 0 && budgeted !== row.category.suggestedBudget) ? (
                            <div className="font-semibold border-t border-slate-700 dark:border-slate-600 pt-1 mt-1">
                              Suggested: ${row.category.suggestedBudget.toFixed(2)}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Spent (read-only) - Desktop only */}
                <div className="hidden md:block md:col-span-2 text-right pt-1.5">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {formatCurrency(spent)}
                  </span>
                </div>

                {/* Available */}
                <div className="col-span-3 md:col-span-2 text-right pt-1.5">
                  <span
                    className={`text-sm font-medium ${
                      available >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {formatCurrency(available)}
                  </span>
                </div>

                {/* Actions */}
                <div className="hidden md:flex md:col-span-1 justify-end gap-1">
                  {/* Use Suggested button - show when user has changed from suggested and there's a different suggestion */}
                  {(!isReadOnly && row.category.suggestedBudget && row.category.suggestedBudget > 0 && 
                   budgeted !== row.category.suggestedBudget && Math.abs(budgeted - row.category.suggestedBudget) > 0.01) ? (
                    <button
                      onClick={() => handleCategoryBudgetInput(row.category.id, row.category.suggestedBudget!.toString())}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300 transition-all"
                      title={`Use suggested: $${row.category.suggestedBudget.toFixed(2)}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </button>
                  ) : null}
                  {(!isReadOnly && (row.category.isCustom || !row.category.hasTransactions)) ? (
                    <button
                      onClick={() => handleDeleteCategory(row.category.id)}
                      disabled={deletingCategory === row.category.id}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all disabled:opacity-50"
                      title="Delete category"
                    >
                      {deletingCategory === row.category.id ? (
                        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Category Button - hidden in read-only mode */}
      {!isReadOnly && (
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Category
          </button>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Add New Category
            </h3>

            {addError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">{addError}</p>
              </div>
            )}

            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name..."
              className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCategory();
                if (e.key === 'Escape') setShowAddModal(false);
              }}
            />

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewCategoryName('');
                  setAddError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                disabled={!newCategoryName.trim() || addingCategory}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {addingCategory ? 'Adding...' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

