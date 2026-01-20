-- Migration: Add category_type to budget categories and super-categories
-- Adds a category_type field with allowed values: income, expense, savings

-- ============================================================================
-- budget_categories: category_type column
-- ============================================================================
ALTER TABLE budget_categories
    ADD COLUMN IF NOT EXISTS category_type TEXT NOT NULL DEFAULT 'expense';

ALTER TABLE budget_categories
    DROP CONSTRAINT IF EXISTS budget_categories_category_type_check;

ALTER TABLE budget_categories
    ADD CONSTRAINT budget_categories_category_type_check
    CHECK (category_type IN ('income', 'expense', 'savings'));

-- ============================================================================
-- budget_super_categories: category_type column
-- ============================================================================
ALTER TABLE budget_super_categories
    ADD COLUMN IF NOT EXISTS category_type TEXT NOT NULL DEFAULT 'expense';

ALTER TABLE budget_super_categories
    DROP CONSTRAINT IF EXISTS budget_super_categories_category_type_check;

ALTER TABLE budget_super_categories
    ADD CONSTRAINT budget_super_categories_category_type_check
    CHECK (category_type IN ('income', 'expense', 'savings'));

-- ============================================================================
-- Backfill default super-categories
-- ============================================================================
UPDATE budget_super_categories
SET category_type = 'income'
WHERE name IN (
  'Primary Income',
  'Variable Income',
  'Business Income',
  'Other Income'
);

UPDATE budget_super_categories
SET category_type = 'savings'
WHERE name = 'Savings & Investments';

-- ============================================================================
-- Backfill default categories
-- ============================================================================
UPDATE budget_categories
SET category_type = 'income'
WHERE name IN (
  'Salary / Wages',
  'Contract Income',
  'Freelance Income',
  'Bonuses',
  'Commissions',
  'Overtime',
  'Tips',
  'Client Payments',
  'Project-Based Income',
  'Retainers',
  'Interest',
  'Dividends',
  'Rental Income',
  'Refunds & Reimbursements',
  'Gifts',
  'Other Income'
);

UPDATE budget_categories
SET category_type = 'savings'
WHERE name IN (
  'Emergency Fund',
  'Retirement Contributions',
  'Investments',
  'High-Yield Savings'
);

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON COLUMN budget_categories.category_type IS 'Category type: income, expense, or savings';
COMMENT ON COLUMN budget_super_categories.category_type IS 'Super-category type: income, expense, or savings';
