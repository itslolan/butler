import { NextRequest, NextResponse } from 'next/server';
import { plaidClient, isPlaidConfigured, formatPlaidError, PLAID_COUNTRY_CODES } from '@/lib/plaid-client';
import { createClient } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';

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
    const { public_token, metadata } = body;

    if (!public_token) {
      return NextResponse.json(
        { error: 'public_token is required' },
        { status: 400 }
      );
    }

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Get institution info
    let institutionId: string | null = null;
    let institutionName: string | null = null;

    if (metadata?.institution) {
      institutionId = metadata.institution.institution_id || null;
      institutionName = metadata.institution.name || null;
    } else {
      // Fetch item to get institution info
      try {
        const itemResponse = await plaidClient.itemGet({
          access_token: accessToken,
        });
        institutionId = itemResponse.data.item.institution_id || null;

        if (institutionId) {
          const institutionResponse = await plaidClient.institutionsGetById({
            institution_id: institutionId,
            country_codes: PLAID_COUNTRY_CODES,
          });
          institutionName = institutionResponse.data.institution.name;
        }
      } catch (e) {
        console.warn('Could not fetch institution info:', e);
      }
    }

    // Store the item in database
    const { data: plaidItem, error: insertError } = await supabase
      .from('plaid_items')
      .insert({
        user_id: userId,
        plaid_item_id: itemId,
        plaid_access_token: accessToken,
        plaid_institution_id: institutionId,
        plaid_institution_name: institutionName,
        status: 'active',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error storing Plaid item:', insertError);
      throw new Error('Failed to store Plaid connection');
    }

    // Fetch accounts from Plaid
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    // Store accounts in database
    const accountsToInsert = accountsResponse.data.accounts.map((account) => ({
      user_id: userId,
      plaid_item_id: plaidItem.id,
      plaid_account_id: account.account_id,
      account_name: account.name,
      account_official_name: account.official_name,
      account_type: account.type,
      account_subtype: account.subtype,
      account_mask: account.mask,
      current_balance: account.balances.current,
      available_balance: account.balances.available,
      credit_limit: account.balances.limit,
      currency: account.balances.iso_currency_code || 'USD',
    }));

    const { error: accountsError } = await supabase
      .from('plaid_accounts')
      .insert(accountsToInsert);

    if (accountsError) {
      console.error('Error storing Plaid accounts:', accountsError);
      // Don't fail completely, the item was still created
    }

    return NextResponse.json({
      success: true,
      item_id: plaidItem.id,
      institution_name: institutionName,
      accounts_count: accountsToInsert.length,
    });

  } catch (error: any) {
    console.error('[plaid/exchange-token] Error:', error);
    return NextResponse.json(
      { error: formatPlaidError(error) },
      { status: 500 }
    );
  }
}
