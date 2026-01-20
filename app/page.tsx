'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ChatInterface from '@/components/ChatInterface';
import VisualizationPanel from '@/components/VisualizationPanel';
import AuthGuard from '@/components/AuthGuard';
import UserMenu from '@/components/UserMenu';
import MobileChatModal from '@/components/MobileChatModal';
import MobileProcessingToast from '@/components/MobileProcessingToast';
import { useAuth } from '@/components/AuthProvider';
import LandingPage from '@/components/LandingPage';
import TodoButton from '@/components/TodoButton';
import TodoList from '@/components/TodoList';
import OnboardingPanels from '@/components/OnboardingPanels';
import SubscriptionsPanel from '@/components/SubscriptionsPanel';
import DashboardWelcomeSummary from '@/components/DashboardWelcomeSummary';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [uploadCount, setUploadCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastUploadResult, setLastUploadResult] = useState<string>('');
  const [processingSteps, setProcessingSteps] = useState<Array<{ step: string; status: string; message: string; timestamp: number }>>([]);
  const [chartRefreshKey, setChartRefreshKey] = useState(0);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [processingUploadsCount, setProcessingUploadsCount] = useState(0);
  const chatInterfaceRef = useRef<any>(null);
  
  // Date range controls for visualization
  // Default to current month
  const [dateRange, setDateRange] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  
  // Generate last 12 months for dropdown
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return {
      value: d.toISOString().slice(0, 7), // YYYY-MM
      label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    };
  });

  useEffect(() => {
    if (!user?.id) {
      setProcessingUploadsCount(0);
      return;
    }

    let isCancelled = false;
    let interval: any;

    const check = async () => {
      try {
        const res = await fetch(
          `/api/uploads?userId=${encodeURIComponent(user.id)}&status=processing&limit=10&_ts=${Date.now()}`,
          { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!isCancelled) setProcessingUploadsCount((data.uploads || []).length);
      } catch {
        // ignore banner fetch errors
      }
    };

    check();
    interval = setInterval(check, 30000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      isCancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user?.id]);

  const handleTodoSelect = (todo: any) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    
    // Handle different todo types
    if (todo.type === 'account_selection') {
      // Account selection todo - show account selector in chat
      // Pass accounts from the todo (already fetched by /api/todos)
      const accountSelectionData = {
        documentIds: [todo.document_id],
        transactionCount: todo.transaction_count,
        dateRange: todo.first_transaction_date && todo.last_transaction_date 
          ? { start: todo.first_transaction_date, end: todo.last_transaction_date }
          : undefined,
        accounts: todo.accounts || [], // Pass accounts from the todo
      };
      
      if (isMobile) {
        setIsMobileChatOpen(true);
        setTimeout(() => {
          chatInterfaceRef.current?.showAccountSelection?.(accountSelectionData);
        }, 300);
      } else {
        chatInterfaceRef.current?.showAccountSelection?.(accountSelectionData);
      }
    } else {
      // Transaction clarification todo - use existing resolveTodo
      if (isMobile) {
        setIsMobileChatOpen(true);
        // Allow time for modal to mount/render
        setTimeout(() => {
          chatInterfaceRef.current?.resolveTodo?.(todo);
        }, 100);
      } else {
        chatInterfaceRef.current?.resolveTodo?.(todo);
      }
    }
  };

  const handleFileUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setLastUploadResult('');
    setProcessingSteps([
      {
        step: 'upload',
        status: 'processing',
        message: `⬆️ Uploading ${files.length} file${files.length !== 1 ? 's' : ''}...`,
        timestamp: Date.now(),
      },
    ]);

    try {
      const formData = new FormData();
      formData.append('userId', user?.id || 'default-user');
      formData.append('sourceType', 'manual_upload');
      for (const f of files) formData.append('files', f);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error || 'Failed to queue upload');
      }

      const uploadId = body.uploadId as string | undefined;

      setProcessingSteps([
        {
          step: 'queued',
          status: 'complete',
          message: '✅ Upload queued. Processing will continue in the background.',
          timestamp: Date.now(),
        },
      ]);
      setLastUploadResult(`✅ Upload queued (${files.length} file${files.length !== 1 ? 's' : ''}). You can leave and come back later.`);
      setUploadCount(prev => prev + 1);
      // Stay on dashboard. Users will see processing banner and TODOs here.
    } catch (error: any) {
      console.error('[dashboard] Failed to queue upload:', error);
      setProcessingSteps([
        {
          step: 'error',
          status: 'complete',
          message: `❌ ${error?.message || 'Failed to upload'}`,
          timestamp: Date.now(),
        },
      ]);
      setLastUploadResult(`❌ ${error?.message || 'Failed to upload'}`);
    } finally {
      setIsProcessing(false);
      // Clear steps after a short delay so toast doesn't linger forever
      setTimeout(() => setProcessingSteps([]), 5000);
    }
  }, [user]);

  const buildClarificationMessage = (result: any) => {
    const unclarified = result.unclarifiedTransactions || [];
    
    let message = `I've processed your ${result.documentType?.replace('_', ' ')}. `;
    message += `I found ${unclarified.length} transaction${unclarified.length !== 1 ? 's' : ''} that need clarification:\n\n`;
    
    unclarified.slice(0, 5).forEach((txn: any, idx: number) => {
      message += `${idx + 1}. **${txn.merchant}** on ${txn.date} - $${Math.abs(txn.amount).toFixed(2)}\n`;
      message += `   Question: ${txn.clarificationQuestion}\n\n`;
    });
    
    if (unclarified.length > 5) {
      message += `... and ${unclarified.length - 5} more.\n\n`;
    }
    
    message += `Please help me categorize these transactions.`;
    
    return message;
  };

  // If loading, show nothing (AuthGuard handles loading state for dashboard)
  if (loading) {
    return null;
  }

  // If not authenticated, show Landing Page
  if (!user) {
    return <LandingPage />;
  }

  // If authenticated, show Dashboard (wrapped in AuthGuard for extra safety)
  return (
    <AuthGuard>
      <main className="flex flex-col h-screen bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
        {/* Top Bar */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
              A
            </div>
            <h1 className="font-semibold text-lg tracking-tight">Adphex</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <Link 
              href="/pricing"
              className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Pricing
            </Link>
            <TodoButton 
              userId={user?.id || 'default-user'} 
              onSelectTodo={handleTodoSelect}
              refreshTrigger={chartRefreshKey} // Refresh todos when uploads happen
            />
            <UserMenu />
          </div>
        </header>

        {processingUploadsCount > 0 && (
          <div className="border-b border-amber-100 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10">
            <div className="px-6 py-2 flex items-center justify-between gap-3">
              <div className="text-sm text-amber-800 dark:text-amber-200">
                You have <span className="font-semibold">{processingUploadsCount}</span> upload{processingUploadsCount !== 1 ? 's' : ''} processing in the background.
              </div>
              <button
                onClick={() => router.push('/uploads')}
                className="text-sm font-medium text-amber-800 dark:text-amber-200 hover:underline"
              >
                View progress →
              </button>
            </div>
          </div>
        )}

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Main Content Grid */}
        <div className="flex-1 grid grid-cols-12 gap-0 min-h-0">
          
          {/* Left Column: Visualization & Data (65%) - Full width on mobile */}
          <div className="col-span-12 lg:col-span-8 flex flex-col h-full lg:border-r border-slate-200 dark:border-slate-800 overflow-y-auto bg-slate-50/50 dark:bg-black/5 p-4 lg:p-6 pb-20 lg:pb-6">
            <div className="max-w-5xl w-full mx-auto space-y-4 lg:space-y-6">
              {/* Welcome Summary with integrated date controls */}
              <DashboardWelcomeSummary
                userId={user?.id || 'default-user'}
                displayName={(user?.user_metadata as any)?.full_name || user?.email || null}
                refreshTrigger={chartRefreshKey}
                dateRange={dateRange}
                selectedMonth={selectedMonth}
                monthOptions={monthOptions}
                showAccountsPanel={true}
                onSyncComplete={() => setChartRefreshKey(prev => prev + 1)}
                onFileUpload={handleFileUpload}
                isProcessing={isProcessing}
                onDateRangeChange={(months) => {
                  setDateRange(months);
                  setSelectedMonth('all');
                }}
                onMonthChange={(month) => {
                  setSelectedMonth(month);
                  if (month !== 'all') {
                    setDateRange(null);
                  } else {
                    setDateRange(6);
                  }
                }}
              />
              
              {/* Todo List - Collapsible action required panel */}
              <TodoList 
                userId={user?.id || 'default-user'} 
                onSelectTodo={handleTodoSelect}
                refreshTrigger={chartRefreshKey}
              />
              
              {/* Visualization Panel - KPIs and Charts */}
              <VisualizationPanel 
                key={chartRefreshKey} 
                userId={user?.id || 'default-user'}
                dateRange={dateRange}
                selectedMonth={selectedMonth}
                chatInterfaceRef={chatInterfaceRef}
                onOpenMobileChat={() => setIsMobileChatOpen(true)}
              />
              
              {/* Subscriptions Panel - Shows auto-detected subscriptions from fixed expenses */}
              <SubscriptionsPanel 
                userId={user?.id || 'default-user'}
                refreshTrigger={chartRefreshKey}
                currency="USD"
              />
            </div>
          </div>

          {/* Right Column: Chat (35%) - Hidden on mobile */}
          <div className="hidden lg:flex col-span-12 lg:col-span-4 flex-col min-h-0 bg-white dark:bg-gray-900">
            {/* Chat Interface - Fills full space */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatInterface 
                ref={chatInterfaceRef} 
                userId={user?.id || 'default-user'}
                onTodoResolved={() => setChartRefreshKey(prev => prev + 1)}
              />
            </div>
          </div>

        </div>
      </div>

          {/* Mobile Chat Modal - Only visible on mobile */}
          <MobileChatModal 
            userId={user?.id || 'default-user'} 
            chatInterfaceRef={chatInterfaceRef} 
            isOpen={isMobileChatOpen}
            onOpenChange={setIsMobileChatOpen}
            onTodoResolved={() => setChartRefreshKey(prev => prev + 1)}
          />
          
          {/* Mobile Processing Toast - Only visible on mobile */}
      <MobileProcessingToast processingSteps={processingSteps} lastUploadResult={lastUploadResult} />
    </main>
    </AuthGuard>
  );
}
