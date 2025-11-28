# Butler - AI Financial Assistant

Butler helps users manage and understand their finances using AI-powered analysis of bank and credit card statements.

## Features

- Upload bank and credit card statements (PDFs or images)
- AI-powered extraction using Google Gemini
- Structured storage of documents and transactions in MongoDB
- File storage in Supabase
- Conversational AI assistant to query your financial data
- Ask questions about spending, balances, transactions, and more

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
# Get from your Supabase project settings
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

3. Set up Supabase:
   - Create a new Supabase project at https://supabase.com
   - Run the SQL schema from `supabase-schema.sql` in the SQL Editor
   - Create a storage bucket called `statements`
   - Make it public or configure appropriate access policies

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## How It Works

1. **Upload**: User uploads a PDF or image of a bank/credit card statement
2. **Storage**: Original file is saved to Supabase Storage
3. **Extraction**: Gemini AI extracts:
   - Document metadata (issuer, account, balances, dates)
   - Individual transactions (date, merchant, amount, category)
   - Metadata summary (markdown text)
4. **Storage**: Structured data is saved to Supabase (PostgreSQL):
   - `documents` table: Document metadata with JSONB for flexible data
   - `transactions` table: Individual transactions with JSONB for flexible data
   - `user_metadata` table: Append-only markdown summaries per user
5. **Chat**: AI assistant answers questions using function calling to query the database

## Data Extracted

- Document type (bank statement vs credit card)
- Issuer/bank name
- Account information
- Statement dates and periods
- Balances (previous, new, credit limits)
- Payment information
- Individual transactions with categories
- Metadata summaries

## Deployment on Render

1. Commit your code and push to your repository
2. In Render dashboard, create a new Web Service
3. Connect to your repository
4. Add environment variables:
   - `GEMINI_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Deploy!
