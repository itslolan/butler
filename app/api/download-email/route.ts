import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Get user agent and IP from request headers
    const userAgent = req.headers.get('user-agent') || null;
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const ipAddress = forwardedFor?.split(',')[0] || realIp || null;

    // Insert email into database
    const { data, error } = await supabase
      .from('download_emails')
      .insert({
        email: email.toLowerCase().trim(),
        user_agent: userAgent,
        ip_address: ipAddress,
        download_url: 'https://gaddwvuybwnhcgciwfky.supabase.co/storage/v1/object/public/adphex-release/Adphex-0.1.0_aarch64.dmg',
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving download email:', error);
      return NextResponse.json(
        { error: 'Failed to save email' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in download-email route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
