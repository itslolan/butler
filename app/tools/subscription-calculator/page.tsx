'use client';

import { useState, useMemo } from 'react';
import CalculatorInput from '@/components/tools/CalculatorInput';
import CTABanner from '@/components/tools/CTABanner';

interface Subscription {
  id: number;
  name: string;
  cost: string;
  frequency: 'monthly' | 'yearly';
}

const popularSubscriptions = [
  { name: 'Netflix', cost: '15.49', frequency: 'monthly' as const },
  { name: 'Spotify', cost: '10.99', frequency: 'monthly' as const },
  { name: 'Amazon Prime', cost: '139', frequency: 'yearly' as const },
  { name: 'Disney+', cost: '13.99', frequency: 'monthly' as const },
  { name: 'YouTube Premium', cost: '13.99', frequency: 'monthly' as const },
  { name: 'Apple Music', cost: '10.99', frequency: 'monthly' as const },
  { name: 'HBO Max', cost: '15.99', frequency: 'monthly' as const },
  { name: 'Hulu', cost: '7.99', frequency: 'monthly' as const },
  { name: 'ChatGPT Plus', cost: '20', frequency: 'monthly' as const },
  { name: 'iCloud+', cost: '2.99', frequency: 'monthly' as const },
];

export default function SubscriptionCalculator() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([
    { id: 1, name: 'Netflix', cost: '15.49', frequency: 'monthly' },
    { id: 2, name: 'Spotify', cost: '10.99', frequency: 'monthly' },
  ]);

  const addSubscription = (preset?: typeof popularSubscriptions[0]) => {
    const newSub: Subscription = preset 
      ? { id: Date.now(), name: preset.name, cost: preset.cost, frequency: preset.frequency }
      : { id: Date.now(), name: '', cost: '', frequency: 'monthly' };
    setSubscriptions([...subscriptions, newSub]);
  };

  const removeSubscription = (id: number) => {
    setSubscriptions(subscriptions.filter(s => s.id !== id));
  };

  const updateSubscription = (id: number, field: keyof Subscription, value: string) => {
    setSubscriptions(subscriptions.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  const results = useMemo(() => {
    let monthlyTotal = 0;
    
    const details = subscriptions.map(sub => {
      const cost = parseFloat(sub.cost) || 0;
      const monthlyCost = sub.frequency === 'yearly' ? cost / 12 : cost;
      const yearlyCost = sub.frequency === 'yearly' ? cost : cost * 12;
      monthlyTotal += monthlyCost;
      return { ...sub, monthlyCost, yearlyCost };
    });

    const yearlyTotal = monthlyTotal * 12;
    const dailyCost = monthlyTotal / 30;
    
    // "Latte factor" - what else this could buy
    const lattesPerMonth = Math.floor(monthlyTotal / 5);
    const investmentIn10Years = yearlyTotal * 10 * 1.07; // 7% annual return
    const vacationDays = Math.floor(yearlyTotal / 200); // $200/day vacation

    return {
      details,
      monthlyTotal,
      yearlyTotal,
      dailyCost,
      lattesPerMonth,
      investmentIn10Years,
      vacationDays,
    };
  }, [subscriptions]);

  const unusedSubs = popularSubscriptions.filter(
    p => !subscriptions.some(s => s.name.toLowerCase() === p.name.toLowerCase())
  );

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
          Subscription Cost Calculator
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Add up all your subscriptions to see the true annual cost of your recurring expenses.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Subscriptions List */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your Subscriptions</h2>
              <button
                onClick={() => addSubscription()}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                + Add Custom
              </button>
            </div>

            {subscriptions.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-center py-8">
                No subscriptions added yet. Add your first one above!
              </p>
            ) : (
              <div className="space-y-3">
                {subscriptions.map((sub) => (
                  <div key={sub.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={sub.name}
                        onChange={(e) => updateSubscription(sub.id, 'name', e.target.value)}
                        placeholder="Subscription name"
                        className="flex-1 text-sm bg-transparent border-none text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-400"
                      />
                      <button
                        onClick={() => removeSubscription(sub.id)}
                        className="text-slate-400 hover:text-red-500 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                        <input
                          type="number"
                          value={sub.cost}
                          onChange={(e) => updateSubscription(sub.id, 'cost', e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-6 pr-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-white"
                        />
                      </div>
                      <select
                        value={sub.frequency}
                        onChange={(e) => updateSubscription(sub.id, 'frequency', e.target.value)}
                        className="px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-white"
                      >
                        <option value="monthly">/mo</option>
                        <option value="yearly">/yr</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Add */}
          {unusedSubs.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-3">Quick Add Popular Services</h3>
              <div className="flex flex-wrap gap-2">
                {unusedSubs.slice(0, 6).map((sub) => (
                  <button
                    key={sub.name}
                    onClick={() => addSubscription(sub)}
                    className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  >
                    + {sub.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
            <p className="text-blue-100 text-sm mb-1">Annual Subscription Cost</p>
            <p className="text-4xl font-bold mb-2">${results.yearlyTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-blue-100">
              That&apos;s ${results.monthlyTotal.toFixed(2)}/month or ${results.dailyCost.toFixed(2)}/day
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">What Else Could This Buy?</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400">☕ Lattes per month</span>
                <span className="font-medium text-slate-900 dark:text-white">{results.lattesPerMonth}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400">🏖️ Vacation days</span>
                <span className="font-medium text-slate-900 dark:text-white">{results.vacationDays} days/year</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400">📈 If invested for 10 years</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  ${results.investmentIn10Years.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown */}
          {results.details.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Monthly Breakdown</h3>
              <div className="space-y-2">
                {results.details.sort((a, b) => b.monthlyCost - a.monthlyCost).map((sub) => (
                  <div key={sub.id} className="flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">{sub.name || 'Unnamed'}</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      ${sub.monthlyCost.toFixed(2)}/mo
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-8">
        <CTABanner 
          title="Find Hidden Subscriptions Automatically"
          description="Upload your bank statements and Adphex will identify all recurring charges, including ones you might have forgotten about."
        />
      </div>
    </div>
  );
}

