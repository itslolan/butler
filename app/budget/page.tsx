'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import UserMenu from '@/components/UserMenu';
import ChatInterface from '@/components/ChatInterface';
import MobileChatModal from '@/components/MobileChatModal';
import BudgetTable from '@/components/BudgetTable';
import ReadyToAssign from '@/components/ReadyToAssign';
import BudgetQuestionnaire from '@/components/BudgetQuestionnaire';
import BudgetExplainer from '@/components/BudgetExplainer';
import { useAuth } from '@/components/AuthProvider';

export default function BudgetPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const chatInterfaceRef = useRef<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Get current month in YYYY-MM format
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  // Month comparison utilities
  const currentMonth = getCurrentMonth();
  const isCurrentMonth = (month: string) => month === currentMonth;
  const isPastMonth = (month: string) => month < currentMonth;
  const isFutureMonth = (month: string) => month > currentMonth;

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // Budget data state
  const [budgetData, setBudgetData] = useState<{
    income: number;
    incomeMonth?: string;
    totalBudgeted: number;
    readyToAssign: number;
    categories: Array<{
      id: string;
      name: string;
      isCustom: boolean;
      budgeted: number;
      spent: number;
      available: number;
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

  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [questionnaireCompleted, setQuestionnaireCompleted] = useState(false);
  
  // User-entered rent from questionnaire (to pass to auto-assign)
  const [rentOverride, setRentOverride] = useState<number | null>(null);
  
  // Budgeted amounts override (from AI auto-assign, before saving)
  const [budgetedOverrides, setBudgetedOverrides] = useState<Record<string, number> | null>(null);
  
  // Track user-manually-set budget amounts (to preserve during AI auto-assign)
  const [userSetBudgets, setUserSetBudgets] = useState<Record<string, number>>({});
  
  // Track if user has any income history (for determining if manual override is allowed)
  const [hasIncomeHistory, setHasIncomeHistory] = useState<boolean>(false);
  
  // Read-only mode for past months
  const isReadOnly = isPastMonth(selectedMonth);

  // Generate month options (last 12 months + next 1 month)
  const monthOptions = Array.from({ length: 13 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i + 1);
    const value = d.toISOString().slice(0, 7);
    const baseLabel = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    // Add visual indicator for month type
    let label = baseLabel;
    if (value === currentMonth) {
      label = `${baseLabel} (Current)`;
    } else if (value < currentMonth) {
      label = `${baseLabel} (Past)`;
    }
    
    return { value, label };
  });

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
    const hasHistory = effectiveIncome > 0;
    setHasIncomeHistory(hasHistory);
    
    const effectiveReadyToAssign = anyData.readyToAssign;

    setBudgetData({
      income: effectiveIncome,
      incomeMonth: anyData.incomeMonth || selectedMonth,
      totalBudgeted: anyData.totalBudgeted,
      readyToAssign: effectiveReadyToAssign,
      categories: anyData.categories,
    });

    // Only show questionnaire for current month with no budgets
    // Never show for past months (read-only) or future months (will get carryover)
    if (data && data.totalBudgeted === 0 && !questionnaireCompleted && isCurrentMonth(selectedMonth)) {
      setShowQuestionnaire(true);
    }
    
    setIsInitialLoadComplete(true);
  }, [questionnaireCompleted]);

  const handleQuestionnaireComplete = async (data: { income: number; rent?: number }) => {
    if (!budgetData || !user) return;

    // Store rent if provided (for auto-assign)
    if (data.rent && data.rent > 0) {
      setRentOverride(data.rent);
    }
    
    // Only save user-entered income if there's no income history
    // Income history (median or DB income) always takes precedence
    if (!hasIncomeHistory && data.income > 0) {
      try {
        // Save the user-provided income to the database
        await fetch('/api/budget/income', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            month: selectedMonth,
            amount: data.income,
          }),
        });
      } catch (error) {
        console.error('Failed to save user-provided income:', error);
      }
    }
    
    // If user has income history, keep the current income (median or DB), otherwise use user-entered
    const effectiveIncome = hasIncomeHistory ? budgetData.income : data.income;
    
    setBudgetData({
      ...budgetData,
      income: effectiveIncome,
      incomeMonth: hasIncomeHistory ? budgetData.incomeMonth : selectedMonth,
      readyToAssign: effectiveIncome - budgetData.totalBudgeted,
    });
    setQuestionnaireCompleted(true);
    setShowQuestionnaire(false);
  };

  const handleBudgetChange = useCallback((categoryId: string, newAmount: number) => {
    if (!budgetData) return;

    const updatedCategories = budgetData.categories.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          budgeted: newAmount,
          available: newAmount - cat.spent,
        };
      }
      return cat;
    });

    const newTotalBudgeted = updatedCategories.reduce((sum, c) => sum + c.budgeted, 0);

    setBudgetData({
      ...budgetData,
      categories: updatedCategories,
      totalBudgeted: newTotalBudgeted,
      readyToAssign: budgetData.income - newTotalBudgeted,
    });
    
    // Track this as a user-set budget (by category name for API)
    const category = budgetData.categories.find(c => c.id === categoryId);
    if (category) {
      setUserSetBudgets(prev => ({
        ...prev,
        [category.name]: newAmount,
      }));
    }
    
    setHasUnsavedChanges(true);
  }, [budgetData]);

  const handleReadyToAssignChange = useCallback(async (newReadyToAssign: number) => {
    if (!budgetData || !user) return;
    const newIncome = budgetData.totalBudgeted + newReadyToAssign;
    
    // Only allow manual income changes when there's no income history
    // If user has income history (median or DB), they can't manually change it here
    if (!hasIncomeHistory) {
      try {
        // Save the manually adjusted income to the database
        await fetch('/api/budget/income', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            month: selectedMonth,
            amount: newIncome,
          }),
        });
      } catch (error) {
        console.error('Failed to save income:', error);
      }
    }
    
    setBudgetData({
      ...budgetData,
      income: newIncome,
      incomeMonth: selectedMonth,
      readyToAssign: newReadyToAssign,
    });
  }, [budgetData, selectedMonth, hasIncomeHistory, user]);

  const handleSave = async () => {
    if (!budgetData || !user) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const budgets = budgetData.categories.map(cat => ({
        categoryId: cat.id,
        amount: cat.budgeted,
      }));

      const res = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          month: selectedMonth,
          budgets,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
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
          month: selectedMonth,
          income: budgetData.income,
          rent: rentOverride,
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

        const newTotalBudgeted = updatedCategories.reduce((sum, c) => sum + c.budgeted, 0);

        setBudgetData({
          ...budgetData,
          categories: updatedCategories,
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
    
    // Only allow reset for current month
    if (!isCurrentMonth(selectedMonth)) return;

    // Zero out all categories locally
    const updatedCategories = budgetData.categories.map(cat => ({
      ...cat,
      budgeted: 0,
      available: 0 - cat.spent, // Recalculate available based on 0 budget
    }));

    // Optimistic update
    setBudgetData({
      ...budgetData,
      categories: updatedCategories,
      totalBudgeted: 0,
      readyToAssign: budgetData.income,
    });
    
    setShowQuestionnaire(true);

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
          month: selectedMonth,
          budgets,
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

  // Handle budget carryover for future months
  const handleBudgetCarryover = async (targetMonth: string) => {
    if (!user) return;
    
    try {
      const res = await fetch('/api/budget/carryover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          targetMonth,
        }),
      });
      
      if (!res.ok) {
        console.error('Failed to carry over budgets');
        return;
      }
      
      const data = await res.json();
      if (data.copied) {
        // Trigger a refresh to show the copied budgets
        setRefreshKey(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error carrying over budgets:', error);
    }
  };

  // Reset states when month changes
  useEffect(() => {
    setRentOverride(null);
    setBudgetedOverrides(null);
    setUserSetBudgets({});
    setHasAiAssigned(false);
    setHasUnsavedChanges(false);
    setIsInitialLoadComplete(false);
    setShowQuestionnaire(false);
    setQuestionnaireCompleted(false);
    
    // Trigger budget carryover for future months
    if (isFutureMonth(selectedMonth)) {
      handleBudgetCarryover(selectedMonth);
    }
  }, [selectedMonth]);

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
              {/* Month toggle: desktop only (moved into left panel on mobile) */}
              <span className="hidden lg:inline text-slate-400 dark:text-slate-600">/</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="hidden lg:block text-sm font-medium bg-transparent border-none focus:outline-none focus:ring-0 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                {monthOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
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
                {/* Mobile controls (moved from top bar) */}
                <div className="lg:hidden bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
                  <div className="flex items-center justify-between gap-3">
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="flex-1 min-w-0 px-3 py-2 text-sm font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      {monthOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={handleSave}
                      disabled={isSaving || isAutoAssigning || !budgetData || !hasUnsavedChanges}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-medium text-sm rounded-xl transition-colors shadow-sm disabled:cursor-not-allowed shrink-0"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Save
                        </>
                      )}
                    </button>
                  </div>

                  {saveMessage && (
                    <div className="mt-3">
                      <span className={`text-sm font-medium ${
                        saveMessage.type === 'success'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {saveMessage.text}
                      </span>
                    </div>
                  )}
                </div>

                {/* Questionnaire */}
                {isInitialLoadComplete && showQuestionnaire && (
                  <BudgetQuestionnaire 
                    onComplete={handleQuestionnaireComplete}
                    onUpload={() => router.push('/')}
                    initialIncome={budgetData?.income || 0}
                    incomeStats={budgetMeta?.incomeStats}
                  />
                )}

                {/* Loading state before initial data is ready */}
                {!isInitialLoadComplete && (
                  <div className="flex items-center justify-center py-20">
                    <div className="flex items-center gap-3 text-slate-500">
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-sm font-medium">Loading budget...</span>
                    </div>
                  </div>
                )}

                <div className={(!isInitialLoadComplete || showQuestionnaire) ? 'hidden' : 'block'}>
                  {/* Budget Explainer Panel */}
                  <BudgetExplainer 
                    medianIncome={budgetMeta?.incomeStats?.medianMonthlyIncome}
                    monthsAnalyzed={budgetMeta?.incomeStats?.monthsIncluded}
                    currentIncome={budgetData?.income || 0}
                  />

                  {/* Ready to Assign Panel */}
                  <ReadyToAssign 
                    amount={budgetData?.readyToAssign || 0}
                    income={budgetData?.income || 0}
                    totalBudgeted={budgetData?.totalBudgeted || 0}
                    incomeMonth={budgetData?.incomeMonth}
                    currentMonth={selectedMonth}
                    onAmountChange={handleReadyToAssignChange}
                    onAutoAssign={handleAutoAssign}
                    isAutoAssigning={isAutoAssigning}
                    hasAiAssigned={hasAiAssigned}
                    onReset={handleResetBudget}
                    onSave={handleSave}
                    isSaving={isSaving}
                    hasUnsavedChanges={hasUnsavedChanges}
                    isReadOnly={isReadOnly}
                  />

                  {/* Budget Table */}
                  <BudgetTable
                    key={refreshKey}
                    userId={user.id}
                    month={selectedMonth}
                    onDataLoaded={handleBudgetDataLoaded}
                    onBudgetChange={handleBudgetChange}
                    onCategoryAdded={handleCategoryAdded}
                    onCategoryDeleted={handleCategoryDeleted}
                    budgetedOverrides={budgetedOverrides}
                    isReadOnly={isReadOnly}
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
