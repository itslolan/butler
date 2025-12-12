'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import UserMenu from '@/components/UserMenu';
import ChatInterface from '@/components/ChatInterface';
import MobileChatModal from '@/components/MobileChatModal';
import BudgetTable from '@/components/BudgetTable';
import ReadyToAssign from '@/components/ReadyToAssign';
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

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

  // Budget data state
  const [budgetData, setBudgetData] = useState<{
    income: number;
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

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Generate month options (last 12 months + next 1 month)
  const monthOptions = Array.from({ length: 13 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i + 1);
    return {
      value: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    };
  });

  const handleBudgetDataLoaded = useCallback((data: typeof budgetData) => {
    setBudgetData(data);
  }, []);

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
  }, [budgetData]);

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

      setSaveMessage({ type: 'success', text: 'Budget saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error: any) {
      setSaveMessage({ type: 'error', text: error.message });
    } finally {
      setIsSaving(false);
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
              <span className="text-slate-400 dark:text-slate-600">/</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-sm font-medium bg-transparent border-none focus:outline-none focus:ring-0 text-slate-700 dark:text-slate-300 cursor-pointer"
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
              }`}>
                {saveMessage.text}
              </span>
            )}
            
            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={isSaving || !budgetData}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-medium text-sm rounded-lg transition-colors shadow-sm disabled:cursor-not-allowed"
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
                  Save Budget
                </>
              )}
            </button>
            
            <UserMenu />
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Main Content Grid */}
          <div className="flex-1 grid grid-cols-12 gap-0 min-h-0">
            
            {/* Left Column: Budget Management (65%) */}
            <div className="col-span-12 lg:col-span-8 flex flex-col h-full lg:border-r border-slate-200 dark:border-slate-800 overflow-y-auto bg-slate-50/50 dark:bg-black/5 p-4 lg:p-6 pb-20 lg:pb-6">
              <div className="max-w-4xl w-full mx-auto space-y-6">
                {/* Ready to Assign Panel */}
                <ReadyToAssign 
                  amount={budgetData?.readyToAssign || 0}
                  income={budgetData?.income || 0}
                  totalBudgeted={budgetData?.totalBudgeted || 0}
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
                />
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

        {/* Mobile Chat Button */}
        <button
          onClick={() => setIsMobileChatOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center z-50"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      </main>
    </AuthGuard>
  );
}

