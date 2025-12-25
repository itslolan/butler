import { NextRequest } from 'next/server';
import { supabase } from './supabase';
import { truncateEventDetails } from './encryption';

/**
 * Audit Logger - Memory-Safe Implementation
 * 
 * Logs critical user actions for security and transparency.
 * Fire-and-forget design prevents memory leaks and doesn't block requests.
 */

export type AuditEventType =
  | 'user.login'
  | 'user.login.failed'
  | 'user.logout'
  | 'upload.created'
  | 'upload.completed'
  | 'upload.deleted'
  | 'plaid.connected'
  | 'plaid.disconnected'
  | 'plaid.refresh'
  | 'data.exported'
  | 'account.deleted'
  | 'account.settings.changed';

export type AuditEventCategory = 'auth' | 'data' | 'account' | 'security';
export type AuditEventStatus = 'success' | 'failure' | 'warning';

export interface AuditLog {
  id: string;
  user_id: string;
  event_type: AuditEventType;
  event_category: AuditEventCategory;
  event_details: any;
  ip_address?: string | null;
  user_agent?: string | null;
  status: AuditEventStatus;
  created_at: string;
}

/**
 * Get event category from event type
 */
function getEventCategory(eventType: AuditEventType): AuditEventCategory {
  if (eventType.startsWith('user.')) return 'auth';
  if (eventType.startsWith('upload.') || eventType.startsWith('data.')) return 'data';
  if (eventType.startsWith('plaid.')) return 'account';
  return 'security';
}

/**
 * Extract IP address from request headers
 * Supports various proxy headers
 */
function getIpFromRequest(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') || // Cloudflare
    req.headers.get('fastly-client-ip') || // Fastly
    req.headers.get('x-client-ip') ||
    null
  );
}

/**
 * Extract user agent from request headers
 */
function getUserAgentFromRequest(req: NextRequest): string | null {
  return req.headers.get('user-agent') || null;
}

/**
 * Log an audit event
 * 
 * Fire-and-forget implementation:
 * - Does not await the database write
 * - Catches and logs errors silently
 * - Never blocks the calling function
 * - No in-memory buffering
 * 
 * @param userId - User ID performing the action
 * @param eventType - Type of event
 * @param details - Additional event details (will be truncated if too large)
 * @param status - Event status (success, failure, warning)
 * @param ipAddress - Optional IP address
 * @param userAgent - Optional user agent
 */
export function logEvent(
  userId: string,
  eventType: AuditEventType,
  details?: any,
  status: AuditEventStatus = 'success',
  ipAddress?: string | null,
  userAgent?: string | null
): void {
  // Fire-and-forget: don't await, don't block
  Promise.resolve().then(async () => {
    try {
      // Truncate details to prevent huge JSONB objects
      const truncatedDetails = details ? truncateEventDetails(details) : {};
      
      const { error } = await supabase.from('audit_logs').insert({
        user_id: userId,
        event_type: eventType,
        event_category: getEventCategory(eventType),
        event_details: truncatedDetails,
        ip_address: ipAddress || null,
        user_agent: userAgent ? userAgent.substring(0, 500) : null, // Limit user agent length
        status,
      });
      
      if (error) {
        // Log error but don't throw - audit logging failures shouldn't crash the app
        console.error('[audit-logger] Failed to log event:', {
          eventType,
          userId,
          error: error.message,
        });
      }
    } catch (err) {
      // Silently catch any errors to prevent memory leaks or crashes
      console.error('[audit-logger] Unexpected error logging event:', err);
    }
  }).catch(() => {
    // Final catch to ensure no unhandled promise rejections
  });
}

/**
 * Log an audit event from a Next.js request
 * Automatically extracts IP and user agent
 * 
 * @param req - Next.js request object
 * @param userId - User ID performing the action
 * @param eventType - Type of event
 * @param details - Additional event details
 * @param status - Event status
 */
export function logFromRequest(
  req: NextRequest,
  userId: string,
  eventType: AuditEventType,
  details?: any,
  status: AuditEventStatus = 'success'
): void {
  const ipAddress = getIpFromRequest(req);
  const userAgent = getUserAgentFromRequest(req);
  
  logEvent(userId, eventType, details, status, ipAddress, userAgent);
}

/**
 * Get audit logs for a user
 * 
 * @param userId - User ID to get logs for
 * @param limit - Maximum number of logs to return (default: 50)
 * @param offset - Offset for pagination (default: 0)
 * @returns Array of audit logs
 */
export async function getAuditLogs(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<AuditLog[]> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('[audit-logger] Failed to fetch audit logs:', error);
      return [];
    }
    
    return (data || []) as AuditLog[];
  } catch (err) {
    console.error('[audit-logger] Unexpected error fetching audit logs:', err);
    return [];
  }
}

/**
 * Get audit log count for a user
 * 
 * @param userId - User ID to count logs for
 * @returns Total number of logs
 */
export async function getAuditLogCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    if (error) {
      console.error('[audit-logger] Failed to count audit logs:', error);
      return 0;
    }
    
    return count || 0;
  } catch (err) {
    console.error('[audit-logger] Unexpected error counting audit logs:', err);
    return 0;
  }
}

/**
 * Get recent failed login attempts for security monitoring
 * 
 * @param limit - Maximum number of attempts to return
 * @returns Array of failed login attempts
 */
export async function getRecentFailedLogins(limit: number = 10): Promise<AuditLog[]> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('event_type', 'user.login.failed')
      .eq('status', 'failure')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('[audit-logger] Failed to fetch failed logins:', error);
      return [];
    }
    
    return (data || []) as AuditLog[];
  } catch (err) {
    console.error('[audit-logger] Unexpected error fetching failed logins:', err);
    return [];
  }
}

