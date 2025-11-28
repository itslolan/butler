-- Butler Database Schema for Supabase (PostgreSQL)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    document_type TEXT CHECK (document_type IN ('bank_statement', 'credit_card_statement', 'unknown')),
    issuer TEXT,
    account_id TEXT,
    account_name TEXT,
    statement_date DATE,
    previous_balance NUMERIC,
    new_balance NUMERIC,
    credit_limit NUMERIC,
    minimum_payment NUMERIC,
    due_date DATE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    account_name TEXT,
    date DATE NOT NULL,
    merchant TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    category TEXT,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Metadata table (stores markdown summaries)
CREATE TABLE user_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_statement_date ON documents(statement_date);
CREATE INDEX idx_documents_document_type ON documents(document_type);
CREATE INDEX idx_documents_issuer ON documents(issuer);
CREATE INDEX idx_documents_account_name ON documents(account_name);
CREATE INDEX idx_documents_user_account ON documents(user_id, account_name);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_document_id ON transactions(document_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_merchant ON transactions(merchant);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_account_name ON transactions(account_name);
CREATE INDEX idx_transactions_user_account ON transactions(user_id, account_name);

CREATE INDEX idx_user_metadata_user_id ON user_metadata(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_metadata ENABLE ROW LEVEL SECURITY;

-- RLS Policies (for now, allow all - you can restrict by user later)
CREATE POLICY "Allow all operations on documents" ON documents FOR ALL USING (true);
CREATE POLICY "Allow all operations on transactions" ON transactions FOR ALL USING (true);
CREATE POLICY "Allow all operations on user_metadata" ON user_metadata FOR ALL USING (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_metadata_updated_at BEFORE UPDATE ON user_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

