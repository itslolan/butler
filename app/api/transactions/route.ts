import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { classifyTransaction } from '@/lib/transaction-classifier';
import { isUserProvidedIncomeTransaction, USER_PROVIDED_INCOME_MERCHANT } from '@/lib/financial-figure-sources';

export const dynamic = 'force-dynamic';

export interface TransactionsQueryParams {
  userId: string;
  accountIds?: string[];
  startDate?: string;
  endDate?: string;
  transactionTypes?: ('income' | 'expense' | 'transfer' | 'other')[];
  uncategorizedOnly?: boolean;
  categories?: string[];
  page?: number;
  pageSize?: number;
  searchQuery?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Parse filters
    const accountIds = searchParams.get('accountIds')?.split(',').filter(Boolean) || [];
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const transactionTypes = searchParams.get('transactionTypes')?.split(',').filter(Boolean) as ('income' | 'expense' | 'transfer' | 'other')[] || [];
    const uncategorizedOnly = searchParams.get('uncategorizedOnly') === 'true';
    const categories = searchParams.get('categories')?.split(',').filter(Boolean) || [];
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50', 10), 100);
    const searchQuery = searchParams.get('searchQuery') || '';

    // Parse sorting
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortDirection = searchParams.get('sortDirection') || 'desc';
    const ascending = sortDirection === 'asc';

    // Validate sort column to prevent SQL injection
    const validSortColumns = ['merchant', 'account_name', 'category', 'date', 'amount'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'date';

    // Build query
    // Exclude synthetic "User Provided Income" transactions - these are manual budget entries, not real transactions
    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .neq('merchant', USER_PROVIDED_INCOME_MERCHANT)
      .order(sortColumn, { ascending });

    // Apply filters
    if (accountIds.length > 0) {
      query = query.in('account_id', accountIds);
    }

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    if (transactionTypes.length > 0) {
      query = query.in('transaction_type', transactionTypes);
    }

    if (uncategorizedOnly) {
      query = query.or('category.is.null,category.eq.');
    }

    if (categories.length > 0 && !uncategorizedOnly) {
      query = query.in('category', categories);
    }

    if (searchQuery) {
      query = query.or(`merchant.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
    }

    // Pagination
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data: transactions, error, count } = await query;

    if (error) {
      console.error('[transactions] Error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate totals for the filtered results (without pagination)
    // Include merchant and category for proper transfer detection
    // Exclude synthetic "User Provided Income" transactions
    let totalsQuery = supabase
      .from('transactions')
      .select('amount, transaction_type, merchant, category')
      .eq('user_id', userId)
      .neq('merchant', USER_PROVIDED_INCOME_MERCHANT);

    // Apply the same filters for totals
    if (accountIds.length > 0) {
      totalsQuery = totalsQuery.in('account_id', accountIds);
    }
    if (startDate) {
      totalsQuery = totalsQuery.gte('date', startDate);
    }
    if (endDate) {
      totalsQuery = totalsQuery.lte('date', endDate);
    }
    if (transactionTypes.length > 0) {
      totalsQuery = totalsQuery.in('transaction_type', transactionTypes);
    }
    if (uncategorizedOnly) {
      totalsQuery = totalsQuery.or('category.is.null,category.eq.');
    }
    if (categories.length > 0 && !uncategorizedOnly) {
      totalsQuery = totalsQuery.in('category', categories);
    }
    if (searchQuery) {
      totalsQuery = totalsQuery.or(`merchant.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
    }

    const { data: allTransactions } = await totalsQuery;

    let totalIncome = 0;
    let totalExpenses = 0;

    if (allTransactions) {
      for (const txn of allTransactions) {
        // Extra safety: skip synthetic user-provided income transactions
        if (isUserProvidedIncomeTransaction(txn)) {
          continue;
        }
        
        // Use the unified classifier to properly detect transfers and classify transactions
        const classification = classifyTransaction(txn);
        
        // Skip transfers and excluded transactions (credit card payments, internal transfers, etc.)
        if (classification.isExcluded) {
          continue;
        }
        
        if (classification.type === 'income') {
          totalIncome += classification.absAmount;
        } else if (classification.type === 'expense') {
          totalExpenses += classification.absAmount;
        }
      }
    }

    return NextResponse.json({
      transactions: transactions || [],
      pagination: {
        page,
        pageSize,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
      totals: {
        income: totalIncome,
        expenses: totalExpenses,
        net: totalIncome - totalExpenses,
      },
    });
  } catch (error: any) {
    console.error('[transactions] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
