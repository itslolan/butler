import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * IMPORTANT:
 * Do not throw at module import time.
 *
 * Next.js may load/trace route modules during build ("Collecting page data"),
 * and a top-level throw will fail the deployment even if the environment
 * variables are present at runtime or the route is never invoked.
 */
let _supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (_supabase) return _supabase;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }
  if (!supabaseKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  _supabase = createClient(supabaseUrl, supabaseKey);
  return _supabase;
}

// Lazily-initialized client: only errors when actually used.
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseClient() as any)[prop];
  },
});

// Database types

// Upload represents a single upload action (1 or more files uploaded together)
export interface Upload {
  id?: string;
  user_id: string;
  upload_name: string;
  source_type: 'manual_upload' | 'plaid_sync' | 'api';
  status: 'processing' | 'completed' | 'failed';
  uploaded_at?: Date | string;
  created_at?: Date | string;
}

export interface ProcessingJobProgress {
  step?: string;
  message?: string;
  percent?: number;
  [key: string]: any;
}

export interface ProcessingJob {
  id?: string;
  user_id: string;
  upload_id?: string | null;
  bucket: string;
  file_path: string;
  file_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority?: number;
  attempts?: number;
  max_attempts?: number;
  progress?: ProcessingJobProgress;
  result?: Record<string, any> | null;
  error_message?: string | null;
  created_at?: Date | string;
  started_at?: Date | string | null;
  completed_at?: Date | string | null;
  worker_id?: string | null;
}

// Upload with additional computed stats for list views
export interface UploadWithStats extends Upload {
  document_count: number;
  total_transactions: number;
  documents?: DocumentSummary[];
}

// Minimal document info for upload list
export interface DocumentSummary {
  id: string;
  file_name: string;
  document_type: string;
  transaction_count?: number;
}

// Full upload details with documents and transactions
export interface UploadDetails {
  upload: Upload;
  documents: DocumentWithTransactions[];
}

export interface DocumentWithTransactions {
  id: string;
  file_name: string;
  file_url: string;
  document_type: string;
  source_type?: string;
  transactions: Transaction[];
}

export interface Document {
  id?: string;
  user_id: string;
  file_name: string;
  file_url: string;
  uploaded_at?: Date | string;
  document_type: 'bank_statement' | 'credit_card_statement' | 'unknown';
  issuer?: string | null;
  account_id?: string | null;
  account_name?: string | null;
  statement_date?: Date | string | null;
  previous_balance?: number | null;
  new_balance?: number | null;
  credit_limit?: number | null;
  minimum_payment?: number | null;
  due_date?: Date | string | null;
  currency?: string;
  metadata?: Record<string, any>;
  created_at?: Date | string;
  updated_at?: Date | string;
  // Screenshot support fields
  source_type?: 'statement' | 'screenshot';
  pending_account_selection?: boolean;
  batch_id?: string | null;
  // Upload reference
  upload_id?: string | null;
  // Todo dismissal
  is_dismissed?: boolean;
}

export interface Transaction {
  id?: string;
  user_id: string;
  document_id?: string | null;
  account_id?: string | null;  // FK to unified accounts table
  account_name?: string | null;
  date: Date | string;
  merchant: string;
  amount: number;
  category?: string | null;
  description?: string | null;
  transaction_type?: 'income' | 'expense' | 'transfer' | 'other' | null;
  spend_classification?: 'essential' | 'discretionary' | null;
  needs_clarification?: boolean;
  clarification_question?: string | null;
  suggested_actions?: string[] | null;
  currency?: string;
  metadata?: Record<string, any>;
  created_at?: Date | string;
  // Plaid-specific fields
  plaid_transaction_id?: string | null;
  plaid_account_id?: string | null;
  source?: 'file_upload' | 'plaid';
  // Todo dismissal
  is_dismissed?: boolean;
}

export interface AccountSnapshot {
  id?: string;
  user_id: string;
  account_name: string;
  snapshot_date: Date | string;
  snapshot_type: 'month_start' | 'month_end';
  balance: number;
  currency?: string;
  document_id?: string;
  created_at?: Date | string;
}

export interface UserMetadata {
  id?: string;
  user_id: string;
  content: string;
  updated_at?: Date | string;
}

export interface UserMemory {
  id?: string;
  user_id: string;
  content: string;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface BudgetCategory {
  id?: string;
  user_id: string;
  name: string;
  is_custom: boolean;
  display_order?: number;
  created_at?: Date | string;
}

export interface Budget {
  id?: string;
  user_id: string;
  category_id: string;
  month: string; // Format: 'YYYY-MM'
  budgeted_amount: number;
  created_at?: Date | string;
  updated_at?: Date | string;
}

// Plaid Integration Types
export interface PlaidItem {
  id?: string;
  user_id: string;
  plaid_item_id: string;
  plaid_access_token: string;
  plaid_institution_id?: string | null;
  plaid_institution_name?: string | null;
  consent_expiration_time?: Date | string | null;
  update_type?: string | null;
  status?: 'active' | 'inactive' | 'error';
  error_code?: string | null;
  error_message?: string | null;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface PlaidAccount {
  id?: string;
  user_id: string;
  plaid_item_id: string;
  plaid_account_id: string;
  account_name?: string | null;
  account_official_name?: string | null;
  account_type?: string | null;
  account_subtype?: string | null;
  mask?: string | null;
  current_balance?: number | null;
  available_balance?: number | null;
  iso_currency_code?: string | null;
  last_synced_at?: Date | string | null;
  created_at?: Date | string;
  updated_at?: Date | string;
}

// Unified Account type - single source of truth for all user accounts
export interface Account {
  id?: string;
  user_id: string;
  display_name: string;                    // What user sees (alias preferred, else official)
  official_name?: string | null;           // From Plaid/statement (null for manual entry)
  alias?: string | null;                   // User-friendly shorthand (e.g., "My Chase")
  account_number_last4?: string | null;    // Last 4 digits (key for matching!)
  account_type?: 'checking' | 'savings' | 'credit_card' | 'investment' | 'loan' | 'other' | null;
  issuer?: string | null;                  // Bank/institution name
  source: 'plaid' | 'statement' | 'manual';
  plaid_account_id?: string | null;        // Link to plaid_accounts if from Plaid
  is_active?: boolean;
  created_at?: Date | string;
  updated_at?: Date | string;
}

// Account creation input (for creating accounts with sparse info)
export interface CreateAccountInput {
  display_name: string;
  alias?: string;
  account_number_last4?: string;
  account_type?: Account['account_type'];
  issuer?: string;
  source: Account['source'];
  official_name?: string;
  plaid_account_id?: string;
}

// Pending account selection info (for documents needing account assignment)
export interface PendingAccountDocument {
  document_id: string;
  file_name: string;
  transaction_count: number;
  first_transaction_date?: string;
  last_transaction_date?: string;
  batch_id?: string;
}

/**
 * Upload a file to Supabase Storage
 * @param userId - User identifier
 * @param file - File buffer
 * @param fileName - Original file name
 * @returns Public URL of the uploaded file
 */
export async function uploadFile(
  userId: string,
  file: Buffer,
  fileName: string
): Promise<string> {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${userId}/${timestamp}_${sanitizedFileName}`;

  const { data, error } = await supabase.storage
    .from('statements')
    .upload(filePath, file, {
      contentType: 'application/octet-stream',
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload file to Supabase: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('statements')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

