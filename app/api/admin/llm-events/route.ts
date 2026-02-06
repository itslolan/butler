import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    // Check admin auth
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check admin status
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();
    
    if (settingsError || !settings || !settings.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Use service role client to bypass RLS
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const flowName = searchParams.get('flowName');
    const eventType = searchParams.get('eventType');
    
    // Build query
    let query = serviceSupabase
      .from('llm_events')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (flowName) {
      query = query.eq('flow_name', flowName);
    }
    
    if (eventType) {
      query = query.eq('event_type', eventType);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching LLM events:', error);
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }
    
    return NextResponse.json({ events: data || [] });
  } catch (error: any) {
    console.error('Error in /api/admin/llm-events:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
