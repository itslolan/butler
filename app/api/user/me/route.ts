import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { authenticated: false, error: 'Not authenticated' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    authenticated: true,
    userId: user.id,
    email: user.email,
  });
}

