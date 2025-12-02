'use client';

import { useState, useRef, useEffect } from 'react';
import ChatInterface from '@/components/ChatInterface';
import VisualizationPanel from '@/components/VisualizationPanel';
import SignupModal from '@/components/SignupModal';
import MobileChatModal from '@/components/MobileChatModal';
import Link from 'next/link';

// Demo user ID - this will be used to load sample data
const DEMO_USER_ID = 'demo-user';

export default function DemoPage() {
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [showTryYourDataModal, setShowTryYourDataModal] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const chatInterfaceRef = useRef<any>(null);

  // Load sample data on mount
  useEffect(() => {
    const loadSampleData = async () => {
      try {
        console.log('Loading sample data...');
        // Force recreate to ensure fresh data
        const response = await fetch('/api/seed-sample-data', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: true })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Sample data loaded:', result);
        
        if (result.error) {
          console.error('Seed API returned error:', result.error);
        }
        
        if (result.verification) {
          console.log('Data verification:', result.verification);
        }
        
        setDataLoaded(true);
      } catch (error) {
        console.error('Failed to load sample data:', error);
        setDataLoaded(true); // Continue anyway
      }
    };
    loadSampleData();
  }, []);

  const handleQuestionLimit = () => {
    setShowSignupModal(true);
  };

  return (
    <>
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
            <button
              onClick={() => setShowTryYourDataModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-full transition-all shadow-sm hover:shadow-md"
            >
              Try it with your data
            </button>
            <Link 
              href="/login"
              className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Sign In
            </Link>
          </div>
        </header>

        {/* Info Banner */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-blue-100 dark:border-blue-800 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-blue-900 dark:text-blue-200">
                You have <strong>{Math.max(0, 3 - questionCount)}</strong> question{Math.max(0, 3 - questionCount) !== 1 ? 's' : ''} remaining.
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Main Content Grid */}
          <div className="flex-1 grid grid-cols-12 gap-0 min-h-0">
            
            {/* Left Column: Visualization & Data (65%) */}
            <div className="col-span-12 lg:col-span-8 flex flex-col h-full lg:border-r border-slate-200 dark:border-slate-800 overflow-y-auto bg-slate-50/50 dark:bg-black/5 p-4 lg:p-6">
              <div className="max-w-5xl w-full mx-auto space-y-6">
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l4 4a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">Bank Statement</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Your financial data</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Ask questions to explore your financial data and get insights!
                  </p>
                </div>
                
                <VisualizationPanel key={dataLoaded ? 'loaded' : 'loading'} userId={DEMO_USER_ID} />
              </div>
            </div>

            {/* Right Column: Chat (35%) - Hidden on mobile */}
            <div className="hidden lg:flex col-span-12 lg:col-span-4 flex-col min-h-0 bg-white dark:bg-gray-900">
              <div className="flex-1 min-h-0 overflow-hidden">
                <ChatInterface 
                  ref={chatInterfaceRef} 
                  userId={DEMO_USER_ID}
                  isDemoMode={true}
                  maxQuestions={3}
                  questionCount={questionCount}
                  onQuestionCountChange={setQuestionCount}
                  onQuestionLimit={handleQuestionLimit}
                />
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Signup Modal - appears after 3 questions */}
      <SignupModal
        isOpen={showSignupModal}
        onClose={() => setShowSignupModal(false)}
      title="Continue with Adphex"
      description="You've reached the limit. Sign up to ask unlimited questions and analyze your own data."
      />

      {/* Try with your data Modal */}
      <SignupModal
        isOpen={showTryYourDataModal}
        onClose={() => setShowTryYourDataModal(false)}
        title="Try it with your data"
        description="Create an account to upload your bank statements and get personalized financial insights."
      />

      {/* Mobile Chat Modal */}
      <MobileChatModal
        userId={DEMO_USER_ID}
        chatInterfaceRef={chatInterfaceRef}
        isOpen={isMobileChatOpen}
        onOpenChange={setIsMobileChatOpen}
        isDemoMode={true}
        maxQuestions={3}
        questionCount={questionCount}
        onQuestionCountChange={setQuestionCount}
        onQuestionLimit={handleQuestionLimit}
      />
    </>
  );
}
