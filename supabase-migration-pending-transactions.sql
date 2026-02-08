-- Migration: Add pending transaction tracking
-- This supports the credit card pending vs posted transaction reconciliation feature
-- 
-- When a pending transaction is uploaded, it gets is_pending = true
-- When the posted/authorized version is later uploaded, the pending one is deleted
-- and the new transaction gets reconciled_from_id pointing to the deleted pending ID

-- Add is_pending column to track pending/processing transactions
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS is_pending BOOLEAN DEFAULT FALSE;

-- Add reconciled_from_id to track which pending transaction was replaced
-- This creates an audit trail of reconciliations
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS reconciled_from_id UUID REFERENCES transactions(id) ON DELETE SET NULL;

-- Create an index for efficient pending transaction queries
-- This is used when scanning for pending transactions to reconcile
CREATE INDEX IF NOT EXISTS idx_transactions_is_pending 
ON transactions(user_id, is_pending) 
WHERE is_pending = TRUE;

-- Create an index for date-based lookups (used in reconciliation window)
CREATE INDEX IF NOT EXISTS idx_transactions_pending_date_range 
ON transactions(user_id, account_id, date, is_pending) 
WHERE is_pending = TRUE;

-- Comment explaining the feature
COMMENT ON COLUMN transactions.is_pending IS 
'True for credit card transactions that are still pending/processing. These will be automatically reconciled (deleted) when the authorized/posted version is uploaded.';

COMMENT ON COLUMN transactions.reconciled_from_id IS 
'References the pending transaction ID that this transaction replaced during reconciliation. Provides audit trail.';
