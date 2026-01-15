-- Migration: Budget Category Hierarchy (Super Categories)
-- Adds super-categories and links categories to their parent

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- budget_super_categories table
-- Stores user's top-level budget super-categories
-- ============================================================================
CREATE TABLE IF NOT EXISTS budget_super_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Indexes for budget_super_categories
CREATE INDEX IF NOT EXISTS idx_budget_super_categories_user_id ON budget_super_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_super_categories_user_order ON budget_super_categories(user_id, display_order);

-- ============================================================================
-- budget_categories: link to super-category
-- ============================================================================
ALTER TABLE budget_categories
    ADD COLUMN IF NOT EXISTS super_category_id UUID REFERENCES budget_super_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_budget_categories_super_category
    ON budget_categories(user_id, super_category_id);

-- ============================================================================
-- budgets: allow super-category allocations
-- ============================================================================
ALTER TABLE budgets
    ADD COLUMN IF NOT EXISTS super_category_id UUID REFERENCES budget_super_categories(id) ON DELETE CASCADE;

ALTER TABLE budgets
    ALTER COLUMN category_id DROP NOT NULL;

-- Ensure uniqueness for super-category budgets
CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_user_super_category_month
    ON budgets(user_id, super_category_id, month)
    WHERE super_category_id IS NOT NULL;

-- Ensure budgets point to exactly one target (category or super-category)
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_category_or_super_category_check;
ALTER TABLE budgets
    ADD CONSTRAINT budgets_category_or_super_category_check
    CHECK (
        (category_id IS NOT NULL AND super_category_id IS NULL) OR
        (category_id IS NULL AND super_category_id IS NOT NULL)
    );

-- ============================================================================
-- Enable Row Level Security (RLS)
-- ============================================================================
ALTER TABLE budget_super_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on budget_super_categories" ON budget_super_categories FOR ALL USING (true);

-- ============================================================================
-- Backfill: assign existing categories to "Miscellaneous"
-- ============================================================================
INSERT INTO budget_super_categories (user_id, name, display_order)
SELECT DISTINCT user_id, 'Miscellaneous', 0
FROM budget_categories
ON CONFLICT (user_id, name) DO NOTHING;

UPDATE budget_categories bc
SET super_category_id = sc.id
FROM budget_super_categories sc
WHERE bc.user_id = sc.user_id
  AND sc.name = 'Miscellaneous'
  AND bc.super_category_id IS NULL;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE budget_super_categories IS 'Stores budget super-categories for hierarchy';
COMMENT ON COLUMN budget_categories.super_category_id IS 'Parent super-category for this category';
COMMENT ON COLUMN budgets.super_category_id IS 'Budget allocation for a super-category (category_id is null)';
