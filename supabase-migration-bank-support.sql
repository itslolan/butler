-- Migration: Add bank statement support
-- Run this if you already have an existing database

-- Add new columns to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_type TEXT 
  CHECK (transaction_type IN ('income', 'expense', 'transfer', 'other'));
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS needs_clarification BOOLEAN DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS clarification_question TEXT;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_needs_clarification ON transactions(needs_clarification) 
  WHERE needs_clarification = true;

-- Create account_snapshots table
CREATE TABLE IF NOT EXISTS account_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    account_name TEXT NOT NULL,
    snapshot_date DATE NOT NULL,
    snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('month_start', 'month_end')),
    balance NUMERIC NOT NULL,
    document_id UUID REFERENCES documents(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, account_name, snapshot_date, snapshot_type)
);

-- Indexes for account_snapshots
CREATE INDEX IF NOT EXISTS idx_snapshots_user_account ON account_snapshots(user_id, account_name);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON account_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_snapshots_user_date ON account_snapshots(user_id, snapshot_date);

-- Enable RLS on account_snapshots
ALTER TABLE account_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policy for account_snapshots
-- Drop existing policy if it exists, then create new one
DROP POLICY IF EXISTS "Allow all operations on account_snapshots" ON account_snapshots;
CREATE POLICY "Allow all operations on account_snapshots" ON account_snapshots FOR ALL USING (true);

