-- Migration: Background processing jobs queue
-- Creates processing_jobs table, indexes, RLS policies, and atomic claim function.

-- 1. Create processing_jobs table
CREATE TABLE IF NOT EXISTS processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    upload_id UUID REFERENCES uploads(id) ON DELETE CASCADE,
    bucket TEXT NOT NULL DEFAULT 'statements',
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    priority INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    progress JSONB NOT NULL DEFAULT '{}'::jsonb,
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    worker_id TEXT
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status_priority_created
  ON processing_jobs(status, priority DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_user_id
  ON processing_jobs(user_id);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_upload_id
  ON processing_jobs(upload_id);

-- 3. RLS
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own processing jobs" ON processing_jobs;
DROP POLICY IF EXISTS "Users can insert own processing jobs" ON processing_jobs;
DROP POLICY IF EXISTS "Users can update own processing jobs" ON processing_jobs;
DROP POLICY IF EXISTS "Users can delete own processing jobs" ON processing_jobs;

CREATE POLICY "Users can view own processing jobs"
  ON processing_jobs FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own processing jobs"
  ON processing_jobs FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own processing jobs"
  ON processing_jobs FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own processing jobs"
  ON processing_jobs FOR DELETE
  USING (auth.uid()::text = user_id);

-- 4. Atomic job claim function (SKIP LOCKED)
-- Note: This is primarily intended for the background worker.
CREATE OR REPLACE FUNCTION claim_next_job(worker_id TEXT)
RETURNS processing_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job processing_jobs;
BEGIN
  UPDATE processing_jobs
  SET status = 'processing',
      started_at = NOW(),
      worker_id = claim_next_job.worker_id,
      attempts = attempts + 1
  WHERE id = (
    SELECT id
    FROM processing_jobs
    WHERE status = 'pending'
      AND attempts < max_attempts
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO job;

  RETURN job;
END;
$$;
