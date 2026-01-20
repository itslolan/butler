'use client';

interface ReadyToAssignProps {
  amount: number;
  income: number;
  totalBudgeted: number;
  onAutoAssign?: () => void;
  isAutoAssigning?: boolean;
  hasAiAssigned?: boolean; // True if AI has assigned budgets at least once
  onReset?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  hasUnsavedChanges?: boolean;
  isLoading?: boolean;
}

export default function ReadyToAssign({ 
  amount, 
  income, 
  totalBudgeted,
  onAutoAssign,
  isAutoAssigning = false,
  hasAiAssigned = false,
  onReset,
  onSave,
  isSaving = false,
  hasUnsavedChanges = false,
  isLoading = false,
}: ReadyToAssignProps) {
  const isPositive = amount >= 0;
  const isOverbudgeted = amount < 0;
  const isFullyAssigned = amount === 0 && totalBudgeted > 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };
  const displayAmount = formatCurrency(Math.abs(amount));
  const statusLabel = isOverbudgeted
    ? `${displayAmount} overbudgeted`
    : `${displayAmount} remaining to budget`;

  return (
    <div
      className={`rounded-2xl p-6 mb-6 shadow-sm transition-colors ${
        isFullyAssigned
          ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
          : isPositive
          ? 'bg-gradient-to-br from-lime-400 to-emerald-500'
          : 'bg-gradient-to-br from-red-500 to-rose-600'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium mb-1">Budget status</p>
          {/* Ready to Assign Amount - Not Editable, Calculated */}
          <div className="flex items-center gap-2">
            <span className="text-4xl font-bold text-white tracking-tight">
              {isLoading ? 'Loading budget data...' : (isFullyAssigned ? 'All money assigned' : statusLabel)}
            </span>
          </div>
          <div className="text-white/70 text-sm mt-2 flex items-center gap-1.5">
            {isLoading ? (
              <span>Fetching totals…</span>
            ) : (
              <>
                <span className="font-medium">{formatCurrency(income)}</span>
                <span>income</span>
                <span>−</span>
                <span className="font-medium">{formatCurrency(totalBudgeted)}</span>
                <span>budgeted</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* Auto/Re-assign AI Button - shows when not fully assigned and not overbudgeted */}
          {!isFullyAssigned && !isOverbudgeted && (
            <button 
              onClick={onAutoAssign}
              disabled={isLoading || isAutoAssigning || !onAutoAssign}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 disabled:bg-white/10 px-4 py-2 rounded-full transition-colors disabled:cursor-not-allowed"
            >
              {isAutoAssigning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-white text-sm font-medium">Analyzing...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-white text-sm font-medium">
                    {hasAiAssigned ? 'Re-assign using AI' : 'Auto Assign using AI'}
                  </span>
                </>
              )}
            </button>
          )}

          {/* Fix Now Button */}
          {isOverbudgeted && (
            <button
              onClick={onAutoAssign}
              disabled={isLoading || isAutoAssigning || !onAutoAssign}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 disabled:bg-white/10 px-4 py-2 rounded-full transition-colors disabled:cursor-not-allowed"
            >
              {isAutoAssigning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-white text-sm font-medium">Fixing...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18M12 3v18" />
                  </svg>
                  <span className="text-white text-sm font-medium">Fix now</span>
                </>
              )}
            </button>
          )}

          {/* Save Button - always visible, enabled when there are unsaved changes */}
          <button
            onClick={onSave}
            disabled={isLoading || isSaving || isAutoAssigning || !onSave || !hasUnsavedChanges || income <= 0}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 disabled:bg-white/10 px-4 py-2 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-white text-sm font-medium">Saving...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white text-sm font-medium">Save Budget</span>
              </>
            )}
          </button>

          {/* Reset Button */}
          {onReset && (
            <button
              onClick={onReset}
              className="text-white/50 hover:text-white/80 text-xs font-medium px-2 py-1 transition-colors mt-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
