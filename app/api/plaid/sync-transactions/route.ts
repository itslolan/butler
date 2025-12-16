import { NextRequest, NextResponse } from 'next/server';
import { plaidClient, isPlaidConfigured, formatPlaidError, mapPlaidCategory, determineTransactionType } from '@/lib/plaid-client';
import { createClient } from '@/lib/supabase-server';
import { supabase, Transaction } from '@/lib/supabase';
import { categorizeTransactions, monitorTransactionPatterns } from '@/lib/transaction-categorizer';
import { searchTransactions, findAccountByPlaidId, findAccountsByLast4, getOrCreateAccount } from '@/lib/db-tools';
import { deduplicateTransactionsSimple } from '@/lib/deduplication-test';

export const runtime = 'nodejs';

// Batch size for LLM categorization (to avoid token limits)
const CATEGORIZATION_BATCH_SIZE = 50;

function chunkArray<T>(arr: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [arr];
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize));
  }
  return chunks;
}

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
        const modifiedTransactions: any[] = [];

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
            modifiedTransactions.push(...syncResponse.data.modified);

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

        // Get account mappings from plaid_accounts
        const { data: plaidAccounts } = await supabase
          .from('plaid_accounts')
          .select('plaid_account_id, account_name, account_official_name, account_type, mask')
          .eq('plaid_item_id', item.id);

        const accountNameMap = new Map(
          (plaidAccounts || []).map(acc => [acc.plaid_account_id, acc.account_name])
        );

        // Ensure unified accounts exist for each Plaid account
        const accountIdMap = new Map<string, string>(); // plaid_account_id -> unified account id
        const accountsNeedingConfirmation: Array<{
          plaidAccountId: string;
          officialName: string;
          last4: string;
          matchedAccounts: any[];
        }> = [];

        for (const plaidAcc of plaidAccounts || []) {
          // Check if unified account already linked
          const existingUnified = await findAccountByPlaidId(userId, plaidAcc.plaid_account_id);
          
          if (existingUnified) {
            accountIdMap.set(plaidAcc.plaid_account_id, existingUnified.id!);
            continue;
          }

          // Try to find by last4
          const last4 = plaidAcc.mask;
          if (last4) {
            const matchingAccounts = await findAccountsByLast4(userId, last4);
            
            if (matchingAccounts.length === 1 && !matchingAccounts[0].plaid_account_id) {
              // Single match without Plaid link - this might need confirmation
              // For now, we'll flag it for later user confirmation
              accountsNeedingConfirmation.push({
                plaidAccountId: plaidAcc.plaid_account_id,
                officialName: plaidAcc.account_official_name || plaidAcc.account_name,
                last4,
                matchedAccounts: matchingAccounts,
              });
            } else if (matchingAccounts.length === 0) {
              // No match - create new unified account
              const { account } = await getOrCreateAccount(userId, {
                display_name: plaidAcc.account_name || plaidAcc.account_official_name || `Account ****${last4}`,
                official_name: plaidAcc.account_official_name,
                account_number_last4: last4,
                account_type: plaidAcc.account_type as any,
                issuer: item.plaid_institution_name || undefined,
                source: 'plaid',
                plaid_account_id: plaidAcc.plaid_account_id,
              });
              accountIdMap.set(plaidAcc.plaid_account_id, account.id!);
            }
          } else {
            // No last4 - create new account
            const { account } = await getOrCreateAccount(userId, {
              display_name: plaidAcc.account_name || plaidAcc.account_official_name || 'Unknown Account',
              official_name: plaidAcc.account_official_name,
              account_type: plaidAcc.account_type as any,
              issuer: item.plaid_institution_name || undefined,
              source: 'plaid',
              plaid_account_id: plaidAcc.plaid_account_id,
            });
            accountIdMap.set(plaidAcc.plaid_account_id, account.id!);
          }
        }

        // Re-categorize and update modified transactions (so they also get LLM categorization, like statement uploads)
        if (modifiedTransactions.length > 0) {
          const modifiedRaw = modifiedTransactions
            .filter(txn => !txn.pending)
            .map(txn => ({
              date: txn.date,
              merchant: txn.merchant_name || txn.name,
              amount: txn.amount,
              category: mapPlaidCategory(txn.category),
              description: txn.name,
              transactionType: determineTransactionType(txn.amount, txn.category, txn.merchant_name),
              _plaidTxn: txn,
            }));

          for (let i = 0; i < modifiedRaw.length; i += CATEGORIZATION_BATCH_SIZE) {
            const batch = modifiedRaw.slice(i, i + CATEGORIZATION_BATCH_SIZE);
            let categorizedBatch: any[] = [];

            try {
              const result = await categorizeTransactions(userId, batch);
              categorizedBatch = result.transactions;
            } catch (catError: any) {
              console.error('[plaid/sync-transactions] Categorization error for modified batch:', catError.message);
              categorizedBatch = batch.map(t => ({
                ...t,
                spendClassification: null,
                confidence: 0.5,
                clarificationNeeded: true,
                clarificationQuestion: 'What type of transaction is this?',
                suggestedActions: null,
              }));
            }

            for (let j = 0; j < batch.length; j++) {
              const original = batch[j]._plaidTxn;
              const categorized = categorizedBatch[j];

              const { error: updateError } = await supabase
                .from('transactions')
                .update({
                  merchant: original.merchant_name || original.name,
                  amount: original.amount,
                  category: categorized?.category || mapPlaidCategory(original.category),
                  date: original.date,
                  description: original.name,
                  transaction_type: categorized?.transactionType || determineTransactionType(
                    original.amount,
                    original.category,
                    original.merchant_name
                  ),
                  spend_classification: categorized?.spendClassification || null,
                  needs_clarification: categorized?.clarificationNeeded || false,
                  clarification_question: categorized?.clarificationQuestion || null,
                  suggested_actions: categorized?.suggestedActions || null,
                })
                .eq('plaid_transaction_id', original.transaction_id);

              if (updateError) {
                console.error('[plaid/sync-transactions] Error updating modified transaction:', updateError);
              } else {
                totalModified++;
              }
            }
          }
        }

        // Filter out pending and already-existing Plaid transactions (by Plaid transaction id)
        const candidateTransactions = transactions.filter(txn => !txn.pending);
        const candidateIds = candidateTransactions.map(txn => txn.transaction_id).filter(Boolean);

        const existingPlaidIdSet = new Set<string>();
        for (const idsChunk of chunkArray(candidateIds, 500)) {
          const { data: existingRows, error: existingError } = await supabase
            .from('transactions')
            .select('plaid_transaction_id')
            .in('plaid_transaction_id', idsChunk);

          if (existingError) {
            console.error('[plaid/sync-transactions] Error checking existing transactions:', existingError);
          }

          for (const row of existingRows || []) {
            if (row.plaid_transaction_id) existingPlaidIdSet.add(row.plaid_transaction_id);
          }
        }

        const newTransactions = candidateTransactions.filter(
          txn => !existingPlaidIdSet.has(txn.transaction_id)
        );

        // Deduplicate new Plaid transactions against existing DB transactions (same behavior as statement uploads)
        // We do this BEFORE LLM categorization to avoid spending tokens on duplicates.
        let dedupedNewTransactions: any[] = [];
        let duplicatesRemoved = 0;

        // Group by resolved account_name (best cross-source match key)
        const byAccountName = new Map<string, any[]>();
        const noAccountName: any[] = [];

        for (const txn of newTransactions) {
          const resolvedAccountName = accountNameMap.get(txn.account_id) || null;
          if (!resolvedAccountName) {
            noAccountName.push(txn);
            continue;
          }
          if (!byAccountName.has(resolvedAccountName)) byAccountName.set(resolvedAccountName, []);
          byAccountName.get(resolvedAccountName)!.push(txn);
        }

        // If we can't resolve account name, fall back to inserting (same as current behavior)
        dedupedNewTransactions.push(...noAccountName);

        for (const [accountName, txnsForAccount] of byAccountName.entries()) {
          // Compute date window for fetching existing transactions
          let minDate = txnsForAccount[0]?.date;
          let maxDate = txnsForAccount[0]?.date;
          for (const t of txnsForAccount) {
            if (t.date < minDate) minDate = t.date;
            if (t.date > maxDate) maxDate = t.date;
          }

          const existing = await searchTransactions(userId, {
            accountName,
            startDate: minDate,
            endDate: maxDate,
          });

          const existingForDedup = existing.map(t => ({
            date: t.date instanceof Date ? t.date.toISOString().split('T')[0] : (t.date as any),
            merchant: t.merchant,
            amount: Number(t.amount),
            category: t.category,
            description: t.description,
          }));

          const newForDedup = txnsForAccount.map(txn => ({
            date: txn.date,
            merchant: txn.merchant_name || txn.name,
            amount: txn.amount,
            category: mapPlaidCategory(txn.category),
            description: txn.name,
            _plaidTxn: txn,
          }));

          const dedupResult: any = deduplicateTransactionsSimple(newForDedup as any, existingForDedup as any);
          duplicatesRemoved += dedupResult.duplicatesFound || 0;
          dedupedNewTransactions.push(...(dedupResult.uniqueTransactions || []).map((t: any) => t._plaidTxn));
        }

        // Prepare transactions for LLM categorization
        const rawTransactions = dedupedNewTransactions.map(txn => ({
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
        const existingByPlaidIdSkipped = candidateTransactions.length - newTransactions.length;

        for (let i = 0; i < dedupedNewTransactions.length; i++) {
          const plaidTxn = dedupedNewTransactions[i];
          const categorized = categorizedTransactions[i];
          
          // Get unified account_id if available
          const unifiedAccountId = accountIdMap.get(plaidTxn.account_id) || null;

          const transaction: Transaction = {
            user_id: userId,
            plaid_transaction_id: plaidTxn.transaction_id,
            plaid_account_id: plaidTxn.account_id,
            account_id: unifiedAccountId,
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
        totalSkipped += itemSkipped + existingByPlaidIdSkipped + duplicatesRemoved;
        totalClarificationNeeded += itemClarificationNeeded;

        results.push({
          institution: item.plaid_institution_name,
          status: 'success',
          transactions_added: itemAdded,
          transactions_skipped: itemSkipped + existingByPlaidIdSkipped + duplicatesRemoved,
          transactions_modified: totalModified,
          clarification_needed: itemClarificationNeeded,
          duplicates_removed: duplicatesRemoved,
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
