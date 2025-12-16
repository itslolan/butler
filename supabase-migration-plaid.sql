-- Migration: Plaid API Integration
-- Run this to add Plaid-related tables and columns

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Create plaid_items table
-- Stores connected financial institutions
-- ============================================
CREATE TABLE IF NOT EXISTS plaid_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    plaid_item_id TEXT NOT NULL UNIQUE,
    plaid_access_token TEXT NOT NULL,
    plaid_institution_id TEXT,
    plaid_institution_name TEXT,
    consent_expiration_time TIMESTAMPTZ,
    update_type TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    error_code TEXT,
    error_message TEXT,
    cursor TEXT, -- For transaction sync pagination
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. Create plaid_accounts table
-- Stores individual accounts within each item
-- ============================================
CREATE TABLE IF NOT EXISTS plaid_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    plaid_item_id UUID REFERENCES plaid_items(id) ON DELETE CASCADE,
    plaid_account_id TEXT NOT NULL UNIQUE,
    account_name TEXT,
    account_official_name TEXT,
    account_type TEXT, -- checking, savings, credit, loan, investment, etc.
    account_subtype TEXT,
    account_mask TEXT, -- Last 4 digits
    current_balance NUMERIC,
    available_balance NUMERIC,
    credit_limit NUMERIC,
    currency TEXT DEFAULT 'USD',
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 3. Modify transactions table
-- Add Plaid-specific columns
-- ============================================
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS plaid_transaction_id TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS plaid_account_id TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'file_upload';

-- Add constraint for source column (if not exists, handle gracefully)
DO $$ 
BEGIN
    ALTER TABLE transactions ADD CONSTRAINT transactions_source_check 
        CHECK (source IN ('file_upload', 'plaid'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create unique index on plaid_transaction_id (allows NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_plaid_transaction_id_unique 
    ON transactions(plaid_transaction_id) 
    WHERE plaid_transaction_id IS NOT NULL;

-- ============================================
-- 4. Create indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_plaid_items_user_id ON plaid_items(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_status ON plaid_items(status);
CREATE INDEX IF NOT EXISTS idx_plaid_items_institution ON plaid_items(plaid_institution_id);

CREATE INDEX IF NOT EXISTS idx_plaid_accounts_user_id ON plaid_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_accounts_plaid_item_id ON plaid_accounts(plaid_item_id);
CREATE INDEX IF NOT EXISTS idx_plaid_accounts_type ON plaid_accounts(account_type);

CREATE INDEX IF NOT EXISTS idx_transactions_plaid_account_id ON transactions(plaid_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(source);

-- ============================================
-- 5. Enable Row Level Security
-- ============================================
ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_accounts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. RLS Policies
-- ============================================
DROP POLICY IF EXISTS "Allow all operations on plaid_items" ON plaid_items;
CREATE POLICY "Allow all operations on plaid_items" ON plaid_items FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on plaid_accounts" ON plaid_accounts;
CREATE POLICY "Allow all operations on plaid_accounts" ON plaid_accounts FOR ALL USING (true);

-- ============================================
-- 7. Update trigger for updated_at columns
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_plaid_items_updated_at ON plaid_items;
CREATE TRIGGER update_plaid_items_updated_at
    BEFORE UPDATE ON plaid_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plaid_accounts_updated_at ON plaid_accounts;
CREATE TRIGGER update_plaid_accounts_updated_at
    BEFORE UPDATE ON plaid_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
