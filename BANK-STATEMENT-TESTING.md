# Bank Statement Support - Testing Guide

This document provides a comprehensive testing guide for the new bank statement support features.

## Test Scenarios

### 1. Income Detection Tests

#### Test 1.1: Salary Income (High Confidence)
**Setup**: Upload a bank statement with a direct deposit labeled "PAYROLL" or "SALARY"

**Expected Results**:
- Transaction classified as `income`
- Confidence score > 0.7
- `needs_clarification` = false
- No clarification question generated

**How to Verify**:
```sql
SELECT merchant, amount, transaction_type, needs_clarification 
FROM transactions 
WHERE transaction_type = 'income';
```

#### Test 1.2: Ambiguous Deposit (Low Confidence)
**Setup**: Upload a statement with a generic deposit like "ACH DEPOSIT" or "TRANSFER"

**Expected Results**:
- Transaction type assigned based on best guess
- Confidence score < 0.7
- `needs_clarification` = true
- Clarification question generated (e.g., "Is this a salary/income deposit or a transfer from another account?")

**How to Verify**:
- Check UI for system message with clarification request
- Verify database has `needs_clarification = true`

#### Test 1.3: Business Income (Irregular)
**Setup**: Upload statement with irregular deposits from payment services (Venmo, PayPal, Stripe)

**Expected Results**:
- Transactions may be flagged for clarification
- Frequency detected as "irregular"
- User can clarify via chat

### 2. Transaction Type Classification Tests

#### Test 2.1: Clear Expense
**Setup**: Upload statement with typical expenses (groceries, gas, restaurants)

**Expected Results**:
- All classified as `expense`
- Appropriate categories assigned (Food, Transportation, etc.)
- High confidence scores

#### Test 2.2: Internal Transfer
**Setup**: Upload statement with transfers labeled "TRANSFER TO SAVINGS" or "INTERNAL TRANSFER"

**Expected Results**:
- Transaction classified as `transfer`
- Confidence score > 0.7

#### Test 2.3: Mixed Transaction Types
**Setup**: Upload a complete bank statement with:
- Salary deposit
- Bill payments
- ATM withdrawals
- Internal transfers
- Merchant purchases

**Expected Results**:
- Each transaction correctly classified
- Summary shows breakdown by type
- Financial health analysis available

### 3. Clarification Workflow Tests

#### Test 3.1: Auto-Clarification Message
**Setup**: Upload statement with 2+ low-confidence transactions

**Expected Results**:
1. Processing completes successfully
2. System message appears in chat automatically
3. Message lists transactions needing clarification
4. Each transaction shows its specific question

**How to Verify**:
- Check UI for yellow system message box
- Verify message format matches specification
- Ensure all unclarified transactions are listed

#### Test 3.2: User Clarification via Chat
**Setup**: After receiving clarification request

**Test Steps**:
1. User responds: "The first transaction is my salary"
2. Butler should recognize intent and call `categorize_transaction`
3. Transaction updated in database

**Expected Results**:
- Transaction `transaction_type` updated to `income`
- `needs_clarification` set to `false`
- `clarification_question` cleared
- Butler confirms categorization

**How to Verify**:
```sql
SELECT id, merchant, transaction_type, needs_clarification 
FROM transactions 
WHERE id = '<transaction_id>';
```

#### Test 3.3: Bulk Clarification
**Setup**: Multiple transactions need clarification

**Test Steps**:
User: "Transactions 1 and 3 are income, transaction 2 is a transfer"

**Expected Results**:
- Butler parses response and categorizes multiple transactions
- All updated in database
- Confirmation message provided

### 4. Monthly Snapshot Tests

#### Test 4.1: Full Month Statement
**Setup**: Upload statement covering Oct 1-31, 2025

**Expected Results**:
- 2 snapshots created:
  - Oct 1, 2025 (month_start)
  - Oct 31, 2025 (month_end)
- Balances match statement start/end balances

**How to Verify**:
```sql
SELECT account_name, snapshot_date, snapshot_type, balance
FROM account_snapshots
WHERE account_name = '<account>'
ORDER BY snapshot_date;
```

#### Test 4.2: Partial Month Statement
**Setup**: Upload statement covering Oct 15 - Nov 10, 2025

**Expected Results**:
- Snapshots created for:
  - Oct 31 (month_end) - interpolated
  - Nov 1 (month_start) - interpolated
- Balance calculations based on transaction history

#### Test 4.3: Multi-Month Statement
**Setup**: Upload statement covering Sep 1 - Nov 30, 2025

