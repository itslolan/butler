-- Migration: Create user_memories table
-- Stores notable memories about the user (salary amounts, spending patterns, etc.)

-- Create user_memories table
CREATE TABLE IF NOT EXISTS user_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for user_id
CREATE INDEX IF NOT EXISTS idx_user_memories_user_id ON user_memories(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;

-- RLS Policy (allow all for now, similar to other tables)
CREATE POLICY "Allow all operations on user_memories" ON user_memories FOR ALL USING (true);

-- Function to automatically update updated_at timestamp
CREATE TRIGGER update_user_memories_updated_at BEFORE UPDATE ON user_memories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

