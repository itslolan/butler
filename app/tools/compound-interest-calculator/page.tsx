'use client';

import { useState, useMemo } from 'react';
import CalculatorInput from '@/components/tools/CalculatorInput';
import ResultCard from '@/components/tools/ResultCard';
import CTABanner from '@/components/tools/CTABanner';

export default function CompoundInterestCalculator() {
  const [principal, setPrincipal] = useState<string>('10000');
  const [monthlyContribution, setMonthlyContribution] = useState<string>('500');
  const [annualRate, setAnnualRate] = useState<string>('7');
  const [years, setYears] = useState<string>('20');
  const [compoundFrequency, setCompoundFrequency] = useState<string>('12');

  const results = useMemo(() => {
    const P = parseFloat(principal) || 0;
    const PMT = parseFloat(monthlyContribution) || 0;
    const r = (parseFloat(annualRate) || 0) / 100;
    const t = parseFloat(years) || 0;
    const n = parseInt(compoundFrequency) || 12;

    // Future value of initial principal
    const futureValuePrincipal = P * Math.pow(1 + r/n, n * t);
    
    // Future value of monthly contributions (annuity)
    // FV = PMT * (((1 + r/n)^(n*t) - 1) / (r/n))
    let futureValueContributions = 0;
    if (r > 0) {
      futureValueContributions = PMT * ((Math.pow(1 + r/n, n * t) - 1) / (r/n));
    } else {
      futureValueContributions = PMT * n * t;
    }

    const totalFutureValue = futureValuePrincipal + futureValueContributions;
    const totalContributed = P + (PMT * 12 * t);
    const totalInterest = totalFutureValue - totalContributed;
    const percentGrowth = totalContributed > 0 ? ((totalFutureValue - totalContributed) / totalContributed) * 100 : 0;

    // Calculate year by year breakdown
    const yearlyBreakdown: Array<{ year: number; balance: number; contributions: number; interest: number }> = [];
    let runningBalance = P;
    let runningContributions = P;
    
    for (let y = 1; y <= t; y++) {
      const startBalance = runningBalance;
      // Compound for the year
      for (let month = 0; month < 12; month++) {
        runningBalance = runningBalance * (1 + r/n) + PMT;
        runningContributions += PMT;
      }
      
      yearlyBreakdown.push({
        year: y,
        balance: runningBalance,
        contributions: runningContributions,
        interest: runningBalance - runningContributions,
      });
    }

    return {
      totalFutureValue,
      totalContributed,
      totalInterest,
      percentGrowth,
      yearlyBreakdown,
    };
  }, [principal, monthlyContribution, annualRate, years, compoundFrequency]);

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
          Compound Interest Calculator
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          See how your money grows over time with the power of compound interest.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Investment Details</h2>
          
          <CalculatorInput
            label="Starting Amount"
            value={principal}
            onChange={setPrincipal}
            type="currency"
            placeholder="10000"
            helpText="Initial investment amount"
          />
          
          <CalculatorInput
            label="Monthly Contribution"
            value={monthlyContribution}
            onChange={setMonthlyContribution}
            type="currency"
            placeholder="500"
            helpText="Amount you'll add each month"
          />
          
          <CalculatorInput
            label="Expected Annual Return"
            value={annualRate}
            onChange={setAnnualRate}
            type="percentage"
            placeholder="7"
            helpText="S&P 500 averages ~10% historically"
          />
          
          <CalculatorInput
            label="Time Period (Years)"
            value={years}
            onChange={setYears}
            type="number"
            placeholder="20"
            min={1}
            max={50}
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Compound Frequency
            </label>
            <select
              value={compoundFrequency}
              onChange={(e) => setCompoundFrequency(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-white py-2.5 px-3 text-sm"
            >
              <option value="365">Daily</option>
              <option value="12">Monthly</option>
              <option value="4">Quarterly</option>
              <option value="1">Annually</option>
            </select>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl p-6 text-white">
            <p className="text-green-100 text-sm mb-1">Future Value</p>
            <p className="text-4xl font-bold">
              ${results.totalFutureValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-green-100 mt-2">
              After {years} years
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ResultCard
              title="Total Contributed"
              value={`$${results.totalContributed.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              color="blue"
              size="sm"
            />
            <ResultCard
              title="Interest Earned"
              value={`$${results.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              color="green"
              size="sm"
            />
          </div>

          <ResultCard
            title="Total Growth"
            value={`${results.percentGrowth.toFixed(0)}%`}
            subtitle="Return on contributions"
            color="purple"
            size="md"
          />

          {/* Mini Chart */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Growth Breakdown</h3>
            <div className="h-8 rounded-full overflow-hidden flex">
              <div 
                className="bg-blue-500 transition-all duration-500 flex items-center justify-center"
                style={{ width: `${(results.totalContributed / results.totalFutureValue) * 100}%` }}
              >
                {(results.totalContributed / results.totalFutureValue) * 100 > 15 && (
                  <span className="text-xs text-white font-medium">Contributions</span>
                )}
              </div>
              <div 
                className="bg-green-500 transition-all duration-500 flex items-center justify-center"
                style={{ width: `${(results.totalInterest / results.totalFutureValue) * 100}%` }}
              >
                {(results.totalInterest / results.totalFutureValue) * 100 > 15 && (
                  <span className="text-xs text-white font-medium">Interest</span>
                )}
              </div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Contributions: {((results.totalContributed / results.totalFutureValue) * 100).toFixed(0)}%</span>
              <span>Interest: {((results.totalInterest / results.totalFutureValue) * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Year by Year Table */}
      {results.yearlyBreakdown.length > 0 && (
        <div className="mt-8 bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Year by Year Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Year</th>
                  <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">Balance</th>
                  <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">Contributions</th>
                  <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">Interest Earned</th>
                </tr>
              </thead>
              <tbody>
                {results.yearlyBreakdown.filter((_, i) => i % Math.ceil(results.yearlyBreakdown.length / 10) === 0 || i === results.yearlyBreakdown.length - 1).map((row) => (
                  <tr key={row.year} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 text-slate-900 dark:text-white">{row.year}</td>
                    <td className="py-2 text-right font-medium text-slate-900 dark:text-white">
                      ${row.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 text-right text-blue-600 dark:text-blue-400">
                      ${row.contributions.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 text-right text-green-600 dark:text-green-400">
                      ${row.interest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Educational Content */}
      <div className="mt-8 bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">The Power of Compound Interest</h2>
        <div className="prose prose-slate dark:prose-invert max-w-none text-sm">
          <p className="text-slate-600 dark:text-slate-400">
            Compound interest is often called &quot;the eighth wonder of the world&quot; because of its ability to grow wealth exponentially over time. Unlike simple interest, compound interest earns interest on your interest.
          </p>
          <div className="grid md:grid-cols-2 gap-6 mt-4">
            <div>
              <h3 className="font-medium text-slate-900 dark:text-white mb-2">Key Factors</h3>
              <ul className="text-slate-600 dark:text-slate-400 space-y-1">
                <li>• <strong>Time</strong>: The longer you invest, the more compound interest works for you</li>
                <li>• <strong>Rate</strong>: Higher returns compound faster</li>
                <li>• <strong>Frequency</strong>: More frequent compounding = slightly higher returns</li>
                <li>• <strong>Contributions</strong>: Regular additions accelerate growth</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-slate-900 dark:text-white mb-2">Rule of 72</h3>
              <p className="text-slate-600 dark:text-slate-400">
                To estimate how long it takes to double your money, divide 72 by your annual return rate.
              </p>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                At {annualRate}% return: <strong className="text-slate-900 dark:text-white">{(72 / (parseFloat(annualRate) || 7)).toFixed(1)} years</strong> to double
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-8">
        <CTABanner 
          title="Track Your Investment Growth"
          description="Connect your investment accounts and watch your compound interest grow in real-time with Adphex."
        />
      </div>
    </div>
  );
}


