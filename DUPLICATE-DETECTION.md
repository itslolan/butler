# 🔍 Intelligent Duplicate Detection

## Overview

Butler now automatically detects and prevents duplicate transactions when users upload the same document multiple times or overlapping statements.

## Problem Solved

**Scenario:** User accidentally uploads the same credit card statement twice, or uploads overlapping statements (e.g., August statement and Q3 statement that includes August).

**Before:** All transactions would be saved twice, causing:
- Inflated spending totals
- Duplicate entries in transaction lists
- Incorrect financial analysis

**After:** Gemini intelligently identifies duplicates and only saves unique transactions!

## How It Works

### Step-by-Step Process

**1. Document Upload**
User uploads a statement (PDF or image)

**2. Initial Extraction**
Gemini extracts:
- All document metadata
- **First transaction date** (earliest transaction)
- **Last transaction date** (latest transaction)
- All transactions

**3. Existing Transaction Lookup**
App queries database for existing transactions:
- Same user
- Same account name
- Within the date range (first to last transaction date)

**4. Intelligent Deduplication**
If existing transactions found:
- App sends BOTH lists to Gemini:
  - Newly parsed transactions
  - Existing transactions from database
- Gemini compares and identifies duplicates
- Returns only unique transactions

**5. Smart Saving**
- Only unique transactions are saved
- Document metadata includes deduplication info
- User sees summary of duplicates removed

### Duplicate Detection Logic

Gemini considers a transaction a duplicate if:
- ✅ **Same date** (exact match)
- ✅ **Same merchant** (handles variations like "STARBUCKS #1234" vs "Starbucks")
- ✅ **Same amount** (exact match, including sign)

Conservative approach: If unsure, transaction is kept (better to have potential duplicate than lose data)

## Example Scenarios

### Scenario 1: Exact Duplicate Upload

**User uploads:** `august-statement.pdf` (twice)

**Result:**
```
✅ Successfully processed august-statement.pdf
Document Type: credit_card_statement
Transactions Saved: 0

🔍 Duplicate Detection:
- Found 45 duplicate transaction(s)
- Only 0 unique transactions saved

Examples:
  • Aug 15 Starbucks $5.50 - exact match with existing
  • Aug 20 Amazon $89.99 - exact match with existing
  • Aug 25 Shell Gas $45.00 - exact match with existing
```

### Scenario 2: Overlapping Statements

**User uploads:** 
1. `august-statement.pdf` (Aug 1-31)
2. `q3-statement.pdf` (Jul 1 - Sep 30, includes August)

**Result for Q3 upload:**
```
✅ Successfully processed q3-statement.pdf
Document Type: credit_card_statement
Transactions Saved: 61

🔍 Duplicate Detection:
- Found 45 duplicate transaction(s)
- Only 61 unique transactions saved

Examples:
  • Aug 15 Starbucks $5.50 - duplicate from August statement
  • Aug 20 Amazon $89.99 - duplicate from August statement
```

Only July and September transactions are saved (August already exists)

### Scenario 3: Partial Overlap

**User uploads:**
1. `statement-1.pdf` (Aug 15 - Sep 15)
2. `statement-2.pdf` (Sep 1 - Sep 30)

**Result for statement-2:**
```
✅ Successfully processed statement-2.pdf
Transactions Saved: 15

🔍 Duplicate Detection:
- Found 15 duplicate transaction(s)
- Only 15 unique transactions saved
```

Sep 1-15 duplicates removed, Sep 16-30 saved

## Technical Implementation

### 1. Enhanced Extraction Prompt

Added fields to initial extraction:
```typescript
{
  "firstTransactionDate": "2025-08-01",
  "lastTransactionDate": "2025-08-31",
  "transactions": [...]
}
```

### 2. Database Query

```typescript
const existingTransactions = await searchTransactions(userId, {
  accountName: extractedData.accountName,
  startDate: extractedData.firstTransactionDate,
  endDate: extractedData.lastTransactionDate,
});
```

