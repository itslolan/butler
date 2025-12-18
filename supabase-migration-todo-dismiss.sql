-- Migration: Add dismiss support for todos
-- This allows users to dismiss todo items without resolving them

-- Add is_dismissed column to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS is_dismissed BOOLEAN DEFAULT false;

-- Add is_dismissed column to documents table
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS is_dismissed BOOLEAN DEFAULT false;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_is_dismissed ON transactions(is_dismissed);
CREATE INDEX IF NOT EXISTS idx_documents_is_dismissed ON documents(is_dismissed);

-- Add index for common todo query pattern (needs_clarification AND not dismissed)
CREATE INDEX IF NOT EXISTS idx_transactions_needs_clarification_not_dismissed 
ON transactions(user_id, needs_clarification, is_dismissed) 
WHERE needs_clarification = true AND is_dismissed = false;

-- Add index for pending account selection query pattern
CREATE INDEX IF NOT EXISTS idx_documents_pending_not_dismissed 
ON documents(user_id, pending_account_selection, is_dismissed) 
WHERE pending_account_selection = true AND is_dismissed = false;
