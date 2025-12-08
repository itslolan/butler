'use client';

import { useState, useMemo } from 'react';
import CTABanner from '@/components/tools/CTABanner';

interface Item {
  id: number;
  name: string;
  value: string;
}

export default function NetWorthCalculator() {
  const [assets, setAssets] = useState<Item[]>([
    { id: 1, name: 'Checking Account', value: '5000' },
    { id: 2, name: 'Savings Account', value: '15000' },
    { id: 3, name: '401(k)', value: '45000' },
  ]);
  
  const [liabilities, setLiabilities] = useState<Item[]>([
    { id: 1, name: 'Credit Card Debt', value: '3000' },
    { id: 2, name: 'Student Loans', value: '25000' },
  ]);

  const addAsset = () => {
    setAssets([...assets, { id: Date.now(), name: '', value: '' }]);
  };

  const addLiability = () => {
    setLiabilities([...liabilities, { id: Date.now(), name: '', value: '' }]);
  };

  const removeAsset = (id: number) => {
    setAssets(assets.filter(a => a.id !== id));
  };

  const removeLiability = (id: number) => {
    setLiabilities(liabilities.filter(l => l.id !== id));
  };

  const updateAsset = (id: number, field: 'name' | 'value', value: string) => {
    setAssets(assets.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const updateLiability = (id: number, field: 'name' | 'value', value: string) => {
    setLiabilities(liabilities.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const results = useMemo(() => {
    const totalAssets = assets.reduce((sum, a) => sum + (parseFloat(a.value) || 0), 0);
    const totalLiabilities = liabilities.reduce((sum, l) => sum + (parseFloat(l.value) || 0), 0);
    const netWorth = totalAssets - totalLiabilities;
    
    const assetBreakdown = assets
      .map(a => ({ name: a.name || 'Unnamed', value: parseFloat(a.value) || 0 }))
      .filter(a => a.value > 0)
      .sort((a, b) => b.value - a.value);
    
    const liabilityBreakdown = liabilities
      .map(l => ({ name: l.name || 'Unnamed', value: parseFloat(l.value) || 0 }))
      .filter(l => l.value > 0)
      .sort((a, b) => b.value - a.value);

    return {
      totalAssets,
      totalLiabilities,
      netWorth,
      assetBreakdown,
      liabilityBreakdown,
    };
  }, [assets, liabilities]);

  const ItemRow = ({ item, onUpdate, onRemove, placeholder }: {
    item: Item;
    onUpdate: (field: 'name' | 'value', value: string) => void;
    onRemove: () => void;
    placeholder: string;
  }) => (
    <div className="flex gap-2 items-center">
      <input
        type="text"
        value={item.name}
        onChange={(e) => onUpdate('name', e.target.value)}
        placeholder={placeholder}
        className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-white"
      />
      <div className="relative w-32">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
        <input
          type="number"
          value={item.value}
          onChange={(e) => onUpdate('value', e.target.value)}
          placeholder="0"
          className="w-full pl-6 pr-2 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-white"
        />
      </div>
      <button
        onClick={onRemove}
        className="text-slate-400 hover:text-red-500 p-1"
      >
        ✕
      </button>
    </div>
  );

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
          Net Worth Calculator
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Calculate your net worth by adding up everything you own (assets) and subtracting everything you owe (liabilities).
        </p>
      </div>

      {/* Net Worth Display */}
      <div className={`rounded-2xl p-8 text-center mb-8 ${
        results.netWorth >= 0 
          ? 'bg-gradient-to-br from-green-600 to-emerald-600' 
          : 'bg-gradient-to-br from-red-600 to-rose-600'
      } text-white`}>
        <p className="text-white/80 mb-2">Your Net Worth</p>
        <p className="text-5xl font-bold">
          {results.netWorth < 0 ? '-' : ''}${Math.abs(results.netWorth).toLocaleString()}
        </p>
        <div className="flex justify-center gap-8 mt-4 text-sm">
          <div>
            <p className="text-white/60">Assets</p>
            <p className="font-semibold">${results.totalAssets.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-white/60">Liabilities</p>
            <p className="font-semibold">${results.totalLiabilities.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Assets */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-green-600 dark:text-green-400">Assets (What You Own)</h2>
            <button
              onClick={addAsset}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              + Add Asset
            </button>
          </div>
          
          <div className="space-y-3">
            {assets.map((asset) => (
              <ItemRow
                key={asset.id}
                item={asset}
                onUpdate={(field, value) => updateAsset(asset.id, field, value)}
                onRemove={() => removeAsset(asset.id)}
                placeholder="Asset name"
              />
            ))}
          </div>

          {assets.length === 0 && (
            <p className="text-slate-500 dark:text-slate-400 text-center py-4">
              Click &quot;+ Add Asset&quot; to get started
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between">
            <span className="font-medium text-slate-900 dark:text-white">Total Assets</span>
            <span className="font-bold text-green-600 dark:text-green-400">
              ${results.totalAssets.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Liabilities */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Liabilities (What You Owe)</h2>
            <button
              onClick={addLiability}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              + Add Debt
            </button>
          </div>
          
          <div className="space-y-3">
            {liabilities.map((liability) => (
              <ItemRow
                key={liability.id}
                item={liability}
                onUpdate={(field, value) => updateLiability(liability.id, field, value)}
                onRemove={() => removeLiability(liability.id)}
                placeholder="Debt name"
              />
            ))}
          </div>

          {liabilities.length === 0 && (
            <p className="text-slate-500 dark:text-slate-400 text-center py-4">
              No debts? That&apos;s great! 🎉
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between">
            <span className="font-medium text-slate-900 dark:text-white">Total Liabilities</span>
            <span className="font-bold text-red-600 dark:text-red-400">
              ${results.totalLiabilities.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Common Assets & Liabilities */}
      <div className="mt-8 grid md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Common Assets to Include</h3>
          <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <li>• Checking & savings accounts</li>
            <li>• Investment accounts (brokerage, IRA, 401k)</li>
            <li>• Real estate (market value)</li>
            <li>• Vehicles (current value)</li>
            <li>• Cash value life insurance</li>
            <li>• Business ownership value</li>
          </ul>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Common Liabilities to Include</h3>
          <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <li>• Mortgage balance</li>
            <li>• Auto loans</li>
            <li>• Student loans</li>
            <li>• Credit card debt</li>
            <li>• Personal loans</li>
            <li>• Medical debt</li>
          </ul>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-8">
        <CTABanner 
          title="Track Your Net Worth Over Time"
          description="Upload your bank and investment statements. Adphex will automatically track your net worth and show you trends over months and years."
        />
      </div>
    </div>
  );
}

