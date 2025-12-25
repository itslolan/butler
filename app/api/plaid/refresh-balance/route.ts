import { NextRequest, NextResponse } from 'next/server';
import { plaidClient, isPlaidConfigured, formatPlaidError } from '@/lib/plaid-client';
import { createClient } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';
import { encryptNumber } from '@/lib/encryption';
import { logFromRequest } from '@/lib/audit-logger';

export const runtime = 'nodejs';

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
    const body = await request.json();
    const { plaid_item_id } = body;

    // Build query
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

    let totalUpdated = 0;
    const results: any[] = [];

    // Refresh balances for each item
    for (const item of plaidItems) {
      try {
        // Fetch balances from Plaid
        const balanceResponse = await plaidClient.accountsBalanceGet({
          access_token: item.plaid_access_token,
        });

        // Update each account in database with encrypted balances
        for (const account of balanceResponse.data.accounts) {
          const { error: updateError } = await supabase
            .from('plaid_accounts')
            .update({
              current_balance_encrypted: encryptNumber(account.balances.current, userId),
              available_balance_encrypted: encryptNumber(account.balances.available, userId),
              credit_limit_encrypted: encryptNumber(account.balances.limit, userId),
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('plaid_account_id', account.account_id);

          if (!updateError) {
            totalUpdated++;
          }
        }

        results.push({
          institution: item.plaid_institution_name,
          status: 'success',
          accounts_updated: balanceResponse.data.accounts.length,
        });

      } catch (itemError: any) {
        console.error(`Error refreshing balances for item ${item.id}:`, itemError);
        
        // Handle item errors (e.g., requires re-auth)
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

    // Log the balance refresh event
    logFromRequest(request, userId, 'plaid.refresh', {
      items_processed: plaidItems.length,
      accounts_updated: totalUpdated,
    });

    return NextResponse.json({
      success: true,
      total_updated: totalUpdated,
      results,
    });

  } catch (error: any) {
    console.error('[plaid/refresh-balance] Error:', error);
    return NextResponse.json(
      { error: formatPlaidError(error) },
      { status: 500 }
    );
  }
}
