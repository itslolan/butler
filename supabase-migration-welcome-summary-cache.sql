-- Migration: Add latest_transaction_at and date_range_key to dashboard_welcome_summaries
-- This tracks the most recent transaction timestamp when the cache was created,
-- allowing automatic cache invalidation when new transactions are added.
-- Also tracks the date range so we can cache per date range selection.

ALTER TABLE dashboard_welcome_summaries
ADD COLUMN IF NOT EXISTS latest_transaction_at TIMESTAMPTZ;

ALTER TABLE dashboard_welcome_summaries
ADD COLUMN IF NOT EXISTS date_range_key TEXT;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_dashboard_welcome_summaries_latest_txn
ON dashboard_welcome_summaries(user_id, latest_transaction_at);

CREATE INDEX IF NOT EXISTS idx_dashboard_welcome_summaries_date_range
ON dashboard_welcome_summaries(user_id, date_range_key);

COMMENT ON COLUMN dashboard_welcome_summaries.latest_transaction_at IS 
  'Timestamp of the most recent transaction when this cache entry was created. Used to detect when new data has been added.';

COMMENT ON COLUMN dashboard_welcome_summaries.date_range_key IS 
  'Identifies the date range selection (e.g., "month:2026-01", "range:3M", "custom:2025-11-01:2026-01-31"). Used for date-range aware caching.';
