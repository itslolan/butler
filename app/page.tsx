'use client';

import { useState, useCallback, useRef } from 'react';
import FileUpload from '@/components/FileUpload';
import ChatInterface from '@/components/ChatInterface';
import VisualizationPanel from '@/components/VisualizationPanel';

export default function Home() {
  const [uploadCount, setUploadCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastUploadResult, setLastUploadResult] = useState<string>('');
  const [processingSteps, setProcessingSteps] = useState<Array<{ step: string; status: string; message: string; timestamp: number }>>([]);
  const [chartRefreshKey, setChartRefreshKey] = useState(0);
  const chatInterfaceRef = useRef<any>(null);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsProcessing(true);
    setLastUploadResult('');
    setProcessingSteps([]);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', 'default-user');

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
                  const existingIndex = newSteps.findIndex(s => s.step === data.step);
                  
                  if (existingIndex >= 0) {
                    newSteps[existingIndex] = data;
                  } else {
                    newSteps.push(data);
                  }
                  
                  return newSteps;
                });
              }
            }
          }
        }
      }

      if (finalResult) {
        setUploadCount(prev => prev + 1);
        
        const resultMessage = `✅ Processed ${finalResult.fileName} (${finalResult.transactionCount} txns)`;
        setLastUploadResult(resultMessage);
        
        // Trigger chart refresh
        setChartRefreshKey(prev => prev + 1);
        
        // Check if there are transactions needing clarification
        if (finalResult.unclarifiedTransactions && finalResult.unclarifiedTransactions.length > 0) {
          // Auto-send clarification message to chat
          const clarificationMsg = buildClarificationMessage(finalResult);
          if (chatInterfaceRef.current?.sendSystemMessage) {
            setTimeout(() => {
              chatInterfaceRef.current.sendSystemMessage(clarificationMsg);
            }, 1000);
          }
        } else {
          // Send financial health summary
          if (chatInterfaceRef.current?.sendSystemMessage) {
            setTimeout(() => {
              chatInterfaceRef.current.sendSystemMessage(
                `I've processed your ${finalResult.documentType?.replace('_', ' ')}. Ask me about your financial health.`
              );
            }, 1000);
          }
        }
      }

    } catch (error: any) {
      console.error('Error processing file:', error);
      setLastUploadResult(`❌ Error: ${error.message || 'Failed to process statement'}`);
      setProcessingSteps([]);
    } finally {
      setIsProcessing(false);
      // Auto-hide processing status after delay if successful
      // Note: We check for success by the absence of error message, 
      // relying on the fact that we just set success message above
      setTimeout(() => setProcessingSteps([]), 5000);
    }
  }, []);

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

  return (
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
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Last sync: Just now
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"></div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content Grid */}
        <div className="flex-1 grid grid-cols-12 gap-0 min-h-0 h-full">
          
          {/* Left Column: Visualization & Data (65%) */}
          <div className="col-span-12 lg:col-span-8 flex flex-col h-full border-r border-slate-200 dark:border-slate-800 overflow-y-auto bg-slate-50/50 dark:bg-black/5 p-6">
            <div className="max-w-5xl w-full mx-auto space-y-6">
              <VisualizationPanel key={chartRefreshKey} userId="default-user" />
            </div>
          </div>

          {/* Right Column: Actions & Chat (35%) */}
          <div className="col-span-12 lg:col-span-4 flex flex-col h-full bg-white dark:bg-gray-900">
            {/* Upload Section - Fixed at top */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
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
            <div className="flex-1 min-h-0 relative">
              <ChatInterface ref={chatInterfaceRef} userId="default-user" />
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
