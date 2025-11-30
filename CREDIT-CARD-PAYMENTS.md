# Credit Card Payment Classification

## Overview
Credit card payments are now correctly classified as **transfers**, not expenses.

## Reasoning

### Why Credit Card Payments Are Transfers

When you pay your credit card bill:
1. **Money moves** from your checking account to your credit card account
2. **No new expense** is created - this is just moving money between your own accounts
3. **Expenses were already recorded** as individual credit card transactions when you made purchases

### Example Scenario

**Credit Card Statement (August):**
- Aug 5: Starbucks - $5.50 (expense)
- Aug 10: Amazon - $89.99 (expense)
- Aug 15: Grocery Store - $125.00 (expense)
- **Total Expenses: $220.49**

**Bank Statement (September):**
- Sep 1: **Credit Card Payment - $220.49** (transfer, NOT expense)

If we counted the credit card payment as an expense, we would be **double-counting** $220.49:
- Once as individual purchases on the credit card
- Again as the credit card payment itself

## Implementation

### System Prompt Update

The Gemini AI model has been instructed to classify credit card payments as transfers:

```
**transfer**: Transfers between own accounts, credit card payments
  - Keywords: TRANSFER TO/FROM, INTERNAL TRANSFER, ACCOUNT TRANSFER, 
              CREDIT CARD PAYMENT, CARD PAYMENT, PAYMENT TO [CARD NAME], 
              AUTO PAYMENT, E-PAYMENT
  - **IMPORTANT**: Credit card payments should ALWAYS be classified as 
                  transfers, NOT expenses
  - **Reasoning**: Credit card payments move money from checking to credit 
                  card account. The actual expenses were already recorded 
                  as individual credit card transactions
```

### Database Filtering

All expense calculations already filter out transfers:

#### 1. Category Breakdown
```typescript
// lib/db-tools.ts - getCategoryBreakdown()
.in('transaction_type', ['expense', 'other'])  // Excludes transfers
```

#### 2. Monthly Spending Trend
```typescript
// lib/db-tools.ts - getMonthlySpendingTrend()
.in('transaction_type', ['expense', 'other'])  // Excludes transfers
```

#### 3. Income vs Expenses
```typescript
// lib/db-tools.ts - getIncomeVsExpenses()
if (txn.transaction_type === 'income') {
  current.income += absAmount;
} else if (txn.transaction_type === 'expense' || txn.transaction_type === 'other') {
  current.expenses += absAmount;  // Excludes transfers
}
```

## Transaction Types

Butler now uses four transaction types:

| Type | Description | Examples |
|------|-------------|----------|
| **income** | Money coming in | Salary, wages, refunds, reimbursements |
| **expense** | Money going out for goods/services | Purchases, bills, subscriptions |
| **transfer** | Moving money between own accounts | Credit card payments, account transfers |
| **other** | Uncategorized | Transactions needing review |

## Benefits

### ✅ Accurate Expense Tracking
- No double-counting of expenses
- True spending reflects actual purchases

### ✅ Correct Financial Health
- Income vs Expenses calculations are accurate
- Net cashflow calculations exclude internal transfers

### ✅ Better Insights
- Category breakdowns show real spending patterns
- Treemap visualizations reflect actual purchases

## Impact on Existing Data

### For Future Uploads
New statements will automatically classify credit card payments as transfers.

### For Existing Data
If you have existing credit card payments classified as expenses:

**Option 1: Re-upload statements**
- Delete old documents
- Upload again - they'll be classified correctly

**Option 2: Manual correction via SQL**
```sql
-- Update existing credit card payments to transfers
UPDATE transactions 
SET transaction_type = 'transfer'
WHERE merchant ILIKE '%credit card%'
   OR merchant ILIKE '%card payment%'
   OR merchant ILIKE '%auto pay%'
   OR merchant ILIKE '%payment to visa%'
   OR merchant ILIKE '%payment to mastercard%';
```

## Common Credit Card Payment Keywords

The AI now recognizes these as transfers:
- "Credit Card Payment"
- "Card Payment"
- "Payment to Visa/Mastercard/Amex"
- "Auto Payment"
- "E-Payment to [Card Name]"
- "Online Payment"
- "Bill Payment - Credit Card"

## Testing

To verify this is working:
1. Upload a bank statement with a credit card payment
2. Check the processing results
3. Verify the payment is classified as `transfer`
4. Confirm it doesn't appear in expense charts

## FAQ

**Q: What about credit card statement transactions?**
A: Individual purchases on credit cards remain expenses. Only the payment from your bank account to the credit card is a transfer.

**Q: What if a payment is misclassified?**
A: You can use the clarification feature in chat to correct it, or Butler may ask for clarification if confidence is low.

**Q: Do transfers affect my net worth?**
A: No. Transfers move money between accounts but don't change total net worth.

**Q: Are loan payments also transfers?**
A: Currently, loan payments are classified as expenses since they typically include principal + interest. The interest portion is a true expense. This may be refined in future updates.

