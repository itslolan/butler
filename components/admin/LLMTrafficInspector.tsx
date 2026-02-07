'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';

interface LLMEvent {
  id: string;
  session_id: string;
  user_id: string | null;
  flow_name: string;
  event_type: 'llm_call' | 'tool_call';
  model: string | null;
  system_prompt: string | null;
  user_message: string | null;
  llm_result: string | null;
  has_attachments: boolean;
  attachment_type: string | null;
  tool_name: string | null;
  tool_arguments: any;
  tool_result: string | null;
  tool_error: string | null;
  duration_ms: number | null;
  created_at: string;
}

interface SessionGroup {
  sessionId: string;
  events: LLMEvent[];
  /** Timestamp of the earliest event in the session */
  startedAt: string;
  /** Timestamp of the most recent event in the session */
  lastEventAt: string;
  /** Primary flow name (from first event) */
  flowName: string;
  /** User ID (from first event that has one) */
  userId: string | null;
  /** Total duration across all events */
  totalDurationMs: number;
  /** Count of LLM calls */
  llmCallCount: number;
  /** Count of tool calls */
  toolCallCount: number;
  /** Whether any event has an error */
  hasError: boolean;
}

const FLOW_COLORS: Record<string, string> = {
  chat: 'bg-blue-100 text-blue-800',
  statement_parsing: 'bg-green-100 text-green-800',
  statement_parsing_stream: 'bg-emerald-100 text-emerald-800',
  budget_auto_assign: 'bg-purple-100 text-purple-800',
  transaction_categorization: 'bg-yellow-100 text-yellow-800',
  fixed_expense_tagging: 'bg-orange-100 text-orange-800',
  fixed_expense_classification: 'bg-amber-100 text-amber-800',
  fixed_expense_input_matching: 'bg-rose-100 text-rose-800',
  subscription_tagging: 'bg-pink-100 text-pink-800',
  welcome_summary: 'bg-indigo-100 text-indigo-800',
  action_generation: 'bg-cyan-100 text-cyan-800',
  memory_conflict_detection: 'bg-teal-100 text-teal-800',
  memory_extraction: 'bg-lime-100 text-lime-800',
  job_processing: 'bg-violet-100 text-violet-800',
};

function truncate(text: string | null | undefined, maxLen: number): string {
  if (!text) return '—';
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen) + '…';
}

