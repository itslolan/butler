-- Migration: Extend fixed_expenses_cache to store subscription tagging
-- Adds:
-- - kind: 'fixed_expense' | 'subscription_candidate'
-- - is_subscription: boolean
-- - is_maybe: boolean
--
-- Also updates uniqueness to allow same merchant in different kinds.

ALTER TABLE fixed_expenses_cache
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'fixed_expense';

ALTER TABLE fixed_expenses_cache
  ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE fixed_expenses_cache
  ADD COLUMN IF NOT EXISTS is_maybe BOOLEAN NOT NULL DEFAULT false;

-- Ensure kind values are constrained
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fixed_expenses_cache_kind_check'
  ) THEN
    ALTER TABLE fixed_expenses_cache
      ADD CONSTRAINT fixed_expenses_cache_kind_check
      CHECK (kind IN ('fixed_expense', 'subscription_candidate'));
  END IF;
END $$;

-- Update unique constraint to include kind (drop old one if present)
ALTER TABLE fixed_expenses_cache
  DROP CONSTRAINT IF EXISTS fixed_expenses_cache_user_id_merchant_name_key;

ALTER TABLE fixed_expenses_cache
  ADD CONSTRAINT fixed_expenses_cache_user_id_merchant_name_kind_key
  UNIQUE (user_id, merchant_name, kind);