**Expected Results**:
- 6 snapshots created (start/end for Sep, Oct, Nov)
- Accurate balance calculations at each boundary

### 5. Net Worth Calculation Tests

#### Test 5.1: Single Account Net Worth
**Setup**: Upload one bank statement

**Test Steps**:
User: "What's my net worth on October 31st?"

**Expected Results**:
- Butler calls `calculate_net_worth('2025-10-31')`
- Returns balance from single account
- Warns that calculation is based on 1 account only

#### Test 5.2: Multi-Account Net Worth
**Setup**: Upload statements for:
- Checking account (positive balance)
- Savings account (positive balance)
- Credit card (negative balance)

**Test Steps**:
User: "Calculate my net worth on October 31st"

**Expected Results**:
- Net worth = sum of all account balances
- Breakdown shows each account
- Identifies assets vs liabilities
- Shows total account count

**Example Response**:
```
Your net worth on Oct 31, 2025 is $15,250.50 based on 3 accounts:

**Assets:**
- Checking Account: $8,500.00
- Savings Account: $10,000.00

**Liabilities:**
- Credit Card (ending 4080): -$3,249.50

**Total Net Worth**: $15,250.50
```

#### Test 5.3: Incomplete Data Warning
**Setup**: Upload only one statement

**Test Steps**:
User: "What's my net worth?"

**Expected Results**:
- Calculation provided with available data
- Clear warning: "Based on 1 account uploaded. Upload statements for all accounts for complete net worth."

### 6. Financial Health Analysis Tests

#### Test 6.1: Healthy Finances
**Setup**: Upload bank statement with:
- Income: $5,000
- Expenses: $3,000

**Expected Results**:
After processing, Butler shows:
- Net Savings: $2,000 (40% savings rate)
- Income-to-Expense Ratio: 1.67:1
- Positive tone in analysis

#### Test 6.2: Warning - Expenses Exceed Income
**Setup**: Upload statement with:
- Income: $2,000
- Expenses: $3,500

**Expected Results**:
- Net Savings: -$1,500 (negative savings rate)
- Warning message about spending exceeding income
- Suggestions to review expenses

#### Test 6.3: No Income Data
**Setup**: Upload credit card statement (expenses only)

**Expected Results**:
- Financial health summary shows expenses only
- Note that income data not available
- Suggests uploading bank statements for complete picture

### 7. Integration Tests

#### Test 7.1: End-to-End Upload Flow
**Test Steps**:
1. Upload bank statement PDF
2. Wait for processing steps (real-time updates)
3. Processing completes
4. Clarification message appears (if needed)
5. User responds to clarifications
6. Request financial health summary

**Expected Results**:
- All steps complete without errors
- Data correctly stored in database
- Chat interaction works smoothly
- Financial insights accurate

#### Test 7.2: Multiple Documents Same Account
**Test Steps**:
1. Upload August statement for "Checking Account"
2. Upload September statement for "Checking Account"
3. Query transactions across both months

**Expected Results**:
- All transactions linked to same account name
- Snapshots calculated for Aug and Sep
- No duplicate transactions (deduplication works)
- Can query transactions across date ranges

#### Test 7.3: Chat Tool Integration
**Test Queries**:
1. "Show me all income transactions"
2. "What's my spending breakdown?"
3. "Calculate net worth"
4. "Show account snapshots for September"

**Expected Results**:
- Each query uses appropriate tools
- Data retrieved correctly
- Response includes markdown tables
- Debug panel shows function calls

### 8. Edge Cases

#### Test 8.1: Zero Balance Statement
**Setup**: Statement with $0 start and end balance

**Expected Results**:
- Snapshots still created with $0 balance
- No errors during processing

#### Test 8.2: Very Large Transactions
**Setup**: Statement with transactions > $100,000

**Expected Results**:
- Amounts stored correctly (no overflow)
- Displayed with proper formatting

#### Test 8.3: Same-Day Duplicate Transactions
**Setup**: Two identical transactions on same day (e.g., two $5 coffees)

**Expected Results**:
- Both transactions saved (not deduplicated)
- Deduplication only removes true duplicates from re-uploads

#### Test 8.4: No Transactions Statement
**Setup**: Upload statement cover page or summary page with no transactions

**Expected Results**:
- Processing completes
- Document saved
- Message: "No transactions found in the document"

### 9. Performance Tests

#### Test 9.1: Large Statement (100+ transactions)
**Setup**: Upload statement with 100+ transactions

