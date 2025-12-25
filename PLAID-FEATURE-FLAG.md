# Plaid Feature Flag Implementation

## Overview

All Plaid-related features and branding are now hidden behind the `NEXT_PUBLIC_PLAID_ENABLED` environment variable.

## Environment Variable

```bash
# .env.local or Render.com environment variables
NEXT_PUBLIC_PLAID_ENABLED=true   # Show Plaid features
NEXT_PUBLIC_PLAID_ENABLED=false  # Hide Plaid features (default if not set)
```

## Files Modified

### 1. Landing Page (`components/LandingPage.tsx`)
- **Line 8-9**: Added feature flag check
- **Line 269-276**: Plaid badge conditionally rendered in "Secured by industry leaders" section
- **Behavior**: When disabled, only shows Supabase and AES-256 Encryption badges

### 2. Privacy Policy (`app/privacy/page.tsx`)
- **Line 9-10**: Added feature flag check
- **Line 54-69**: Section 1.2 "Information from Third-Party Services" conditionally shows Plaid info
  - When **enabled**: Shows Plaid data collection details
  - When **disabled**: Shows "Currently, we support manual upload of bank statements and financial documents."
- **Line 95**: Usage section bullet point about Plaid sync conditionally rendered
- **Line 122**: "Service Providers" mention of Plaid conditionally included
- **Line 156-171**: Section 6.1 "Plaid" (third-party services) conditionally rendered
  - Section numbering auto-adjusts: Supabase becomes 6.1 when Plaid is disabled, 6.2 when enabled

## Other Files Already Gated

These files already use `NEXT_PUBLIC_PLAID_ENABLED`:

1. `components/ConnectedAccounts.tsx` (line 39)
   - "Connect Bank" button only shows when Plaid is enabled
   - Upload button adjusts grid layout based on Plaid availability

2. All Plaid API routes (`app/api/plaid/*`)
   - Already check `isPlaidConfigured()` before allowing access

## Testing

### To Disable Plaid (Current State)
```bash
# In .env.local, set or remove:
NEXT_PUBLIC_PLAID_ENABLED=false

# Or simply don't set it (defaults to disabled)
```

### To Enable Plaid (After Approval)
```bash
# In .env.local:
NEXT_PUBLIC_PLAID_ENABLED=true
```

Then restart the dev server:
```bash
npm run dev
```

## Production Deployment

On Render.com:
1. Go to Environment tab
2. Add/Update `NEXT_PUBLIC_PLAID_ENABLED`
3. Set to `false` until Plaid approval
4. Set to `true` after approval
5. Redeploy

## What Users See

### When DISABLED (before Plaid approval):
- ✅ Upload bank statements (PDF/screenshots) - still works
- ✅ All AI features and analysis - still works
- ❌ "Connect Bank" button - hidden
- ❌ Plaid branding on landing page - hidden
- ❌ Plaid mentions in privacy policy - hidden/replaced

### When ENABLED (after Plaid approval):
- ✅ Everything above plus:
- ✅ "Connect Bank" button visible
- ✅ Plaid badge on landing page
- ✅ Full Plaid disclosure in privacy policy

## Summary

**Current State**: Plaid is disabled by default. Your app works fully without it using manual uploads.

**After Approval**: Simply set `NEXT_PUBLIC_PLAID_ENABLED=true` to enable all Plaid features and branding.

No code changes needed - just flip the environment variable!

