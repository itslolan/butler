-- Migration: Create llm_events table for LLM Traffic Inspector
-- This table logs all LLM calls and tool executions for debugging and monitoring

-- Create llm_events table
CREATE TABLE IF NOT EXISTS llm_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL,
  user_id TEXT,
  flow_name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('llm_call', 'tool_call')),
  
  -- LLM call fields
  model TEXT,
  system_prompt TEXT,
  user_message TEXT,
  llm_result TEXT,
  has_attachments BOOLEAN DEFAULT FALSE,
  attachment_type TEXT,
  
  -- Tool call fields
  tool_name TEXT,
  tool_arguments JSONB,
  tool_result TEXT,
  tool_error TEXT,
  
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_llm_events_created_at ON llm_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_events_session_id ON llm_events(session_id);
CREATE INDEX IF NOT EXISTS idx_llm_events_flow_name ON llm_events(flow_name);
CREATE INDEX IF NOT EXISTS idx_llm_events_user_id ON llm_events(user_id);

-- Comment on table
COMMENT ON TABLE llm_events IS 'Logs all LLM calls and tool executions for the admin LLM Traffic Inspector';

-- No RLS on this table - accessed only by admin via service role
-- Note: Enable Realtime on this table via Supabase Dashboard:
-- Database > Replication > llm_events > Enable
