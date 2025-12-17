-- Fixed Expenses Cache Table
-- Stores pre-calculated fixed expenses for faster dashboard loading

CREATE TABLE IF NOT EXISTS fixed_expenses_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    -- Individual fixed expense entry (one row per fixed expense)
    merchant_name TEXT NOT NULL,
    median_amount NUMERIC NOT NULL,
    occurrence_count INTEGER NOT NULL,
    months_tracked INTEGER NOT NULL,
    avg_day_of_month INTEGER,  -- Average day when this expense occurs
    last_occurrence_date DATE,
    -- Cache metadata
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, merchant_name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_cache_user_id ON fixed_expenses_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_cache_calculated_at ON fixed_expenses_cache(calculated_at);

-- Enable Row Level Security
ALTER TABLE fixed_expenses_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all operations on fixed_expenses_cache" ON fixed_expenses_cache FOR ALL USING (true);

-- Function to automatically update calculated_at timestamp
CREATE OR REPLACE FUNCTION update_fixed_expenses_calculated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.calculated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for calculated_at
DROP TRIGGER IF EXISTS update_fixed_expenses_cache_calculated_at ON fixed_expenses_cache;
CREATE TRIGGER update_fixed_expenses_cache_calculated_at BEFORE UPDATE ON fixed_expenses_cache
    FOR EACH ROW EXECUTE FUNCTION update_fixed_expenses_calculated_at();
