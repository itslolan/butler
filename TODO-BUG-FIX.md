# Todo Items Not Resolving - Bug Fix

## Problem

Todos for transaction clarification are not being removed from the dashboard even after the user provides answers and the system reports successful categorization.

## Root Cause

The bug was caused by a database query mismatch:

1. The `is_dismissed` column was added via migration (`supabase-migration-todo-dismiss.sql`)
2. However, transactions created **before** this migration have `is_dismissed = NULL`
3. The query in `getUnclarifiedTransactions()` was filtering with `.eq('is_dismissed', false)`
4. This filter **excludes** rows where `is_dismissed = NULL`
5. Result: Even after successfully updating `needs_clarification = false`, old todos remained visible because the query was looking at the wrong condition

## Files Changed

### 1. `/lib/db-tools.ts`

**Fixed `getUnclarifiedTransactions()` function:**
```typescript
// OLD (broken):
.eq('is_dismissed', false)

// NEW (fixed):
.or('is_dismissed.is.null,is_dismissed.eq.false')
```

**Fixed `getDocumentsPendingAccountSelection()` function:**
```typescript
// OLD (broken):
.eq('is_dismissed', false)

// NEW (fixed):
.or('is_dismissed.is.null,is_dismissed.eq.false')
```

## How to Apply the Fix

### Option 1: Automatic Script (Recommended)

Run the migration script to update all existing NULL values to false:

```bash
npx tsx scripts/fix-dismissed-nulls.ts
```

This will:
- Count records with NULL `is_dismissed` values
- Update them to `false`
- Verify the migration was successful

### Option 2: Manual SQL Migration

If you prefer to run SQL directly in Supabase:

```sql
-- Update transactions
UPDATE transactions
SET is_dismissed = false
WHERE is_dismissed IS NULL;

-- Update documents
UPDATE documents
SET is_dismissed = false
WHERE is_dismissed IS NULL;
```

### Option 3: Let It Fix Itself Naturally

The code fix in `lib/db-tools.ts` handles NULL values correctly now, so:
- Old todos will now appear correctly
- New transactions will have `is_dismissed = false` by default
- Over time, as old transactions are resolved, the NULL values will naturally disappear

## Verification

After applying the fix, verify it worked:

1. Refresh the dashboard
2. Check if todos appear for transactions that need clarification
3. Answer a clarifying question
4. Refresh the page
5. The todo should now be gone ✅

## Prevention

To prevent this in the future:

1. ✅ Code now handles NULL values properly in queries
2. ✅ Migration script provided to clean up existing data
3. ✅ All new transactions will have `is_dismissed = false` by default (via migration)

## Technical Details

### Why `.eq('is_dismissed', false)` failed:

In SQL/Postgres:
- `NULL != false` 
- `NULL != true`
- `NULL IS NULL` ✓

So when filtering `.eq('is_dismissed', false)`, rows with `NULL` were excluded.

### Why `.or('is_dismissed.is.null,is_dismissed.eq.false')` works:

This matches rows where:
- `is_dismissed IS NULL` (old data)
- OR `is_dismissed = false` (new data)

Both should show up as active todos until dismissed/resolved.