export default function LLMTrafficInspector() {
  const [events, setEvents] = useState<LLMEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<LLMEvent | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [filterFlow, setFilterFlow] = useState<string>('');
  const [filterEventType, setFilterEventType] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Get unique flow names for filter
  const uniqueFlows = Array.from(new Set(events.map(e => e.flow_name))).sort();

  // Fetch initial events
  useEffect(() => {
    fetchEvents();
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    const supabase = createClient();
    
    if (!supabase) return;

    const channel = supabase
      .channel('llm_events_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'llm_events',
        },
        (payload) => {
          const newEvent = payload.new as LLMEvent;
          setEvents((prev) => [newEvent, ...prev].slice(0, 200));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchEvents() {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/llm-events?limit=100');
      if (!response.ok) throw new Error('Failed to fetch events');
      const data = await response.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  }

  // Filter events
  const filteredEvents = events.filter((event) => {
    if (filterFlow && event.flow_name !== filterFlow) return false;
    if (filterEventType && event.event_type !== filterEventType) return false;
    return true;
  });

  // Group filtered events into sessions, sorted by most recent activity
  const sessionGroups: SessionGroup[] = useMemo(() => {
    const groupMap: Record<string, LLMEvent[]> = {};
    for (const event of filteredEvents) {
      if (!groupMap[event.session_id]) groupMap[event.session_id] = [];
      groupMap[event.session_id].push(event);
    }

    const groups: SessionGroup[] = Object.entries(groupMap).map(([sessionId, sessionEvents]) => {
      // Sort events within session chronologically (oldest first)
      const sorted = [...sessionEvents].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const firstEvent = sorted[0];
      const lastEvent = sorted[sorted.length - 1];
      const userId = sorted.find(e => e.user_id)?.user_id ?? null;

      return {
        sessionId,
        events: sorted,
        startedAt: firstEvent.created_at,
        lastEventAt: lastEvent.created_at,
        flowName: firstEvent.flow_name,
        userId,
        totalDurationMs: sorted.reduce((sum, e) => sum + (e.duration_ms || 0), 0),
        llmCallCount: sorted.filter(e => e.event_type === 'llm_call').length,
        toolCallCount: sorted.filter(e => e.event_type === 'tool_call').length,
        hasError: sorted.some(e => !!e.tool_error),
      };
    });

    // Sort sessions by most recent activity (newest first)
    groups.sort((a, b) => new Date(b.lastEventAt).getTime() - new Date(a.lastEventAt).getTime());
    return groups;
  }, [filteredEvents]);

  function toggleSession(sessionId: string) {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }

  function getRelativeTime(timestamp: string) {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return `${Math.floor(diffHour / 24)}d ago`;
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Filters */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Flow Name
            </label>
            <select
              value={filterFlow}
              onChange={(e) => setFilterFlow(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">All Flows</option>
              {uniqueFlows.map((flow) => (
                <option key={flow} value={flow}>
                  {flow}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Type
            </label>
            <select
              value={filterEventType}
              onChange={(e) => setFilterEventType(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">All Types</option>
              <option value="llm_call">LLM Call</option>
              <option value="tool_call">Tool Call</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchEvents}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-2 text-sm text-gray-600">
          {sessionGroups.length} sessions · {filteredEvents.length} events
        </div>
      </div>

      {/* Session Accordion List */}
      <div className="max-h-[600px] overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading events...</div>
        ) : sessionGroups.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No events found</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {sessionGroups.map((session) => {
              const isExpanded = expandedSessions.has(session.sessionId);
              return (
                <div key={session.sessionId}>
                  {/* Session header row (click to expand/collapse) */}
                  <div
                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer select-none"
                    onClick={() => toggleSession(session.sessionId)}
                  >
                    <div className="flex items-center gap-2">
                      {/* Chevron */}
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>

                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          FLOW_COLORS[session.flowName] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {session.flowName}
                      </span>

                      <span className="text-xs text-gray-600">
                        {session.llmCallCount > 0 && (
                          <span className="mr-2">🤖 {session.llmCallCount}</span>
                        )}
                        {session.toolCallCount > 0 && (
                          <span>🔧 {session.toolCallCount}</span>
                        )}
                      </span>

                      {session.hasError && (
                        <span className="text-xs text-red-600 font-medium">ERROR</span>
                      )}

                      <span className="ml-auto text-xs text-gray-500">
                        {getRelativeTime(session.lastEventAt)}
                      </span>

                      <span className="text-xs text-gray-400">
                        {session.totalDurationMs}ms total
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-400 ml-6">
                      {session.userId && (
                        <span>User: {session.userId.substring(0, 8)}…</span>
                      )}
                      <span className="font-mono">
                        {session.sessionId.substring(0, 8)}…
                      </span>
                      <span>
                        {session.events.length} event{session.events.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Expanded events */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50">
                      {session.events.map((event, idx) => (
                        <div
                          key={event.id}
                          className={`px-4 py-3 ml-6 cursor-pointer hover:bg-gray-100 ${
                            idx < session.events.length - 1 ? 'border-b border-gray-100' : ''
                          }`}
                          onClick={() => setSelectedEvent(event)}
                        >
                          {/* Event row header */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 font-mono w-5 text-right flex-shrink-0">
                              {idx + 1}.
                            </span>

                            <span className="text-xs font-medium text-gray-700">
                              {event.event_type === 'llm_call' ? '🤖 LLM Call' : '🔧 Tool Call'}
                            </span>

                            {event.event_type === 'llm_call' && event.model && (
                              <span className="text-xs text-gray-500 font-mono">
                                {event.model}
                              </span>
                            )}

                            {event.event_type === 'tool_call' && event.tool_name && (
                              <span className="text-xs text-gray-600 font-mono">
                                {event.tool_name}
                              </span>
                            )}

                            {event.has_attachments && (
                              <span className="text-xs" title={event.attachment_type || 'attachment'}>
                                📎
                              </span>
                            )}

                            {event.tool_error && (
                              <span className="text-xs text-red-600 font-medium">ERROR</span>
                            )}

                            <span className="ml-auto text-xs text-gray-500">
                              {getRelativeTime(event.created_at)}
                            </span>

                            {event.duration_ms != null && (
                              <span className="text-xs text-gray-500">
                                {event.duration_ms}ms
                              </span>
                            )}
                          </div>

                          {/* Self-contained input/output preview */}
                          {event.event_type === 'llm_call' && (
                            <div className="mt-2 ml-7 space-y-1">
                              <div className="text-xs text-gray-500">
                                <span className="font-medium text-gray-600">Input:</span>{' '}
                                {truncate(event.user_message, 120)}
                              </div>
                              <div className="text-xs text-gray-500">
                                <span className="font-medium text-gray-600">Output:</span>{' '}
                                {truncate(event.llm_result, 120)}
                              </div>
                            </div>
                          )}

                          {event.event_type === 'tool_call' && (
                            <div className="mt-2 ml-7 space-y-1">
                              <div className="text-xs text-gray-500">
                                <span className="font-medium text-gray-600">Args:</span>{' '}
                                {truncate(
                                  event.tool_arguments ? JSON.stringify(event.tool_arguments) : null,
                                  120
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                <span className="font-medium text-gray-600">Result:</span>{' '}
                                {event.tool_error ? (
                                  <span className="text-red-600">{truncate(event.tool_error, 120)}</span>
                                ) : (
                                  truncate(event.tool_result, 120)
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedEvent.event_type === 'llm_call' ? 'LLM Call Details' : 'Tool Call Details'}
              </h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Flow:</span>{' '}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${FLOW_COLORS[selectedEvent.flow_name] || 'bg-gray-100 text-gray-800'}`}>
                    {selectedEvent.flow_name}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Type:</span> {selectedEvent.event_type}
                </div>
                <div>
                  <span className="font-medium text-gray-700">Duration:</span>{' '}
                  {selectedEvent.duration_ms != null ? `${selectedEvent.duration_ms}ms` : '—'}
                </div>
                <div>
                  <span className="font-medium text-gray-700">Time:</span>{' '}
                  {new Date(selectedEvent.created_at).toLocaleString()}
                </div>
                {selectedEvent.user_id && (
                  <div>
                    <span className="font-medium text-gray-700">User:</span>{' '}
                    <span className="font-mono text-xs">{selectedEvent.user_id}</span>
                  </div>
                )}
                <div>
                  <span className="font-medium text-gray-700">Session:</span>{' '}
                  <span className="font-mono text-xs">{selectedEvent.session_id}</span>
                </div>
              </div>

              {/* LLM Call Details — always show all fields */}
              {selectedEvent.event_type === 'llm_call' && (
                <>
                  <div>
                    <div className="mb-1">
                      <span className="text-sm font-medium text-gray-700">Model</span>
                    </div>
                    <div className="text-sm text-gray-900 font-mono">
                      {selectedEvent.model || <span className="text-gray-400 italic">Not logged</span>}
                    </div>
                  </div>

                  <DetailSection
                    label="System Prompt"
                    content={selectedEvent.system_prompt}
                    onCopy={copyToClipboard}
                  />

                  <DetailSection
                    label="User Message"
                    content={selectedEvent.user_message}
                    onCopy={copyToClipboard}
                  />

                  {selectedEvent.has_attachments && (
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Attachment:</span>{' '}
                      {selectedEvent.attachment_type || 'Unknown type'}
                    </div>
                  )}

                  <DetailSection
                    label="LLM Result"
                    content={selectedEvent.llm_result}
                    onCopy={copyToClipboard}
                  />
                </>
              )}

              {/* Tool Call Details — always show all fields */}
              {selectedEvent.event_type === 'tool_call' && (
                <>
                  <div>
                    <div className="mb-1">
                      <span className="text-sm font-medium text-gray-700">Tool Name</span>
                    </div>
                    <div className="text-sm text-gray-900 font-mono">
                      {selectedEvent.tool_name || <span className="text-gray-400 italic">Not logged</span>}
                    </div>
                  </div>

                  <DetailSection
                    label="Arguments"
                    content={
                      selectedEvent.tool_arguments
                        ? JSON.stringify(selectedEvent.tool_arguments, null, 2)
                        : null
                    }
                    onCopy={copyToClipboard}
                  />

                  <DetailSection
                    label="Result"
                    content={selectedEvent.tool_result}
                    onCopy={copyToClipboard}
                  />

                  {selectedEvent.tool_error && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-red-700">Error</span>
                        <button
                          onClick={() => copyToClipboard(selectedEvent.tool_error || '')}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="text-xs bg-red-50 p-3 rounded border border-red-200 overflow-x-auto text-red-900 whitespace-pre-wrap">
                        {selectedEvent.tool_error}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Reusable section for displaying a text field with copy button. Always rendered even when content is null. */
function DetailSection({
  label,
  content,
  onCopy,
}: {
  label: string;
  content: string | null | undefined;
  onCopy: (text: string) => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {content && (
          <button
            onClick={() => onCopy(content)}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Copy
          </button>
        )}
      </div>
      {content ? (
        <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto whitespace-pre-wrap max-h-80 overflow-y-auto">
          {content}
        </pre>
      ) : (
        <div className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded border border-gray-200">
          Not logged
        </div>
      )}
    </div>
  );
}
