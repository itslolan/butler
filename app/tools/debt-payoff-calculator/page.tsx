'use client';

import { useState, useMemo } from 'react';
import CalculatorInput from '@/components/tools/CalculatorInput';
import CTABanner from '@/components/tools/CTABanner';

interface Debt {
  id: number;
  name: string;
  balance: string;
  interestRate: string;
  minimumPayment: string;
}

export default function DebtPayoffCalculator() {
  const [debts, setDebts] = useState<Debt[]>([
    { id: 1, name: 'Credit Card', balance: '5000', interestRate: '22', minimumPayment: '150' },
    { id: 2, name: 'Car Loan', balance: '15000', interestRate: '6', minimumPayment: '350' },
    { id: 3, name: 'Student Loan', balance: '25000', interestRate: '5', minimumPayment: '250' },
  ]);
  const [extraPayment, setExtraPayment] = useState<string>('200');

  const addDebt = () => {
    setDebts([...debts, { id: Date.now(), name: '', balance: '', interestRate: '', minimumPayment: '' }]);
  };

  const removeDebt = (id: number) => {
    if (debts.length > 1) {
      setDebts(debts.filter(d => d.id !== id));
    }
  };

  const updateDebt = (id: number, field: keyof Debt, value: string) => {
    setDebts(debts.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const calculatePayoff = (debtList: Array<{ balance: number; rate: number; minPayment: number; name: string }>, extra: number, strategy: 'snowball' | 'avalanche') => {
    // Sort debts by strategy
    const sorted = [...debtList].sort((a, b) => 
      strategy === 'snowball' ? a.balance - b.balance : b.rate - a.rate
    );

    let totalInterest = 0;
    let months = 0;
    const maxMonths = 360; // 30 years max
    
    // Clone balances
    const balances = sorted.map(d => d.balance);
    const paymentOrder: string[] = [];

    while (balances.some(b => b > 0) && months < maxMonths) {
      months++;
      let extraAvailable = extra;

      for (let i = 0; i < sorted.length; i++) {
        if (balances[i] <= 0) continue;

        // Add interest
        const monthlyRate = sorted[i].rate / 100 / 12;
        const interest = balances[i] * monthlyRate;
        totalInterest += interest;
        balances[i] += interest;

        // Make payment
        let payment = sorted[i].minPayment;
        
        // Add extra payment to first debt with balance
        if (extraAvailable > 0 && balances.findIndex(b => b > 0) === i) {
          payment += extraAvailable;
          extraAvailable = 0;
        }

        balances[i] -= payment;

        // Check if paid off
        if (balances[i] <= 0) {
          if (!paymentOrder.includes(sorted[i].name)) {
            paymentOrder.push(sorted[i].name);
          }
          // Roll over extra to next debt
          extraAvailable += -balances[i] + sorted[i].minPayment;
          balances[i] = 0;
        }
      }
    }

    return { months, totalInterest, paymentOrder };
  };

  const results = useMemo(() => {
    const extra = parseFloat(extraPayment) || 0;
    
    const debtList = debts.map(d => ({
      name: d.name || 'Debt',
      balance: parseFloat(d.balance) || 0,
      rate: parseFloat(d.interestRate) || 0,
      minPayment: parseFloat(d.minimumPayment) || 0,
    })).filter(d => d.balance > 0);

    if (debtList.length === 0) {
      return null;
    }

    const totalDebt = debtList.reduce((sum, d) => sum + d.balance, 0);
    const totalMinPayment = debtList.reduce((sum, d) => sum + d.minPayment, 0);

    const snowball = calculatePayoff(debtList, extra, 'snowball');
    const avalanche = calculatePayoff(debtList, extra, 'avalanche');
    const minimumOnly = calculatePayoff(debtList, 0, 'avalanche');

    const savings = minimumOnly.totalInterest - avalanche.totalInterest;
    const timeSaved = minimumOnly.months - avalanche.months;

    return {
      totalDebt,
      totalMinPayment,
      snowball,
      avalanche,
      minimumOnly,
      savings,
      timeSaved,
      bestStrategy: avalanche.totalInterest < snowball.totalInterest ? 'avalanche' : 'snowball',
    };
  }, [debts, extraPayment]);

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
          Debt Payoff Calculator
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Compare the debt snowball vs avalanche methods and see when you&apos;ll be debt-free.
        </p>
      </div>

      {/* Debt Input */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your Debts</h2>
          <button onClick={addDebt} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            + Add Debt
          </button>
        </div>

        <div className="space-y-4">
          {debts.map((debt) => (
            <div key={debt.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <div className="flex justify-between items-center mb-3">
                <input
                  type="text"
                  value={debt.name}
                  onChange={(e) => updateDebt(debt.id, 'name', e.target.value)}
                  placeholder="Debt name"
                  className="text-sm font-medium bg-transparent border-none text-slate-900 dark:text-white focus:outline-none"
                />
                {debts.length > 1 && (
                  <button onClick={() => removeDebt(debt.id)} className="text-slate-400 hover:text-red-500 text-sm">
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <CalculatorInput
                  label="Balance"
                  value={debt.balance}
                  onChange={(v) => updateDebt(debt.id, 'balance', v)}
                  type="currency"
                />
                <CalculatorInput
                  label="Interest Rate"
                  value={debt.interestRate}
                  onChange={(v) => updateDebt(debt.id, 'interestRate', v)}
                  type="percentage"
                />
                <CalculatorInput
                  label="Min. Payment"
                  value={debt.minimumPayment}
                  onChange={(v) => updateDebt(debt.id, 'minimumPayment', v)}
                  type="currency"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
          <CalculatorInput
            label="Extra Monthly Payment"
            value={extraPayment}
            onChange={setExtraPayment}
            type="currency"
            helpText="Additional amount you can put toward debt each month"
          />
        </div>
      </div>

      {/* Results */}
      {results && (
        <>
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {/* Avalanche */}
            <div className={`rounded-2xl p-6 ${results.bestStrategy === 'avalanche' ? 'bg-gradient-to-br from-green-600 to-emerald-600 text-white ring-4 ring-green-500/20' : 'bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🏔️</span>
                <h3 className={`font-semibold ${results.bestStrategy === 'avalanche' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  Avalanche Method
                </h3>
              </div>
              <p className={`text-sm mb-4 ${results.bestStrategy === 'avalanche' ? 'text-green-100' : 'text-slate-500 dark:text-slate-400'}`}>
                Pay highest interest first
              </p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className={results.bestStrategy === 'avalanche' ? 'text-green-100' : 'text-slate-500 dark:text-slate-400'}>Time to payoff</span>
                  <span className="font-bold">{Math.floor(results.avalanche.months / 12)}y {results.avalanche.months % 12}m</span>
                </div>
                <div className="flex justify-between">
                  <span className={results.bestStrategy === 'avalanche' ? 'text-green-100' : 'text-slate-500 dark:text-slate-400'}>Total interest</span>
                  <span className="font-bold">${results.avalanche.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
              {results.bestStrategy === 'avalanche' && (
                <div className="mt-4 pt-4 border-t border-white/20">
                  <span className="text-sm font-medium">✓ Saves the most money</span>
                </div>
              )}
            </div>

            {/* Snowball */}
            <div className={`rounded-2xl p-6 ${results.bestStrategy === 'snowball' ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white ring-4 ring-blue-500/20' : 'bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">⛄</span>
                <h3 className={`font-semibold ${results.bestStrategy === 'snowball' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  Snowball Method
                </h3>
              </div>
              <p className={`text-sm mb-4 ${results.bestStrategy === 'snowball' ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                Pay smallest balance first
              </p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className={results.bestStrategy === 'snowball' ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}>Time to payoff</span>
                  <span className="font-bold">{Math.floor(results.snowball.months / 12)}y {results.snowball.months % 12}m</span>
                </div>
                <div className="flex justify-between">
                  <span className={results.bestStrategy === 'snowball' ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}>Total interest</span>
                  <span className="font-bold">${results.snowball.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
              {results.bestStrategy === 'snowball' && (
                <div className="mt-4 pt-4 border-t border-white/20">
                  <span className="text-sm font-medium">✓ Quick wins for motivation</span>
                </div>
              )}
            </div>

            {/* Minimum Only */}
            <div className="rounded-2xl p-6 bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🐌</span>
                <h3 className="font-semibold text-slate-900 dark:text-white">Minimum Only</h3>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                No extra payments
              </p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Time to payoff</span>
                  <span className="font-bold text-slate-900 dark:text-white">{Math.floor(results.minimumOnly.months / 12)}y {results.minimumOnly.months % 12}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Total interest</span>
                  <span className="font-bold text-red-600 dark:text-red-400">${results.minimumOnly.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Savings Summary */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl p-6 border border-green-200 dark:border-green-800 mb-8">
            <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">
              By adding ${parseFloat(extraPayment || '0').toLocaleString()}/month extra:
            </h3>
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  ${results.savings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">saved in interest</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {results.timeSaved} months
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">faster payoff</p>
              </div>
            </div>
          </div>

          {/* Strategy Explanation */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3">🏔️ Avalanche Method</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                Pay off debts with the <strong>highest interest rate first</strong>. This mathematically saves the most money.
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <strong>Best for:</strong> People motivated by numbers and long-term savings.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3">⛄ Snowball Method</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                Pay off debts with the <strong>smallest balance first</strong>. Quick wins provide psychological motivation.
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <strong>Best for:</strong> People who need motivation and quick victories.
              </p>
            </div>
          </div>
        </>
      )}

      {/* CTA */}
      <div className="mt-8">
        <CTABanner 
          title="Track Your Debt Payoff Progress"
          description="Upload your statements and Adphex will track your debt balances, interest paid, and celebrate your payoff milestones."
        />
      </div>
    </div>
  );
}


