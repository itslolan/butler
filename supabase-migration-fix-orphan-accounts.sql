-- Migration: Fix orphan accounts
-- This migration creates account records for transactions that have account_name
-- but no corresponding account in the accounts table, then links those transactions
-- to the newly created accounts.

-- Step 1: Create a temporary table to hold the orphan account names and their user IDs
CREATE TEMP TABLE orphan_accounts AS
SELECT DISTINCT 
  t.user_id,
  t.account_name,
  -- Try to extract issuer from the account name or document
  COALESCE(
    (SELECT DISTINCT d.issuer FROM documents d WHERE d.account_name = t.account_name AND d.user_id = t.user_id LIMIT 1),
    NULL
  ) AS issuer
FROM transactions t
WHERE t.account_name IS NOT NULL
  AND t.account_name != ''
  AND t.account_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM accounts a 
    WHERE a.user_id = t.user_id 
      AND (
        LOWER(a.display_name) = LOWER(t.account_name)
        OR LOWER(a.official_name) = LOWER(t.account_name)
      )
  );

-- Step 2: Insert new account records for orphan accounts
INSERT INTO accounts (id, user_id, display_name, official_name, issuer, source, is_active, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  user_id,
  account_name,
  account_name,
  issuer,
  'statement',
  true,
  NOW(),
  NOW()
FROM orphan_accounts
ON CONFLICT DO NOTHING;

-- Step 3: Update transactions to link to the newly created accounts
UPDATE transactions t
SET account_id = (
  SELECT a.id 
  FROM accounts a 
  WHERE a.user_id = t.user_id 
    AND (
      LOWER(a.display_name) = LOWER(t.account_name)
      OR LOWER(a.official_name) = LOWER(t.account_name)
    )
  LIMIT 1
)
WHERE t.account_id IS NULL
  AND t.account_name IS NOT NULL
  AND t.account_name != '';

-- Step 4: Update documents to link to the newly created accounts
UPDATE documents d
SET account_id = (
  SELECT a.id 
  FROM accounts a 
  WHERE a.user_id = d.user_id 
    AND (
      LOWER(a.display_name) = LOWER(d.account_name)
      OR LOWER(a.official_name) = LOWER(d.account_name)
    )
  LIMIT 1
)
WHERE d.account_id IS NULL
  AND d.account_name IS NOT NULL
  AND d.account_name != '';

-- Step 5: Clean up
DROP TABLE IF EXISTS orphan_accounts;

-- Step 6: Verification query (run manually to check results)
-- SELECT 
--   'Transactions without account_id' AS check_type,
--   COUNT(*) AS count
-- FROM transactions 
-- WHERE account_id IS NULL AND account_name IS NOT NULL
-- UNION ALL
-- SELECT 
--   'Documents without account_id' AS check_type,
--   COUNT(*) AS count
-- FROM documents 
-- WHERE account_id IS NULL AND account_name IS NOT NULL;
