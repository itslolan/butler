'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import UserMenu from '@/components/UserMenu';
import ChatInterface from '@/components/ChatInterface';
import MobileChatModal from '@/components/MobileChatModal';
import BudgetTable from '@/components/BudgetTable';
import ReadyToAssign from '@/components/ReadyToAssign';
import EstimatedIncomeInput from '@/components/EstimatedIncomeInput';
import { useAuth } from '@/components/AuthProvider';

export default function BudgetPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const chatInterfaceRef = useRef<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Listen for budget updates from chat
  useEffect(() => {
    const handleBudgetUpdate = (event: CustomEvent) => {
      // Refresh budget data when chat makes changes
      setRefreshKey(prev => prev + 1);
      
      // Show a toast notification
      setSaveMessage({ type: 'success', text: 'Budget updated from chat' });
      setTimeout(() => setSaveMessage(null), 3000);
    };

    window.addEventListener('budgetUpdated', handleBudgetUpdate as EventListener);
    
    return () => {
      window.removeEventListener('budgetUpdated', handleBudgetUpdate as EventListener);
    };
  }, []);

  // Get current month in YYYY-MM format
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const currentMonth = getCurrentMonth();

  // Budget data state
  const [budgetData, setBudgetData] = useState<{
    income: number;
    incomeMonth?: string;
    totalBudgeted: number;
    readyToAssign: number;
    categories: Array<{
      id: string;
      name: string;
      superCategoryId: string;
      isCustom: boolean;
      budgeted: number;
      spent: number;
      available: number;
    }>;
    superCategories: Array<{
      id: string;
      name: string;
      budgeted: number;
      spent: number;
      available: number;
      isOverride: boolean;
      categories: Array<{
        id: string;
        name: string;
        superCategoryId: string;
        isCustom: boolean;
        budgeted: number;
        spent: number;
        available: number;
      }>;
    }>;
  } | null>(null);
  
  // Meta state for additional context (from remote changes)
  const [budgetMeta, setBudgetMeta] = useState<{
    hasTransactions: boolean;
    incomeStats?: { medianMonthlyIncome: number; monthsIncluded: number };
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Track if AI has assigned budgets (to show "Re-assign" instead of "Auto Assign")
  const [hasAiAssigned, setHasAiAssigned] = useState(false);
  
  // Track if there are unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  
  // Budgeted amounts override (from AI auto-assign, before saving)
  const [budgetedOverrides, setBudgetedOverrides] = useState<Record<string, number> | null>(null);
  
  // Track user-manually-set budget amounts (to preserve during AI auto-assign)
  const [userSetBudgets, setUserSetBudgets] = useState<Record<string, number>>({});
  
  const handleBudgetDataLoaded = useCallback((data: typeof budgetData) => {
    if (!data) {
      setBudgetData(null);
      setBudgetMeta(null);
      return;
    }

    // Pull meta fields (if present) without polluting the budgetData shape
    const anyData: any = data;
    if (typeof anyData.hasTransactions === 'boolean' || anyData.incomeStats) {
      setBudgetMeta({
        hasTransactions: Boolean(anyData.hasTransactions),
        incomeStats: anyData.incomeStats,
      });
    }

    // The API now handles income priority (median > month-specific)
    // We just use what the API sends us
    const effectiveIncome = anyData.income || 0;
    const effectiveReadyToAssign = anyData.readyToAssign;

    setBudgetData({
      income: effectiveIncome,
      incomeMonth: anyData.incomeMonth || currentMonth,
      totalBudgeted: anyData.totalBudgeted,
      readyToAssign: effectiveReadyToAssign,
      categories: anyData.categories,
      superCategories: anyData.superCategories || [],
    });

    // Check if any categories have pre-filled suggested budgets (indicating unsaved changes)
    const hasPreFilledBudgets = anyData.categories.some((cat: any) => 
      cat.budgeted > 0 && cat.suggestedBudget > 0 && 
      Math.abs(cat.budgeted - cat.suggestedBudget) < 0.01
    );
    
    // Mark as having unsaved changes if we have pre-filled budgets
    if (hasPreFilledBudgets && anyData.totalBudgeted > 0) {
      setHasUnsavedChanges(true);
    }

    setIsInitialLoadComplete(true);
  }, [currentMonth]);

  const handleBudgetChange = useCallback((update: {
    categories: Array<{
      id: string;
      name: string;
      superCategoryId: string;
      isCustom: boolean;
      budgeted: number;
      spent: number;
      available: number;
    }>;
    superCategories: Array<{
      id: string;
      name: string;
      budgeted: number;
      spent: number;
      available: number;
      isOverride: boolean;
      categories: Array<{
        id: string;
        name: string;
        superCategoryId: string;
        isCustom: boolean;
        budgeted: number;
        spent: number;
        available: number;
      }>;
    }>;
    totalBudgeted: number;
    changedCategory?: { id: string; name: string; amount: number };
    changedSuperCategory?: { id: string; name: string; amount: number };
  }) => {
    if (!budgetData) return;

    setBudgetData({
      ...budgetData,
      categories: update.categories,
      superCategories: update.superCategories,
      totalBudgeted: update.totalBudgeted,
      readyToAssign: budgetData.income - update.totalBudgeted,
    });
    
    if (update.changedCategory) {
      // TS doesn't preserve optional narrowing into async state updaters
      const { name, amount } = update.changedCategory;
      setUserSetBudgets(prev => ({
        ...prev,
        [name]: amount,
      }));
    }

    if (update.changedSuperCategory) {
      const target = update.superCategories.find(sc => sc.id === update.changedSuperCategory?.id);
      if (target) {
        setUserSetBudgets(prev => {
          const next = { ...prev };
          target.categories.forEach(cat => {
            delete next[cat.name];
          });
          return next;
        });
      }
    }
    
    setHasUnsavedChanges(true);
  }, [budgetData]);

  // New handler for direct income editing
  const handleIncomeChange = useCallback((newIncome: number) => {
    if (!budgetData) return;

    // Update budget data with new income and recalculate ready to assign
    const newReadyToAssign = newIncome - budgetData.totalBudgeted;
    
    setBudgetData({
      ...budgetData,
      income: newIncome,
      incomeMonth: currentMonth,
      readyToAssign: newReadyToAssign,
    });
    setHasUnsavedChanges(true);
  }, [budgetData, currentMonth]);

  const handleSave = async () => {
    if (!budgetData || !user) return;
    if (budgetData.income <= 0) {
      setSaveMessage({ type: 'error', text: 'Set your income before saving the budget.' });
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const budgets = budgetData.categories.map(cat => ({
        categoryId: cat.id,
        amount: cat.budgeted,
      }));
      const superBudgets = budgetData.superCategories
        .filter(superCategory => superCategory.isOverride)
        .map(superCategory => ({
          superCategoryId: superCategory.id,
          amount: superCategory.budgeted,
        }));

      const [incomeRes, budgetRes] = await Promise.all([
        fetch('/api/budget/income', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            month: currentMonth,
            amount: budgetData.income,
          }),
        }),
        fetch('/api/budget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            month: currentMonth,
            budgets,
            superBudgets,
          }),
        }),
      ]);

      if (!incomeRes.ok) {
        const data = await incomeRes.json();
        throw new Error(data.error || 'Failed to save income');
      }

      if (!budgetRes.ok) {
        const data = await budgetRes.json();
        throw new Error(data.error || 'Failed to save');
      }

      // Clear overrides and user-set budgets after successful save
      setBudgetedOverrides(null);
      setUserSetBudgets({});
      setHasUnsavedChanges(false);

      setSaveMessage({ type: 'success', text: 'Budget saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error: any) {
      setSaveMessage({ type: 'error', text: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoAssign = async () => {
    if (!user || !budgetData) return;

    setIsAutoAssigning(true);
    setSaveMessage(null);

    try {
      // Prepare existing allocations for re-assignment
      const existingAllocations = hasAiAssigned 
        ? budgetData.categories.reduce((acc, cat) => {
            acc[cat.name] = cat.budgeted;
            return acc;
          }, {} as Record<string, number>)
        : undefined;

      const res = await fetch('/api/budget/auto-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          month: currentMonth,
          income: budgetData.income,
          existingAllocations,
          isReassign: hasAiAssigned,
          userSetBudgets, // Pass user-set budgets to preserve them
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to auto-assign');
      }

      // Apply allocations to local state (NOT saved to DB yet)
      if (data.categoryAllocations) {
        // Build overrides map for BudgetTable
        const overrides: Record<string, number> = {};
        data.categoryAllocations.forEach((a: { categoryId: string; amount: number }) => {
          overrides[a.categoryId] = a.amount;
        });
        setBudgetedOverrides(overrides);

        const updatedCategories = budgetData.categories.map(cat => {
          const allocation = data.categoryAllocations.find(
            (a: { categoryId: string; amount: number }) => a.categoryId === cat.id
          );
          const newBudgeted = allocation ? allocation.amount : cat.budgeted;
          return {
            ...cat,
            budgeted: newBudgeted,
            available: newBudgeted - cat.spent,
          };
        });

        const updatedSuperCategories = budgetData.superCategories.map(superCategory => {
          const updatedChildren = superCategory.categories.map(cat => {
            const updated = updatedCategories.find(updatedCat => updatedCat.id === cat.id);
            return updated ? { ...cat, ...updated } : cat;
          });
          const budgeted = updatedChildren.reduce((sum, cat) => sum + cat.budgeted, 0);
          const spent = updatedChildren.reduce((sum, cat) => sum + cat.spent, 0);
          return {
            ...superCategory,
            categories: updatedChildren,
            budgeted,
            spent,
            available: budgeted - spent,
            isOverride: false,
          };
        });

        const newTotalBudgeted = updatedSuperCategories.reduce((sum, c) => sum + c.budgeted, 0);

        setBudgetData({
          ...budgetData,
          categories: updatedCategories,
          superCategories: updatedSuperCategories,
          totalBudgeted: newTotalBudgeted,
          readyToAssign: budgetData.income - newTotalBudgeted,
        });
      }

      setHasAiAssigned(true);
      setHasUnsavedChanges(true);

      // Send the chat message explaining the assignment
      if (data.chatMessage && chatInterfaceRef.current?.sendSystemMessage) {
        chatInterfaceRef.current.sendSystemMessage(data.chatMessage);
      }
      
      setSaveMessage({ type: 'success', text: 'AI budget assigned! Click "Save Budget" to keep changes.' });
      setTimeout(() => setSaveMessage(null), 5000);
    } catch (error: any) {
      setSaveMessage({ type: 'error', text: error.message });
    } finally {
      setIsAutoAssigning(false);
    }
  };

  const handleResetBudget = async () => {
    if (!budgetData || !user) return;

    // Zero out all categories locally
    const updatedCategories = budgetData.categories.map(cat => ({
      ...cat,
      budgeted: 0,
      available: 0 - cat.spent, // Recalculate available based on 0 budget
    }));
    const updatedSuperCategories = budgetData.superCategories.map(superCategory => {
      const updatedChildren = superCategory.categories.map(cat => {
        const updated = updatedCategories.find(updatedCat => updatedCat.id === cat.id);
        return updated ? { ...cat, ...updated } : cat;
      });
      const spent = updatedChildren.reduce((sum, cat) => sum + cat.spent, 0);
      return {
        ...superCategory,
        categories: updatedChildren,
        budgeted: 0,
        spent,
        available: 0 - spent,
        isOverride: false,
      };
    });

    // Optimistic update
    setBudgetData({
      ...budgetData,
      categories: updatedCategories,
      superCategories: updatedSuperCategories,
      totalBudgeted: 0,
      readyToAssign: budgetData.income,
    });
    setHasUnsavedChanges(false);

    // Save the zeroed budget to server
    try {
      const budgets = updatedCategories.map(cat => ({
        categoryId: cat.id,
        amount: 0,
      }));

      await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          month: currentMonth,
          budgets,
          superBudgets: [],
        }),
      });
    } catch (error) {
      console.error('Failed to reset budget on server:', error);
      // We don't show an error toast here to avoid disrupting the reset flow,
      // as the user is about to re-enter data anyway.
    }
  };

  const handleCategoryAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleCategoryDeleted = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (loading) {
    return null;
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
            <button
              onClick={() => router.push('/')}
              className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm hover:opacity-90 transition-opacity"
            >
              A
            </button>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-lg tracking-tight">Budget</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Save Message */}
            {saveMessage && (
              <span className={`text-sm font-medium ${
                saveMessage.type === 'success' 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-red-600 dark:text-red-400'
              } hidden lg:inline`}>
                {saveMessage.text}
              </span>
            )}
            
            <UserMenu />
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Main Content Grid */}
          <div className="flex-1 grid grid-cols-12 gap-0 min-h-0">
            
            {/* Left Column: Budget Management (65%) */}
            <div className="col-span-12 lg:col-span-8 flex flex-col h-full lg:border-r border-slate-200 dark:border-slate-800 overflow-y-auto bg-slate-50/50 dark:bg-black/5 p-4 lg:p-6 pb-20 lg:pb-6">
              <div className="max-w-4xl w-full mx-auto space-y-4">
                <div>
                  <EstimatedIncomeInput
                    income={budgetData?.income || 0}
                    incomeStats={budgetMeta?.incomeStats}
                    onIncomeChange={handleIncomeChange}
                    isLoading={!isInitialLoadComplete}
                  />

                  {/* Ready to Assign Panel */}
                  <ReadyToAssign 
                    amount={budgetData?.readyToAssign || 0}
                    income={budgetData?.income || 0}
                    totalBudgeted={budgetData?.totalBudgeted || 0}
                    onIncomeChange={handleIncomeChange}
                    onAutoAssign={handleAutoAssign}
                    isAutoAssigning={isAutoAssigning}
                    hasAiAssigned={hasAiAssigned}
                    onReset={handleResetBudget}
                    onSave={handleSave}
                    isSaving={isSaving}
                    hasUnsavedChanges={hasUnsavedChanges}
                    isLoading={!isInitialLoadComplete}
                  />

                  {/* Budget Table */}
                  <BudgetTable
                    key={refreshKey}
                    userId={user.id}
                    month={currentMonth}
                    onDataLoaded={handleBudgetDataLoaded}
                    onBudgetChange={handleBudgetChange}
                    onCategoryAdded={handleCategoryAdded}
                    onCategoryDeleted={handleCategoryDeleted}
                    budgetedOverrides={budgetedOverrides}
                    isReadOnly={false}
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Chat (35%) - Hidden on mobile */}
            <div className="hidden lg:flex col-span-12 lg:col-span-4 flex-col min-h-0 bg-white dark:bg-gray-900">
              <div className="flex-1 min-h-0 overflow-hidden">
                <ChatInterface 
                  ref={chatInterfaceRef} 
                  userId={user.id}
                />
              </div>
            </div>

          </div>
        </div>

        {/* Mobile Chat Modal */}
        <MobileChatModal 
          userId={user.id}
          chatInterfaceRef={chatInterfaceRef} 
          isOpen={isMobileChatOpen}
          onOpenChange={setIsMobileChatOpen}
        />
      </main>
    </AuthGuard>
  );
}
