-- Dashboard Welcome Summary Cache
-- Stores the LLM-generated "welcome summary" so we don't regenerate every load.

CREATE TABLE IF NOT EXISTS dashboard_welcome_summaries (
  user_id TEXT PRIMARY KEY,
  summary_text TEXT NOT NULL,
  model TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_welcome_summaries_user_id
  ON dashboard_welcome_summaries(user_id);

ALTER TABLE dashboard_welcome_summaries ENABLE ROW LEVEL SECURITY;

-- NOTE: This repo currently uses permissive RLS policies in schema/migrations.
-- Tighten later to auth.uid() = user_id once user_id is a UUID and auth is enforced.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dashboard_welcome_summaries'
      AND policyname = 'Allow all operations on dashboard_welcome_summaries'
  ) THEN
    CREATE POLICY "Allow all operations on dashboard_welcome_summaries"
      ON dashboard_welcome_summaries
      FOR ALL
      USING (true);
  END IF;
END $$;

-- Keep updated_at in sync if the helper trigger exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'update_dashboard_welcome_summaries_updated_at'
    ) THEN
      CREATE TRIGGER update_dashboard_welcome_summaries_updated_at
      BEFORE UPDATE ON dashboard_welcome_summaries
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
  END IF;
END $$;

