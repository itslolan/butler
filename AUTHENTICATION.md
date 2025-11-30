# Authentication Setup Guide

Butler now includes user authentication using Supabase Auth. Users can sign up and log in using email/password or Google OAuth.

## Features

✅ Email/Password Authentication
✅ Google OAuth Integration  
✅ Protected Routes with Auth Middleware
✅ User-specific Data Isolation
✅ Session Management
✅ Logout Functionality

---

## Setup Instructions

### 1. Environment Variables

Add the following to your `.env.local` file:

```bash
# Supabase Authentication (required)
NEXT_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Where to find these:**
1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to **Settings** > **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Enable Email Authentication in Supabase

1. In your Supabase Dashboard, go to **Authentication** > **Providers**
2. Ensure **Email** is enabled
3. Configure email templates if needed (optional)

### 3. Enable Google OAuth (Optional)

To enable Google sign-in:

1. **Create Google OAuth Credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Go to **APIs & Services** > **Credentials**
   - Click **Create Credentials** > **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Add authorized redirect URIs:
     ```
     https://your-project-url.supabase.co/auth/v1/callback
     ```
   - Copy the **Client ID** and **Client Secret**

2. **Configure in Supabase:**
   - In Supabase Dashboard, go to **Authentication** > **Providers**
   - Find **Google** and enable it
   - Paste your Google **Client ID** and **Client Secret**
   - Save

3. **Update Your App URL:**
   - In Supabase Dashboard, go to **Authentication** > **URL Configuration**
   - Set **Site URL** to your production URL (e.g., `https://your-app.com`)
   - Add **Redirect URLs**:
     ```
     http://localhost:3000/auth/callback
     https://your-app.com/auth/callback
     ```

### 4. Test Authentication

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000`
3. You should be redirected to `/login`
4. Try signing up with email or Google
5. After successful authentication, you should be redirected to the main dashboard

---

## How It Works

### Authentication Flow

1. **Unauthenticated Users:**
   - Redirected to `/login` page
   - Can sign up or sign in with email/password or Google

2. **Authentication Process:**
   - Email/password: Direct sign-in via Supabase
   - Google OAuth: Redirects to Google, then back to `/auth/callback`

3. **Authenticated Users:**
   - Session stored in secure httpOnly cookies
   - Middleware refreshes sessions automatically
   - User ID used for all database operations

4. **Sign Out:**
   - Click "Sign Out" in top-right menu
   - Clears session and redirects to `/login`

### Protected Routes

All routes are protected by default except:
- `/login` - Login/Signup page
- `/auth/callback` - OAuth callback handler
- Static assets

This is managed by `middleware.ts` which refreshes user sessions on every request.

### User Data Isolation

- All financial data (documents, transactions, metadata) is linked to the authenticated user's ID
- Users can only see and interact with their own data
- API routes automatically use the authenticated user ID from the session

---

## Architecture

### Files Added/Modified

**New Files:**
- `lib/supabase-client.ts` - Client-side Supabase client
- `lib/supabase-server.ts` - Server-side Supabase client
- `lib/supabase-middleware.ts` - Middleware session handler
- `middleware.ts` - Next.js middleware for auth
- `components/AuthProvider.tsx` - React context for auth state
- `components/AuthGuard.tsx` - Component to protect routes
- `components/UserMenu.tsx` - User menu with logout
- `app/login/page.tsx` - Login/signup page
- `app/auth/callback/route.ts` - OAuth callback handler

**Modified Files:**
- `app/layout.tsx` - Added AuthProvider wrapper
- `app/page.tsx` - Added AuthGuard protection, UserMenu, and user-specific data
- `package.json` - Added `@supabase/ssr` dependency

### Database Considerations

All existing database tables already have `user_id` fields, so no schema changes are needed. Just ensure:
- Supabase RLS (Row Level Security) policies are configured if needed
- Existing test data uses actual user IDs or a default ID

---

## Troubleshooting

### "Auth callback error" after OAuth login

**Cause:** OAuth redirect URL mismatch

**Fix:**
1. Check Supabase Dashboard > Authentication > URL Configuration
2. Ensure your app's URL is added to **Redirect URLs**
3. For local dev, add `http://localhost:3000/auth/callback`

### Stuck on loading screen

**Cause:** Missing environment variables

**Fix:**
1. Verify all three Supabase env vars are set in `.env.local`
2. Restart your dev server after adding env vars
3. Check browser console for errors

### "Invalid JWT" errors

**Cause:** Mismatched or expired service role key

**Fix:**
1. Re-copy the service role key from Supabase Dashboard
2. Ensure you're using the **service_role** key, not the anon key
3. Restart dev server

### Can't sign up with email

**Cause:** Email confirmation required

**Fix:**
1. In Supabase Dashboard, go to **Authentication** > **Providers** > **Email**
2. Disable "Confirm email" if you want instant access (for development)
3. Or check your email inbox for verification link

---

## Security Best Practices

1. **Never commit `.env.local`** to version control
2. Use **Row Level Security (RLS)** in Supabase for additional protection
3. Rotate your **service_role** key if it's ever exposed
4. Use **anon key** for client-side code only
5. Always validate user permissions on the server side

---

## Next Steps

### Recommended Enhancements

1. **Password Reset Flow**
   - Add "Forgot Password" link on login page
   - Implement password reset handler

2. **Email Verification**
   - Enable email confirmation in Supabase
   - Customize email templates

3. **User Profile Page**
   - Allow users to update email, password
   - Display account creation date

4. **Multi-factor Authentication (MFA)**
   - Enable in Supabase Dashboard
   - Add MFA setup UI

5. **Social Logins**
   - Add more OAuth providers (GitHub, Microsoft, etc.)
   - Follow same process as Google OAuth

---

## Support

For issues or questions:
- Check [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- Review [Next.js App Router + Supabase Guide](https://supabase.com/docs/guides/auth/server-side/nextjs)

