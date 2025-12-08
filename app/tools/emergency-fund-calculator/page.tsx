'use client';

import { useState, useMemo } from 'react';
import CalculatorInput from '@/components/tools/CalculatorInput';
import ResultCard from '@/components/tools/ResultCard';
import CTABanner from '@/components/tools/CTABanner';

export default function EmergencyFundCalculator() {
  const [monthlyExpenses, setMonthlyExpenses] = useState<string>('4000');
  const [currentSavings, setCurrentSavings] = useState<string>('8000');
  const [monthlyContribution, setMonthlyContribution] = useState<string>('500');
  const [jobStability, setJobStability] = useState<string>('medium');

  const results = useMemo(() => {
    const expenses = parseFloat(monthlyExpenses) || 0;
    const savings = parseFloat(currentSavings) || 0;
    const contribution = parseFloat(monthlyContribution) || 0;

    // Recommended months based on job stability
    let recommendedMonths = 6; // default
    if (jobStability === 'high') recommendedMonths = 3;
    else if (jobStability === 'medium') recommendedMonths = 6;
    else if (jobStability === 'low') recommendedMonths = 9;
    else if (jobStability === 'self-employed') recommendedMonths = 12;

    const targetFund = expenses * recommendedMonths;
    const currentMonths = expenses > 0 ? savings / expenses : 0;
    const remaining = Math.max(0, targetFund - savings);
    const monthsToGoal = contribution > 0 ? Math.ceil(remaining / contribution) : Infinity;
    const percentComplete = targetFund > 0 ? Math.min((savings / targetFund) * 100, 100) : 0;

    let status = '';
    let statusColor: 'green' | 'orange' | 'red' = 'red';
    
    if (currentMonths >= recommendedMonths) {
      status = 'Fully funded! You have a solid emergency fund.';
      statusColor = 'green';
    } else if (currentMonths >= 3) {
      status = 'Good progress! Keep building toward your goal.';
      statusColor = 'orange';
    } else if (currentMonths >= 1) {
      status = 'You have some coverage, but need to build more.';
      statusColor = 'orange';
    } else {
      status = 'Priority: Build your emergency fund ASAP.';
      statusColor = 'red';
    }

    return {
      targetFund,
      currentMonths,
      remaining,
      monthsToGoal,
      percentComplete,
      recommendedMonths,
      status,
      statusColor,
    };
  }, [monthlyExpenses, currentSavings, monthlyContribution, jobStability]);

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
          Emergency Fund Calculator
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Calculate how much you need in your emergency fund and track your progress toward financial security.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your Information</h2>
          
          <CalculatorInput
            label="Monthly Essential Expenses"
            value={monthlyExpenses}
            onChange={setMonthlyExpenses}
            type="currency"
            placeholder="4000"
            helpText="Rent, utilities, food, insurance, minimum payments"
          />
          
          <CalculatorInput
            label="Current Emergency Savings"
            value={currentSavings}
            onChange={setCurrentSavings}
            type="currency"
            placeholder="8000"
            helpText="Money set aside for emergencies only"
          />
          
          <CalculatorInput
            label="Monthly Contribution"
            value={monthlyContribution}
            onChange={setMonthlyContribution}
            type="currency"
            placeholder="500"
            helpText="How much you can save each month"
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Job Stability
            </label>
            <select
              value={jobStability}
              onChange={(e) => setJobStability(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-white py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              <option value="high">High - Stable job, in-demand skills</option>
              <option value="medium">Medium - Generally stable</option>
              <option value="low">Low - Uncertain or contract work</option>
              <option value="self-employed">Self-Employed / Freelancer</option>
            </select>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This affects how many months of expenses you should save
            </p>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          <ResultCard
            title="Emergency Fund Target"
            value={`$${results.targetFund.toLocaleString()}`}
            subtitle={`${results.recommendedMonths} months of expenses`}
            color="blue"
            size="lg"
          />
          
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-600 dark:text-slate-400">Progress</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">
                {results.percentComplete.toFixed(0)}%
              </span>
            </div>
            <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  results.percentComplete >= 100 ? 'bg-green-500' :
                  results.percentComplete >= 50 ? 'bg-blue-500' :
                  'bg-orange-500'
                }`}
                style={{ width: `${results.percentComplete}%` }}
              />
            </div>
            <p className={`mt-3 text-sm font-medium ${
              results.statusColor === 'green' ? 'text-green-600 dark:text-green-400' :
              results.statusColor === 'orange' ? 'text-orange-600 dark:text-orange-400' :
              'text-red-600 dark:text-red-400'
            }`}>
              {results.status}
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <ResultCard
              title="Current Coverage"
              value={`${results.currentMonths.toFixed(1)} months`}
              color={results.currentMonths >= 3 ? 'green' : 'orange'}
              size="sm"
            />
            <ResultCard
              title="Still Needed"
              value={`$${results.remaining.toLocaleString()}`}
              color={results.remaining > 0 ? 'orange' : 'green'}
              size="sm"
            />
          </div>

          {results.remaining > 0 && results.monthsToGoal !== Infinity && (
            <ResultCard
              title="Time to Goal"
              value={`${results.monthsToGoal} months`}
              subtitle={`At $${parseFloat(monthlyContribution).toLocaleString()}/month`}
              color="blue"
              size="sm"
            />
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="mt-8 bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Emergency Fund Best Practices</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-slate-900 dark:text-white mb-2">What to Include</h3>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>✓ Rent or mortgage payment</li>
              <li>✓ Utilities (electric, water, gas)</li>
              <li>✓ Groceries (not dining out)</li>
              <li>✓ Health insurance premiums</li>
              <li>✓ Minimum debt payments</li>
              <li>✓ Transportation basics</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-slate-900 dark:text-white mb-2">Where to Keep It</h3>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>✓ High-yield savings account</li>
              <li>✓ Money market account</li>
              <li>✗ Not in stocks or investments</li>
              <li>✗ Not in checking (too easy to spend)</li>
              <li>✗ Not in CDs (not liquid enough)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-8">
        <CTABanner 
          title="Track Your Emergency Fund Progress"
          description="Connect your bank accounts and Adphex will track your emergency fund, categorize expenses, and help you reach your goal faster."
        />
      </div>
    </div>
  );
}

