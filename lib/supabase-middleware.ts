import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/blog', '/tools', '/pricing', '/privacy', '/login', '/signup', '/demo'];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const pathname = request.nextUrl.pathname;

  // Skip session update for public routes - just pass through
  if (isPublicRoute(pathname)) {
    return response;
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value,
              ...options,
            });
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value: '',
              ...options,
            });
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set({
              name,
              value: '',
              ...options,
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Auth error in middleware:', error.message);
      
      const accessToken = request.cookies.get('sb-access-token');
      const refreshToken = request.cookies.get('sb-refresh-token');
      
      if (accessToken || refreshToken) {
        response.cookies.delete('sb-access-token');
        response.cookies.delete('sb-refresh-token');
        
        const supabaseCookies = request.cookies.getAll()
          .map(c => c.name)
          .filter(name => name.startsWith('sb-'));
        supabaseCookies.forEach(name => {
          response.cookies.delete(name);
        });
      }
    }
  } catch (error) {
    console.error('[Middleware] Error updating session:', error);
  }

  return response;
}
