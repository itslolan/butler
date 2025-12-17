'use client';

import { useState, useEffect, useRef } from 'react';

interface BudgetQuestionnaireProps {
  onComplete: (data: { income: number; rent?: number }) => void;
  onUpload?: () => void;
  initialIncome?: number;
  incomeStats?: { medianMonthlyIncome: number; monthsIncluded: number };
}

// Typing effect hook
function useTypingEffect(text: string, speed: number = 30) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    // Reset on text change
    indexRef.current = 0;
    setIsComplete(false);
    setDisplayedText('');

    if (!text) {
      return;
    }

    const timer = setInterval(() => {
      if (indexRef.current < text.length) {
        const currentIndex = indexRef.current;
        // Use substring to avoid race conditions with concatenation
        setDisplayedText(text.substring(0, currentIndex + 1));
        indexRef.current++;
      } else {
        setIsComplete(true);
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return { displayedText, isComplete };
}

export default function BudgetQuestionnaire({ onComplete, onUpload, initialIncome = 0, incomeStats }: BudgetQuestionnaireProps) {
  const [income, setIncome] = useState(initialIncome > 0 ? initialIncome.toString() : '');
  const [rent, setRent] = useState('');
  const incomeInputRef = useRef<HTMLInputElement>(null);
  
  const hasMedianIncome = incomeStats && incomeStats.medianMonthlyIncome > 0 && incomeStats.monthsIncluded > 0;
  
  const titleText = "I need just a few details to get started...";
  const baseBodyText = "Don't worry about being precise right now. These are just estimates to help me draft your initial budget. I'll automatically refine everything as you connect your accounts or upload statements.";
  
  // Add median income context if available
  const medianContext = hasMedianIncome 
    ? ` I've pre-filled your median monthly income over the last ${incomeStats.monthsIncluded} months based on your transaction history.` 
    : '';
  
  const bodyText = baseBodyText + medianContext;

  const { displayedText: title, isComplete: titleComplete } = useTypingEffect(titleText, 25);
  const { displayedText: body, isComplete: bodyComplete } = useTypingEffect(titleComplete ? bodyText : '', 10);

  // Focus input when text finishes
  useEffect(() => {
    if (titleComplete && bodyComplete) {
      setTimeout(() => incomeInputRef.current?.focus(), 500);
    }
  }, [titleComplete, bodyComplete]);

  const handleSubmit = () => {
    const incomeVal = parseFloat(income);
    const rentVal = parseFloat(rent);
    if (!isNaN(incomeVal)) {
      onComplete({ 
        income: incomeVal, 
        rent: isNaN(rentVal) ? undefined : rentVal 
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && income) {
      handleSubmit();
    }
  };

  return (
    <div className="mb-8 px-2 max-w-3xl mx-auto">
      {/* Streaming Text Header */}
      <div className="mb-8 space-y-3">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20 mt-1">
            <span className="text-xl">✨</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 min-h-[1.75rem]">
              {title}
              {!titleComplete && <span className="animate-pulse inline-block w-0.5 h-5 bg-indigo-500 ml-1 align-middle"/>}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed min-h-[3rem] text-sm md:text-base">
              {body}
              {titleComplete && !bodyComplete && <span className="animate-pulse inline-block w-0.5 h-4 bg-slate-400 ml-1 align-middle"/>}
            </p>
          </div>
        </div>
      </div>

      {/* Form Area - Fades in after text */}
      <div 
        className={`transition-all duration-700 delay-300 ${
          (titleComplete && bodyComplete) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="grid sm:grid-cols-2 gap-6 mb-8 pl-[3.5rem]">
          {/* Income Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Average Monthly Income
            </label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors text-lg">$</span>
              <input
                ref={incomeInputRef}
                type="number"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="0"
                className="w-full pl-9 pr-4 py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-lg font-medium shadow-sm hover:border-slate-200 dark:hover:border-slate-600 placeholder:text-slate-300"
              />
            </div>
          </div>

          {/* Rent Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Rent or Mortgage <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors text-lg">$</span>
              <input
                type="number"
                value={rent}
                onChange={(e) => setRent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="0"
                className="w-full pl-9 pr-4 py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-lg font-medium shadow-sm hover:border-slate-200 dark:hover:border-slate-600 placeholder:text-slate-300"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pl-[3.5rem]">
          <button
            onClick={onUpload}
            className="group flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors text-sm font-medium px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          >
            <svg className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            I&apos;d rather upload statements
          </button>

          <button
            onClick={handleSubmit}
            disabled={!income}
            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-2xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none disabled:shadow-none flex items-center justify-center gap-2 group"
          >
            Continue to Budget
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono bg-white/20 px-1.5 py-0.5 rounded border border-white/30 opacity-80 group-hover:opacity-100 transition-opacity">↵</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
