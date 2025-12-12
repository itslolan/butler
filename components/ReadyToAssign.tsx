'use client';

interface ReadyToAssignProps {
  amount: number;
  income: number;
  totalBudgeted: number;
}

export default function ReadyToAssign({ amount, income, totalBudgeted }: ReadyToAssignProps) {
  const isPositive = amount >= 0;
  const isOverbudgeted = amount < 0;
  const isFullyAssigned = amount === 0 && totalBudgeted > 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div
      className={`rounded-2xl p-6 shadow-sm transition-colors ${
        isFullyAssigned
          ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
          : isPositive
          ? 'bg-gradient-to-br from-lime-400 to-emerald-500'
          : 'bg-gradient-to-br from-red-500 to-rose-600'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium mb-1">
            {isFullyAssigned
              ? 'All Money Assigned!'
              : isPositive
              ? 'Ready to Assign'
              : 'Overbudgeted'}
          </p>
          <h2 className="text-4xl font-bold text-white tracking-tight">
            {formatCurrency(Math.abs(amount))}
          </h2>
          <p className="text-white/70 text-sm mt-2">
            {formatCurrency(income)} income − {formatCurrency(totalBudgeted)} budgeted
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* Status indicator */}
          {isFullyAssigned ? (
            <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-full">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-white text-sm font-medium">Zero-Based</span>
            </div>
          ) : isOverbudgeted ? (
            <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-full">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-white text-sm font-medium">Over Budget</span>
            </div>
          ) : (
            <button className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full transition-colors">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="text-white text-sm font-medium">Assign</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

