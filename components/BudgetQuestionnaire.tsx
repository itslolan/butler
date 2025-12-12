'use client';

import { useState } from 'react';

interface BudgetQuestionnaireProps {
  onComplete: (data: { income: number; rent?: number }) => void;
  onUpload?: () => void;
  initialIncome?: number;
}

export default function BudgetQuestionnaire({ onComplete, onUpload, initialIncome = 0 }: BudgetQuestionnaireProps) {
  const [income, setIncome] = useState(initialIncome > 0 ? initialIncome.toString() : '');
  const [rent, setRent] = useState('');

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

  return (
    <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-8 shadow-lg text-white mb-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h2 className="text-2xl font-bold mb-2">Answer the below questions to get started.</h2>
          <div className="flex items-start gap-2 text-white/90 bg-white/10 p-4 rounded-xl backdrop-blur-sm">
            <span className="text-xl">💡</span>
            <p className="text-sm leading-relaxed">
              <span className="font-semibold">Want to do this the easy way?</span> Just upload your bank statements, 
              and I can 🪄 magically generate budgets for you. The more months you upload, the better I can learn from your patterns and help you.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-white/90">
              What is your average income in a month?
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <input
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
              What is your rent or mortgage amount? <span className="text-white/60 font-normal">(Optional)</span>
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
        </div>

        <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm">
          <p className="text-xs text-white/80 text-center">
            Remember, these figures don't need to be accurate. Once you start uploading your bank statements, Adphex will auto adjust all your amounts.
          </p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={onUpload}
            className="text-sm font-medium text-white hover:text-white/80 underline decoration-white/30 hover:decoration-white/80 transition-all"
          >
            Upload bank statements
          </button>

          <button
            onClick={handleSubmit}
            disabled={!income}
            className="px-8 py-3 bg-white text-purple-600 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            Next
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

