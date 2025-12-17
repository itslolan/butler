'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function createClient(): SupabaseClient | null {
  // During prerender/build, Next may execute client components on the server.
  // Avoid creating a browser client in a non-browser environment.
  if (typeof window === 'undefined') return null;

  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Don't throw during render; allow the app to show a friendly message instead.
  if (!url || !anonKey) return null;

  _client = createBrowserClient(url, anonKey);
  return _client;
}

