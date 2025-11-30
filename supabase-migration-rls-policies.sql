-- Update RLS Policies to Enforce User Isolation
-- Run this in Supabase SQL Editor after authentication is set up

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow all operations on documents" ON documents;
DROP POLICY IF EXISTS "Allow all operations on transactions" ON transactions;
DROP POLICY IF EXISTS "Allow all operations on user_metadata" ON user_metadata;
DROP POLICY IF EXISTS "Allow all operations on account_snapshots" ON account_snapshots;

-- Documents: Users can only see/modify their own documents
CREATE POLICY "Users can view own documents" 
    ON documents FOR SELECT 
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own documents" 
    ON documents FOR INSERT 
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own documents" 
    ON documents FOR UPDATE 
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own documents" 
    ON documents FOR DELETE 
    USING (auth.uid()::text = user_id);

-- Transactions: Users can only see/modify their own transactions
CREATE POLICY "Users can view own transactions" 
    ON transactions FOR SELECT 
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own transactions" 
    ON transactions FOR INSERT 
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own transactions" 
    ON transactions FOR UPDATE 
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own transactions" 
    ON transactions FOR DELETE 
    USING (auth.uid()::text = user_id);

-- User Metadata: Users can only see/modify their own metadata
CREATE POLICY "Users can view own metadata" 
    ON user_metadata FOR SELECT 
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own metadata" 
    ON user_metadata FOR INSERT 
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own metadata" 
    ON user_metadata FOR UPDATE 
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own metadata" 
    ON user_metadata FOR DELETE 
    USING (auth.uid()::text = user_id);

-- Account Snapshots: Users can only see/modify their own snapshots
CREATE POLICY "Users can view own snapshots" 
    ON account_snapshots FOR SELECT 
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own snapshots" 
    ON account_snapshots FOR INSERT 
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own snapshots" 
    ON account_snapshots FOR UPDATE 
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own snapshots" 
    ON account_snapshots FOR DELETE 
    USING (auth.uid()::text = user_id);

