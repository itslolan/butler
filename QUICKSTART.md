# Quick Start Guide: Bank Statement Support

## 🚀 Getting Started in 5 Minutes

### Step 1: Database Setup

If you have an existing Butler installation:

```sql
-- Run this in your Supabase SQL Editor
-- File: supabase-migration-bank-support.sql

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_type TEXT 
  CHECK (transaction_type IN ('income', 'expense', 'transfer', 'other'));
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS needs_clarification BOOLEAN DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS clarification_question TEXT;

CREATE TABLE IF NOT EXISTS account_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    account_name TEXT NOT NULL,
    snapshot_date DATE NOT NULL,
    snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('month_start', 'month_end')),
    balance NUMERIC NOT NULL,
    document_id UUID REFERENCES documents(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, account_name, snapshot_date, snapshot_type)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_needs_clarification ON transactions(needs_clarification) 
  WHERE needs_clarification = true;
CREATE INDEX IF NOT EXISTS idx_snapshots_user_account ON account_snapshots(user_id, account_name);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON account_snapshots(snapshot_date);
```

### Step 2: Restart Your App

```bash
npm run dev
```

### Step 3: Upload a Bank Statement

1. Go to http://localhost:3000
2. Drag and drop a bank statement PDF or take a screenshot
3. Watch the real-time processing updates
4. Wait for Butler to analyze your transactions

### Step 4: Handle Clarifications (if any)

If Butler finds transactions it's unsure about, you'll see a yellow system message:

```
🔔 System Message

I found 2 transactions that need clarification:

1. **ACH DEPOSIT** on 2025-10-01 - $2,500.00
   Question: Is this a salary/income deposit or a transfer from another account?

2. **VENMO** on 2025-10-15 - $150.00
   Question: Is this business income or a personal transfer?
```

Simply respond in the chat:
```
"The first one is my salary, and the second is business income"
```

Butler will understand and categorize them automatically!

### Step 5: Ask Questions

Try these example queries:

#### Financial Health
```
"What's my financial health for October?"
```

#### Income Analysis
```
"Show me all my income transactions"
```

#### Net Worth
```
"Calculate my net worth on October 31st"
```

#### Spending Breakdown
```
"What did I spend the most on this month?"
```

#### Account Balances
```
"Show me my checking account balance over the last 3 months"
```

## 💡 Pro Tips

### 1. Consistent Account Names
When uploading multiple statements for the same account, use consistent naming:
- ✅ Good: "Chase Checking", "Chase Checking", "Chase Checking"
- ❌ Bad: "Chase Checking", "Checking Account", "Main Checking"

### 2. Complete Statement Periods
Upload full statement periods (e.g., Oct 1-31) for accurate monthly snapshots.

### 3. All Accounts
Upload statements for ALL your accounts (checking, savings, credit cards) to get accurate net worth calculations.

### 4. Clarify Promptly
Respond to clarification requests right away for the most accurate financial insights.

### 5. Regular Uploads
Upload statements monthly to track your net worth trends over time.

## 🎯 What Gets Detected

### Automatically Classified as Income:
- Payroll deposits
- Direct deposits from employers
- Salary payments
- Freelance payments
- Business income
- Refunds and reimbursements
- Regular deposits of similar amounts

### Automatically Classified as Expenses:
- Merchant purchases
- Bill payments
- ATM withdrawals
- Subscription charges
- Fees

### Automatically Classified as Transfers:
- "TRANSFER TO SAVINGS"
- "INTERNAL TRANSFER"
- Moves between your own accounts

### May Need Clarification:
- Generic "ACH DEPOSIT" or "DEPOSIT"
- Payment apps (Venmo, PayPal) without clear context
- Round-number transfers
- Unusual one-time transactions

## 📊 Example Response

After uploading your October bank statement:

```
I've processed your bank statement.

Here's your financial health summary for Oct 1-31, 2025:

**Income**: $5,250.00
**Expenses**: $3,120.45
**Net Savings**: $2,129.55 (40.6% savings rate)
**Income-to-Expense Ratio**: 1.68:1

Your checking account balance changed from $8,450 to $10,579.

### Spending Breakdown

| Category | Amount | % of Expenses |
|----------|--------|---------------|
| Food & Dining | $850.25 | 27.3% |
| Transportation | $420.00 | 13.5% |
| Utilities | $280.20 | 9.0% |
| Entertainment | $195.00 | 6.2% |
| Other | $1,375.00 | 44.0% |

Great job maintaining a healthy savings rate! 💰
```

## 🐛 Troubleshooting

### "No transactions found"
- Make sure your PDF/image is clear and readable
- Try uploading a different page with transactions visible
- Check that it's a complete statement, not just a summary

### "All transactions need clarification"
- This happens with generic transaction descriptions
- Just respond naturally in chat to categorize them
- Butler learns the context from your responses

### "Net worth shows incomplete data"
- You need to upload statements for all your accounts
- Butler will warn you when data is incomplete
- Upload checking, savings, and credit card statements

### Snapshots not appearing
- Ensure your statement has clear start and end dates
- Check that account names are consistent
- Verify the statement covers at least part of a month

## 📚 Learn More

- **[BANK-STATEMENT-SUPPORT.md](BANK-STATEMENT-SUPPORT.md)**: Full feature documentation
- **[BANK-STATEMENT-TESTING.md](BANK-STATEMENT-TESTING.md)**: Testing guide
- **[README.md](README.md)**: Complete project documentation

## 🆘 Need Help?

1. Check the documentation files above
2. Look at the example queries in this guide
3. Try uploading a different statement format
4. Check the browser console for error messages
5. Verify your Supabase setup is correct

## 🎉 Success Indicators

You'll know everything is working when:
- ✅ Upload progress shows real-time updates
- ✅ Transactions are automatically categorized
- ✅ System messages appear for clarifications
- ✅ Financial health summary is accurate
- ✅ Net worth calculations work across accounts
- ✅ Chat responses include markdown tables
- ✅ Debug panel shows function calls

---

**Ready to go!** Upload your first bank statement and let Butler help you understand your finances! 💰🤵

