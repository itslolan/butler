export interface FinancialData {
  id: string;
  fileName: string;
  extractedAt: string;
  data: {
    carryForwardBalance?: {
      previousBalance: number;
      payments: number;
      newBalance: number;
      hasCarryOver: boolean;
    };
    cashAdvances?: {
      transactions: Array<{
        date: string;
        description: string;
        amount: number;
        fee?: number;
      }>;
      totalAmount: number;
      totalFees: number;
    };
    creditUtilization?: {
      creditLimit: number;
      newBalance: number;
      utilizationRatio: number;
      percentage: number;
    };
    spendingVolatility?: {
      monthlySpends: number[];
      standardDeviation: number;
      averageSpend: number;
    };
    paymentRegularity?: {
      payments: Array<{
        date: string;
        amount: number;
        dueDate: string;
        onTime: boolean;
      }>;
      onTimePercentage: number;
    };
    categorySpending?: {
      categories: Record<string, number>;
      total: number;
    };
    refunds?: {
      transactions: Array<{
        date: string;
        description: string;
        amount: number;
      }>;
      totalAmount: number;
    };
    subscriptions?: {
      recurringCharges: Array<{
        merchant: string;
        amount: number;
        frequency: string;
        occurrences: number;
      }>;
    };
  };
}

