'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';

interface AuditLog {
  id: string;
  user_id: string;
  event_type: string;
  event_category: string;
  event_details: any;
  ip_address?: string | null;
  user_agent?: string | null;
  status: 'success' | 'failure' | 'warning';
  created_at: string;
}

interface ActivityHistoryProps {
  limit?: number;
}

const EVENT_ICONS: Record<string, string> = {
  'user.login': '🔐',
  'user.logout': '🚪',
  'upload.created': '📤',
  'upload.completed': '✅',
  'upload.deleted': '🗑️',
  'plaid.connected': '🏦',
  'plaid.disconnected': '🔌',
  'plaid.refresh': '🔄',
  'account.deleted': '⚠️',
  'account.settings.changed': '⚙️',
};

const EVENT_LABELS: Record<string, string> = {
  'user.login': 'Logged in',
  'user.logout': 'Logged out',
  'upload.created': 'Upload started',
  'upload.completed': 'Upload completed',
  'upload.deleted': 'Data deleted',
  'plaid.connected': 'Bank account connected',
  'plaid.disconnected': 'Bank account disconnected',
  'plaid.refresh': 'Balances refreshed',
  'account.deleted': 'Account deleted',
  'account.settings.changed': 'Settings updated',
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function groupLogsByDate(logs: AuditLog[]): Map<string, AuditLog[]> {
  const groups = new Map<string, AuditLog[]>();
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();

  for (const log of logs) {
    const logDate = new Date(log.created_at);
    const logDateString = logDate.toDateString();

    let groupKey: string;
    if (logDateString === today) {
      groupKey = 'Today';
    } else if (logDateString === yesterday) {
      groupKey = 'Yesterday';
    } else {
      groupKey = logDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(log);
  }

  return groups;
}

export default function ActivityHistory({ limit = 50 }: ActivityHistoryProps) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchLogs = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/audit-logs?limit=${limit}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch activity history');
        }

        const data = await response.json();
        setLogs(data.logs || []);
      } catch (err: any) {
        console.error('Error fetching audit logs:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [user, limit]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 dark:text-red-400">Failed to load activity history</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{error}</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-500 dark:text-slate-400">No activity yet</p>
      </div>
    );
  }

  const groupedLogs = groupLogsByDate(logs);
  const displayLogs = showAll ? logs : logs.slice(0, 10);
  const displayGroups = groupLogsByDate(displayLogs);

  return (
    <div className="space-y-6">
      {Array.from(displayGroups.entries()).map(([dateGroup, groupLogs]) => (
        <div key={dateGroup}>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 sticky top-0 bg-white dark:bg-gray-900 py-2">
            {dateGroup}
          </h3>
          <div className="space-y-2">
            {groupLogs.map(log => {
              const icon = EVENT_ICONS[log.event_type] || '📋';
              const label = EVENT_LABELS[log.event_type] || log.event_type;
              const statusColor =
                log.status === 'success'
                  ? 'text-green-600 dark:text-green-400'
                  : log.status === 'failure'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-yellow-600 dark:text-yellow-400';

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors"
                >
                  <span className="text-2xl flex-shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-medium ${statusColor}`}>{label}</p>
                      <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                    {log.event_details && Object.keys(log.event_details).length > 0 && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {log.event_details.institution_name && `Institution: ${log.event_details.institution_name}`}
                        {log.event_details.accounts_count && ` • ${log.event_details.accounts_count} account(s)`}
                        {log.event_details.upload_name && `Upload: ${log.event_details.upload_name}`}
                        {log.event_details.file_count && ` • ${log.event_details.file_count} file(s)`}
                      </p>
                    )}
                    {log.ip_address && (
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                        IP: {log.ip_address}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {logs.length > 10 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
        >
          {showAll ? 'Show Less' : `Show All (${logs.length} total)`}
        </button>
      )}
    </div>
  );
}

