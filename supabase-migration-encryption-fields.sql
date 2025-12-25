-- Encryption Fields Migration
-- Adds encrypted columns for sensitive financial data
-- No backwards compatibility - assumes clean slate (no existing data)

-- ============================================
-- 1. Modify plaid_accounts table for encryption
-- ============================================

-- Add encrypted fields for sensitive data
ALTER TABLE plaid_accounts 
  ADD COLUMN IF NOT EXISTS current_balance_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS available_balance_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS account_official_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS credit_limit_encrypted TEXT;

-- IMPORTANT: Keep old columns for now to preserve existing data
-- The app will prefer encrypted columns when available, but fall back to unencrypted
-- You can drop these columns after reconnecting all your Plaid accounts
-- ALTER TABLE plaid_accounts 
--   DROP COLUMN IF EXISTS current_balance,
--   DROP COLUMN IF EXISTS available_balance;

-- Keep account_official_name for now, but we'll use encrypted version going forward
-- account_mask stays unencrypted (last 4 digits for display)
-- account_name stays unencrypted (generic name like "Checking")

-- ============================================
-- 2. Modify documents table for encryption
-- ============================================

-- Add encrypted field for account_id
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS account_id_encrypted TEXT;

-- We'll keep account_id for backwards compatibility but prefer encrypted version

-- ============================================
-- 3. Modify account_snapshots table for encryption
-- ============================================

-- Add encrypted field for balance
ALTER TABLE account_snapshots
  ADD COLUMN IF NOT EXISTS balance_encrypted TEXT;

-- Make the unencrypted balance nullable (we'll use encrypted going forward)
ALTER TABLE account_snapshots
  ALTER COLUMN balance DROP NOT NULL;

-- ============================================
-- 4. Comments for documentation
-- ============================================

COMMENT ON COLUMN plaid_accounts.current_balance_encrypted IS 'AES-256-GCM encrypted current balance';
COMMENT ON COLUMN plaid_accounts.available_balance_encrypted IS 'AES-256-GCM encrypted available balance';
COMMENT ON COLUMN plaid_accounts.account_official_name_encrypted IS 'AES-256-GCM encrypted official account name';
COMMENT ON COLUMN plaid_accounts.credit_limit_encrypted IS 'AES-256-GCM encrypted credit limit';

COMMENT ON COLUMN documents.account_id_encrypted IS 'AES-256-GCM encrypted account ID';

COMMENT ON COLUMN account_snapshots.balance_encrypted IS 'AES-256-GCM encrypted balance snapshot';

-- ============================================
-- 5. Create indexes on encrypted fields if needed
-- ============================================

-- Note: We generally don't index encrypted fields since they can't be searched efficiently
-- But we might want to index for NOT NULL checks or existence checks

-- ============================================
-- 6. Validation
-- ============================================

-- Verify the changes
DO $$
BEGIN
  -- Check that encrypted columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plaid_accounts' 
    AND column_name = 'current_balance_encrypted'
  ) THEN
    RAISE EXCEPTION 'Migration failed: current_balance_encrypted column not created';
  END IF;
  
  RAISE NOTICE 'Encryption fields migration completed successfully';
END $$;

