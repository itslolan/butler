import { createClient, SupabaseClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Please add NEXT_PUBLIC_SUPABASE_URL to .env.local');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Please add SUPABASE_SERVICE_ROLE_KEY to .env.local');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database types
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
}

export interface Transaction {
  id?: string;
  user_id: string;
  document_id?: string | null;
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

