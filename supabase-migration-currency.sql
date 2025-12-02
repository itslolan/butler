-- Add currency support to Butler
-- Migration: Add currency columns to documents, transactions, and account_snapshots tables

-- Add currency column to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Add currency column to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Add currency column to account_snapshots table
ALTER TABLE account_snapshots 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Create indexes for currency columns (useful for filtering/grouping by currency)
CREATE INDEX IF NOT EXISTS idx_documents_currency ON documents(currency);
CREATE INDEX IF NOT EXISTS idx_transactions_currency ON transactions(currency);
CREATE INDEX IF NOT EXISTS idx_snapshots_currency ON account_snapshots(currency);

-- Update existing records to have USD as the default currency
UPDATE documents SET currency = 'USD' WHERE currency IS NULL;
UPDATE transactions SET currency = 'USD' WHERE currency IS NULL;
UPDATE account_snapshots SET currency = 'USD' WHERE currency IS NULL;

