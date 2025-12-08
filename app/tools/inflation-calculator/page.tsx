'use client';

import { useState, useMemo } from 'react';
import CalculatorInput from '@/components/tools/CalculatorInput';
import ResultCard from '@/components/tools/ResultCard';
import CTABanner from '@/components/tools/CTABanner';

export default function InflationCalculator() {
  const [amount, setAmount] = useState<string>('100');
  const [startYear, setStartYear] = useState<string>('2000');
  const [endYear, setEndYear] = useState<string>('2024');
  const [customInflation, setCustomInflation] = useState<string>('3');
  const [mode, setMode] = useState<'historical' | 'future'>('historical');

  // Historical average inflation rates by decade (simplified)
  const getHistoricalInflation = (year: number): number => {
    if (year < 1980) return 6.5;
    if (year < 1990) return 4.8;
    if (year < 2000) return 3.0;
    if (year < 2010) return 2.5;
    if (year < 2020) return 1.8;
    return 4.0; // 2020s has been higher
  };

  const results = useMemo(() => {
    const principal = parseFloat(amount) || 0;
    const start = parseInt(startYear) || 2000;
    const end = parseInt(endYear) || 2024;
    const inflationRate = (parseFloat(customInflation) || 3) / 100;

    let futureValue = principal;
    let totalInflation = 0;
    const yearlyData: Array<{ year: number; value: number; cumulativeInflation: number }> = [];

    if (mode === 'historical') {
      // Calculate based on historical-ish rates
      for (let year = start; year <= end; year++) {
        const yearRate = getHistoricalInflation(year) / 100;
        futureValue = futureValue * (1 + yearRate);
        totalInflation = ((futureValue / principal) - 1) * 100;
        yearlyData.push({ year, value: futureValue, cumulativeInflation: totalInflation });
      }
    } else {
      // Future projection with custom rate
      for (let year = start; year <= end; year++) {
        futureValue = futureValue * (1 + inflationRate);
        totalInflation = ((futureValue / principal) - 1) * 100;
        yearlyData.push({ year, value: futureValue, cumulativeInflation: totalInflation });
      }
    }

    const purchasingPowerLost = principal - (principal * principal / futureValue);
    const equivalentToday = principal * principal / futureValue;

    return {
      futureValue,
      totalInflation,
      purchasingPowerLost,
      equivalentToday,
      yearlyData,
      years: end - start,
    };
  }, [amount, startYear, endYear, customInflation, mode]);

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
          Inflation Calculator
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          See how inflation erodes your purchasing power over time and plan accordingly.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              onClick={() => setMode('historical')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                mode === 'historical'
                  ? 'bg-white dark:bg-gray-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Historical
            </button>
            <button
              onClick={() => setMode('future')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                mode === 'future'
                  ? 'bg-white dark:bg-gray-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Future Projection
            </button>
          </div>

          <CalculatorInput
            label="Amount"
            value={amount}
            onChange={setAmount}
            type="currency"
            placeholder="100"
            helpText={mode === 'historical' ? 'How much this was worth in the start year' : 'Current value to project forward'}
          />
          
          <div className="grid grid-cols-2 gap-4">
            <CalculatorInput
              label={mode === 'historical' ? 'Start Year' : 'Current Year'}
              value={startYear}
              onChange={setStartYear}
              type="number"
              min={1950}
              max={2030}
            />
            <CalculatorInput
              label={mode === 'historical' ? 'End Year' : 'Future Year'}
              value={endYear}
              onChange={setEndYear}
              type="number"
              min={1950}
              max={2050}
            />
          </div>

          {mode === 'future' && (
            <CalculatorInput
              label="Expected Annual Inflation Rate"
              value={customInflation}
              onChange={setCustomInflation}
              type="percentage"
              placeholder="3"
              helpText="Historical average is around 3%"
            />
          )}
        </div>

        {/* Results */}
        <div className="space-y-4">
          {mode === 'historical' ? (
            <>
              <div className="bg-gradient-to-br from-orange-600 to-red-600 rounded-2xl p-6 text-white">
                <p className="text-orange-100 text-sm mb-1">
                  ${parseFloat(amount).toLocaleString()} in {startYear} equals
                </p>
                <p className="text-4xl font-bold">
                  ${results.futureValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
                <p className="text-orange-100 mt-2">
                  in {endYear} dollars
                </p>
              </div>

              <ResultCard
                title="Purchasing Power Lost"
                value={`${results.totalInflation.toFixed(1)}%`}
                subtitle={`Over ${results.years} years`}
                color="red"
                size="md"
              />

              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  <strong className="text-slate-900 dark:text-white">${parseFloat(amount).toLocaleString()}</strong> in {startYear} had the same buying power as <strong className="text-slate-900 dark:text-white">${results.equivalentToday.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong> today.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
                <p className="text-blue-100 text-sm mb-1">
                  To have ${parseFloat(amount).toLocaleString()} buying power in {endYear}
                </p>
                <p className="text-4xl font-bold">
                  ${results.futureValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
                <p className="text-blue-100 mt-2">
                  will be needed
                </p>
              </div>

              <ResultCard
                title="Total Inflation"
                value={`${results.totalInflation.toFixed(1)}%`}
                subtitle={`At ${customInflation}% per year for ${results.years} years`}
                color="orange"
                size="md"
              />

              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  Your <strong className="text-slate-900 dark:text-white">${parseFloat(amount).toLocaleString()}</strong> today will only buy <strong className="text-slate-900 dark:text-white">${results.equivalentToday.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong> worth of goods in {endYear}.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Inflation Table */}
      {results.yearlyData.length > 0 && results.yearlyData.length <= 30 && (
        <div className="mt-8 bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Year by Year Impact</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Year</th>
                  <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">Equivalent Value</th>
                  <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">Cumulative Inflation</th>
                </tr>
              </thead>
              <tbody>
                {results.yearlyData.filter((_, i) => 
                  results.yearlyData.length <= 10 || i % Math.ceil(results.yearlyData.length / 10) === 0 || i === results.yearlyData.length - 1
                ).map((row) => (
                  <tr key={row.year} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 text-slate-900 dark:text-white">{row.year}</td>
                    <td className="py-2 text-right font-medium text-slate-900 dark:text-white">
                      ${row.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 text-right text-orange-600 dark:text-orange-400">
                      +{row.cumulativeInflation.toFixed(1)}%
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
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Understanding Inflation</h2>
        <div className="grid md:grid-cols-2 gap-6 text-sm text-slate-600 dark:text-slate-400">
          <div>
            <h3 className="font-medium text-slate-900 dark:text-white mb-2">What is Inflation?</h3>
            <p>
              Inflation is the rate at which prices for goods and services rise over time, decreasing your purchasing power. If inflation is 3%, what cost $100 last year costs $103 this year.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-slate-900 dark:text-white mb-2">Why It Matters</h3>
            <ul className="space-y-1">
              <li>• Cash loses value over time</li>
              <li>• Investments need to beat inflation to grow wealth</li>
              <li>• Retirement planning must account for future costs</li>
              <li>• Fixed income becomes less valuable</li>
            </ul>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-8">
        <CTABanner 
          title="Beat Inflation With Smart Money Management"
          description="Track your spending, identify savings opportunities, and grow your wealth faster than inflation with Adphex."
        />
      </div>
    </div>
  );
}

