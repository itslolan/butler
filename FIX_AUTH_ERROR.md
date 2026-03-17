# Fix: Auth Refresh Token Error

## Problem
You're seeing this error when accessing localhost:3000:
```
[AuthApiError: Invalid Refresh Token: Refresh Token Not Found] {
  __isAuthError: true,
  name: 'AuthApiError',
  status: 400,
  code: 'refresh_token_not_found'
}
```

## Root Cause
This happens when your browser has stale or corrupted Supabase authentication cookies. The middleware tries to refresh the session on every request, but the refresh token in the cookie is invalid or expired.

## Solution Applied

### 1. Updated Middleware (lib/supabase-middleware.ts)
Added error handling to gracefully handle auth errors and automatically clear corrupted cookies:
- Catches auth errors instead of letting them propagate
- Clears invalid Supabase cookies automatically
- Logs errors for debugging

### 2. Updated AuthProvider (components/AuthProvider.tsx)
Added error handling in the session initialization:
- Catches errors when getting initial session
- Gracefully handles refresh token errors
- Prevents app from crashing

## How to Fix Right Now

### Option 1: Clear Browser Cookies (Recommended)
1. Open your browser
2. Open Developer Tools (F12)
3. Go to the "Application" tab (Chrome) or "Storage" tab (Firefox)
4. Find "Cookies" in the left sidebar
5. Click on "http://localhost:3000"
6. Delete all cookies that start with "sb-" (Supabase cookies)
7. Refresh the page

### Option 2: Use Incognito/Private Window
1. Open an incognito/private browser window
2. Navigate to http://localhost:3000
3. This will start with a clean slate (no cookies)

### Option 3: Clear All Site Data
In Chrome:
1. Click the lock icon in the address bar
2. Click "Cookies and site data"
3. Click "Manage on-device site data"
4. Remove localhost:3000
5. Refresh the page

## After Clearing Cookies

1. You'll be redirected to the login page (if middleware is protecting routes)
2. Sign up or log in with your credentials
3. The app should work normally with fresh auth tokens

## For Development

If you frequently encounter this issue during development, you can:

1. **Always start with Incognito mode** - Ensures clean slate
2. **Sign out properly** - Always use the "Sign Out" button in the app rather than just closing the browser
3. **Restart the dev server** - Sometimes helps clear server-side session state

## Testing the Fix

1. Stop your dev server (Ctrl+C)
2. Clear browser cookies as described above
3. Restart dev server: `npm run dev`
4. Navigate to http://localhost:3000
5. The error should be gone (or handled gracefully)

## What Changed in the Code

The middleware now:
- Catches auth errors instead of crashing
- Automatically removes invalid cookies
- Logs errors for debugging

The AuthProvider now:
- Handles session errors gracefully
- Won't crash if refresh token is invalid
- Properly initializes with null session on error

## Prevention

To prevent this in production:
1. Ensure proper session expiry handling
2. Implement refresh token rotation
3. Add session timeout warnings
4. Handle auth state changes properly

## Still Having Issues?

If the error persists after clearing cookies:
1. Check that environment variables are properly set in `.env.local`
2. Verify Supabase project is active and accessible
3. Check Supabase dashboard for any service issues
4. Look at browser console for additional error details
5. Check server logs for more context
