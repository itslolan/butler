-- Migration: Zero-Based Budgeting Feature
-- Creates budget_categories and budgets tables for YNAB-style budgeting

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- budget_categories table
-- Stores user's budget categories (both from transactions and custom)
-- ============================================================================
CREATE TABLE IF NOT EXISTS budget_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_custom BOOLEAN DEFAULT false,  -- true if user-created, false if from transactions
    display_order INTEGER DEFAULT 0,  -- for custom ordering in UI
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Indexes for budget_categories
CREATE INDEX IF NOT EXISTS idx_budget_categories_user_id ON budget_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_categories_user_order ON budget_categories(user_id, display_order);

-- ============================================================================
-- budgets table
-- Stores monthly budget allocations per category
-- ============================================================================
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    category_id UUID NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
    month TEXT NOT NULL,  -- Format: 'YYYY-MM'
    budgeted_amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, category_id, month)
);

-- Indexes for budgets
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, month);
CREATE INDEX IF NOT EXISTS idx_budgets_category_id ON budgets(category_id);

-- ============================================================================
-- Enable Row Level Security (RLS)
-- ============================================================================
ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for now - restrict by user later if needed)
CREATE POLICY "Allow all operations on budget_categories" ON budget_categories FOR ALL USING (true);
CREATE POLICY "Allow all operations on budgets" ON budgets FOR ALL USING (true);

-- ============================================================================
-- Trigger for updated_at on budgets table
-- ============================================================================
CREATE TRIGGER update_budgets_updated_at 
    BEFORE UPDATE ON budgets
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE budget_categories IS 'Stores budget categories for zero-based budgeting feature';
COMMENT ON COLUMN budget_categories.is_custom IS 'true if user-created category, false if auto-populated from transactions';
COMMENT ON COLUMN budget_categories.display_order IS 'Custom ordering for UI display';

COMMENT ON TABLE budgets IS 'Stores monthly budget allocations per category';
COMMENT ON COLUMN budgets.month IS 'Budget month in YYYY-MM format';
COMMENT ON COLUMN budgets.budgeted_amount IS 'Amount budgeted for this category in this month';

