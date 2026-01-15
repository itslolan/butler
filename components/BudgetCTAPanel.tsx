'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface BudgetCTAPanelProps {
  userId: string;
}

interface CategorySummary {
  id: string;
  name: string;
  budgeted: number;
  spent: number;
}

export default function BudgetCTAPanel({ userId }: BudgetCTAPanelProps) {
  const router = useRouter();
  const [hasBudgets, setHasBudgets] = useState<boolean>(false);
  const [topCategories, setTopCategories] = useState<CategorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBudgetData = async () => {
      try {
        // Get current month in YYYY-MM format
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        const res = await fetch(`/api/budget?userId=${userId}&month=${currentMonth}`);
        
        if (res.ok) {
          const data = await res.json();
          
          if (data.totalBudgeted > 0) {
            setHasBudgets(true);
            
            const categories = Array.isArray(data.categories) ? data.categories : [];
            const superCategories = Array.isArray(data.superCategories) ? data.superCategories : [];
            const categoryBudgets = categories.filter((c: any) => c.budgeted > 0);

            const sorted = (categoryBudgets.length > 0 ? categoryBudgets : superCategories)
              .filter((c: any) => c.budgeted > 0)
              .sort((a: any, b: any) => b.budgeted - a.budgeted)
              .slice(0, 5)
              .map((c: any) => ({
                id: c.id,
                name: c.name,
                budgeted: c.budgeted,
                spent: c.spent, // spent is already provided in the API response
              }));

            setTopCategories(sorted);
          } else {
            setHasBudgets(false);
          }
        }
      } catch (error) {
        console.error('Error fetching budget data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBudgetData();
  }, [userId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return null; // Or a skeleton if preferred
  }

  // View for users with active budgets
  if (hasBudgets) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Budget Summary
          </h3>
          <button
            onClick={() => router.push('/budget')}
            className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
          >
            View Full Budget →
          </button>
        </div>

        <div className="space-y-4">
          {topCategories.map(category => {
            const progress = Math.min((category.spent / category.budgeted) * 100, 100);
            const isOverBudget = category.spent > category.budgeted;
            
            return (
              <div key={category.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {category.name}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    <span className={isOverBudget ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                      {formatCurrency(category.spent)}
                    </span>
                    {' / '}
                    {formatCurrency(category.budgeted)}
                  </span>
                </div>
                
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      isOverBudget 
                        ? 'bg-red-500' 
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // View for users without budgets (Original CTA)
  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 shadow-sm mb-6">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
          <svg 
            className="w-6 h-6 text-emerald-600 dark:text-emerald-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" 
            />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100 mb-1">
            Start Zero-Based Budgeting
          </h3>
          <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-4 leading-relaxed">
            Give every dollar a job. Assign your income to spending categories and track exactly where your money goes. 
            Just like YNAB, but built into your financial assistant.
          </p>

          {/* Features */}
          <div className="flex flex-wrap gap-3 mb-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-1 rounded-full">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Assign every dollar
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-1 rounded-full">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Track spending vs budget
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-1 rounded-full">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Custom categories
            </span>
          </div>

          {/* CTA Button */}
          <button
            onClick={() => router.push('/budget')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl transition-colors shadow-sm hover:shadow-md"
          >
            Setup budgets for me
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
