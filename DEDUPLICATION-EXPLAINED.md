# 🔍 Deduplication Logic Explained

## How It Works

### Step-by-Step Flow

**1. User Uploads Document**
```
POST /api/process-statement
File: statement.pdf
```

**2. Gemini Extracts Data**
```javascript
{
  "firstTransactionDate": "2025-08-01",  // ← CRITICAL for dedup
  "lastTransactionDate": "2025-08-31",   // ← CRITICAL for dedup
  "accountName": "Chase Freedom",         // ← CRITICAL for dedup
  "transactions": [
    { "date": "2025-08-15", "merchant": "Starbucks", "amount": 5.50 },
    { "date": "2025-08-20", "merchant": "Amazon", "amount": 89.99 },
    ...
  ]
}
```

**3. Query Existing Transactions**
```javascript
const existingTransactions = await searchTransactions(userId, {
  accountName: "Chase Freedom",
  startDate: "2025-08-01",
  endDate: "2025-08-31"
});
// Returns all transactions in this date range for this account
```

**4. Deduplicate**

For each new transaction, check if it matches ANY existing transaction:

```javascript
// Match criteria (ALL must match):
✅ Same date (normalized to YYYY-MM-DD)
✅ Same merchant (case-insensitive, normalized)
✅ Same amount (within $0.01)

// Example:
New:      { date: "2025-08-15", merchant: "STARBUCKS #1234", amount: 5.50 }
Existing: { date: "2025-08-15", merchant: "starbucks #1234", amount: 5.50 }
Result: DUPLICATE (not saved)

New:      { date: "2025-08-15", merchant: "Starbucks", amount: 8.75 }
Existing: { date: "2025-08-15", merchant: "Starbucks", amount: 5.50 }
Result: UNIQUE (different amount - saved)
```

**5. Save Only Unique**
```javascript
// Before dedup: 50 transactions
// Duplicates found: 15 transactions
// Saved: 35 unique transactions
```

## Why It Might Not Work

### Issue 1: Missing Date Range ⚠️

**Problem:** If Gemini doesn't extract `firstTransactionDate` or `lastTransactionDate`, deduplication is SKIPPED.

**Check logs:**
```
⚠️  Missing date range - firstTransactionDate or lastTransactionDate not extracted
   Deduplication will be skipped!
```

**Solution:** Update the Gemini prompt to emphasize date range extraction.

### Issue 2: Wrong Account Name ⚠️

**Problem:** If account name doesn't match, transactions won't be compared.

**Example:**
```
First upload:  accountName = "Chase Freedom"
Second upload: accountName = "Freedom Card"
Result: No match - both sets saved (duplicates!)
```

**Solution:** Normalize account names or use fuzzy matching.

### Issue 3: Date Format Mismatch ⚠️

**Problem:** Different date formats might not match.

**Example:**
```
New:      date = "2025-08-15"
Existing: date = "2025-08-15T00:00:00.000Z"
Result: Might not match (but our code normalizes this)
```

**Solution:** Always normalize to YYYY-MM-DD.

### Issue 4: Merchant Name Variations ⚠️

**Problem:** Different merchant formats.

**Example:**
```
New:      merchant = "STARBUCKS #1234"
Existing: merchant = "Starbucks Store 1234"
Result: Might not match
```

**Solution:** Our code normalizes (lowercase, trim spaces), but can't handle all variations.

## Testing

### Run Unit Tests

Visit: `http://localhost:3000/api/test-deduplication`

Or in terminal:
```bash
curl http://localhost:3000/api/test-deduplication
```

### Test Cases Included

1. **Exact Duplicates** - Should find 100% duplicates
2. **No Duplicates** - Should find 0 duplicates
3. **Merchant Variations** - Should match case-insensitive
4. **Same Merchant, Different Amount** - Should NOT be duplicate
5. **Same Merchant, Different Date** - Should NOT be duplicate

### Manual Testing

**Test 1: Upload Same File Twice**

1. Upload `statement.pdf`
2. Check logs - should see:
   ```
   Extracted transactions: 45
   Found 0 existing transactions in database
   ```
3. Upload `statement.pdf` again
4. Check logs - should see:
   ```
   Extracted transactions: 45
   Found 45 existing transactions in database
   Running deduplication...
   Deduplication complete:
     - 45 duplicates found
     - 0 unique transactions to save
   ```

**Test 2: Check Date Range Extraction**

