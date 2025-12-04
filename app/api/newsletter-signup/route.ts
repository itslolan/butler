import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * API endpoint to collect newsletter email signups
 * 
 * POST /api/newsletter-signup
 * Body: {
 *   email: string,
 *   source?: string (optional, e.g., "demo-page")
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, source } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Normalize email (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim();

    // Insert email into database
    // Use upsert to handle duplicates gracefully (ON CONFLICT DO NOTHING)
    const { data, error } = await supabase
      .from('newsletter_emails')
      .upsert(
        {
          email: normalizedEmail,
          source: source || 'demo-page',
        },
        {
          onConflict: 'email',
          ignoreDuplicates: true,
        }
      )
      .select()
      .single();

    if (error) {
      // If it's a duplicate error, that's okay - return success
      if (error.code === '23505') {
        return NextResponse.json({
          success: true,
          message: 'Email already subscribed',
          email: normalizedEmail,
        });
      }
      
      throw new Error(`Failed to save email: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Email saved successfully',
      email: normalizedEmail,
    });

  } catch (error: any) {
    console.error('[newsletter-signup] Error:', error.message);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to save email',
      },
      { status: 500 }
    );
  }
}

