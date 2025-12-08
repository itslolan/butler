'use client';

import { useState, useMemo } from 'react';
import { Metadata } from 'next';
import CalculatorInput from '@/components/tools/CalculatorInput';
import ResultCard from '@/components/tools/ResultCard';
import CTABanner from '@/components/tools/CTABanner';

export default function SavingsRateCalculator() {
  const [monthlyIncome, setMonthlyIncome] = useState<string>('5000');
  const [monthlyExpenses, setMonthlyExpenses] = useState<string>('3500');

  const results = useMemo(() => {
    const income = parseFloat(monthlyIncome) || 0;
    const expenses = parseFloat(monthlyExpenses) || 0;
    const savings = income - expenses;
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;
    const annualSavings = savings * 12;

    let rating = '';
    let ratingColor: 'red' | 'orange' | 'green' = 'red';
    
    if (savingsRate >= 50) {
      rating = 'Exceptional! You\'re in the top 5% of savers.';
      ratingColor = 'green';
    } else if (savingsRate >= 30) {
      rating = 'Excellent! You\'re on track for early retirement.';
      ratingColor = 'green';
    } else if (savingsRate >= 20) {
      rating = 'Great! You\'re saving more than average.';
      ratingColor = 'green';
    } else if (savingsRate >= 10) {
      rating = 'Good start, but there\'s room to improve.';
      ratingColor = 'orange';
    } else if (savingsRate > 0) {
      rating = 'You\'re saving something, but aim for at least 20%.';
      ratingColor = 'orange';
    } else {
      rating = 'You\'re spending more than you earn. Time to review your budget.';
      ratingColor = 'red';
    }

    return { savings, savingsRate, annualSavings, rating, ratingColor };
  }, [monthlyIncome, monthlyExpenses]);

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
          Savings Rate Calculator
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Calculate what percentage of your income you&apos;re saving and see how you compare to top savers.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your Numbers</h2>
          
          <CalculatorInput
            label="Monthly Income (after tax)"
            value={monthlyIncome}
            onChange={setMonthlyIncome}
            type="currency"
            placeholder="5000"
            helpText="Your total take-home pay each month"
          />
          
          <CalculatorInput
            label="Monthly Expenses"
            value={monthlyExpenses}
            onChange={setMonthlyExpenses}
            type="currency"
            placeholder="3500"
            helpText="Everything you spend each month"
          />
        </div>

        {/* Results */}
        <div className="space-y-4">
          <ResultCard
            title="Your Savings Rate"
            value={`${results.savingsRate.toFixed(1)}%`}
            subtitle={results.rating}
            color={results.ratingColor}
            size="lg"
          />
          
          <div className="grid grid-cols-2 gap-4">
            <ResultCard
              title="Monthly Savings"
              value={`$${results.savings.toLocaleString()}`}
              color={results.savings >= 0 ? 'green' : 'red'}
              size="sm"
            />
            <ResultCard
              title="Annual Savings"
              value={`$${results.annualSavings.toLocaleString()}`}
              color={results.annualSavings >= 0 ? 'green' : 'red'}
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* Benchmark Chart */}
      <div className="mt-8 bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">How Do You Compare?</h2>
        <div className="space-y-3">
          {[
            { label: 'Average American', rate: 4.6, color: 'bg-red-500' },
            { label: 'Good Saver', rate: 15, color: 'bg-orange-500' },
            { label: 'Great Saver', rate: 20, color: 'bg-yellow-500' },
            { label: 'FIRE Movement', rate: 50, color: 'bg-green-500' },
            { label: 'Your Rate', rate: results.savingsRate, color: 'bg-blue-500' },
          ].sort((a, b) => a.rate - b.rate).map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <div className="w-24 text-sm text-slate-600 dark:text-slate-400">{item.label}</div>
              <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-6 overflow-hidden">
                <div 
                  className={`h-full ${item.color} rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
                  style={{ width: `${Math.min(Math.max(item.rate, 0), 100)}%` }}
                >
                  {item.rate >= 10 && (
                    <span className="text-xs text-white font-medium">{item.rate.toFixed(1)}%</span>
                  )}
                </div>
              </div>
              {item.rate < 10 && (
                <span className="text-xs text-slate-500 dark:text-slate-400 w-12">{item.rate.toFixed(1)}%</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="mt-8 bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Tips to Increase Your Savings Rate</h2>
        <ul className="space-y-3 text-slate-600 dark:text-slate-400">
          <li className="flex items-start gap-3">
            <span className="text-green-500">✓</span>
            <span>Pay yourself first: Set up automatic transfers to savings on payday</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-green-500">✓</span>
            <span>Track your spending to identify areas to cut back</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-green-500">✓</span>
            <span>Negotiate bills and subscriptions for lower rates</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-green-500">✓</span>
            <span>Increase income through side hustles or asking for a raise</span>
          </li>
        </ul>
      </div>

      {/* CTA */}
      <div className="mt-8">
        <CTABanner 
          title="Track Your Savings Rate Automatically"
          description="Upload your bank statements and Adphex will calculate your savings rate, categorize expenses, and show trends over time."
        />
      </div>
    </div>
  );
}

