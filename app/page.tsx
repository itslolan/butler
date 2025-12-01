'use client';

import { useState, useCallback, useRef } from 'react';
import FileUpload from '@/components/FileUpload';
import ChatInterface from '@/components/ChatInterface';
import VisualizationPanel from '@/components/VisualizationPanel';
import AuthGuard from '@/components/AuthGuard';
import UserMenu from '@/components/UserMenu';
import MobileChatModal from '@/components/MobileChatModal';
import MobileUploadButton from '@/components/MobileUploadButton';
import MobileProcessingToast from '@/components/MobileProcessingToast';
import { useAuth } from '@/components/AuthProvider';
import LandingPage from '@/components/LandingPage';
import TodoButton from '@/components/TodoButton';

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
    // If on mobile (simple check), open chat first
    if (window.innerWidth < 1024) {
      setIsMobileChatOpen(true);
      // Allow time for modal to mount/render
      setTimeout(() => {
        chatInterfaceRef.current?.resolveTodo(todo);
      }, 100);
    } else {
      chatInterfaceRef.current?.resolveTodo(todo);
    }
  };

  const handleFileUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    
    setIsProcessing(true);
    setLastUploadResult('');
    setProcessingSteps([]);
    
    let processedCount = 0;
    let totalTransactions = 0;
    let errors = 0;

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
          
          // Trigger chart refresh immediately after each file
          setChartRefreshKey(prev => prev + 1);
          
          // Handle clarifications and summary for THIS file
          if (finalResult.unclarifiedTransactions && finalResult.unclarifiedTransactions.length > 0) {
            const clarificationMsg = buildClarificationMessage(finalResult);
            if (chatInterfaceRef.current?.sendSystemMessage) {
              // Small delay to ensure order
              setTimeout(() => {
                chatInterfaceRef.current.sendSystemMessage(clarificationMsg);
              }, 500);
            }
          } else {
            // Send summary
            if (chatInterfaceRef.current?.sendSystemMessage) {
              setTimeout(() => {
                let message = `✅ **${file.name}**: Processed successfully.\n`;
                message += `• Saved ${finalResult.transactionCount} transactions`;
                if (finalResult.duplicatesRemoved > 0) {
                  message += `\n• Skipped ${finalResult.duplicatesRemoved} duplicates`;
                }
                chatInterfaceRef.current.sendSystemMessage(message);
              }, 500);
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
    
    // Final batch summary
    if (files.length > 1) {
      const summary = errors === 0
        ? `✅ Batch Complete: ${processedCount}/${files.length} files processed (${totalTransactions} txns)`
        : `⚠️ Batch Complete: ${processedCount}/${files.length} files processed (${errors} failed)`;
      
      setLastUploadResult(summary);
      
      // Clear steps after a delay
      setTimeout(() => setProcessingSteps([]), 5000);
    } else {
      // Single file logic matches existing behavior more or less
      if (errors === 0) {
         // Success message was already set per-file, but let's set the toast one
         // We can't easily get the finalResult here for single file without storing it, 
         // but checking success count is enough
         setLastUploadResult(`✅ Upload Complete`);
         setTimeout(() => setProcessingSteps([]), 5000);
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
              B
            </div>
            <h1 className="font-semibold text-lg tracking-tight">Butler</h1>
            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></div>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
              Connected
            </span>
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
              {/* Mobile Upload Button */}
              <MobileUploadButton onFileUpload={handleFileUpload} isProcessing={isProcessing} />
              
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
              <ChatInterface ref={chatInterfaceRef} userId={user?.id || 'default-user'} />
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
