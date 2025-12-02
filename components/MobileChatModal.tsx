'use client';

import { useState } from 'react';
import ChatInterface from './ChatInterface';

interface MobileChatModalProps {
  userId: string;
  chatInterfaceRef: React.RefObject<any>;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  isDemoMode?: boolean;
  maxQuestions?: number;
  questionCount?: number;
  onQuestionCountChange?: (count: number) => void;
  onQuestionLimit?: () => void;
}

export default function MobileChatModal({ 
  userId, 
  chatInterfaceRef, 
  isOpen, 
  onOpenChange,
  isDemoMode = false,
  maxQuestions,
  questionCount,
  onQuestionCountChange,
  onQuestionLimit,
}: MobileChatModalProps) {
  return (
    <>
      {/* Floating Action Bar - Only visible on mobile */}
      <button
        onClick={() => onOpenChange(true)}
        className="fixed bottom-0 left-0 right-0 lg:hidden z-40 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-3 group active:scale-[0.99] border-t-2 border-blue-500/20"
        aria-label="Open chat"
      >
        <svg 
          className="w-5 h-5" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
          />
        </svg>
        <span className="font-semibold text-lg">Ask me anything</span>
        <span className="absolute top-2 right-4 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white animate-pulse"></span>
      </button>

      {/* Modal Overlay - Only on mobile */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          
          {/* Modal Content */}
          <div className="absolute inset-0 flex flex-col bg-white dark:bg-gray-900 animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
                  A
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">Chat with Adphex</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">AI Financial Assistant</p>
                </div>
              </div>
              
              <button
                onClick={() => onOpenChange(false)}
                className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                aria-label="Close chat"
              >
                <svg 
                  className="w-5 h-5 text-slate-600 dark:text-slate-400" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M19 9l-7 7-7-7" 
                  />
                </svg>
              </button>
            </div>

            {/* Chat Interface */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatInterface 
                ref={chatInterfaceRef} 
                userId={userId}
                isDemoMode={isDemoMode}
                maxQuestions={maxQuestions}
                questionCount={questionCount}
                onQuestionCountChange={onQuestionCountChange}
                onQuestionLimit={onQuestionLimit}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

