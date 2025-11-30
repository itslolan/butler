'use client';

import { useRef } from 'react';

interface MobileUploadButtonProps {
  onFileUpload: (file: File) => void;
  isProcessing: boolean;
}

export default function MobileUploadButton({ onFileUpload, isProcessing }: MobileUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      // Reset input
      e.target.value = '';
    }
  };

  return (
    <div className="lg:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-slate-800 p-3 -mx-4 -mt-4 mb-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,.pdf"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isProcessing}
      />
      
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            <span>Processing...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span>Upload Statement</span>
          </>
        )}
      </button>
    </div>
  );
}

