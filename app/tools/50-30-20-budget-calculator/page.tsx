'use client';

import { useState, useMemo } from 'react';
import CalculatorInput from '@/components/tools/CalculatorInput';
import ResultCard from '@/components/tools/ResultCard';
import CTABanner from '@/components/tools/CTABanner';

export default function BudgetCalculator() {
  const [monthlyIncome, setMonthlyIncome] = useState<string>('5000');
  const [currentNeeds, setCurrentNeeds] = useState<string>('2800');
  const [currentWants, setCurrentWants] = useState<string>('1500');
  const [currentSavings, setCurrentSavings] = useState<string>('700');

  const results = useMemo(() => {
    const income = parseFloat(monthlyIncome) || 0;
    const needs = parseFloat(currentNeeds) || 0;
    const wants = parseFloat(currentWants) || 0;
    const savings = parseFloat(currentSavings) || 0;

    // Recommended allocations (50/30/20)
    const recommendedNeeds = income * 0.5;
    const recommendedWants = income * 0.3;
    const recommendedSavings = income * 0.2;

    // Current percentages
    const totalSpent = needs + wants + savings;
    const needsPercent = totalSpent > 0 ? (needs / income) * 100 : 0;
    const wantsPercent = totalSpent > 0 ? (wants / income) * 100 : 0;
    const savingsPercent = totalSpent > 0 ? (savings / income) * 100 : 0;

    // Differences
    const needsDiff = needs - recommendedNeeds;
    const wantsDiff = wants - recommendedWants;
    const savingsDiff = savings - recommendedSavings;

    return {
      recommendedNeeds,
      recommendedWants,
      recommendedSavings,
      needsPercent,
      wantsPercent,
      savingsPercent,
      needsDiff,
      wantsDiff,
      savingsDiff,
    };
  }, [monthlyIncome, currentNeeds, currentWants, currentSavings]);

  const formatDiff = (diff: number) => {
    if (diff > 0) return `$${diff.toLocaleString()} over`;
    if (diff < 0) return `$${Math.abs(diff).toLocaleString()} under`;
    return 'On target!';
  };

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
          50/30/20 Budget Calculator
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          The 50/30/20 rule is a simple budgeting framework: 50% for needs, 30% for wants, and 20% for savings.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Your Income</h2>
            <CalculatorInput
              label="Monthly Income (after tax)"
              value={monthlyIncome}
              onChange={setMonthlyIncome}
              type="currency"
              placeholder="5000"
            />
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Current Spending</h2>
            
            <CalculatorInput
              label="Needs (rent, groceries, utilities, insurance)"
              value={currentNeeds}
              onChange={setCurrentNeeds}
              type="currency"
              helpText="Essential expenses you can't avoid"
            />
            
            <CalculatorInput
              label="Wants (dining out, entertainment, shopping)"
              value={currentWants}
              onChange={setCurrentWants}
              type="currency"
              helpText="Non-essential expenses for enjoyment"
            />
            
            <CalculatorInput
              label="Savings & Debt Payments"
              value={currentSavings}
              onChange={setCurrentSavings}
              type="currency"
              helpText="Emergency fund, investments, extra debt payments"
            />
          </div>
        </div>

        {/* Results */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Recommended Budget</h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Needs (50%)</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{formatDiff(results.needsDiff)}</p>
                </div>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  ${results.recommendedNeeds.toLocaleString()}
                </p>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Wants (30%)</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{formatDiff(results.wantsDiff)}</p>
                </div>
                <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  ${results.recommendedWants.toLocaleString()}
                </p>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Savings (20%)</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{formatDiff(results.savingsDiff)}</p>
                </div>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  ${results.recommendedSavings.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Visual Comparison */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Your Current Split</h2>
            
            <div className="h-8 rounded-full overflow-hidden flex mb-4">
              <div 
                className="bg-blue-500 transition-all duration-500"
                style={{ width: `${Math.min(results.needsPercent, 100)}%` }}
              />
              <div 
                className="bg-purple-500 transition-all duration-500"
                style={{ width: `${Math.min(results.wantsPercent, 100)}%` }}
              />
              <div 
                className="bg-green-500 transition-all duration-500"
                style={{ width: `${Math.min(results.savingsPercent, 100)}%` }}
              />
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-blue-600 dark:text-blue-400">Needs: {results.needsPercent.toFixed(0)}%</span>
              <span className="text-purple-600 dark:text-purple-400">Wants: {results.wantsPercent.toFixed(0)}%</span>
              <span className="text-green-600 dark:text-green-400">Savings: {results.savingsPercent.toFixed(0)}%</span>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium">Ideal split:</span> 50% / 30% / 20%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="mt-8 bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">What Counts as Needs vs Wants?</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <h3 className="font-medium text-blue-600 dark:text-blue-400 mb-2">Needs (50%)</h3>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>• Rent/Mortgage</li>
              <li>• Utilities</li>
              <li>• Groceries</li>
              <li>• Health Insurance</li>
              <li>• Car Payment</li>
              <li>• Minimum Debt Payments</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-purple-600 dark:text-purple-400 mb-2">Wants (30%)</h3>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>• Dining Out</li>
              <li>• Entertainment</li>
              <li>• Shopping</li>
              <li>• Subscriptions</li>
              <li>• Travel</li>
              <li>• Hobbies</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-green-600 dark:text-green-400 mb-2">Savings (20%)</h3>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>• Emergency Fund</li>
              <li>• Retirement (401k, IRA)</li>
              <li>• Extra Debt Payments</li>
              <li>• Investments</li>
              <li>• Saving for Goals</li>
            </ul>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-8">
        <CTABanner 
          title="Automatically Categorize Your Spending"
          description="Upload your bank statements and Adphex will automatically sort your transactions into needs, wants, and savings categories."
        />
      </div>
    </div>
  );
}