### 3. Deduplication Prompt

Specialized prompt for Gemini:
```
You are a transaction deduplication expert.

Newly Parsed Transactions: [...]
Existing Transactions: [...]

Return only unique transactions.
```

### 4. Result Processing

```typescript
{
  "uniqueTransactions": [...],
  "duplicatesFound": 45,
  "duplicateExamples": [
    "Aug 15 Starbucks $5.50 - exact match",
    ...
  ]
}
```

### 5. Metadata Storage

Document metadata includes:
```typescript
{
  metadata: {
    firstTransactionDate: "2025-08-01",
    lastTransactionDate: "2025-08-31",
    duplicatesRemoved: 45,
    duplicateExamples: [...]
  }
}
```

## Benefits

### 1. **User-Friendly**
- Users can upload without worry
- Mistakes are automatically corrected
- No manual cleanup needed

### 2. **Accurate Data**
- No inflated spending totals
- Clean transaction history
- Reliable financial analysis

### 3. **Intelligent Matching**
- Handles merchant name variations
- Accounts for statement formatting differences
- Conservative approach (keeps data if unsure)

### 4. **Transparent**
- Shows how many duplicates were found
- Provides examples of what was filtered
- User understands what happened

## Edge Cases Handled

### 1. No Existing Transactions
If no transactions exist in date range:
- Skip deduplication
- Save all transactions
- Fast processing

### 2. Deduplication Failure
If Gemini fails to deduplicate:
- Fall back to saving all transactions
- Log error for debugging
- Better to have duplicates than lose data

### 3. Merchant Name Variations
Gemini handles:
- "STARBUCKS #1234" vs "Starbucks"
- "AMAZON.COM" vs "Amazon"
- "SHELL 12345" vs "Shell Gas"

### 4. Same Merchant, Different Amounts
Not considered duplicates:
- Aug 15 Starbucks $5.50
- Aug 15 Starbucks $8.75
Both saved (different purchases)

### 5. Same Amount, Different Merchants
Not considered duplicates:
- Aug 15 Starbucks $5.50
- Aug 15 McDonald's $5.50
Both saved (different merchants)

## Performance Considerations

### Optimization 1: Date Range Query
Only fetch transactions in the relevant date range (not all transactions)

### Optimization 2: Account Filtering
Only compare transactions from the same account

### Optimization 3: Skip if No Overlap
If no existing transactions found, skip deduplication entirely

### Optimization 4: Batch Processing
Single Gemini call for all transactions (not per-transaction)

## User Experience

### Upload Feedback

**No Duplicates:**
```
✅ Successfully processed statement.pdf
Document Type: credit_card_statement
Transactions Saved: 45
```

**Duplicates Found:**
```
✅ Successfully processed statement.pdf
Document Type: credit_card_statement
Transactions Saved: 30

🔍 Duplicate Detection:
- Found 15 duplicate transaction(s)
- Only 30 unique transactions saved

Examples:
  • Aug 15 Starbucks $5.50 - exact match
  • Aug 20 Amazon $89.99 - exact match
  • Aug 25 Shell Gas $45.00 - exact match
```

## Future Enhancements

Possible improvements:
- Show duplicate transactions in a detailed view
- Allow user to manually review duplicates
- Suggest merging overlapping statements
- Detect partial duplicates (same merchant/amount, different dates)
- Learn from user corrections
- Bulk duplicate cleanup tool

## Configuration

### Conservative Mode (Default)
When unsure, keep the transaction:
- Minimizes data loss
- May allow some duplicates through
- Better safe than sorry

### Aggressive Mode (Future)
When unsure, mark as duplicate:
- Minimizes duplicates
- May filter some unique transactions
- Requires user review

## Monitoring

Console logs show:
```
Found 45 existing transactions in date range. Running deduplication...
Deduplication complete: 15 duplicates removed, 30 unique transactions remaining.
```

Useful for debugging and understanding system behavior.

