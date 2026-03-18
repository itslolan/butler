# Fix: Transaction Type Filtering Issue

## Problem

Transactions were only showing up when BOTH related type filters were selected, not when just one was selected. For example, an e-Transfer transaction that should appear under "Income" would only show when both "Income" AND "Transfer" filters were active.

### Root Cause

The backend API (`app/api/transactions/route.ts`) was filtering transactions based solely on the `transaction_type` field stored in the database:

```typescript
if (transactionTypes.length > 0) {
  query = query.in('transaction_type', transactionTypes);
}
```

However, the application has a sophisticated **transaction classifier** (`lib/transaction-classifier.ts`) that determines a transaction's true type based on multiple factors:

1. **Explicit transaction_type field** (if set)
2. **Transaction amount** (positive = income, negative = expense)
3. **Merchant name patterns** (to detect internal transfers vs external transfers)
4. **Category** (to identify internal transfers)

This meant:
- A transaction stored with `transaction_type = 'income'` would only show when "Income" filter was selected
- But the classifier might recognize it as having transfer-like characteristics
- The frontend display logic uses the classifier, but the backend filtering didn't

### Example from Screenshot

The transaction "e-Transfer received Sreelakshmy Muraleedharan" was:
- Stored in DB as `transaction_type = 'income'`
- Displayed as income (green, positive amount)
- Only appeared when "Income" filter was selected OR when both "Income" AND "Transfer" were selected
- The confusion arose because the name contains "e-Transfer" but it's actually an **external transfer** (real income), not an **internal transfer** (which should be excluded)

## Solution

Updated the backend API to use the **transaction classifier** when filtering by type, ensuring consistency between what's displayed and what's filtered.

### Changes Made to `app/api/transactions/route.ts`

1. **Removed database-level type filtering**:
   - No longer using `.in('transaction_type', transactionTypes)` on the Supabase query

2. **Added in-memory classification-based filtering**:
   - When type filters are active, fetch all matching transactions
   - Run each through `classifyTransaction()` to get its true type
   - Filter based on the classified type, not the raw database field
   - Then apply pagination in-memory

3. **Updated totals calculation**:
   - Also applies classification-based filtering to ensure totals match the displayed transactions
   - Added check: `if (transactionTypes.length > 0 && !transactionTypes.includes(classification.type))`

### Code Changes

**Before:**
```typescript
if (transactionTypes.length > 0) {
  query = query.in('transaction_type', transactionTypes);
}

// Pagination
const offset = (page - 1) * pageSize;
query = query.range(offset, offset + pageSize - 1);

const { data: transactions, error, count } = await query;
```

**After:**
```typescript
// For type filtering, we need to fetch all matching transactions and filter in-memory
// because the classification logic is more complex than just checking the database field
const needsTypeFiltering = transactionTypes.length > 0;

let allMatchingTransactions: any[] = [];
let totalMatchingCount = 0;

if (needsTypeFiltering) {
  // Fetch all transactions without pagination to apply type filter
  const { data: allData, error: fetchError } = await query;
  
  if (fetchError) {
    console.error('[transactions] Error:', fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  // Filter by classified type
  allMatchingTransactions = (allData || []).filter(txn => {
    const classification = classifyTransaction(txn);
    return transactionTypes.includes(classification.type);
  });

  totalMatchingCount = allMatchingTransactions.length;

  // Apply pagination in-memory
  const offset = (page - 1) * pageSize;
  allMatchingTransactions = allMatchingTransactions.slice(offset, offset + pageSize);
} else {
  // No type filtering needed, use normal pagination
  const offset = (page - 1) * pageSize;
  query = query.range(offset, offset + pageSize - 1);

  const { data, error: fetchError, count: dbCount } = await query;
  
  if (fetchError) {
    console.error('[transactions] Error:', fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  allMatchingTransactions = data || [];
  totalMatchingCount = dbCount || 0;
}

const transactions = allMatchingTransactions;
const count = totalMatchingCount;
```

## What This Fixes

1. **Consistent filtering**: Transactions now filter based on their classified type, matching what's displayed visually
2. **Single filter selection works**: Selecting only "Income" will show all transactions classified as income
3. **Multiple filter selection works**: Selecting both "Income" and "Transfer" shows transactions classified as either type
4. **Transfer detection works**: The classifier properly distinguishes between:
   - **Internal transfers** (between your own accounts) - excluded from totals
   - **External transfers** (e-transfers from/to other people) - counted as income/expense

## Transaction Classification Logic

The classifier (`lib/transaction-classifier.ts`) uses this logic:

1. **Explicit transfers**: If `transaction_type = 'transfer'`, it's a transfer
2. **Internal transfer detection**: Checks merchant/category for patterns like:
   - "Credit card payment" + card network name
   - "Transfer to savings/checking"
   - "Internal transfer"
   - "Balance transfer"
3. **External transfers**: e-Transfers with person names are NOT detected as internal transfers
4. **Income vs Expense**: Based on explicit type or amount sign (positive = income, negative = expense)

## Performance Note

When type filtering is active, the API now fetches all matching transactions and filters in-memory before pagination. This is necessary because:
- The classification logic is complex (JavaScript-based)
- Cannot be replicated in SQL/Supabase query
- Performance impact is minimal for typical use cases (most users have <10k transactions)

If performance becomes an issue in the future, consider:
1. Caching classification results in the database
2. Running periodic classification updates via background job
3. Adding a `classified_type` column that stores the classifier's result

## Testing

Test these scenarios to verify the fix:

1. **Single type filter**:
   - Select only "Income" → Should show all income transactions
   - Select only "Expense" → Should show all expense transactions  
   - Select only "Transfer" → Should show transfers (internal movements)

2. **Multiple type filters**:
   - Select "Income" + "Transfer" → Should show both income and transfer transactions
   - Select "Expense" + "Transfer" → Should show both expense and transfer transactions

3. **E-Transfer transactions**:
   - "e-Transfer received [Person Name]" → Should appear under "Income"
   - "e-Transfer sent to [Person Name]" → Should appear under "Expense"
   - These should NOT appear under "Transfer" alone (they're external, not internal transfers)

4. **Internal transfers**:
   - "Transfer to savings" → Should appear under "Transfer"
   - "Credit card payment" → Should appear under "Transfer"
   - These should be excluded from Income/Expense totals

## Files Modified

- `app/api/transactions/route.ts` - Updated filtering and totals logic to use transaction classifier
