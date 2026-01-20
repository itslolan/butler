'use client';
 
 interface EstimatedIncomeInputProps {
   income: number;
   onIncomeChange: (income: number) => void;
   incomeStats?: { medianMonthlyIncome: number; monthsIncluded: number };
  isLoading?: boolean;
 }
 
 export default function EstimatedIncomeInput({
   income,
   onIncomeChange,
   incomeStats,
  isLoading = false,
 }: EstimatedIncomeInputProps) {
   const hasMedianIncome =
     Boolean(incomeStats?.medianMonthlyIncome) && (incomeStats?.monthsIncluded || 0) > 0;
 
   const formatCurrency = (value: number) =>
     new Intl.NumberFormat('en-US', {
       style: 'currency',
       currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
     }).format(value);
 
  const roundCurrency = (value: number) => Math.round(value * 100) / 100;

   const handleInputChange = (value: string) => {
    if (isLoading) return;
     const parsed = parseFloat(value);
    const next = Number.isFinite(parsed) ? roundCurrency(parsed) : 0;
    onIncomeChange(next);
   };
 
   const handleSetMedian = () => {
    if (isLoading || !hasMedianIncome || !incomeStats) return;
     onIncomeChange(incomeStats.medianMonthlyIncome);
   };
 
   return (
     <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 mb-4">
       <div className="flex flex-col gap-4">
         <div>
           <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
             Estimated income
           </h2>
           <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
             This can be changed any time and Adphex can automatically adjust the budget
             allocations accordingly.
           </p>
           {isLoading && (
             <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
               Loading income and budget data...
             </p>
           )}
         </div>
 
         <div className="flex flex-col lg:flex-row lg:items-center gap-4">
           <div className="flex-1">
             <div className="relative">
               <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                 $
               </span>
               <input
                 type="number"
                 inputMode="decimal"
                 min="0"
                 step="any"
                value={income > 0 ? income.toFixed(2) : ''}
                 onChange={(e) => handleInputChange(e.target.value)}
                 placeholder="0"
                disabled={isLoading}
                 className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-base font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                 aria-label="Estimated income"
               />
             </div>
           </div>
 
           <div className="flex items-center gap-3 flex-wrap">
             <span className="text-xs text-slate-400 uppercase tracking-wide">-or-</span>
             <div className="flex items-center gap-2">
               <button
                 type="button"
                 onClick={handleSetMedian}
                disabled={isLoading || !hasMedianIncome}
                 className="px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:bg-slate-100/60 disabled:text-slate-400 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 disabled:cursor-not-allowed transition-colors"
               >
                 Set your median income{' '}
                 {hasMedianIncome ? formatCurrency(incomeStats!.medianMonthlyIncome) : ''}
               </button>
               <span className="text-[11px] text-slate-400">
                 {hasMedianIncome
                   ? `(from ${incomeStats!.monthsIncluded} months of data)`
                   : '(no history yet)'}
               </span>
             </div>
           </div>
         </div>
       </div>
     </div>
   );
 }
