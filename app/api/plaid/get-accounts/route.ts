import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';
import { decryptField, decryptNumber } from '@/lib/encryption';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
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

    // Fetch all plaid items for user
    const { data: plaidItems, error: itemsError } = await supabase
      .from('plaid_items')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (itemsError) {
      throw new Error(`Failed to fetch Plaid items: ${itemsError.message}`);
    }

    // Fetch all accounts for these items
    const itemIds = plaidItems?.map(item => item.id) || [];
    
    let accounts: any[] = [];
    if (itemIds.length > 0) {
      const { data: plaidAccounts, error: accountsError } = await supabase
        .from('plaid_accounts')
        .select('*')
        .in('plaid_item_id', itemIds)
        .order('account_type', { ascending: true });

      if (accountsError) {
        throw new Error(`Failed to fetch Plaid accounts: ${accountsError.message}`);
      }

      accounts = plaidAccounts || [];
    }

    // Group accounts by institution
    const institutionMap = new Map();
    
    for (const item of plaidItems || []) {
      institutionMap.set(item.id, {
        id: item.id,
        institution_id: item.plaid_institution_id,
        institution_name: item.plaid_institution_name,
        status: item.status,
        created_at: item.created_at,
        accounts: [],
      });
    }

    for (const account of accounts) {
      const institution = institutionMap.get(account.plaid_item_id);
      if (institution) {
        // Decrypt sensitive fields with fallback to unencrypted data
        let currentBalance = null;
        let availableBalance = null;
        let creditLimit = null;
        let officialName = null;

        try {
          // Try encrypted first, fall back to unencrypted (backwards compatibility)
          currentBalance = account.current_balance_encrypted 
            ? decryptNumber(account.current_balance_encrypted, userId)
            : account.current_balance; // Fallback to old unencrypted data
          
          availableBalance = account.available_balance_encrypted
            ? decryptNumber(account.available_balance_encrypted, userId)
            : account.available_balance; // Fallback to old unencrypted data
          
          creditLimit = account.credit_limit_encrypted
            ? decryptNumber(account.credit_limit_encrypted, userId)
            : account.credit_limit; // Fallback to old unencrypted data
          
          officialName = account.account_official_name_encrypted
            ? decryptField(account.account_official_name_encrypted, userId)
            : account.account_official_name; // Fallback to unencrypted if exists
        } catch (err) {
          console.error('[get-accounts] Decryption error for account:', account.id, err);
          // On decryption error, try falling back to unencrypted
          currentBalance = account.current_balance || null;
          availableBalance = account.available_balance || null;
          creditLimit = account.credit_limit || null;
          officialName = account.account_official_name || null;
        }

        institution.accounts.push({
          id: account.id,
          plaid_account_id: account.plaid_account_id,
          name: account.account_name,
          official_name: officialName,
          type: account.account_type,
          subtype: account.account_subtype,
          mask: account.account_mask,
          current_balance: currentBalance,
          available_balance: availableBalance,
          credit_limit: creditLimit,
          currency: account.currency,
          last_synced_at: account.last_synced_at,
        });
      }
    }

    const institutions = Array.from(institutionMap.values());

    return NextResponse.json({
      institutions,
      total_accounts: accounts.length,
    });

  } catch (error: any) {
    console.error('[plaid/get-accounts] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}