**Expected Results**:
- Processing completes in reasonable time (< 30 seconds)
- All transactions saved correctly
- No timeout errors

#### Test 9.2: Multiple Concurrent Uploads
**Setup**: Upload 3 statements simultaneously

**Expected Results**:
- All process successfully
- No race conditions
- Data correctly isolated by document

### 10. UI/UX Tests

#### Test 10.1: Real-Time Progress Updates
**Verify**:
- Each step appears as it happens
- Loading spinners show for in-progress steps
- Checkmarks appear when steps complete
- Steps appear in correct order

#### Test 10.2: System Message Styling
**Verify**:
- System messages have distinct yellow background
- Bell icon (🔔) visible
- "System Message" label shown
- Markdown rendering works in system messages

#### Test 10.3: Clarification Message Format
**Verify**:
- Transactions numbered
- Merchant name bolded
- Date and amount clearly shown
- Question text distinct
- Call-to-action clear

## Manual Testing Checklist

- [ ] Upload bank statement with salary - income detected
- [ ] Upload statement with ambiguous deposit - clarification requested
- [ ] Respond to clarification in chat - transaction updated
- [ ] Upload full month statement - snapshots created
- [ ] Upload partial month statement - snapshots interpolated
- [ ] Query net worth - calculation correct
- [ ] Multiple account upload - net worth aggregated correctly
- [ ] Financial health summary - appears after upload
- [ ] Income vs expense analysis - accurate calculations
- [ ] Spending breakdown table - formatted correctly
- [ ] Debug panel - shows function calls
- [ ] Real-time progress - updates stream correctly
- [ ] Deduplication - prevents duplicate transactions
- [ ] Error handling - graceful failures
- [ ] Mobile responsive - works on small screens

## Automated Testing (Future)

Recommended test framework: Jest + React Testing Library

Example test structure:

```typescript
describe('Bank Statement Support', () => {
  describe('Income Detection', () => {
    it('should classify direct deposits as income with high confidence', async () => {
      // Test implementation
    });
    
    it('should flag ambiguous deposits for clarification', async () => {
      // Test implementation
    });
  });
  
  describe('Snapshot Calculator', () => {
    it('should create snapshots for month boundaries', () => {
      // Test implementation
    });
    
    it('should interpolate balances for partial months', () => {
      // Test implementation
    });
  });
  
  describe('Clarification Workflow', () => {
    it('should send system message when clarifications needed', async () => {
      // Test implementation
    });
    
    it('should update transaction type when user clarifies', async () => {
      // Test implementation
    });
  });
});
```

## Database Verification Queries

### Check Transaction Types Distribution
```sql
SELECT transaction_type, COUNT(*) as count
FROM transactions
GROUP BY transaction_type
ORDER BY count DESC;
```

### Find Unclarified Transactions
```sql
SELECT id, date, merchant, amount, clarification_question
FROM transactions
WHERE needs_clarification = true
ORDER BY date DESC;
```

### View Account Snapshots
```sql
SELECT account_name, snapshot_date, snapshot_type, balance
FROM account_snapshots
ORDER BY account_name, snapshot_date;
```

### Calculate Income vs Expenses
```sql
SELECT 
  transaction_type,
  SUM(amount) as total,
  COUNT(*) as count
FROM transactions
WHERE date >= '2025-10-01' AND date <= '2025-10-31'
GROUP BY transaction_type;
```

## Reporting Issues

When reporting issues, include:

1. **Test scenario**: Which test case failed
2. **Steps to reproduce**: Exact steps taken
3. **Expected result**: What should have happened
4. **Actual result**: What actually happened
5. **Screenshots**: UI state, error messages
6. **Database state**: Relevant queries and results
7. **Console logs**: Browser console errors
8. **File info**: Type and size of uploaded document

## Success Criteria

The bank statement support feature is considered complete when:

- [ ] All income detection scenarios work correctly
- [ ] Transaction type classification is accurate (>90%)
- [ ] Clarification workflow functions end-to-end
- [ ] Monthly snapshots calculate correctly for all date ranges
- [ ] Net worth calculation aggregates multiple accounts
- [ ] Financial health analysis provides accurate insights
- [ ] UI updates in real-time during processing
- [ ] System messages appear and format correctly
- [ ] Chat tools integrate properly
- [ ] Deduplication prevents duplicate transactions
- [ ] Error handling is graceful and informative
- [ ] Performance is acceptable for typical use cases
- [ ] Documentation is complete and accurate

