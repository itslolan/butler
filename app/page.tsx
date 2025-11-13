'use client';

import { useState, useCallback } from 'react';
import FileUpload from '@/components/FileUpload';
import Dashboard from '@/components/Dashboard';
import { FinancialData } from '@/types/financial';

export default function Home() {
  const [financialData, setFinancialData] = useState<FinancialData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/process-statement', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to process statement');
      }

      const data = await response.json();
      setFinancialData(prev => [...prev, data]);
    } catch (error: any) {
      console.error('Error processing file:', error);
      alert(error.message || 'Failed to process statement. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-2 text-gray-900 dark:text-white">
          🤵 Butler
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
          Your AI-powered financial health tracker
        </p>

        <div className="relative">
          {financialData.length === 0 ? (
            <div className="relative">
              {/* Blurred example dashboard */}
              <div className="blur-sm pointer-events-none">
                <Dashboard financialData={[]} isExample={true} />
              </div>
              
              {/* Upload button centered */}
              <div className="absolute inset-0 flex items-center justify-center">
                <FileUpload onFileUpload={handleFileUpload} isProcessing={isProcessing} />
              </div>
            </div>
          ) : (
            <>
              <FileUpload onFileUpload={handleFileUpload} isProcessing={isProcessing} />
              <Dashboard financialData={financialData} isExample={false} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}

