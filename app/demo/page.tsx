'use client';

import { useState, useRef, useEffect } from 'react';
import ChatInterface from '@/components/ChatInterface';
import VisualizationPanel from '@/components/VisualizationPanel';
import SignupModal from '@/components/SignupModal';
import MobileChatModal from '@/components/MobileChatModal';
import EmailCollectionModal from '@/components/EmailCollectionModal';
import Link from 'next/link';

// Demo user ID - this will be used to load sample data
const DEMO_USER_ID = 'demo-user';

// Hardcoded fixed expenses for demo mode (transaction-level)
const DEMO_FIXED_EXPENSES = {
  month: new Date().toISOString().slice(0, 7),
  monthly_total: 2132,
  mtd_total: 17 + 8 + 8 + 270 + 29,
  expenses: [
    {
      id: 'demo-fixed-1',
      merchant: 'RBC',
      monthly_amount: 17,
      mtd_amount: 17,
      month_dates: [new Date().toISOString().slice(0, 7) + '-19'],
      currency: 'USD',
      is_maybe: false,
      fixed_expense_source: 'category',
    },
    {
      id: 'demo-fixed-2',
      merchant: 'PrimeVideo.ca',
      monthly_amount: 8,
      mtd_amount: 8,
      month_dates: [new Date().toISOString().slice(0, 7) + '-17'],
      currency: 'USD',
      is_maybe: false,
      fixed_expense_source: 'category',
    },
    {
      id: 'demo-fixed-3',
      merchant: 'Amazon Channels',
      monthly_amount: 8,
      mtd_amount: 8,
      month_dates: [new Date().toISOString().slice(0, 7) + '-16'],
      currency: 'USD',
      is_maybe: false,
      fixed_expense_source: 'category',
    },
    {
      id: 'demo-fixed-4',
      merchant: 'CONSUMER LOANS',
      monthly_amount: 270,
      mtd_amount: 270,
      month_dates: [new Date().toISOString().slice(0, 7) + '-13'],
      currency: 'USD',
      is_maybe: true,
      fixed_expense_source: 'llm',
      fixed_expense_confidence: 0.62,
      fixed_expense_explain: 'Loan repayment that likely recurs monthly',
    },
    {
      id: 'demo-fixed-5',
      merchant: 'CURSOR, AI POWERED IDE',
      monthly_amount: 29,
      mtd_amount: 29,
      month_dates: [new Date().toISOString().slice(0, 7) + '-12'],
      currency: 'USD',
      is_maybe: false,
      fixed_expense_source: 'llm',
      fixed_expense_confidence: 0.92,
      fixed_expense_explain: 'Recognizable subscription service',
    },
    {
      id: 'demo-fixed-6',
      merchant: 'Rent',
      monthly_amount: 1800,
      mtd_amount: 0,
      month_dates: [],
      currency: 'USD',
      is_maybe: false,
      fixed_expense_source: 'llm',
      fixed_expense_confidence: 0.9,
      fixed_expense_explain: 'Rent payment expected later this month',
    },
  ],
  calculated_at: new Date().toISOString(),
  from_cache: false,
};

export default function DemoPage() {
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [showTryYourDataModal, setShowTryYourDataModal] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailModalDismissed, setEmailModalDismissed] = useState(false);
  const chatInterfaceRef = useRef<any>(null);

  // TEMPORARILY DISABLED: Check if email modal should be shown
  // useEffect(() => {
  //   // Check localStorage to see if email was already submitted
  //   // Only check on client side
  //   if (typeof window !== 'undefined') {
  //     try {
  //       const emailSubmitted = localStorage.getItem('newsletter-email-submitted');
  //       
  //       if (!emailSubmitted) {
  //         // Show email modal after a brief delay for better UX
  //         const timer = setTimeout(() => {
  //           setShowEmailModal(true);
  //         }, 500);
  //         return () => clearTimeout(timer);
  //       } else {
  //         // Email already submitted, don't show modal
  //         setEmailModalDismissed(true);
  //         setShowEmailModal(false);
  //       }
  //     } catch (error) {
  //       // If localStorage access fails, show modal anyway
  //       console.error('Error accessing localStorage:', error);
  //       const timer = setTimeout(() => {
  //         setShowEmailModal(true);
  //       }, 500);
  //       return () => clearTimeout(timer);
  //     }
  //   }
  // }, []);

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

  const handleEmailModalClose = () => {
    setShowEmailModal(false);
    setEmailModalDismissed(true);
  };

  const handleEmailModalSkip = () => {
    setShowEmailModal(false);
    setEmailModalDismissed(true);
    // Don't store in localStorage - allow modal to show again next time
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

          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Main Content Grid */}
            <div className="flex-1 grid grid-cols-12 gap-0 min-h-0">
              
              {/* Left Column: Visualization & Data (65%) */}
              <div className="col-span-12 lg:col-span-8 flex flex-col h-full lg:border-r border-slate-200 dark:border-slate-800 overflow-y-auto bg-slate-50/50 dark:bg-black/5 p-4 lg:p-6">
                <div className="max-w-5xl w-full mx-auto space-y-6">
                  <VisualizationPanel 
                    key={dataLoaded ? 'loaded' : 'loading'} 
                    userId={DEMO_USER_ID}
                    fixedExpensesDemoData={DEMO_FIXED_EXPENSES}
                  />
                </div>
              </div>

              {/* Right Column: Chat (35%) - Hidden on mobile */}
              <div className="hidden lg:flex col-span-12 lg:col-span-4 flex-col min-h-0 bg-white dark:bg-gray-900">
                {/* Info Banner - moved to top of chat column */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-blue-100 dark:border-blue-800 px-4 py-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-blue-900 dark:text-blue-200">
                      You have <strong>{Math.max(0, 3 - questionCount)}</strong> question{Math.max(0, 3 - questionCount) !== 1 ? 's' : ''} remaining.
                    </p>
                  </div>
                </div>
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

      {/* TEMPORARILY DISABLED: Email Collection Modal - overlays on top of dashboard */}
      {/* <EmailCollectionModal
        isOpen={showEmailModal}
        onClose={handleEmailModalClose}
        onSkip={handleEmailModalSkip}
      /> */}

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
