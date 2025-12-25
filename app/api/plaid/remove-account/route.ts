import { NextRequest, NextResponse } from 'next/server';
import { plaidClient, isPlaidConfigured, formatPlaidError } from '@/lib/plaid-client';
import { createClient } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';
import { logFromRequest } from '@/lib/audit-logger';

export const runtime = 'nodejs';

export async function DELETE(request: NextRequest) {
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

    if (!plaid_item_id) {
      return NextResponse.json(
        { error: 'plaid_item_id is required' },
        { status: 400 }
      );
    }

    // Verify item belongs to user
    const { data: plaidItem, error: itemError } = await supabase
      .from('plaid_items')
      .select('*')
      .eq('id', plaid_item_id)
      .eq('user_id', userId)
      .single();

    if (itemError || !plaidItem) {
      return NextResponse.json(
        { error: 'Plaid item not found' },
        { status: 404 }
      );
    }

    // Remove item from Plaid (invalidate access token)
    try {
      await plaidClient.itemRemove({
        access_token: plaidItem.plaid_access_token,
      });
    } catch (plaidError: any) {
      console.warn('Error removing item from Plaid:', plaidError);
      // Continue anyway - we still want to remove from our database
    }

    // Mark item as inactive (preserve transaction history)
    const { error: updateError } = await supabase
      .from('plaid_items')
      .update({
        status: 'inactive',
        plaid_access_token: '', // Clear access token for security
        updated_at: new Date().toISOString(),
      })
      .eq('id', plaid_item_id);

    if (updateError) {
      throw new Error(`Failed to update Plaid item: ${updateError.message}`);
    }

    // Log the disconnection event
    logFromRequest(request, userId, 'plaid.disconnected', {
      institution_name: plaidItem.plaid_institution_name,
      item_id: plaid_item_id,
    });

    return NextResponse.json({
      success: true,
      message: `Disconnected ${plaidItem.plaid_institution_name}`,
    });

  } catch (error: any) {
    console.error('[plaid/remove-account] Error:', error);
    return NextResponse.json(
      { error: formatPlaidError(error) },
      { status: 500 }
    );
  }
}
