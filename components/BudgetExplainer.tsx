'use client';

interface BudgetExplainerProps {
  medianIncome?: number;
  monthsAnalyzed?: number;
  currentIncome: number;
}

export default function BudgetExplainer({ 
  medianIncome, 
  monthsAnalyzed,
  currentIncome 
}: BudgetExplainerProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Don't show if no meaningful data
  if (!currentIncome && !medianIncome) {
    return null;
  }

  const displayIncome = currentIncome || medianIncome || 0;
  const hasHistoricalData = medianIncome && monthsAnalyzed && monthsAnalyzed > 0;

  return (
    <div className="mb-2 p-4 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800/50 dark:to-blue-900/20 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
          <span className="text-lg">💡</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {hasHistoricalData ? (
              <>
                Based on your last <strong>{monthsAnalyzed} months</strong> of transactions, 
                your median monthly income is <strong>{formatCurrency(medianIncome)}</strong>. I&apos;ll use this for budgeting.{' '}
              </>
            ) : (
              <>
                Your available income is <strong>{formatCurrency(displayIncome)}</strong>.{' '}
              </>
            )}
            In zero-based budgeting, every dollar gets a job — assign amounts to categories 
            until &quot;Ready to Assign&quot; reaches $0. 
            <span className="text-blue-600 dark:text-blue-400 font-medium">
              {' '}Click &quot;Auto Assign using AI&quot; to let me distribute it automatically.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

