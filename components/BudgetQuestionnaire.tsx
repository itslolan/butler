'use client';

import { useState, useEffect, useRef } from 'react';

interface BudgetQuestionnaireProps {
  onComplete: (data: { income: number; rent?: number }) => void;
  onUpload?: () => void;
  initialIncome?: number;
}

// Streaming text hook for AI-like typing effect
function useStreamingText(fullText: string, speed: number = 30) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setDisplayedText('');
    setIsComplete(false);
    
    let currentIndex = 0;
    const words = fullText.split(' ');
    
    const interval = setInterval(() => {
      if (currentIndex < words.length) {
        setDisplayedText(words.slice(0, currentIndex + 1).join(' '));
        currentIndex++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [fullText, speed]);

  return { displayedText, isComplete };
}

export default function BudgetQuestionnaire({ onComplete, onUpload, initialIncome = 0 }: BudgetQuestionnaireProps) {
  const [income, setIncome] = useState(initialIncome > 0 ? initialIncome.toString() : '');
  const [rent, setRent] = useState('');
  const [showQuestions, setShowQuestions] = useState(false);
  const incomeInputRef = useRef<HTMLInputElement>(null);

  // AI-style conversational text
  const greetingText = "Hi there! I'm here to help you set up your budget.";
  const introText = "I just need a couple of quick things from you to get started. Don't worry about being exact — once you upload your bank statements, I'll fine-tune everything automatically.";
  const tipText = "Want to skip this? Just upload your bank statements and I'll magically generate your budget from your actual spending patterns.";

  // Streaming hooks for each text block
  const greeting = useStreamingText(greetingText, 40);
  const intro = useStreamingText(greeting.isComplete ? introText : '', 35);
  const tip = useStreamingText(intro.isComplete ? tipText : '', 30);

  // Show questions after intro completes
  useEffect(() => {
    if (intro.isComplete) {
      const timer = setTimeout(() => {
        setShowQuestions(true);
        // Focus the income input after questions appear
        setTimeout(() => incomeInputRef.current?.focus(), 100);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [intro.isComplete]);

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

  // Typing cursor component
  const TypingCursor = ({ show }: { show: boolean }) => (
    show ? (
      <span className="inline-block w-0.5 h-5 bg-white/80 ml-1 animate-pulse" />
    ) : null
  );

  return (
    <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-8 shadow-lg text-white mb-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* AI Avatar and Greeting */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 ring-2 ring-white/30">
            <span className="text-2xl">🤖</span>
          </div>
          <div className="flex-1 space-y-4">
            {/* Greeting */}
            <div className="min-h-[2rem]">
              <h2 className="text-2xl font-bold">
                {greeting.displayedText}
                <TypingCursor show={!greeting.isComplete} />
              </h2>
            </div>

            {/* Intro text */}
            {greeting.isComplete && (
              <div className="min-h-[3rem]">
                <p className="text-white/90 leading-relaxed">
                  {intro.displayedText}
                  <TypingCursor show={!intro.isComplete && greeting.isComplete} />
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tip box - appears after intro */}
        {intro.isComplete && (
          <div 
            className={`flex items-start gap-2 text-white/90 bg-white/10 p-4 rounded-xl backdrop-blur-sm transition-all duration-500 ${
              intro.isComplete ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            <span className="text-xl shrink-0">💡</span>
            <p className="text-sm leading-relaxed">
              {tip.displayedText}
              <TypingCursor show={!tip.isComplete && intro.isComplete} />
            </p>
          </div>
        )}

        {/* Questions - fade in after intro completes */}
        <div 
          className={`space-y-6 transition-all duration-500 ${
            showQuestions ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-white/90">
              What is your average monthly income?
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <input
                ref={incomeInputRef}
                type="number"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                placeholder="0"
                className="w-full pl-8 pr-4 py-3 bg-white text-slate-900 rounded-xl focus:outline-none focus:ring-4 focus:ring-white/20 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-white/90">
              What is your rent or mortgage? <span className="text-white/60 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <input
                type="number"
                value={rent}
                onChange={(e) => setRent(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-3 bg-white text-slate-900 rounded-xl focus:outline-none focus:ring-4 focus:ring-white/20 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm">
            <p className="text-xs text-white/80 text-center">
              These don&apos;t need to be exact. I&apos;ll adjust everything automatically once you start uploading statements.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={onUpload}
              className="text-sm font-medium text-white hover:text-white/80 underline decoration-white/30 hover:decoration-white/80 transition-all"
            >
              Upload bank statements instead
            </button>

            <button
              onClick={handleSubmit}
              disabled={!income}
              className="px-8 py-3 bg-white text-purple-600 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Continue
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
