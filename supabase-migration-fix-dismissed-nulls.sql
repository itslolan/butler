-- Migration: Fix NULL values for is_dismissed column
-- This ensures all existing records have is_dismissed set to false instead of NULL
-- This is important for query performance and consistency

-- Update transactions table - set NULL is_dismissed to false
UPDATE transactions
SET is_dismissed = false
WHERE is_dismissed IS NULL;

-- Update documents table - set NULL is_dismissed to false
UPDATE documents
SET is_dismissed = false
WHERE is_dismissed IS NULL;

-- Verify the updates
DO $$
DECLARE
  null_transactions_count INTEGER;
  null_documents_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_transactions_count
  FROM transactions
  WHERE is_dismissed IS NULL;
  
  SELECT COUNT(*) INTO null_documents_count
  FROM documents
  WHERE is_dismissed IS NULL;
  
  RAISE NOTICE 'Migration complete. Remaining NULL values:';
  RAISE NOTICE '  - Transactions with NULL is_dismissed: %', null_transactions_count;
  RAISE NOTICE '  - Documents with NULL is_dismissed: %', null_documents_count;
END $$;