Look in console logs after upload:
```
=== DUPLICATE DETECTION START ===
Extracted transactions: 45
First transaction date: 2025-08-01  ← Should be present!
Last transaction date: 2025-08-31   ← Should be present!
Account name: Chase Freedom          ← Should be present!
```

If ANY of these are null/undefined, deduplication won't work!

## Debugging Checklist

If deduplication isn't working, check:

- [ ] **Are date ranges extracted?**
  ```
  firstTransactionDate: "2025-08-01" ✅
  lastTransactionDate: "2025-08-31" ✅
  ```

- [ ] **Is account name extracted?**
  ```
  accountName: "Chase Freedom" ✅
  ```

- [ ] **Are existing transactions found?**
  ```
  Found 45 existing transactions in database ✅
  ```

- [ ] **Is deduplication running?**
  ```
  Running deduplication... ✅
  ```

- [ ] **Are duplicates detected?**
  ```
  Deduplication complete:
    - 45 duplicates found ✅
    - 0 unique transactions to save ✅
  ```

## Console Logs Explained

### Successful Deduplication
```
=== DUPLICATE DETECTION START ===
Extracted transactions: 45
First transaction date: 2025-08-01
Last transaction date: 2025-08-31
Account name: Chase Freedom
Found 45 existing transactions in database
Running deduplication...

=== DEDUPLICATION TEST ===
New transactions: 45
Existing transactions: 45
  ❌ DUPLICATE: 2025-08-15 | Starbucks | $5.50 - exact match
  ❌ DUPLICATE: 2025-08-20 | Amazon | $89.99 - exact match
  ... (43 more)

RESULT: 45 duplicates, 0 unique
=== END DEDUPLICATION ===

Deduplication complete:
  - 45 duplicates found
  - 0 unique transactions to save
=== DUPLICATE DETECTION END ===
```

### Failed Deduplication (Missing Date Range)
```
=== DUPLICATE DETECTION START ===
Extracted transactions: 45
First transaction date: null  ← PROBLEM!
Last transaction date: null   ← PROBLEM!
Account name: Chase Freedom
⚠️  Missing date range - firstTransactionDate or lastTransactionDate not extracted
   Deduplication will be skipped!
=== DUPLICATE DETECTION END ===
```

## Algorithm Details

```javascript
function isDuplicate(newTxn, existingTxn) {
  // Step 1: Normalize dates
  const newDate = new Date(newTxn.date)
    .toISOString()
    .split('T')[0];  // "2025-08-15"
  
  const existingDate = new Date(existingTxn.date)
    .toISOString()
    .split('T')[0];  // "2025-08-15"
  
  // Step 2: Normalize merchants
  const newMerchant = newTxn.merchant
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');  // "starbucks #1234"
  
  const existingMerchant = existingTxn.merchant
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');  // "starbucks #1234"
  
  // Step 3: Compare amounts (allow 1 cent difference)
  const amountsMatch = Math.abs(
    newTxn.amount - existingTxn.amount
  ) < 0.01;
  
  // Step 4: Return true if ALL match
  return (
    newDate === existingDate &&
    newMerchant === existingMerchant &&
    amountsMatch
  );
}
```

## Performance

- **Fast**: JavaScript-based (no AI call needed)
- **Reliable**: Deterministic matching rules
- **Scalable**: O(n*m) where n=new, m=existing
- **Conservative**: Better to keep than delete

## Edge Cases

### 1. Floating Point Precision
```javascript
amount1 = 5.50
amount2 = 5.499999999
// Matched within 0.01 tolerance ✅
```

### 2. Extra Whitespace
```javascript
merchant1 = "Starbucks  #1234"  // double space
merchant2 = "Starbucks #1234"   // single space
// Normalized to same ✅
```

### 3. Case Sensitivity
```javascript
merchant1 = "STARBUCKS"
merchant2 = "starbucks"
// Lowercased to same ✅
```

### 4. Date Objects vs Strings
```javascript
date1 = "2025-08-15"
date2 = new Date("2025-08-15T00:00:00.000Z")
// Both converted to "2025-08-15" ✅
```

## Future Improvements

1. **Fuzzy Merchant Matching**
   - "STARBUCKS #1234" vs "Starbucks Store 1234"
   - Use Levenshtein distance or AI

2. **Account Name Normalization**
   - "Chase Freedom" vs "Freedom Card"
   - Use fuzzy matching

3. **Batch Optimization**
   - Index existing transactions by date
   - Skip comparisons for non-overlapping dates

4. **User Confirmation**
   - Show duplicates before saving
   - Let user override decisions

