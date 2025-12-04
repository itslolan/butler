-- Migration: Create newsletter_emails table
-- Stores email addresses collected from users for newsletter purposes

-- Create newsletter_emails table
CREATE TABLE IF NOT EXISTS newsletter_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    source TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on email for uniqueness (already enforced by UNIQUE constraint, but index helps performance)
CREATE INDEX IF NOT EXISTS idx_newsletter_emails_email ON newsletter_emails(email);

-- Create index on source for analytics
CREATE INDEX IF NOT EXISTS idx_newsletter_emails_source ON newsletter_emails(source);

-- Enable Row Level Security (RLS)
ALTER TABLE newsletter_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow anyone to insert (for public signup)
-- Note: Reads are restricted - only service role (via API) can read emails
CREATE POLICY "Allow public insert on newsletter_emails" ON newsletter_emails
    FOR INSERT
    WITH CHECK (true);

