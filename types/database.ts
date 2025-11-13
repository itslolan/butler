import { ObjectId } from 'mongodb';

export type DocumentType =
  | 'credit_card_statement'
  | 'bank_statement'
  | 'receipt'
  | 'loan_statement'
  | 'investment_statement'
  | 'unknown'
  | (string & {});

export type TransactionType =
  | 'purchase'
  | 'refund'
  | 'payment'
  | 'cash_advance'
  | 'fee'
  | 'interest'
  | (string & {});

export interface ExtractionStatus {
  summary_extracted?: boolean;
  transactions_extracted?: boolean;
  last_extracted_at?: Date;
}

export interface BaseDocument {
  _id?: ObjectId;
  created_at: Date;
  updated_at: Date;
}

export interface DocumentRecord extends BaseDocument {
  user_id?: string;
  document_type?: DocumentType;
  file_path?: string;
  file_name?: string;
  upload_date: Date;
  period_start?: Date;
  period_end?: Date;
  metadata?: Record<string, unknown>;
  extraction_status?: ExtractionStatus;
}

export interface TransactionRecord extends BaseDocument {
  user_id?: string;
  document_id: ObjectId;
  txn_date?: Date;
  posting_date?: Date;
  merchant?: string;
  amount: number;
  category?: string;
  type?: TransactionType;
  is_refund?: boolean;
  is_cash_advance?: boolean;
  is_payment?: boolean;
  metadata?: Record<string, unknown>;
}

export interface StatementSummaryRecord extends BaseDocument {
  user_id?: string;
  document_id: ObjectId;
  period_start?: Date;
  period_end?: Date;
  credit_limit?: number;
  previous_balance?: number;
  payments_total?: number;
  new_balance?: number;
  cash_advances_total?: number;
  utilization_ratio?: number;
  payment_regular?: boolean;
  metrics_computed_at?: Date;
  metadata?: Record<string, unknown>;
}

export interface DerivedMetricsRecord extends BaseDocument {
  user_id?: string;
  computed_at: Date;
  metrics: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface LlmExtractionRecord extends BaseDocument {
  user_id?: string;
  document_id: ObjectId;
  model_name: string;
  output_version?: number;
  raw_output: unknown;
  normalized_output?: Record<string, unknown>;
}

export type CollectionName =
  | 'documents'
  | 'transactions'
  | 'statement_summaries'
  | 'derived_metrics'
  | 'llm_extractions';
