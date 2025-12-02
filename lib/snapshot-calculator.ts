import { AccountSnapshot } from './supabase';

interface Transaction {
  date: string;
  amount: number;
}

/**
 * Calculate monthly balance snapshots for an account
 * 
 * Handles cases where statement periods don't align with calendar months.
 * Interpolates balances at month boundaries based on transaction history.
 * 
 * @param userId - User identifier
 * @param accountName - Account name
 * @param documentId - Document ID for reference
 * @param startBalance - Balance at statement start
 * @param endBalance - Balance at statement end
 * @param startDate - Statement start date (YYYY-MM-DD)
 * @param endDate - Statement end date (YYYY-MM-DD)
 * @param transactions - List of transactions with dates and amounts
 * @returns Array of month start/end snapshots
 */
export function calculateMonthlySnapshots(
  userId: string,
  accountName: string,
  documentId: string,
  startBalance: number,
  endBalance: number,
  startDate: string,
  endDate: string,
  transactions: Transaction[],
  currency?: string
): AccountSnapshot[] {
  const snapshots: AccountSnapshot[] = [];
  
  if (!accountName || !startDate || !endDate) {
    return snapshots;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Sort transactions by date
  const sortedTransactions = [...transactions].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Calculate running balance at each transaction
  const balanceAtDate = new Map<string, number>();
  let runningBalance = startBalance;
  
  balanceAtDate.set(startDate, startBalance);
  
  for (const txn of sortedTransactions) {
    runningBalance += txn.amount;
    balanceAtDate.set(txn.date, runningBalance);
  }
  
  balanceAtDate.set(endDate, endBalance);

  // Find all month boundaries in the date range
  const monthBoundaries: Date[] = [];
  
  // Add month start and end for each month in range
  const currentDate = new Date(start);
  currentDate.setDate(1); // Start of month
  
  while (currentDate <= end) {
    const monthStart = new Date(currentDate);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    if (monthStart >= start && monthStart <= end) {
      monthBoundaries.push(new Date(monthStart));
    }
    
    if (monthEnd >= start && monthEnd <= end && monthEnd.getTime() !== monthStart.getTime()) {
      monthBoundaries.push(new Date(monthEnd));
    }
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  // Calculate balance at each boundary
  for (const boundary of monthBoundaries) {
    const boundaryDateStr = boundary.toISOString().split('T')[0];
    
    // Determine if this is month start or end
    const isMonthStart = boundary.getDate() === 1;
    const snapshotType: 'month_start' | 'month_end' = isMonthStart ? 'month_start' : 'month_end';
    
    // Find balance at or before this date
    let balance = startBalance;
    
    if (balanceAtDate.has(boundaryDateStr)) {
      balance = balanceAtDate.get(boundaryDateStr)!;
    } else {
      // Interpolate: find closest transaction before this date
      let closestDate = startDate;
      let closestBalance = startBalance;
      
      for (const [dateStr, bal] of Array.from(balanceAtDate.entries())) {
        if (dateStr <= boundaryDateStr && dateStr > closestDate) {
          closestDate = dateStr;
          closestBalance = bal;
        }
      }
      
      // Calculate transactions between closest date and boundary
      for (const txn of sortedTransactions) {
        if (txn.date > closestDate && txn.date <= boundaryDateStr) {
          closestBalance += txn.amount;
        }
      }
      
      balance = closestBalance;
    }

    snapshots.push({
      user_id: userId,
      account_name: accountName,
      snapshot_date: boundaryDateStr,
      snapshot_type: snapshotType,
      balance,
      currency: currency || 'USD',
      document_id: documentId,
    });
  }

  return snapshots;
}

/**
 * Calculate net worth at a specific date across all accounts
 * 
 * @param snapshots - Array of account snapshots for a specific date
 * @returns Total net worth
 */
export function calculateNetWorthFromSnapshots(snapshots: AccountSnapshot[]): number {
  return snapshots.reduce((total, snapshot) => total + Number(snapshot.balance), 0);
}

/**
 * Get month start and end dates for a given date
 */
export function getMonthBoundaries(date: string): { monthStart: string; monthEnd: string } {
  const d = new Date(date);
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
  const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  
  return {
    monthStart: monthStart.toISOString().split('T')[0],
    monthEnd: monthEnd.toISOString().split('T')[0],
  };
}

