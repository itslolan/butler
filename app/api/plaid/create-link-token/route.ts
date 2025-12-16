import { NextRequest, NextResponse } from 'next/server';
import { plaidClient, PLAID_PRODUCTS, PLAID_COUNTRY_CODES, PLAID_LANGUAGE, isPlaidConfigured, formatPlaidError } from '@/lib/plaid-client';
import { createClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Check if Plaid is configured
    if (!isPlaidConfigured()) {
      return NextResponse.json(
        { error: 'Plaid is not configured. Please add PLAID_CLIENT_ID and PLAID_SECRET to your environment variables.' },
        { status: 500 }
      );
    }

    // Get authenticated user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Create link token
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: userId,
      },
      client_name: 'Adphex',
      products: PLAID_PRODUCTS,
      country_codes: PLAID_COUNTRY_CODES,
      language: PLAID_LANGUAGE,
      // Optional: Set redirect URI for OAuth institutions
      redirect_uri: process.env.NEXT_PUBLIC_PLAID_REDIRECT_URI || undefined,
    });

    return NextResponse.json({
      link_token: response.data.link_token,
      expiration: response.data.expiration,
    });

  } catch (error: any) {
    console.error('[plaid/create-link-token] Error:', error);
    return NextResponse.json(
      { error: formatPlaidError(error) },
      { status: 500 }
    );
  }
}
