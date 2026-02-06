import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

// Use service role key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export function createLLMSession(): string {
  return uuidv4();
}

interface LogLLMCallParams {
  sessionId: string;
  userId?: string;
  flowName: string;
  model?: string;
  systemPrompt?: string;
  userMessage?: string;
  llmResult?: string;
  hasAttachments?: boolean;
  attachmentType?: string;
  durationMs?: number;
}

export async function logLLMCall(params: LogLLMCallParams): Promise<void> {
  try {
    // Fire-and-forget: don't await, catch errors silently
    supabase
      .from('llm_events')
      .insert({
        session_id: params.sessionId,
        user_id: params.userId,
        flow_name: params.flowName,
        event_type: 'llm_call',
        model: params.model,
        system_prompt: params.systemPrompt,
        user_message: params.userMessage,
        llm_result: params.llmResult,
        has_attachments: params.hasAttachments || false,
        attachment_type: params.attachmentType,
        duration_ms: params.durationMs,
      })
      .then(() => {
        // Success - do nothing
      })
      .catch((error) => {
        // Silently swallow errors to not affect user flows
        console.error('[LLM Logger] Failed to log LLM call:', error);
      });
  } catch (error) {
    // Catch synchronous errors
    console.error('[LLM Logger] Error in logLLMCall:', error);
  }
}

interface LogToolCallParams {
  sessionId: string;
  userId?: string;
  flowName: string;
  toolName: string;
  toolArguments?: any;
  toolResult?: string;
  toolError?: string;
  durationMs?: number;
}

export async function logToolCall(params: LogToolCallParams): Promise<void> {
  try {
    // Fire-and-forget: don't await, catch errors silently
    supabase
      .from('llm_events')
      .insert({
        session_id: params.sessionId,
        user_id: params.userId,
        flow_name: params.flowName,
        event_type: 'tool_call',
        tool_name: params.toolName,
        tool_arguments: params.toolArguments,
        tool_result: params.toolResult,
        tool_error: params.toolError,
        duration_ms: params.durationMs,
      })
      .then(() => {
        // Success - do nothing
      })
      .catch((error) => {
        // Silently swallow errors to not affect user flows
        console.error('[LLM Logger] Failed to log tool call:', error);
      });
  } catch (error) {
    // Catch synchronous errors
    console.error('[LLM Logger] Error in logToolCall:', error);
  }
}
