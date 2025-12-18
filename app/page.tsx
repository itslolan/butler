'use client';

import { useState, useCallback, useRef } from 'react';
import FileUpload from '@/components/FileUpload';
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

export default function Home() {
  const { user, loading } = useAuth();
  const [uploadCount, setUploadCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastUploadResult, setLastUploadResult] = useState<string>('');
  const [processingSteps, setProcessingSteps] = useState<Array<{ step: string; status: string; message: string; timestamp: number }>>([]);
  const [chartRefreshKey, setChartRefreshKey] = useState(0);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const chatInterfaceRef = useRef<any>(null);

  const handleTodoSelect = (todo: any) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    
    // Handle different todo types
    if (todo.type === 'account_selection') {
      // Account selection todo - show account selector in chat
      if (isMobile) {
        setIsMobileChatOpen(true);
        setTimeout(() => {
          chatInterfaceRef.current?.showAccountSelection?.({
            documentIds: [todo.document_id],
            transactionCount: todo.transaction_count,
            dateRange: todo.first_transaction_date && todo.last_transaction_date 
              ? { start: todo.first_transaction_date, end: todo.last_transaction_date }
              : undefined,
          });
        }, 300);
      } else {
        chatInterfaceRef.current?.showAccountSelection?.({
          documentIds: [todo.document_id],
          transactionCount: todo.transaction_count,
          dateRange: todo.first_transaction_date && todo.last_transaction_date 
            ? { start: todo.first_transaction_date, end: todo.last_transaction_date }
            : undefined,
        });
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
    setProcessingSteps([]);
    
    let processedCount = 0;
    let totalTransactions = 0;
    let duplicatesSkipped = 0;
    let errors = 0;
    
    // Track date ranges and pending account selections
    let earliestDate: string | null = null;
    let latestDate: string | null = null;
    const pendingAccountDocs: string[] = [];
    const accountMatchDocs: any[] = [];
    
    // Generate batch_id for multi-file uploads (for grouping screenshots)
    const batchId = files.length > 1 ? crypto.randomUUID() : null;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileIndex = i + 1;
      const totalFiles = files.length;
      
      // Initial step for this file
      setProcessingSteps([{ 
        step: 'init', 
        status: 'processing', 
        message: totalFiles > 1 
          ? `📄 Processing file ${fileIndex}/${totalFiles}: ${file.name}...` 
          : `📄 Processing ${file.name}...`, 
        timestamp: Date.now() 
      }]);
    
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', user?.id || 'default-user');
        if (batchId) {
          formData.append('batchId', batchId);
        }

        const response = await fetch('/api/process-statement-stream', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to process statement');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        let done = false;
        let finalResult: any = null;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;

          if (value) {
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = JSON.parse(line.substring(6));

                if (data.error) {
                  throw new Error(data.error);
                }

                if (data.done) {
                  finalResult = data;
                } else if (data.step) {
                  // Update processing steps in real-time
                  setProcessingSteps(prev => {
                    const newSteps = [...prev];
                    // Check if we already have this step type for THIS file context?
                    // Actually, since we reset steps for each file, we can just look for step name
                    const existingIndex = newSteps.findIndex(s => s.step === data.step);
                    
                    // Prefix message with file info if batch processing
                    const message = totalFiles > 1 
                      ? `[${fileIndex}/${totalFiles}] ${data.message}` 
                      : data.message;

                    if (existingIndex >= 0) {
                      newSteps[existingIndex] = { ...data, message };
                    } else {
                      newSteps.push({ ...data, message });
                    }
                    
                    return newSteps;
                  });
                }
              }
            }
          }
        }

        if (finalResult) {
          processedCount++;
          totalTransactions += finalResult.transactionCount || 0;
          duplicatesSkipped += finalResult.duplicatesRemoved || 0;
          
          // Track date ranges across all files
          if (finalResult.firstTransactionDate) {
            if (!earliestDate || finalResult.firstTransactionDate < earliestDate) {
              earliestDate = finalResult.firstTransactionDate;
            }
          }
          if (finalResult.lastTransactionDate) {
            if (!latestDate || finalResult.lastTransactionDate > latestDate) {
              latestDate = finalResult.lastTransactionDate;
            }
          }
          
          // Track pending account selections (screenshots)
          if (finalResult.pendingAccountSelection) {
            pendingAccountDocs.push(finalResult.id);
          }
          
          // Track account match confirmations (statements)
          if (finalResult.accountMatchInfo?.needsConfirmation) {
            accountMatchDocs.push({
              documentId: finalResult.id,
              transactionCount: finalResult.transactionCount,
              ...finalResult.accountMatchInfo,
            });
          }
          
          // Trigger chart refresh immediately after each file
          setChartRefreshKey(prev => prev + 1);
          
          // Handle clarifications and summary for THIS file (only if not batching)
          if (files.length === 1) {
            const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
            
            if (finalResult.unclarifiedTransactions && finalResult.unclarifiedTransactions.length > 0) {
              const clarificationMsg = buildClarificationMessage(finalResult);
              
              if (isMobile) {
                setIsMobileChatOpen(true);
                setTimeout(() => {
                  chatInterfaceRef.current?.sendSystemMessage?.(clarificationMsg);
                }, 300);
              } else if (chatInterfaceRef.current?.sendSystemMessage) {
                setTimeout(() => {
                  chatInterfaceRef.current.sendSystemMessage(clarificationMsg);
                }, 500);
              }
            } else if (!finalResult.pendingAccountSelection && !finalResult.accountMatchInfo?.needsConfirmation) {
              // Send summary only if no account selection needed
              // Note: We don't need to open mobile chat for simple success summaries
              if (chatInterfaceRef.current?.sendSystemMessage) {
                setTimeout(() => {
                  let message = `✅ **${file.name}**: Processed successfully.\n`;
                  message += `• Saved ${finalResult.transactionCount} transactions`;
                  if (finalResult.duplicatesRemoved > 0) {
                    message += `\n• Skipped ${finalResult.duplicatesRemoved} duplicates`;
                  }
                  if (finalResult.firstTransactionDate && finalResult.lastTransactionDate) {
                    const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    message += `\n• Date range: ${formatDate(finalResult.firstTransactionDate)} - ${formatDate(finalResult.lastTransactionDate)}`;
                  }
                  chatInterfaceRef.current.sendSystemMessage(message);
                }, 500);
              }
            }
          }
        }

      } catch (error: any) {
        console.error(`Error processing file ${file.name}:`, error);
        errors++;
        setLastUploadResult(`❌ Error with ${file.name}: ${error.message}`);
        // Keep going to next file
      }
    }

    setIsProcessing(false);
    
    // Helper to format date
    const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    // Final batch summary
    if (files.length > 1) {
      const summary = errors === 0
        ? `✅ Batch Complete: ${processedCount}/${files.length} files processed (${totalTransactions} txns)`
        : `⚠️ Batch Complete: ${processedCount}/${files.length} files processed (${errors} failed)`;
      
      setLastUploadResult(summary);
      
      // Send detailed batch summary to chat
      if (chatInterfaceRef.current?.sendSystemMessage && processedCount > 0) {
        setTimeout(() => {
          let message = `✅ **Upload Complete**: ${processedCount} file${processedCount !== 1 ? 's' : ''} processed\n\n`;
          message += `📊 **Summary:**\n`;
          message += `• Transactions added: **${totalTransactions}**\n`;
          if (duplicatesSkipped > 0) {
            message += `• Duplicates skipped: ${duplicatesSkipped}\n`;
          }
          if (earliestDate && latestDate) {
            message += `• Date range: ${formatDate(earliestDate)} - ${formatDate(latestDate)}\n`;
          }
          
          chatInterfaceRef.current.sendSystemMessage(message);
        }, 500);
      }
      
      // Clear steps after a delay
      setTimeout(() => setProcessingSteps([]), 5000);
    } else {
      // Single file logic
      if (errors === 0) {
         setLastUploadResult(`✅ Upload Complete`);
         setTimeout(() => setProcessingSteps([]), 5000);
      }
    }
    
    // Handle pending account selections (screenshots without account info)
    if (pendingAccountDocs.length > 0) {
      // On mobile, open chat modal first before showing account selection
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
      
      if (isMobile) {
        setIsMobileChatOpen(true);
        // Wait for modal to mount/render, then show account selection
        setTimeout(() => {
          chatInterfaceRef.current?.showAccountSelection?.({
            documentIds: pendingAccountDocs,
            transactionCount: totalTransactions,
            dateRange: earliestDate && latestDate ? { start: earliestDate, end: latestDate } : undefined,
          });
        }, 300); // Slightly longer delay to ensure modal is fully mounted
      } else if (chatInterfaceRef.current?.showAccountSelection) {
        setTimeout(() => {
          chatInterfaceRef.current.showAccountSelection({
            documentIds: pendingAccountDocs,
            transactionCount: totalTransactions,
            dateRange: earliestDate && latestDate ? { start: earliestDate, end: latestDate } : undefined,
          });
        }, 1000);
      }
    }
    
    // Handle account match confirmations (statements with new official names)
    if (accountMatchDocs.length > 0) {
      // Show first one (they can be handled one at a time)
      const firstMatch = accountMatchDocs[0];
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
      
      if (isMobile) {
        setIsMobileChatOpen(true);
        // Wait for modal to mount/render, then show account match confirmation
        setTimeout(() => {
          chatInterfaceRef.current?.showAccountMatchConfirmation?.({
            documentId: firstMatch.documentId,
            transactionCount: firstMatch.transactionCount,
            matchedAccount: firstMatch.matchedAccount,
            officialName: firstMatch.officialName,
            last4: firstMatch.last4,
            existingAccounts: firstMatch.existingAccounts,
          });
        }, 400); // Slightly longer delay to ensure modal is fully mounted
      } else if (chatInterfaceRef.current?.showAccountMatchConfirmation) {
        setTimeout(() => {
          chatInterfaceRef.current.showAccountMatchConfirmation({
            documentId: firstMatch.documentId,
            transactionCount: firstMatch.transactionCount,
            matchedAccount: firstMatch.matchedAccount,
            officialName: firstMatch.officialName,
            last4: firstMatch.last4,
            existingAccounts: firstMatch.existingAccounts,
          });
        }, 1200);
      }
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
            <TodoButton 
              userId={user?.id || 'default-user'} 
              onSelectTodo={handleTodoSelect}
              refreshTrigger={chartRefreshKey} // Refresh todos when uploads happen
            />
            <UserMenu />
          </div>
        </header>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Main Content Grid */}
        <div className="flex-1 grid grid-cols-12 gap-0 min-h-0">
          
          {/* Left Column: Visualization & Data (65%) - Full width on mobile */}
          <div className="col-span-12 lg:col-span-8 flex flex-col h-full lg:border-r border-slate-200 dark:border-slate-800 overflow-y-auto bg-slate-50/50 dark:bg-black/5 p-4 lg:p-6 pb-20 lg:pb-6">
            <div className="max-w-5xl w-full mx-auto space-y-4 lg:space-y-6">
              {/* Todo List - Prominent placement above charts */}
              <TodoList 
                userId={user?.id || 'default-user'} 
                onSelectTodo={handleTodoSelect}
                refreshTrigger={chartRefreshKey}
              />
              
              {/* Budget & Connected Banks Panels - Side by side on desktop */}
              <OnboardingPanels 
                userId={user?.id || 'default-user'} 
                onSyncComplete={() => setChartRefreshKey(prev => prev + 1)}
                onFileUpload={handleFileUpload}
                isProcessing={isProcessing}
              />
              
              {/* Subscriptions Panel - Shows auto-detected subscriptions from fixed expenses */}
              <SubscriptionsPanel 
                userId={user?.id || 'default-user'}
                refreshTrigger={chartRefreshKey}
                currency="USD"
              />
              
              <VisualizationPanel key={chartRefreshKey} userId={user?.id || 'default-user'} />
            </div>
          </div>

          {/* Right Column: Actions & Chat (35%) - Hidden on mobile */}
          <div className="hidden lg:flex col-span-12 lg:col-span-4 flex-col min-h-0 bg-white dark:bg-gray-900">
            {/* Upload Section - Fixed at top */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <FileUpload onFileUpload={handleFileUpload} isProcessing={isProcessing} />
              
              {/* Toast-style Processing Status */}
              {(processingSteps.length > 0 || lastUploadResult) && (
                <div className="mt-3 space-y-2">
                  {processingSteps.length > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-lg text-sm">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                      <div className="flex-1 font-medium text-blue-900 dark:text-blue-100 truncate">
                        {processingSteps[processingSteps.length - 1].message}
                      </div>
                      <span className="text-xs text-blue-700 dark:text-blue-300 font-mono">
                        {Math.round((processingSteps.filter(s => s.status === 'complete').length / processingSteps.length) * 100)}%
                      </span>
                    </div>
                  )}
                  
                  {lastUploadResult && (
                    <div className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium border ${
                      lastUploadResult.startsWith('✅') 
                        ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800 text-green-800 dark:text-green-200'
                        : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800 text-red-800 dark:text-red-200'
                    }`}>
                      <span>{lastUploadResult.startsWith('✅') ? '✓' : '!'}</span>
                      <span className="truncate">{lastUploadResult.replace(/^[✅❌]\s*/, '')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Chat Interface - Fills remaining space */}
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
          />
          
          {/* Mobile Processing Toast - Only visible on mobile */}
      <MobileProcessingToast processingSteps={processingSteps} lastUploadResult={lastUploadResult} />
    </main>
    </AuthGuard>
  );
}
