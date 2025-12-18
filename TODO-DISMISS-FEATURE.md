# Todo Dismiss Feature

## Overview

Added the ability to dismiss todo items without resolving them. This allows users to hide todos that don't require action or that they want to ignore temporarily.

## Changes Made

### 1. Database Migration

**File**: `supabase-migration-todo-dismiss.sql`

Added `is_dismissed` boolean column to both `transactions` and `documents` tables:
- Defaults to `false`
- Indexed for performance
- Includes composite indexes for common query patterns

**To apply the migration:**
1. Open your Supabase project SQL editor
2. Copy and paste the contents of `supabase-migration-todo-dismiss.sql`
3. Execute the SQL

### 2. API Endpoint

**File**: `app/api/todos/dismiss/route.ts`

Created a new POST endpoint to dismiss todos:
- Endpoint: `POST /api/todos/dismiss`
- Body parameters:
  - `userId`: string (required)
  - `todoId`: string (required)
  - `todoType`: 'account_selection' | 'transaction_clarification' (required)
- Updates the appropriate table (documents or transactions) to set `is_dismissed = true`

### 3. Database Functions

**File**: `lib/db-tools.ts`

Updated two functions to filter out dismissed items:
- `getUnclarifiedTransactions()`: Now excludes transactions where `is_dismissed = true`
- `getDocumentsPendingAccountSelection()`: Now excludes documents where `is_dismissed = true`

### 4. TypeScript Types

**File**: `lib/supabase.ts`

Added `is_dismissed?: boolean` field to:
- `Document` interface
- `Transaction` interface

### 5. UI Components

**Files**: `components/TodoButton.tsx`, `components/TodoList.tsx`

Added dismiss functionality to both todo display components:
- Small X button appears on hover in the top-right corner of each todo item
- Click stops propagation (doesn't trigger todo selection)
- Calls dismiss API endpoint
- Immediately removes item from local state for instant feedback
- Styled with red hover state to indicate "remove" action

## User Experience

1. **Hover over any todo item** to reveal the dismiss button (X icon)
2. **Click the X** to dismiss the todo without resolving it
3. **The todo disappears immediately** and won't appear in future todo lists
4. **No way to un-dismiss** (by design - keeps the feature simple)

## Technical Notes

- Dismissed items remain in the database but are filtered out of queries
- The dismiss state is permanent (no undo feature)
- Both todo types (account selection and transaction clarification) can be dismissed
- Dismissing is independent of resolving - dismissed items still have `needs_clarification = true` or `pending_account_selection = true`

## Future Enhancements (Optional)

If needed, you could add:
- A "Show dismissed items" toggle
- An "undo dismiss" feature
- Auto-dismiss after X days
- Bulk dismiss functionality
- Dismiss reasons/notes
