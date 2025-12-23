-- Fixed Expenses Incremental State Tables
-- Stores per-user ingestion coverage and per-merchant recurrence state
-- so fixed-expense detection can be updated incrementally.

-- 1) Per-user state (what dates we have coverage through, and cursor for incremental processing)
CREATE TABLE IF NOT EXISTS fixed_expense_user_state (
    user_id TEXT PRIMARY KEY,
    -- The latest transaction "date" we have ingested for this user.
    -- IMPORTANT: Use this for overdue/inactive evaluation; never compare to "today"
    -- when data ingestion is stale.
    data_coverage_end_date DATE,
    -- Cursor for incremental processing: latest created_at we have processed from transactions
    last_processed_created_at TIMESTAMPTZ,
    -- When we last observed any new transactions for this user
    last_ingestion_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fixed_expense_user_state_coverage ON fixed_expense_user_state(data_coverage_end_date);

-- 2) Per-merchant recurrence + classification state
CREATE TABLE IF NOT EXISTS fixed_expense_merchant_state (
    user_id TEXT NOT NULL,
    merchant_key TEXT NOT NULL,
    merchant_name TEXT NOT NULL,

    -- Bounded occurrence history for efficient re-scoring (JSON array)
    -- Each element: { id, date, amount, description, merchant }
    occurrences JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Derived stats
    occurrence_count INTEGER NOT NULL DEFAULT 0,
    months_tracked INTEGER NOT NULL DEFAULT 0,
    median_interval_days INTEGER NOT NULL DEFAULT 0,
    interval_cv NUMERIC NOT NULL DEFAULT 0,
    day_concentration TEXT NOT NULL DEFAULT '',
    amount_mean NUMERIC NOT NULL DEFAULT 0,
    amount_rstd NUMERIC NOT NULL DEFAULT 0,
    flags JSONB NOT NULL DEFAULT '[]'::jsonb,

    first_occurrence_date DATE,
    last_occurrence_date DATE,
    avg_day_of_month INTEGER,

    -- Monthly amount estimate used by UI
    monthly_amount NUMERIC NOT NULL DEFAULT 0,

    -- Status evaluation (based on data_coverage_end_date, not wall-clock time)
    expected_next_date DATE,
    grace_days INTEGER NOT NULL DEFAULT 7,
    status TEXT NOT NULL DEFAULT 'unknown_no_data'
      CHECK (status IN ('active', 'overdue', 'inactive', 'unknown_no_data')),

    -- Classification state (LLM-driven)
    label TEXT NOT NULL DEFAULT 'unclassified'
      CHECK (label IN ('fixed', 'not_fixed', 'maybe', 'unclassified')),
    confidence NUMERIC,
    llm_reasoning_score NUMERIC,
    explain TEXT,
    primary_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    classifier_version TEXT NOT NULL DEFAULT 'v1',
    classified_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, merchant_key)
);

CREATE INDEX IF NOT EXISTS idx_fixed_expense_merchant_state_user_id ON fixed_expense_merchant_state(user_id);
CREATE INDEX IF NOT EXISTS idx_fixed_expense_merchant_state_status ON fixed_expense_merchant_state(user_id, status);
CREATE INDEX IF NOT EXISTS idx_fixed_expense_merchant_state_label ON fixed_expense_merchant_state(user_id, label);

-- Enable Row Level Security
ALTER TABLE fixed_expense_user_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_expense_merchant_state ENABLE ROW LEVEL SECURITY;

-- RLS Policies (consistent with rest of repo: allow all; tighten later)
CREATE POLICY "Allow all operations on fixed_expense_user_state"
  ON fixed_expense_user_state FOR ALL USING (true);

CREATE POLICY "Allow all operations on fixed_expense_merchant_state"
  ON fixed_expense_merchant_state FOR ALL USING (true);

-- updated_at trigger function might already exist (update_updated_at_column)
-- Add triggers for updated_at if function exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS update_fixed_expense_user_state_updated_at ON fixed_expense_user_state;
    CREATE TRIGGER update_fixed_expense_user_state_updated_at
      BEFORE UPDATE ON fixed_expense_user_state
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_fixed_expense_merchant_state_updated_at ON fixed_expense_merchant_state;
    CREATE TRIGGER update_fixed_expense_merchant_state_updated_at
      BEFORE UPDATE ON fixed_expense_merchant_state
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

