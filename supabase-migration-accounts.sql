-- Migration: Unified Accounts Table for Screenshot Support
-- This creates a unified accounts table and adds supporting columns to documents/transactions

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Create unified accounts table
-- Single source of truth for all user accounts
-- ============================================
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    display_name TEXT NOT NULL,              -- What user sees (alias preferred, else official)
    official_name TEXT,                      -- From Plaid/statement (null for manual entry)
    alias TEXT,                              -- User-friendly shorthand (e.g., "My Chase")
    account_number_last4 TEXT,               -- Last 4 digits (key for matching!)
    account_type TEXT,                       -- checking, savings, credit_card, investment, loan
    issuer TEXT,                             -- Bank/institution name
    source TEXT NOT NULL DEFAULT 'manual',   -- 'plaid' | 'statement' | 'manual'
    plaid_account_id TEXT UNIQUE,            -- Link to plaid_accounts if from Plaid
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, display_name)
);

-- Add constraint for source column
DO $$ 
BEGIN
    ALTER TABLE accounts ADD CONSTRAINT accounts_source_check 
        CHECK (source IN ('plaid', 'statement', 'manual'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add constraint for account_type column
DO $$ 
BEGIN
    ALTER TABLE accounts ADD CONSTRAINT accounts_type_check 
        CHECK (account_type IS NULL OR account_type IN ('checking', 'savings', 'credit_card', 'investment', 'loan', 'other'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 2. Create indexes for accounts table
-- ============================================
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_last4 ON accounts(user_id, account_number_last4);
CREATE INDEX IF NOT EXISTS idx_accounts_plaid ON accounts(plaid_account_id) WHERE plaid_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_source ON accounts(user_id, source);
CREATE INDEX IF NOT EXISTS idx_accounts_active ON accounts(user_id, is_active) WHERE is_active = true;

-- ============================================
-- 3. Add columns to documents table
-- For screenshot support and batch tracking
-- ============================================
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'statement';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS pending_account_selection BOOLEAN DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS batch_id UUID;

-- Add constraint for source_type column
DO $$ 
BEGIN
    ALTER TABLE documents ADD CONSTRAINT documents_source_type_check 
        CHECK (source_type IN ('statement', 'screenshot'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Index for pending account selection lookups
CREATE INDEX IF NOT EXISTS idx_documents_pending_account ON documents(user_id, pending_account_selection) 
    WHERE pending_account_selection = true;

-- Index for batch lookups
CREATE INDEX IF NOT EXISTS idx_documents_batch_id ON documents(batch_id) WHERE batch_id IS NOT NULL;

-- ============================================
-- 4. Add account_id to transactions table
-- Nullable for gradual migration
-- ============================================
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);

-- Index for account_id lookups
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id) WHERE account_id IS NOT NULL;

-- ============================================
-- 5. Enable Row Level Security
-- ============================================
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. RLS Policies
-- ============================================
DROP POLICY IF EXISTS "Allow all operations on accounts" ON accounts;
CREATE POLICY "Allow all operations on accounts" ON accounts FOR ALL USING (true);

-- ============================================
-- 7. Update trigger for updated_at column
-- ============================================
DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

