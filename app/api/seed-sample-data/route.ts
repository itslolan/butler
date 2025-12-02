import { NextResponse } from 'next/server';
import { insertDocument, insertTransactions, insertAccountSnapshots } from '@/lib/db-tools';
import { supabase } from '@/lib/supabase';

const SAMPLE_USER_ID = 'demo-user';

export async function POST(request: Request) {
  try {
    const { force } = await request.json().catch(() => ({}));
    
    // Check if data already exists
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', SAMPLE_USER_ID)
      .limit(1);

    if (existing && existing.length > 0 && !force) {
      return NextResponse.json({ 
        success: true, 
        message: 'Sample data already exists. Use { "force": true } to recreate.',
        skipped: true 
      });
    }

    // If force, delete existing data first - be aggressive
    if (force) {
      console.log('Force mode: Deleting ALL existing data for demo-user...');
      
      // Delete in parallel and verify
      const [txnResult, docResult, snapResult, metaResult] = await Promise.all([
        supabase.from('transactions').delete().eq('user_id', SAMPLE_USER_ID),
        supabase.from('documents').delete().eq('user_id', SAMPLE_USER_ID),
        supabase.from('account_snapshots').delete().eq('user_id', SAMPLE_USER_ID),
        supabase.from('user_metadata').delete().eq('user_id', SAMPLE_USER_ID),
      ]);
      
      console.log('Delete results:', {
        transactions: txnResult.error ? txnResult.error.message : `Deleted rows`,
        documents: docResult.error ? docResult.error.message : `Deleted rows`,
        snapshots: snapResult.error ? snapResult.error.message : `Deleted rows`,
        metadata: metaResult.error ? metaResult.error.message : `Deleted rows`,
      });
      
      // Verify deletion
      const { count: remainingCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', SAMPLE_USER_ID);
      
      if (remainingCount && remainingCount > 0) {
        console.warn(`WARNING: ${remainingCount} transactions still exist after delete!`);
      } else {
        console.log('✓ All existing data deleted successfully');
      }
    }

    // Create a sample document - generate data for last 12 months
    const currentDate = new Date();
    const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);

    const document = await insertDocument({
      user_id: SAMPLE_USER_ID,
      file_name: 'bank-statement-jan-2025.pdf',
      file_url: '', // Not needed for sample data
      document_type: 'bank_statement',
      issuer: 'Chase Bank',
      account_id: '****5678',
      account_name: 'Chase Checking',
      statement_date: lastMonth.toISOString().split('T')[0],
      previous_balance: 5420.50,
      new_balance: 6234.75,
      currency: 'USD',
    });

    const documentId = document.id;

    // Generate sample transactions for the last 12 months with rich, varied data
    // IMPORTANT: Generate data relative to TODAY so it matches query ranges
    const transactions = [];
    console.log(`Generating data relative to: ${currentDate.toISOString()}`);
    
    // Expanded realistic sample data with many merchants
    const categories = {
      expense: [
        // Groceries
        { merchant: 'Whole Foods Market', category: 'Groceries', amount: -125.50, classification: 'essential' },
        { merchant: 'Trader Joe\'s', category: 'Groceries', amount: -78.45, classification: 'essential' },
        { merchant: 'Safeway', category: 'Groceries', amount: -95.30, classification: 'essential' },
        { merchant: 'Costco', category: 'Groceries', amount: -180.75, classification: 'essential' },
        
        // Transportation
        { merchant: 'Shell', category: 'Transportation', amount: -45.20, classification: 'essential' },
        { merchant: 'Chevron', category: 'Transportation', amount: -52.80, classification: 'essential' },
        { merchant: 'Uber', category: 'Transportation', amount: -28.60, classification: 'discretionary' },
        { merchant: 'Lyft', category: 'Transportation', amount: -31.45, classification: 'discretionary' },
        
        // Food & Dining
        { merchant: 'Starbucks', category: 'Food & Dining', amount: -8.75, classification: 'discretionary' },
        { merchant: 'The Cheesecake Factory', category: 'Food & Dining', amount: -67.50, classification: 'discretionary' },
        { merchant: 'Chipotle', category: 'Food & Dining', amount: -12.50, classification: 'discretionary' },
        { merchant: 'Olive Garden', category: 'Food & Dining', amount: -45.90, classification: 'discretionary' },
        { merchant: 'Domino\'s Pizza', category: 'Food & Dining', amount: -24.99, classification: 'discretionary' },
        
        // Shopping
        { merchant: 'Amazon.com', category: 'Shopping', amount: -89.99, classification: 'discretionary' },
        { merchant: 'Target', category: 'Shopping', amount: -145.32, classification: 'discretionary' },
        { merchant: 'Walmart', category: 'Shopping', amount: -67.88, classification: 'essential' },
        { merchant: 'Best Buy', category: 'Shopping', amount: -299.99, classification: 'discretionary' },
        
        // Utilities
        { merchant: 'Pacific Gas & Electric', category: 'Utilities', amount: -125.00, classification: 'essential' },
        { merchant: 'Verizon Wireless', category: 'Utilities', amount: -85.00, classification: 'essential' },
        { merchant: 'AT&T Internet', category: 'Utilities', amount: -75.00, classification: 'essential' },
        
        // Entertainment
        { merchant: 'Netflix', category: 'Entertainment', amount: -15.99, classification: 'discretionary' },
        { merchant: 'Spotify', category: 'Entertainment', amount: -9.99, classification: 'discretionary' },
        { merchant: 'AMC Theaters', category: 'Entertainment', amount: -24.50, classification: 'discretionary' },
        { merchant: 'PlayStation Store', category: 'Entertainment', amount: -59.99, classification: 'discretionary' },
        
        // Healthcare
        { merchant: 'CVS Pharmacy', category: 'Healthcare', amount: -32.45, classification: 'essential' },
        { merchant: 'Walgreens', category: 'Healthcare', amount: -28.90, classification: 'essential' },
        { merchant: 'Medical Center', category: 'Healthcare', amount: -150.00, classification: 'essential' },
        
        // Health & Fitness
        { merchant: 'Planet Fitness', category: 'Health & Fitness', amount: -49.99, classification: 'discretionary' },
        { merchant: 'Lululemon', category: 'Health & Fitness', amount: -98.00, classification: 'discretionary' },
        
        // Other
        { merchant: 'Home Depot', category: 'Home & Garden', amount: -87.50, classification: 'essential' },
        { merchant: 'Petco', category: 'Pets', amount: -45.00, classification: 'essential' },
      ],
      income: [
        { merchant: 'ACME Corporation', category: 'Salary', amount: 4500.00, classification: null },
        { merchant: 'Freelance Project', category: 'Freelance', amount: 800.00, classification: null },
      ],
    };

    // Generate transactions for last 12 months with varied, realistic data
    // This ensures data exists for the default 6M view
    console.log(`Generating transactions for last 12 months from ${currentDate.toISOString()}`);
    for (let monthOffset = 11; monthOffset >= 0; monthOffset--) {
      const month = new Date(currentDate.getFullYear(), currentDate.getMonth() - monthOffset, 1);
      const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      if (monthOffset <= 6) {
        console.log(`  Month ${monthOffset} (${month.toISOString().split('T')[0]}): Will generate transactions`);
      }
      
      // Vary income slightly month to month (simulate bonuses, overtime, etc.)
      const baseSalary = 4500;
      const salaryVariation = monthOffset % 3 === 0 ? 500 : 0; // Bonus every 3 months
      const monthlyIncome = baseSalary + salaryVariation;

      // Add income at the start of month (always positive)
      transactions.push({
        user_id: SAMPLE_USER_ID,
        document_id: documentId,
        account_name: 'Chase Checking',
        date: new Date(month.getFullYear(), month.getMonth(), 1).toISOString().split('T')[0],
        merchant: categories.income[0].merchant,
        amount: monthlyIncome,
        category: categories.income[0].category,
        transaction_type: 'income' as const,
        spend_classification: null,
        currency: 'USD',
      });

      // Occasionally add freelance income (every 4-6 months)
      if (monthOffset % 5 === 0) {
        transactions.push({
          user_id: SAMPLE_USER_ID,
          document_id: documentId,
          account_name: 'Chase Checking',
          date: new Date(month.getFullYear(), month.getMonth(), 15).toISOString().split('T')[0],
          merchant: categories.income[1].merchant,
          amount: categories.income[1].amount,
          category: categories.income[1].category,
          transaction_type: 'income' as const,
          spend_classification: null,
          currency: 'USD',
        });
      }

      // Vary expense count and amounts based on month (holiday season = more spending)
      const monthNum = month.getMonth(); // 0-11
      const isHolidaySeason = monthNum === 10 || monthNum === 11; // Nov, Dec
      const isSummer = monthNum >= 5 && monthNum <= 7; // Jun, Jul, Aug
      
      // More expenses in holiday season, fewer in early months to show growth
      const baseExpenseCount = isHolidaySeason ? 18 : isSummer ? 14 : (12 - Math.floor(monthOffset / 4));
      const expenseCount = Math.max(8, baseExpenseCount + Math.floor(Math.random() * 5));
      
      const usedIndices = new Set();
      
      for (let i = 0; i < expenseCount; i++) {
        let expenseIndex;
        do {
          expenseIndex = Math.floor(Math.random() * categories.expense.length);
        } while (usedIndices.has(expenseIndex) && usedIndices.size < categories.expense.length);
        usedIndices.add(expenseIndex);

        const expense = categories.expense[expenseIndex];
        const day = 2 + Math.floor(Math.random() * (daysInMonth - 2)); // Skip day 1 (income day)

        // Vary amounts - holiday season and recent months = higher amounts (shows spending growth)
        const spendingTrend = 1.0 + (monthOffset * 0.02); // Slight upward trend over time
        const variationFactor = isHolidaySeason 
          ? (1.2 + Math.random() * 0.3) * spendingTrend
          : (0.85 + Math.random() * 0.3) * spendingTrend;
        const baseAmount = Math.abs(expense.amount);
        const variedAmount = baseAmount * variationFactor;
        const finalAmount = -Math.round(variedAmount * 100) / 100;

        transactions.push({
          user_id: SAMPLE_USER_ID,
          document_id: documentId,
          account_name: 'Chase Checking',
          date: new Date(month.getFullYear(), month.getMonth(), day).toISOString().split('T')[0],
          merchant: expense.merchant,
          amount: finalAmount,
          category: expense.category,
          transaction_type: 'expense' as const,
          spend_classification: expense.classification as 'essential' | 'discretionary' | null,
          currency: 'USD',
        });
      }
    }

    // Sort transactions by date to ensure chronological order
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Insert all transactions in batches to avoid issues
    const insertedTransactions = await insertTransactions(transactions);
    console.log(`Inserted ${insertedTransactions.length} transactions out of ${transactions.length} attempted`);
    
    // Log date range for debugging
    if (transactions.length > 0) {
      console.log(`Transaction date range: ${transactions[0].date} to ${transactions[transactions.length - 1].date}`);
    }
    
    // Verify insertion
    const { data: verifyData, error: verifyError } = await supabase
      .from('transactions')
      .select('id, date, amount, transaction_type, merchant')
      .eq('user_id', SAMPLE_USER_ID)
      .limit(10);
    
    console.log('Verification query result:', { count: verifyData?.length, error: verifyError, sample: verifyData });

    // Create account snapshots for last 12 months with realistic balance progression
    const snapshots = [];
    let runningBalance = 4500; // Start with lower balance 12 months ago
    
    for (let monthOffset = 11; monthOffset >= 0; monthOffset--) {
      const month = new Date(currentDate.getFullYear(), currentDate.getMonth() - monthOffset, 1);
      
      // Calculate month start balance (end of previous month)
      const monthStartBalance = runningBalance;
      
      // Month start snapshot
      snapshots.push({
        user_id: SAMPLE_USER_ID,
        account_name: 'Chase Checking',
        snapshot_date: new Date(month.getFullYear(), month.getMonth(), 1).toISOString().split('T')[0],
        snapshot_type: 'month_start' as const,
        balance: monthStartBalance,
        currency: 'USD',
      });

      // Calculate month end balance (income - expenses for this month + start balance)
      const monthTransactions = transactions.filter(t => {
        const txnDate = new Date(t.date);
        return txnDate.getFullYear() === month.getFullYear() && 
               txnDate.getMonth() === month.getMonth();
      });
      
      const monthIncome = monthTransactions
        .filter(t => t.transaction_type === 'income')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      const monthExpenses = monthTransactions
        .filter(t => t.transaction_type === 'expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      const monthEndBalance = monthStartBalance + monthIncome - monthExpenses;
      runningBalance = monthEndBalance; // Update for next month

      // Month end snapshot
      const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      snapshots.push({
        user_id: SAMPLE_USER_ID,
        account_name: 'Chase Checking',
        snapshot_date: new Date(month.getFullYear(), month.getMonth(), lastDay).toISOString().split('T')[0],
        snapshot_type: 'month_end' as const,
        balance: Math.round(monthEndBalance * 100) / 100,
        currency: 'USD',
      });
    }

    await insertAccountSnapshots(snapshots);

    // Calculate totals for verification - check last 6 months specifically
    const nowForCalc = new Date();
    const sixMonthsAgo = new Date(nowForCalc.getFullYear(), nowForCalc.getMonth() - 6, 1);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];
    const todayStr = nowForCalc.toISOString().split('T')[0];
    
    const last6MonthsTransactions = transactions.filter(t => t.date >= sixMonthsAgoStr && t.date <= todayStr);
    const totalIncome6M = last6MonthsTransactions
      .filter(t => t.transaction_type === 'income')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalExpenses6M = last6MonthsTransactions
      .filter(t => t.transaction_type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const totalIncome = transactions
      .filter(t => t.transaction_type === 'income')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalExpenses = transactions
      .filter(t => t.transaction_type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Get date range info
    const dateRange = transactions.length > 0 ? {
      earliest: transactions[0].date,
      latest: transactions[transactions.length - 1].date
    } : null;

    console.log(`\n=== DATA SUMMARY ===`);
    console.log(`Total transactions: ${insertedTransactions.length}`);
    console.log(`Date range: ${dateRange?.earliest} to ${dateRange?.latest}`);
    console.log(`Last 6 months range: ${sixMonthsAgoStr} to ${todayStr}`);
    console.log(`Last 6 months transactions: ${last6MonthsTransactions.length}`);
    console.log(`Last 6 months totals: Income=${totalIncome6M}, Expenses=${totalExpenses6M}, Net=${totalIncome6M - totalExpenses6M}`);
    console.log(`All time totals: Income=${totalIncome}, Expenses=${totalExpenses}, Net=${totalIncome - totalExpenses}`);

    return NextResponse.json({
      success: true,
      message: `Sample data created successfully: ${insertedTransactions.length} transactions, ${snapshots.length} snapshots`,
      transactionCount: insertedTransactions.length,
      attemptedCount: transactions.length,
      snapshotCount: snapshots.length,
      dateRange,
      totals: {
        income: totalIncome,
        expenses: totalExpenses,
        net: totalIncome - totalExpenses
      },
      last6Months: {
        transactionCount: last6MonthsTransactions.length,
        income: totalIncome6M,
        expenses: totalExpenses6M,
        net: totalIncome6M - totalExpenses6M,
        dateRange: { start: sixMonthsAgoStr, end: todayStr }
      },
      verification: {
        found: verifyData?.length || 0,
        sample: verifyData?.slice(0, 3)
      }
    });
  } catch (error: any) {
    console.error('Error seeding sample data:', error);
    return NextResponse.json(
      { error: 'Failed to seed sample data', message: error.message },
      { status: 500 }
    );
  }
}

