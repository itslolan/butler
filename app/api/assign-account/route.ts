import { NextRequest, NextResponse } from 'next/server';
import { assignAccountToDocuments, getOrCreateAccount, getAccountById } from '@/lib/db-tools';
import { CreateAccountInput } from '@/lib/supabase';
import { createClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

/**
 * POST /api/assign-account - Assign account to documents (from screenshot uploads)
 * 
 * Body: {
 *   document_ids: string[],          // Documents to assign
 *   account_id?: string,             // Existing account ID (if selecting existing)
 *   new_account?: {                  // New account details (if creating new)
 *     display_name: string,
 *     last4?: string,
 *     account_type?: string,
 *     issuer?: string
 *   }
 * }
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
    const { document_ids, account_id, new_account } = body;

    // Validate document_ids
    if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
      return NextResponse.json(
        { error: 'document_ids is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    // Must provide either account_id or new_account
    if (!account_id && !new_account) {
      return NextResponse.json(
        { error: 'Either account_id or new_account must be provided' },
        { status: 400 }
      );
    }

    let accountToAssign;
    let accountCreated = false;

    if (account_id) {
      // Use existing account
      accountToAssign = await getAccountById(account_id);
      if (!accountToAssign) {
        return NextResponse.json(
          { error: 'Account not found' },
          { status: 404 }
        );
      }
    } else if (new_account) {
      // Create or get account
      if (!new_account.display_name) {
        return NextResponse.json(
          { error: 'new_account.display_name is required' },
          { status: 400 }
        );
      }

      const input: CreateAccountInput = {
        display_name: new_account.display_name,
        alias: new_account.alias || new_account.display_name,
        account_number_last4: new_account.last4 || new_account.account_number_last4 || null,
        account_type: new_account.account_type || null,
        issuer: new_account.issuer || null,
        source: 'manual',
      };

      const result = await getOrCreateAccount(userId, input);
      accountToAssign = result.account;
      accountCreated = result.created;
    }

    // Assign account to documents
    const assignResult = await assignAccountToDocuments(
      document_ids,
      accountToAssign!.id!,
      accountToAssign!.display_name
    );

    return NextResponse.json({
      success: true,
      account: accountToAssign,
      account_created: accountCreated,
      documents_updated: assignResult.documents_updated,
      transactions_updated: assignResult.transactions_updated,
    });

  } catch (error: any) {
    console.error('[assign-account] Error:', error.message);
    
    // Handle unique constraint violation for account creation
    if (error.message.includes('duplicate key') || error.message.includes('unique')) {
      return NextResponse.json(
        { error: 'An account with this name already exists. Please select it from the dropdown or use a different name.' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to assign account' },
      { status: 500 }
    );
  }
}

