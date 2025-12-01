-- Migration: Add suggested_actions column to transactions table
-- This column will store LLM-generated action suggestions for transactions needing clarification

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS suggested_actions text[];

-- Add comment to document the column
COMMENT ON COLUMN transactions.suggested_actions IS 'LLM-generated action suggestions for transactions needing clarification (2-4 contextual actions)';

