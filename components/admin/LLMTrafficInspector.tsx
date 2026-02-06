'use client';

import { useEffect, useState } from 'react';
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

export default function LLMTrafficInspector() {
  const [events, setEvents] = useState<LLMEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<LLMEvent | null>(null);
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
          setEvents((prev) => [newEvent, ...prev].slice(0, 200)); // Keep last 200
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
  
  // Group by session
  const eventsBySession = filteredEvents.reduce((acc, event) => {
    if (!acc[event.session_id]) acc[event.session_id] = [];
    acc[event.session_id].push(event);
    return acc;
  }, {} as Record<string, LLMEvent[]>);
  
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
          Showing {filteredEvents.length} events
        </div>
      </div>
      
      {/* Event List */}
      <div className="max-h-[600px] overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading events...</div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No events found</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {Object.entries(eventsBySession).map(([sessionId, sessionEvents]) => (
              <div key={sessionId} className="p-4 hover:bg-gray-50">
                {sessionEvents.map((event, idx) => (
                  <div
                    key={event.id}
                    className={`${idx > 0 ? 'ml-6 mt-2 pt-2 border-t border-gray-100' : ''} cursor-pointer`}
                    onClick={() => setSelectedEvent(event)}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          FLOW_COLORS[event.flow_name] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {event.flow_name}
                      </span>
                      
                      <span className="text-xs font-medium text-gray-700">
                        {event.event_type === 'llm_call' ? '🤖 LLM Call' : '🔧 Tool Call'}
                      </span>
                      
                      {event.event_type === 'tool_call' && (
                        <span className="text-xs text-gray-600">
                          {event.tool_name}
                        </span>
                      )}
                      
                      {event.has_attachments && (
                        <span className="text-xs" title={event.attachment_type || 'attachment'}>
                          📎
                        </span>
                      )}
                      
                      <span className="ml-auto text-xs text-gray-500">
                        {getRelativeTime(event.created_at)}
                      </span>
                      
                      {event.duration_ms && (
                        <span className="text-xs text-gray-500">
                          {event.duration_ms}ms
                        </span>
                      )}
                    </div>
                    
                    {event.user_id && (
                      <div className="mt-1 text-xs text-gray-500">
                        User: {event.user_id.substring(0, 8)}...
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
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
                  <span className="font-medium text-gray-700">Duration:</span> {selectedEvent.duration_ms}ms
                </div>
                <div>
                  <span className="font-medium text-gray-700">Time:</span> {new Date(selectedEvent.created_at).toLocaleString()}
                </div>
              </div>
              
              {/* LLM Call Details */}
              {selectedEvent.event_type === 'llm_call' && (
                <>
                  {selectedEvent.model && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Model</span>
                      </div>
                      <div className="text-sm text-gray-900">{selectedEvent.model}</div>
                    </div>
                  )}
                  
                  {selectedEvent.system_prompt && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">System Prompt</span>
                        <button
                          onClick={() => copyToClipboard(selectedEvent.system_prompt || '')}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto whitespace-pre-wrap">
                        {selectedEvent.system_prompt}
                      </pre>
                    </div>
                  )}
                  
                  {selectedEvent.user_message && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">User Message</span>
                        <button
                          onClick={() => copyToClipboard(selectedEvent.user_message || '')}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto whitespace-pre-wrap">
                        {selectedEvent.user_message}
                      </pre>
                    </div>
                  )}
                  
                  {selectedEvent.has_attachments && (
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Attachment:</span> {selectedEvent.attachment_type}
                    </div>
                  )}
                  
                  {selectedEvent.llm_result && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">LLM Result</span>
                        <button
                          onClick={() => copyToClipboard(selectedEvent.llm_result || '')}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto whitespace-pre-wrap">
                        {selectedEvent.llm_result}
                      </pre>
                    </div>
                  )}
                </>
              )}
              
              {/* Tool Call Details */}
              {selectedEvent.event_type === 'tool_call' && (
                <>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Tool Name:</span>
                    <div className="text-sm text-gray-900 mt-1">{selectedEvent.tool_name}</div>
                  </div>
                  
                  {selectedEvent.tool_arguments && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Arguments</span>
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(selectedEvent.tool_arguments, null, 2))}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto">
                        {JSON.stringify(selectedEvent.tool_arguments, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {selectedEvent.tool_result && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Result</span>
                        <button
                          onClick={() => copyToClipboard(selectedEvent.tool_result || '')}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto whitespace-pre-wrap">
                        {selectedEvent.tool_result}
                      </pre>
                    </div>
                  )}
                  
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
