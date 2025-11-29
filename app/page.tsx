'use client';

import { useState, useCallback, useRef } from 'react';
import FileUpload from '@/components/FileUpload';
import ChatInterface from '@/components/ChatInterface';

export default function Home() {
  const [uploadCount, setUploadCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastUploadResult, setLastUploadResult] = useState<string>('');
  const [processingSteps, setProcessingSteps] = useState<Array<{ step: string; status: string; message: string; timestamp: number }>>([]);
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
        
        const resultMessage = `✅ Successfully processed ${finalResult.fileName}\n` +
          `Document Type: ${finalResult.documentType}\n` +
          `Transactions Saved: ${finalResult.transactionCount}`;
        
        setLastUploadResult(resultMessage);
        
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
                `I've processed your ${finalResult.documentType?.replace('_', ' ')}. Please ask me about your financial health for this period, such as "What's my income vs expenses?" or "Show me my spending breakdown."`
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
    
    message += `Please help me categorize these transactions so I can provide better financial insights.`;
    
    return message;
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 h-screen flex flex-col">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">
            🤵 Butler
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Your AI-powered financial assistant
          </p>
        </div>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
          {/* Left side: Upload */}
          <div className="flex flex-col space-y-4">
            <FileUpload onFileUpload={handleFileUpload} isProcessing={isProcessing} />
            
            {/* Processing Steps */}
            {processingSteps.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  📊 Processing Steps
                </h3>
                <div className="space-y-2">
                  {processingSteps.map((step, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      {step.status === 'complete' ? (
                        <span className="text-green-500 mt-0.5">✓</span>
                      ) : (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mt-0.5"></div>
                      )}
                      <span className="text-gray-700 dark:text-gray-300 flex-1">
                        {step.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {lastUploadResult && (
              <div className={`p-4 rounded-lg ${
                lastUploadResult.startsWith('✅') 
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
              }`}>
                <pre className="whitespace-pre-wrap text-sm">{lastUploadResult}</pre>
              </div>
            )}

            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                📊 Upload Statistics
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Documents processed: <span className="font-bold">{uploadCount}</span>
              </p>
            </div>
          </div>

          {/* Right side: Chat */}
          <div className="flex flex-col min-h-0">
            <ChatInterface ref={chatInterfaceRef} userId="default-user" />
          </div>
        </div>
      </div>
    </main>
  );
}

