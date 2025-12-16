import { NextRequest, NextResponse } from 'next/server';
import { plaidClient, isPlaidConfigured, formatPlaidError, mapPlaidCategory, determineTransactionType } from '@/lib/plaid-client';
import { createClient } from '@/lib/supabase-server';
import { supabase, Transaction } from '@/lib/supabase';
import { categorizeTransactions, monitorTransactionPatterns } from '@/lib/transaction-categorizer';

export const runtime = 'nodejs';

// Batch size for LLM categorization (to avoid token limits)
const CATEGORIZATION_BATCH_SIZE = 50;

export async function POST(request: NextRequest) {
  try {
    // Check if Plaid is configured
    if (!isPlaidConfigured()) {
      return NextResponse.json(
        { error: 'Plaid is not configured' },
        { status: 500 }
      );
    }

    // Get authenticated user
    const supabaseAuth = createClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { plaid_item_id, days_back = 30 } = body;

    // Build query to get Plaid items
    let query = supabase
      .from('plaid_items')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (plaid_item_id) {
      query = query.eq('id', plaid_item_id);
    }

    const { data: plaidItems, error: itemsError } = await query;

    if (itemsError) {
      throw new Error(`Failed to fetch Plaid items: ${itemsError.message}`);
    }

    if (!plaidItems || plaidItems.length === 0) {
      return NextResponse.json(
        { error: 'No connected accounts found' },
        { status: 404 }
      );
    }

    // Calculate date range
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days_back * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let totalAdded = 0;
    let totalSkipped = 0;
    let totalModified = 0;
    let totalClarificationNeeded = 0;
    const results: any[] = [];
    const allInsertedTransactions: any[] = [];
    const allIncomeTransactions: any[] = [];

    // Sync transactions for each item
    for (const item of plaidItems) {
      try {
        // Use transactions/sync for incremental sync if cursor exists
        // Otherwise use transactions/get for initial sync
        let transactions: any[] = [];
        let newCursor: string | undefined;

        if (item.cursor) {
          // Incremental sync using cursor
          let hasMore = true;
          let cursor = item.cursor;

          while (hasMore) {
            const syncResponse = await plaidClient.transactionsSync({
              access_token: item.plaid_access_token,
              cursor,
            });

            transactions = transactions.concat(syncResponse.data.added);
            // Handle modified and removed transactions
            for (const modified of syncResponse.data.modified) {
              // Update existing transaction
              await supabase
                .from('transactions')
                .update({
                  merchant: modified.merchant_name || modified.name,
                  amount: modified.amount,
                  category: mapPlaidCategory(modified.category),
                  date: modified.date,
                })
                .eq('plaid_transaction_id', modified.transaction_id);
              totalModified++;
            }

            for (const removed of syncResponse.data.removed) {
              // Delete removed transactions
              await supabase
                .from('transactions')
                .delete()
                .eq('plaid_transaction_id', removed.transaction_id);
            }

            hasMore = syncResponse.data.has_more;
            cursor = syncResponse.data.next_cursor;
            newCursor = cursor;
          }
        } else {
          // Initial sync using transactions/get
          const transactionsResponse = await plaidClient.transactionsGet({
            access_token: item.plaid_access_token,
            start_date: startDate,
            end_date: endDate,
            options: {
              count: 500,
              offset: 0,
            },
          });

          transactions = transactionsResponse.data.transactions;

          // If there are more transactions, paginate
          const totalTransactions = transactionsResponse.data.total_transactions;
          let offset = transactions.length;

          while (offset < totalTransactions) {
            const moreResponse = await plaidClient.transactionsGet({
              access_token: item.plaid_access_token,
              start_date: startDate,
              end_date: endDate,
              options: {
                count: 500,
                offset,
              },
            });
            transactions = transactions.concat(moreResponse.data.transactions);
            offset += moreResponse.data.transactions.length;
          }
        }

        // Get account mappings
        const { data: plaidAccounts } = await supabase
          .from('plaid_accounts')
          .select('plaid_account_id, account_name')
          .eq('plaid_item_id', item.id);

        const accountNameMap = new Map(
          (plaidAccounts || []).map(acc => [acc.plaid_account_id, acc.account_name])
        );

        // Filter out pending and already-existing transactions
        const newTransactions: any[] = [];
        for (const txn of transactions) {
          if (txn.pending) continue;

          const { data: existing } = await supabase
            .from('transactions')
            .select('id')
            .eq('plaid_transaction_id', txn.transaction_id)
            .single();

          if (!existing) {
            newTransactions.push(txn);
          }
        }

        // Prepare transactions for LLM categorization
        const rawTransactions = newTransactions.map(txn => ({
          date: txn.date,
          merchant: txn.merchant_name || txn.name,
          amount: txn.amount,
          category: mapPlaidCategory(txn.category),
          description: txn.name,
          transactionType: determineTransactionType(txn.amount, txn.category, txn.merchant_name),
        }));

        // Categorize transactions in batches using LLM
        let categorizedTransactions: any[] = [];
        let incomeTransactions: any[] = [];

        for (let i = 0; i < rawTransactions.length; i += CATEGORIZATION_BATCH_SIZE) {
          const batch = rawTransactions.slice(i, i + CATEGORIZATION_BATCH_SIZE);
          
          try {
            const result = await categorizeTransactions(userId, batch);
            categorizedTransactions = categorizedTransactions.concat(result.transactions);
            incomeTransactions = incomeTransactions.concat(result.incomeTransactions);
          } catch (catError: any) {
            console.error('Categorization error for batch:', catError.message);
            // Fallback: use the raw transactions without LLM enhancement
            categorizedTransactions = categorizedTransactions.concat(batch.map(t => ({
              ...t,
              spendClassification: null,
              confidence: 0.5,
              clarificationNeeded: true,
              clarificationQuestion: 'What type of transaction is this?',
              suggestedActions: null,
            })));
          }
        }

        // Insert categorized transactions
        let itemAdded = 0;
        let itemSkipped = 0;
        let itemClarificationNeeded = 0;

        for (let i = 0; i < newTransactions.length; i++) {
          const plaidTxn = newTransactions[i];
          const categorized = categorizedTransactions[i];

          const transaction: Transaction = {
            user_id: userId,
            plaid_transaction_id: plaidTxn.transaction_id,
            plaid_account_id: plaidTxn.account_id,
            account_name: accountNameMap.get(plaidTxn.account_id) || null,
            date: plaidTxn.date,
            merchant: plaidTxn.merchant_name || plaidTxn.name,
            amount: plaidTxn.amount,
            category: categorized?.category || mapPlaidCategory(plaidTxn.category),
            description: plaidTxn.name,
            transaction_type: categorized?.transactionType || determineTransactionType(
              plaidTxn.amount,
              plaidTxn.category,
              plaidTxn.merchant_name
            ),
            spend_classification: categorized?.spendClassification || null,
            needs_clarification: categorized?.clarificationNeeded || false,
            clarification_question: categorized?.clarificationQuestion || null,
            suggested_actions: categorized?.suggestedActions || null,
            source: 'plaid',
            currency: plaidTxn.iso_currency_code || 'USD',
            metadata: {
              plaid_category: plaidTxn.category,
              payment_channel: plaidTxn.payment_channel,
              location: plaidTxn.location,
              confidence: categorized?.confidence || 0.5,
            },
          };

          const { error: insertError } = await supabase
            .from('transactions')
            .insert(transaction);

          if (insertError) {
            console.error('Error inserting transaction:', insertError);
            itemSkipped++;
          } else {
            itemAdded++;
            allInsertedTransactions.push(categorized);
            if (transaction.needs_clarification) {
              itemClarificationNeeded++;
            }
          }
        }

        // Collect income transactions for pattern monitoring
        allIncomeTransactions.push(...incomeTransactions);

        // Update cursor for incremental sync
        if (newCursor) {
          await supabase
            .from('plaid_items')
            .update({ cursor: newCursor })
            .eq('id', item.id);
        }

        // Update last_synced_at for accounts
        await supabase
          .from('plaid_accounts')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('plaid_item_id', item.id);

        totalAdded += itemAdded;
        totalSkipped += itemSkipped + (transactions.length - newTransactions.length);
        totalClarificationNeeded += itemClarificationNeeded;

        results.push({
          institution: item.plaid_institution_name,
          status: 'success',
          transactions_added: itemAdded,
          transactions_skipped: itemSkipped + (transactions.length - newTransactions.length),
          transactions_modified: totalModified,
          clarification_needed: itemClarificationNeeded,
        });

      } catch (itemError: any) {
        console.error(`Error syncing transactions for item ${item.id}:`, itemError);

        // Handle item errors
        if (itemError?.response?.data?.error_code === 'ITEM_LOGIN_REQUIRED') {
          await supabase
            .from('plaid_items')
            .update({
              status: 'error',
              error_code: 'ITEM_LOGIN_REQUIRED',
              error_message: 'Re-authentication required',
            })
            .eq('id', item.id);
        }

        results.push({
          institution: item.plaid_institution_name,
          status: 'error',
          error: formatPlaidError(itemError),
        });
      }
    }

    // Run pattern monitoring to detect and save memory patterns
    if (allInsertedTransactions.length > 0) {
      try {
        await monitorTransactionPatterns(userId, allInsertedTransactions, allIncomeTransactions);
      } catch (monitorError: any) {
        console.error('[plaid/sync-transactions] Pattern monitoring error:', monitorError.message);
        // Non-critical, don't fail the sync
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total_added: totalAdded,
        total_skipped: totalSkipped,
        total_modified: totalModified,
        total_clarification_needed: totalClarificationNeeded,
        date_range: { start: startDate, end: endDate },
      },
      results,
    });

  } catch (error: any) {
    console.error('[plaid/sync-transactions] Error:', error);
    return NextResponse.json(
      { error: formatPlaidError(error) },
      { status: 500 }
    );
  }
}
