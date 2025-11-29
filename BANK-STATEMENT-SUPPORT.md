# Bank Statement Support

Butler now fully supports bank statements in addition to credit card statements, with advanced features for income tracking, transaction classification, net worth monitoring, and interactive clarification.

## Key Features

### 1. Transaction Type Classification

Every transaction is automatically classified into one of four types:

- **income**: Salary, wages, direct deposits, business income, freelance payments, refunds, reimbursements
- **expense**: Purchases, bills, fees, charges, payments
- **transfer**: Transfers between your own accounts
- **other**: Uncategorized or uncertain transactions

### 2. Income Detection

The system uses AI to identify income transactions based on:

- **Keywords**: SALARY, PAYROLL, DIRECT DEPOSIT, WAGE, INCOME, EMPLOYER, PAYCHECK, etc.
- **Patterns**: Regular deposits of similar amounts, large credits
- **Frequency analysis**: Monthly, biweekly, weekly, or irregular income patterns

### 3. Interactive Clarification

When the AI is uncertain about a transaction type (confidence < 0.7):

1. The transaction is flagged for clarification
2. A specific question is generated (e.g., "Is this a salary deposit or a transfer?")
3. After document processing, Butler automatically asks you in the chat
4. You can clarify by responding naturally in the chat
5. Butler uses the `categorize_transaction` tool to update the database

### 4. Monthly Balance Snapshots

For each account, Butler calculates and stores balance snapshots at:

- **Month start** (1st of each month)
- **Month end** (last day of each month)

This enables:
- Net worth tracking over time
- Month-over-month comparisons
- Financial health trend analysis

### 5. Net Worth Calculation

Butler can calculate your net worth at any point in time by:

- Aggregating balances across all uploaded accounts
- Including both assets (positive balances) and liabilities (negative balances)
- Providing breakdowns by account
- Warning when data is incomplete

### 6. Financial Health Analysis

After processing each document, Butler automatically provides insights:

- **Income vs Expenses**: Clear comparison of money in vs money out
- **Savings Rate**: Percentage of income saved
- **Income-to-Expense Ratio**: How much income covers expenses
- **Balance Changes**: Month-over-month trends
- **Warnings**: Alerts when expenses exceed income

## Database Schema

### Enhanced Transactions Table

```sql
CREATE TABLE transactions (
    -- ... existing fields ...
    transaction_type TEXT CHECK (transaction_type IN ('income', 'expense', 'transfer', 'other')),
    needs_clarification BOOLEAN DEFAULT false,
    clarification_question TEXT,
    -- ...
);
```

### New Account Snapshots Table

```sql
CREATE TABLE account_snapshots (
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
```

## Chat Assistant Tools

Butler now has access to these additional tools:

### categorize_transaction(transaction_id, transaction_type)

Allows users to clarify transaction types through natural conversation.

**Example:**
- User: "The $2,500 deposit on Oct 1st is my salary"
- Butler: Calls `categorize_transaction(txn_id, 'income')`

### get_account_snapshots(accountName?, startDate?, endDate?)

Retrieves monthly balance snapshots for accounts.

**Example:**
- User: "Show me my checking account balance over the last 3 months"
- Butler: Calls `get_account_snapshots('checking', '2025-07-01', '2025-10-31')`

### calculate_net_worth(date)

Calculates total net worth at a specific date.

**Example:**
- User: "What was my net worth at the end of September?"
- Butler: Calls `calculate_net_worth('2025-09-30')`

## Processing Workflow

### Document Upload

1. **File Upload**: User uploads bank statement (PDF or image)
2. **Gemini Analysis**: AI extracts transactions with type classification
3. **Confidence Scoring**: Each transaction gets a confidence score (0.0 to 1.0)
4. **Clarification Flagging**: Low-confidence transactions marked for review
5. **Snapshot Calculation**: Monthly balances calculated and stored
6. **Database Storage**: All data saved to Supabase

### Post-Processing

1. **Clarification Check**: System checks for transactions needing clarification
2. **Auto-Message**: If clarifications needed, Butler sends a system message
3. **User Response**: User clarifies transactions through natural chat
4. **Update**: Butler categorizes transactions based on user input
5. **Financial Health**: Butler provides comprehensive financial analysis

## Example Clarification Flow

```
🔔 System Message

I've processed your bank statement. I found 2 transactions that need clarification:

1. **ACH DEPOSIT** on 2025-10-01 - $2,500.00
   Question: Is this a salary/income deposit or a transfer from another account?

2. **VENMO** on 2025-10-15 - $150.00
   Question: Is this business income or a personal transfer?

Please help me categorize these transactions so I can provide better financial insights.
```

User: "The first one is my salary, and the second is business income from a client."

Butler: "Thanks! I've categorized the ACH deposit as income (salary) and the Venmo transaction as income (business). Your total income for this period is now $2,650."

## Financial Health Example

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

## Migration

To enable bank statement support on an existing Butler installation:

1. **Run Migration Script**:
   ```sql
   -- Execute supabase-migration-bank-support.sql
   ```

2. **Restart Application**:
   The new features will be automatically available.

3. **Re-process Existing Documents** (Optional):
   Upload documents again to classify transactions and generate snapshots.

## Best Practices

1. **Upload Complete Statements**: Include full statement periods for accurate snapshots
2. **Clarify Promptly**: Respond to clarification requests for better insights
3. **Regular Uploads**: Upload statements monthly to track net worth trends
4. **Use Account Names**: Consistent naming helps track accounts across statements
5. **Ask Questions**: Butler can now provide comprehensive financial health analysis

## Troubleshooting

### Transactions Not Classified

- Check if the statement is readable (clear image/PDF)
- Verify transaction descriptions contain recognizable keywords
- Use clarification feature to manually categorize

### Missing Snapshots

- Ensure statement has clear start/end balances
- Check that account name is consistent across uploads
- Verify statement date range includes month boundaries

### Incomplete Net Worth

- Upload statements for all your accounts (checking, savings, credit cards)
- Use consistent date ranges across accounts
- Butler will warn when data is incomplete

## Technical Details

### Snapshot Calculator Algorithm

1. **Identify Month Boundaries**: Find all month starts/ends in statement period
2. **Calculate Running Balance**: Track balance changes through transactions
3. **Interpolate**: Estimate balance at month boundaries using transaction history
4. **Store**: Save snapshots with month_start or month_end type

### Income Pattern Detection

1. **Keyword Matching**: Look for salary-related terms in transaction descriptions
2. **Amount Analysis**: Identify regular deposits of similar amounts
3. **Frequency Detection**: Analyze timing patterns (monthly, biweekly, etc.)
4. **Confidence Scoring**: Combine factors to calculate confidence (0.0 to 1.0)

## Future Enhancements

- **Automatic Categorization Learning**: Learn from user clarifications
- **Spending Insights**: Automatic detection of unusual spending patterns
- **Budget Recommendations**: AI-powered budget suggestions based on income
- **Bill Tracking**: Automatic identification of recurring bills
- **Financial Goals**: Track progress toward savings goals

