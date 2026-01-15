-- Migration: Transaction-level fixed expenses + user-input fixed expenses
-- Adds:
-- - budget_categories.is_fixed_expense_category
-- - transactions.* fixed expense flags (is_fixed_expense, status, source, confidence, link to user input)
-- - fixed_expense_user_inputs table (minimal; UI can be added later)

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1) budget_categories: fixed-expense category flag
-- ============================================================================
ALTER TABLE budget_categories
  ADD COLUMN IF NOT EXISTS is_fixed_expense_category BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN budget_categories.is_fixed_expense_category IS 'Marks categories that should auto-tag transactions as fixed expenses';

-- Backfill: mark common default categories as fixed-expense categories
-- (applies to all users who have these categories)
UPDATE budget_categories
SET is_fixed_expense_category = true
WHERE is_fixed_expense_category = false
  AND LOWER(name) IN (
    -- Housing
    'rent / mortgage',
    'property taxes',
    'home insurance',
    'hoa fees',
    -- Utilities
    'electricity',
    'water',
    'gas',
    'internet',
    'mobile phone',
    -- Transportation insurance / debt
    'vehicle insurance',
    -- Debt & Credit
    'personal loans',
    'student loans',
    'auto loans',
    -- Business (often fixed)
    'subscriptions',
    'hosting / domains',
    'coworking / office rent',
    -- Health insurance
    'health insurance'
  );

-- ============================================================================
-- 2) fixed_expense_user_inputs table
-- ============================================================================
CREATE TABLE IF NOT EXISTS fixed_expense_user_inputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  expected_amount NUMERIC,
  expected_day_of_month INTEGER,
  expected_cadence TEXT
    CHECK (expected_cadence IN ('monthly', 'biweekly', 'weekly', 'quarterly', 'annual', 'irregular') OR expected_cadence IS NULL),
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  matched_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  match_confidence NUMERIC,
  match_explain TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fixed_expense_user_inputs_user_id
  ON fixed_expense_user_inputs(user_id);

CREATE INDEX IF NOT EXISTS idx_fixed_expense_user_inputs_user_active
  ON fixed_expense_user_inputs(user_id, is_active);

-- Enable Row Level Security
ALTER TABLE fixed_expense_user_inputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on fixed_expense_user_inputs"
  ON fixed_expense_user_inputs FOR ALL USING (true);

-- updated_at trigger (function may already exist in schema)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS update_fixed_expense_user_inputs_updated_at ON fixed_expense_user_inputs;
    CREATE TRIGGER update_fixed_expense_user_inputs_updated_at
      BEFORE UPDATE ON fixed_expense_user_inputs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- 3) transactions: fixed expense flags
-- ============================================================================
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS is_fixed_expense BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS fixed_expense_status TEXT
    CHECK (fixed_expense_status IN ('fixed', 'maybe') OR fixed_expense_status IS NULL);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS fixed_expense_source TEXT
    CHECK (fixed_expense_source IN ('category', 'llm', 'user') OR fixed_expense_source IS NULL);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS fixed_expense_confidence NUMERIC;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS fixed_expense_model TEXT;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS fixed_expense_explain TEXT;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS fixed_expense_user_input_id UUID REFERENCES fixed_expense_user_inputs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_fixed_expense
  ON transactions(user_id, is_fixed_expense, date);

CREATE INDEX IF NOT EXISTS idx_transactions_fixed_expense_true
  ON transactions(user_id, date)
  WHERE is_fixed_expense = true;

COMMENT ON COLUMN transactions.is_fixed_expense IS 'True when this transaction is a fixed expense (including maybe candidates)';
COMMENT ON COLUMN transactions.fixed_expense_status IS 'fixed | maybe (null when not a fixed expense)';
COMMENT ON COLUMN transactions.fixed_expense_source IS 'category | llm | user';
COMMENT ON COLUMN transactions.fixed_expense_confidence IS '0..1 confidence of fixed-expense classification';
COMMENT ON COLUMN transactions.fixed_expense_user_input_id IS 'Links a transaction to an equivalent user-input fixed expense (to prevent duplicates)';

