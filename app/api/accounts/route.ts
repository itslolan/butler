import { NextRequest, NextResponse } from 'next/server';
import { getAccountsByUserId, createAccount, getDocumentsPendingAccountSelection } from '@/lib/db-tools';
import { CreateAccountInput } from '@/lib/supabase';
import { createClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/accounts - List all accounts for the authenticated user
 * Also returns documents pending account selection
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabaseAuth = createClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      console.error('[accounts] Authentication failed:', authError?.message);
      return NextResponse.json(
        { error: 'Unauthorized', accounts: [] },
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const userId = user.id;

    // Get all accounts
    const accounts = await getAccountsByUserId(userId);
    
    // Get documents pending account selection
    const pendingDocuments = await getDocumentsPendingAccountSelection(userId);

    return NextResponse.json({
      accounts,
      pendingDocuments,
      totalAccounts: accounts.length,
      totalPendingDocuments: pendingDocuments.length,
    });

  } catch (error: any) {
    console.error('[accounts] GET Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch accounts', accounts: [] },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * POST /api/accounts - Create a new account
 * Body: CreateAccountInput
 */
export async function POST(request: NextRequest) {
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
    const body = await request.json();

    // Validate required fields
    if (!body.display_name) {
      return NextResponse.json(
        { error: 'display_name is required' },
        { status: 400 }
      );
    }

    const input: CreateAccountInput = {
      display_name: body.display_name,
      alias: body.alias || body.display_name,
      account_number_last4: body.account_number_last4 || body.last4 || null,
      account_type: body.account_type || null,
      issuer: body.issuer || null,
      source: body.source || 'manual',
      official_name: body.official_name || null,
      plaid_account_id: body.plaid_account_id || null,
    };

    const account = await createAccount(userId, input);

    return NextResponse.json({
      success: true,
      account,
    });

  } catch (error: any) {
    console.error('[accounts] POST Error:', error.message);
    
    // Handle unique constraint violation
    if (error.message.includes('duplicate key') || error.message.includes('unique')) {
      return NextResponse.json(
        { error: 'An account with this name already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to create account' },
      { status: 500 }
    );
  }
}

