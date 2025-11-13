'use client';

import { FinancialData } from '@/types/financial';
import MetricCard from './MetricCard';

interface DashboardProps {
  financialData: FinancialData[];
  isExample: boolean;
}

export default function Dashboard({ financialData, isExample }: DashboardProps) {
  // Aggregate data from all statements
  const aggregatedData = financialData.length > 0 ? financialData[financialData.length - 1].data : null;

  const metrics: Array<{
    title: string;
    value: string;
    subtitle: string;
    color: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
  }> = [
    {
      title: 'Credit Utilization',
      value: aggregatedData?.creditUtilization?.percentage != null
        ? `${Number(aggregatedData.creditUtilization.percentage).toFixed(1)}%`
        : 'N/A',
      subtitle: aggregatedData?.creditUtilization?.newBalance != null && aggregatedData?.creditUtilization?.creditLimit != null
        ? `$${Number(aggregatedData.creditUtilization.newBalance).toLocaleString()} / $${Number(aggregatedData.creditUtilization.creditLimit).toLocaleString()}`
        : 'No data available',
      color: aggregatedData?.creditUtilization?.percentage != null
        ? Number(aggregatedData.creditUtilization.percentage) > 30 ? 'red' : Number(aggregatedData.creditUtilization.percentage) > 20 ? 'yellow' : 'green'
        : 'gray',
    },
    {
      title: 'Payment Regularity',
      value: aggregatedData?.paymentRegularity?.onTimePercentage != null
        ? `${Number(aggregatedData.paymentRegularity.onTimePercentage).toFixed(0)}%`
        : 'N/A',
      subtitle: aggregatedData?.paymentRegularity?.payments && Array.isArray(aggregatedData.paymentRegularity.payments)
        ? `${aggregatedData.paymentRegularity.payments.length} payments tracked`
        : 'No data available',
      color: aggregatedData?.paymentRegularity?.onTimePercentage != null
        ? Number(aggregatedData.paymentRegularity.onTimePercentage) >= 90 ? 'green' : Number(aggregatedData.paymentRegularity.onTimePercentage) >= 70 ? 'yellow' : 'red'
        : 'gray',
    },
    {
      title: 'Cash Advances',
      value: aggregatedData?.cashAdvances?.totalAmount != null
        ? `$${Number(aggregatedData.cashAdvances.totalAmount).toLocaleString()}`
        : 'N/A',
      subtitle: aggregatedData?.cashAdvances?.transactions && Array.isArray(aggregatedData.cashAdvances.transactions)
        ? `${aggregatedData.cashAdvances.transactions.length} transaction(s)`
        : 'No cash advances detected',
      color: aggregatedData?.cashAdvances?.totalAmount != null && Number(aggregatedData.cashAdvances.totalAmount) > 0 ? 'yellow' : 'green',
    },
    {
      title: 'Spending Volatility',
      value: aggregatedData?.spendingVolatility?.standardDeviation != null
        ? `$${Number(aggregatedData.spendingVolatility.standardDeviation).toFixed(0)}`
        : 'N/A',
      subtitle: aggregatedData?.spendingVolatility?.averageSpend != null
        ? `Avg: $${Number(aggregatedData.spendingVolatility.averageSpend).toFixed(0)}`
        : 'No data available',
      color: aggregatedData?.spendingVolatility?.standardDeviation != null && aggregatedData?.spendingVolatility?.averageSpend != null
        ? Number(aggregatedData.spendingVolatility.standardDeviation) > Number(aggregatedData.spendingVolatility.averageSpend) * 0.5 ? 'yellow' : 'green'
        : 'gray',
    },
    {
      title: 'Carry-Forward Balance',
      value: aggregatedData?.carryForwardBalance?.hasCarryOver != null
        ? aggregatedData.carryForwardBalance.hasCarryOver ? 'Yes' : 'No'
        : 'N/A',
      subtitle: aggregatedData?.carryForwardBalance?.newBalance != null
        ? `Balance: $${Number(aggregatedData.carryForwardBalance.newBalance).toLocaleString()}`
        : 'No data available',
      color: aggregatedData?.carryForwardBalance?.hasCarryOver ? 'red' : 'green',
    },
    {
      title: 'Total Refunds',
      value: aggregatedData?.refunds?.totalAmount != null
        ? `$${Number(aggregatedData.refunds.totalAmount).toLocaleString()}`
        : 'N/A',
      subtitle: aggregatedData?.refunds?.transactions && Array.isArray(aggregatedData.refunds.transactions)
        ? `${aggregatedData.refunds.transactions.length} refund(s)`
        : 'No refunds detected',
      color: 'blue',
    },
  ];

  const categorySpending = aggregatedData?.categorySpending;
  const subscriptions = aggregatedData?.subscriptions;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric, index) => (
          <MetricCard key={index} {...metric} />
        ))}
      </div>

      {categorySpending && categorySpending.categories && Object.keys(categorySpending.categories).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Category Spending
          </h2>
          <div className="space-y-2">
            {Object.entries(categorySpending.categories)
              .sort(([, a], [, b]) => Number(b) - Number(a))
              .map(([category, amount]) => (
                <div key={category} className="flex justify-between items-center">
                  <span className="text-gray-700 dark:text-gray-300 capitalize">{category}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ${Number(amount).toLocaleString()}
                  </span>
                </div>
              ))}
            {categorySpending.total != null && (
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <span className="font-semibold text-gray-900 dark:text-white">Total</span>
                <span className="font-bold text-lg text-gray-900 dark:text-white">
                  ${Number(categorySpending.total).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {subscriptions && subscriptions.recurringCharges && Array.isArray(subscriptions.recurringCharges) && subscriptions.recurringCharges.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Recurring Subscriptions
          </h2>
          <div className="space-y-3">
            {subscriptions.recurringCharges.map((sub, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{sub.merchant || 'Unknown'}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {sub.frequency || 'N/A'} • {sub.occurrences || 0} occurrence(s)
                  </p>
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">
                  ${sub.amount != null ? Number(sub.amount).toLocaleString() : '0'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {financialData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Processed Statements
          </h2>
          <div className="space-y-2">
            {financialData.map((data) => (
              <div key={data.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-gray-700 dark:text-gray-300">{data.fileName}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(data.extractedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

