'use client';

import { useState, useMemo } from 'react';
import CalculatorInput from '@/components/tools/CalculatorInput';
import ResultCard from '@/components/tools/ResultCard';
import CTABanner from '@/components/tools/CTABanner';

interface CreditCard {
  id: number;
  name: string;
  balance: string;
  limit: string;
}

export default function CreditUtilizationCalculator() {
  const [cards, setCards] = useState<CreditCard[]>([
    { id: 1, name: 'Card 1', balance: '2500', limit: '10000' },
  ]);

  const addCard = () => {
    setCards([...cards, { 
      id: Date.now(), 
      name: `Card ${cards.length + 1}`, 
      balance: '', 
      limit: '' 
    }]);
  };

  const removeCard = (id: number) => {
    if (cards.length > 1) {
      setCards(cards.filter(c => c.id !== id));
    }
  };

  const updateCard = (id: number, field: 'balance' | 'limit' | 'name', value: string) => {
    setCards(cards.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const results = useMemo(() => {
    let totalBalance = 0;
    let totalLimit = 0;

    const cardDetails = cards.map(card => {
      const balance = parseFloat(card.balance) || 0;
      const limit = parseFloat(card.limit) || 0;
      const utilization = limit > 0 ? (balance / limit) * 100 : 0;
      
      totalBalance += balance;
      totalLimit += limit;

      return { ...card, balanceNum: balance, limitNum: limit, utilization };
    });

    const overallUtilization = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;

    let scoreImpact = '';
    let impactColor: 'green' | 'orange' | 'red' = 'green';
    
    if (overallUtilization <= 10) {
      scoreImpact = 'Excellent! This utilization is ideal for your credit score.';
      impactColor = 'green';
    } else if (overallUtilization <= 30) {
      scoreImpact = 'Good. Your utilization is within the recommended range.';
      impactColor = 'green';
    } else if (overallUtilization <= 50) {
      scoreImpact = 'Fair. Try to reduce to under 30% for better scores.';
      impactColor = 'orange';
    } else if (overallUtilization <= 75) {
      scoreImpact = 'High. This may negatively impact your credit score.';
      impactColor = 'orange';
    } else {
      scoreImpact = 'Very high. This is likely hurting your credit score significantly.';
      impactColor = 'red';
    }

    // Calculate how much to pay down to reach 30% and 10%
    const targetFor30 = totalLimit * 0.3;
    const targetFor10 = totalLimit * 0.1;
    const paydownFor30 = Math.max(0, totalBalance - targetFor30);
    const paydownFor10 = Math.max(0, totalBalance - targetFor10);

    return {
      cardDetails,
      totalBalance,
      totalLimit,
      overallUtilization,
      scoreImpact,
      impactColor,
      paydownFor30,
      paydownFor10,
    };
  }, [cards]);

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
          Credit Utilization Calculator
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Credit utilization is the percentage of your available credit that you&apos;re using. It&apos;s one of the biggest factors in your credit score.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your Credit Cards</h2>
              <button
                onClick={addCard}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                + Add Card
              </button>
            </div>

            <div className="space-y-6">
              {cards.map((card, index) => (
                <div key={card.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <input
                      type="text"
                      value={card.name}
                      onChange={(e) => updateCard(card.id, 'name', e.target.value)}
                      className="text-sm font-medium bg-transparent border-none text-slate-900 dark:text-white focus:outline-none"
                    />
                    {cards.length > 1 && (
                      <button
                        onClick={() => removeCard(card.id)}
                        className="text-slate-400 hover:text-red-500 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <CalculatorInput
                      label="Balance"
                      value={card.balance}
                      onChange={(v) => updateCard(card.id, 'balance', v)}
                      type="currency"
                      placeholder="0"
                    />
                    <CalculatorInput
                      label="Credit Limit"
                      value={card.limit}
                      onChange={(v) => updateCard(card.id, 'limit', v)}
                      type="currency"
                      placeholder="10000"
                    />
                  </div>
                  
                  {results.cardDetails[index] && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Card Utilization:</span>
                      <span className={`font-medium ${
                        results.cardDetails[index].utilization <= 30 ? 'text-green-600 dark:text-green-400' :
                        results.cardDetails[index].utilization <= 50 ? 'text-orange-600 dark:text-orange-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {results.cardDetails[index].utilization.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          <ResultCard
            title="Overall Credit Utilization"
            value={`${results.overallUtilization.toFixed(1)}%`}
            subtitle={results.scoreImpact}
            color={results.impactColor}
            size="lg"
          />
          
          <div className="grid grid-cols-2 gap-4">
            <ResultCard
              title="Total Balance"
              value={`$${results.totalBalance.toLocaleString()}`}
              size="sm"
            />
            <ResultCard
              title="Total Credit"
              value={`$${results.totalLimit.toLocaleString()}`}
              size="sm"
            />
          </div>

          {results.overallUtilization > 30 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Paydown Goals</h3>
              <div className="space-y-3">
                {results.paydownFor30 > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">To reach 30%:</span>
                    <span className="font-medium text-orange-600 dark:text-orange-400">
                      Pay ${results.paydownFor30.toLocaleString()}
                    </span>
                  </div>
                )}
                {results.paydownFor10 > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">To reach 10%:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      Pay ${results.paydownFor10.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Utilization Zones */}
      <div className="mt-8 bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Credit Utilization Zones</h2>
        <div className="h-8 rounded-full overflow-hidden flex mb-4">
          <div className="bg-green-500 w-[10%] flex items-center justify-center text-xs text-white font-medium">
            0-10%
          </div>
          <div className="bg-green-400 w-[20%] flex items-center justify-center text-xs text-white font-medium">
            10-30%
          </div>
          <div className="bg-yellow-400 w-[20%] flex items-center justify-center text-xs text-white font-medium">
            30-50%
          </div>
          <div className="bg-orange-500 w-[25%] flex items-center justify-center text-xs text-white font-medium">
            50-75%
          </div>
          <div className="bg-red-500 w-[25%] flex items-center justify-center text-xs text-white font-medium">
            75%+
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <p className="font-medium text-green-600 dark:text-green-400">Excellent</p>
            <p className="text-slate-500 dark:text-slate-400">Best for score</p>
          </div>
          <div>
            <p className="font-medium text-green-500">Good</p>
            <p className="text-slate-500 dark:text-slate-400">Recommended</p>
          </div>
          <div>
            <p className="font-medium text-yellow-600 dark:text-yellow-400">Fair</p>
            <p className="text-slate-500 dark:text-slate-400">Could improve</p>
          </div>
          <div>
            <p className="font-medium text-orange-600 dark:text-orange-400">High</p>
            <p className="text-slate-500 dark:text-slate-400">May hurt score</p>
          </div>
          <div>
            <p className="font-medium text-red-600 dark:text-red-400">Very High</p>
            <p className="text-slate-500 dark:text-slate-400">Hurts score</p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-8">
        <CTABanner 
          title="Track Your Credit Automatically"
          description="Upload your credit card statements and Adphex will track your utilization, spending patterns, and help you optimize your credit."
        />
      </div>
    </div>
  );
}


