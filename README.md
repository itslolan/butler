# 🤵 Butler - AI Financial Assistant

Butler helps users manage and understand their finances using AI-powered analysis of bank and credit card statements.

## Features

### Authentication & Security
- **User Authentication**: Email/password and Google OAuth login
- **Protected Routes**: Automatic session management and route protection
- **User Data Isolation**: Each user's financial data is completely isolated
- **Secure Sessions**: httpOnly cookies for session storage

### Core Features
- Upload bank and credit card statements (PDFs or images)
- AI-powered extraction using Google Gemini 2.0 Flash
- Structured storage of documents and transactions in Supabase
- File storage in Supabase Storage
- Conversational AI assistant to query your financial data
- Real-time processing updates with streaming progress

### Bank Statement Support (NEW)
- **Transaction Type Classification**: Automatically categorizes transactions as income, expense, transfer, or other
- **Income Detection**: AI identifies salary, wages, business income, and other income sources
- **Interactive Clarification**: System asks for help when uncertain about transaction types
- **Monthly Balance Snapshots**: Track account balances at month start/end for net worth monitoring
- **Net Worth Calculation**: Aggregate balances across all accounts at any point in time
- **Financial Health Analysis**: Automatic insights on income vs expenses, savings rate, and spending patterns

### Advanced Features
- Duplicate transaction detection
- Account name tracking across multiple statement periods
- Rich markdown responses with data tables
- Debug panel showing LLM reasoning and function calls
- Confidence scoring for transaction classifications

## Architecture

- **Frontend**: Next.js 14 with React
- **AI**: Google Gemini 2.0 Flash with function calling
- **Database**: Supabase (PostgreSQL with JSONB columns)
- **Storage**: Supabase Storage for original files
- **Language**: TypeScript

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env.local` file with:
```
# Required: Gemini API Key
# Get your API key from: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# Required: Supabase configuration
# Get from your Supabase project settings > API
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

3. Set up Supabase:
   - Create a new Supabase project at https://supabase.com
   - Run the SQL schema from `supabase-schema.sql` in the SQL Editor
   - If migrating from older version, also run `supabase-migration-bank-support.sql`
   - Create a storage bucket called `statements`
   - Make it public or configure appropriate access policies

4. Set up Authentication (see [AUTHENTICATION.md](./AUTHENTICATION.md) for detailed guide):
   - Enable Email authentication in Supabase Dashboard > Authentication > Providers
   - (Optional) Configure Google OAuth for social login
   - Update redirect URLs in Supabase Dashboard

5. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## How It Works

### Document Processing

1. **Upload**: User uploads a PDF or image of a bank/credit card statement
2. **Storage**: Original file is saved to Supabase Storage
3. **AI Extraction**: Gemini AI extracts:
   - Document metadata (type, issuer, account, balances, dates)
   - Individual transactions with type classification (income/expense/transfer/other)
   - Confidence scores for each classification
   - Income pattern detection (monthly, biweekly, irregular)
   - Metadata summary (markdown text)
4. **Clarification**: For low-confidence transactions:
   - System flags transaction for clarification
   - Generates specific question (e.g., "Is this income or a transfer?")
   - Auto-sends message to user in chat
5. **Snapshot Calculation**: Monthly balance snapshots computed for net worth tracking
6. **Database Storage**: Structured data saved to Supabase (PostgreSQL):
   - `documents` table: Document metadata with JSONB
   - `transactions` table: Individual transactions with type, clarification status
   - `account_snapshots` table: Monthly balance snapshots
   - `user_metadata` table: Append-only markdown summaries
7. **Financial Health**: System provides automatic analysis of income, expenses, and savings

### Chat Assistant

Butler's AI assistant uses function calling to:
- **search_documents**: Query uploaded statements
- **search_transactions**: Find specific transactions with filters (including transaction type)
- **get_all_metadata**: Retrieve summary text
- **categorize_transaction**: Update transaction types based on user clarification
- **get_account_snapshots**: Retrieve monthly balance history
- **calculate_net_worth**: Aggregate balances across accounts

