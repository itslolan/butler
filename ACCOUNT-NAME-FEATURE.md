# 🏦 Account Name Tracking Feature

## Overview

Added **account name extraction and tracking** to link transactions from the same account across multiple statement periods.

## Problem Solved

**Before:** Transactions from different months for the same credit card/bank account were isolated - couldn't query "show me all my Chase Freedom spending for Q3 2025" if you uploaded 3 separate monthly statements.

**After:** All transactions are tagged with the account name, allowing cross-statement queries like:
- "What did I spend on my Chase Freedom card from July to September?"
- "Show me all transactions from my Checking Account this year"
- "Compare spending between my Visa and Mastercard"

## What Changed

### 1. Database Schema

**Documents Table:**
- Added `account_name` column (TEXT)
- Added indexes for fast querying

**Transactions Table:**
- Added `account_name` column (TEXT)  
- Added indexes for fast querying
- Denormalized from documents for query performance

### 2. Extraction

Updated Gemini prompt to extract:
- `accountId`: Account number or last 4 digits (e.g., "1234")
- `accountName`: Account nickname/card name (e.g., "Chase Freedom", "Checking Account", "Visa Signature")
- `issuer`: Bank/institution name (e.g., "Chase", "Bank of America")

### 3. Storage

Both documents and transactions now store `account_name`:
- Documents: For statement-level queries
- Transactions: For transaction-level queries (denormalized for performance)

### 4. Query Tools

Updated LLM tools to support `accountName` filter:

**search_documents:**
```typescript
{
  accountName: "Chase Freedom",
  startDate: "2025-07-01",
  endDate: "2025-09-30"
}
```

**search_transactions:**
```typescript
{
  accountName: "Checking",
  startDate: "2025-01-01",
  endDate: "2025-12-31"
}
```

## Migration

### For New Databases
Run the updated `supabase-schema.sql` - includes `account_name` columns.

### For Existing Databases
Run `supabase-migration-add-account-name.sql`:
```sql
-- Adds account_name columns
-- Creates indexes
-- Backfills transactions from documents
```

## Example Queries

### 1. Cross-Statement Queries
**User:** "What did I spend on my Chase Freedom card from August to October?"

**LLM calls:**
```javascript
search_transactions({
  accountName: "Chase Freedom",
  startDate: "2025-08-01",
  endDate: "2025-10-31"
})
```

**Result:** All transactions from that card across 3 monthly statements.

### 2. Account Comparison
**User:** "Compare my spending on Visa vs Mastercard"

**LLM calls:**
```javascript
// First query
search_transactions({ accountName: "Visa" })

// Second query
search_transactions({ accountName: "Mastercard" })
```

**Result:** Side-by-side comparison with totals.

### 3. Account-Specific Analysis
**User:** "Show me all grocery spending from my Checking Account"

**LLM calls:**
```javascript
search_transactions({
  accountName: "Checking",
  category: "Groceries"
})
```

**Result:** Filtered transactions with category breakdown.

## Benefits

### 1. **Continuity Across Statements**
Upload multiple months → Query across all of them seamlessly

### 2. **Account-Level Insights**
- Track spending per card/account
- Compare accounts
- Identify which card you use most

### 3. **Better Organization**
- Group transactions by account
- Separate personal vs business accounts
- Track multiple credit cards independently

### 4. **Flexible Queries**
- "All transactions from Account X"
- "Spending on Account Y in Q3"
- "Compare Account A vs Account B"

## How It Works

### Upload Flow
1. User uploads statement PDF
2. Gemini extracts `accountName` (e.g., "Chase Sapphire")
3. Saved to `documents` table
4. All transactions inherit the `account_name`
5. Transactions saved to `transactions` table with `account_name`

### Query Flow
1. User asks: "Show spending on my Chase Sapphire"
2. LLM calls `search_transactions({ accountName: "Chase Sapphire" })`
3. Database returns ALL transactions with that account name
4. LLM aggregates and presents results

### Linking Logic
Transactions are linked by `account_name` (fuzzy match):
- "Chase Freedom" matches "chase freedom" (case-insensitive)
- "Checking" matches "checking account" (partial match)
- Flexible enough to handle slight variations

## Database Indexes

Optimized for fast queries:
```sql
-- Single column indexes
CREATE INDEX idx_documents_account_name ON documents(account_name);
CREATE INDEX idx_transactions_account_name ON transactions(account_name);

-- Composite indexes for user+account queries
CREATE INDEX idx_documents_user_account ON documents(user_id, account_name);
CREATE INDEX idx_transactions_user_account ON transactions(user_id, account_name);
```

## Edge Cases Handled

### 1. Missing Account Name
If Gemini can't extract account name:
- `account_name` is NULL
- Transactions still work (just not grouped by account)

### 2. Multiple Accounts Same Issuer
- "Chase Freedom" vs "Chase Sapphire" → Separate accounts
- "Visa 1234" vs "Visa 5678" → Separate accounts

### 3. Account Name Variations
Fuzzy matching handles:
- "Checking Account" vs "checking"
- "VISA Signature" vs "Visa Signature"
- Case-insensitive, partial matches

## Future Enhancements

Possible additions:
- Account nickname customization by user
- Automatic account merging suggestions
- Account-level analytics dashboard
- Account balance tracking over time
- Multi-account budget allocation

