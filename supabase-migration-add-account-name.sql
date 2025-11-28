-- Migration: Add account_name column to documents and transactions tables
-- Run this if you already have an existing database

-- Add account_name to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS account_name TEXT;

-- Add account_name to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_name TEXT;

-- Create indexes for account_name
CREATE INDEX IF NOT EXISTS idx_documents_account_name ON documents(account_name);
CREATE INDEX IF NOT EXISTS idx_documents_user_account ON documents(user_id, account_name);
CREATE INDEX IF NOT EXISTS idx_transactions_account_name ON transactions(account_name);
CREATE INDEX IF NOT EXISTS idx_transactions_user_account ON transactions(user_id, account_name);

-- Optional: Update existing transactions to inherit account_name from their document
UPDATE transactions t
SET account_name = d.account_name
FROM documents d
WHERE t.document_id = d.id
AND t.account_name IS NULL
AND d.account_name IS NOT NULL;