The assistant provides detailed, data-rich responses with:
- Markdown tables for transaction lists
- Spending breakdowns by category
- Income vs expense comparisons
- Savings rate calculations
- Financial health insights

## Data Extracted

### Document Metadata
- Document type (bank statement vs credit card statement)
- Issuer/bank name
- Account ID and account name
- Statement dates and transaction date ranges
- Balances (previous, new, credit limits, minimum payment)
- Due dates

### Transaction Data
- Date, merchant, amount, category, description
- **Transaction type** (income, expense, transfer, other)
- **Confidence score** (0.0 to 1.0)
- **Clarification status** (needs_clarification flag)
- **Clarification question** (if applicable)
- Account name linkage

### Income Analysis
- Income transaction identification
- Payment frequency detection (monthly, biweekly, irregular)
- Source identification

### Financial Snapshots
- Monthly balance snapshots (start and end of month)
- Net worth calculation across accounts
- Account balance trends

### Metadata Summaries
- Markdown-formatted summaries per document
- Aggregated metadata text per user

## Deployment on Render

1. Commit your code and push to your repository
2. In Render dashboard, create a new Web Service
3. Connect to your repository
4. Add environment variables:
   - `GEMINI_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Deploy!

## Documentation

- **[BANK-STATEMENT-SUPPORT.md](BANK-STATEMENT-SUPPORT.md)**: Comprehensive guide to bank statement features
- **[BANK-STATEMENT-TESTING.md](BANK-STATEMENT-TESTING.md)**: Testing guide for all new features
- **[DEDUPLICATION-EXPLAINED.md](DEDUPLICATION-EXPLAINED.md)**: How duplicate detection works
- **[supabase-schema.sql](supabase-schema.sql)**: Complete database schema
- **[supabase-migration-bank-support.sql](supabase-migration-bank-support.sql)**: Migration script for existing installations

## Example Queries

### Financial Health
```
User: "What's my financial health for October?"

Butler: "Your financial health for October 2025:

**Income**: $5,250.00
**Expenses**: $3,120.45
**Net Savings**: $2,129.55 (40.6% savings rate)
**Income-to-Expense Ratio**: 1.68:1

| Category | Amount | % |
|----------|--------|---|
| Food & Dining | $850.25 | 27.3% |
| Transportation | $420.00 | 13.5% |
| Utilities | $280.20 | 9.0% |
...

Great job maintaining a healthy savings rate! 💰"
```

### Net Worth Tracking
```
User: "Calculate my net worth on October 31st"

Butler: "Your net worth on Oct 31, 2025 is $15,250.50 based on 3 accounts:

**Assets:**
- Checking Account: $8,500.00
- Savings Account: $10,000.00

**Liabilities:**
- Credit Card (ending 4080): -$3,249.50

**Total Net Worth**: $15,250.50"
```

### Transaction Clarification
```
System: "I found 2 transactions that need clarification:

1. **ACH DEPOSIT** on 2025-10-01 - $2,500.00
   Question: Is this a salary/income deposit or a transfer from another account?

2. **VENMO** on 2025-10-15 - $150.00
   Question: Is this business income or a personal transfer?"

User: "The first is my salary, the second is business income"

Butler: "Thanks! I've categorized both as income. Your total income for this period is $2,650."
```

## Technology Stack

- **Frontend**: Next.js 14 (App Router), React, TailwindCSS
- **AI Model**: Google Gemini 2.0 Flash Experimental
- **Database**: Supabase (PostgreSQL with JSONB columns)
- **Storage**: Supabase Storage
- **Markdown**: react-markdown with remark-gfm for tables
- **Language**: TypeScript
- **Deployment**: Vercel, Render, or any Node.js host

