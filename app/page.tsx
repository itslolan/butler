'use client';

import { useState, useCallback } from 'react';
import FileUpload from '@/components/FileUpload';
import ChatInterface from '@/components/ChatInterface';

export default function Home() {
  const [uploadCount, setUploadCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastUploadResult, setLastUploadResult] = useState<string>('');

  const handleFileUpload = useCallback(async (file: File) => {
    setIsProcessing(true);
    setLastUploadResult('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', 'default-user');

      const response = await fetch('/api/process-statement', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to process statement');
      }

      const data = await response.json();
      setUploadCount(prev => prev + 1);
      setLastUploadResult(
        `✅ Successfully processed ${file.name}\n` +
        `Document Type: ${data.documentType}\n` +
        `Transactions: ${data.transactionCount}`
      );
    } catch (error: any) {
      console.error('Error processing file:', error);
      setLastUploadResult(`❌ Error: ${error.message || 'Failed to process statement'}`);
    } finally {
      setIsProcessing(false);
    }
  }, []);

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
            <ChatInterface userId="default-user" />
          </div>
        </div>
      </div>
    </main>
  );
}

