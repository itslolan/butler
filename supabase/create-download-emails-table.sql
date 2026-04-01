-- Create table for storing download email addresses
CREATE TABLE IF NOT EXISTS download_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  download_url TEXT
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_download_emails_email ON download_emails(email);

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_download_emails_created_at ON download_emails(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE download_emails ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to insert
CREATE POLICY "Service role can insert download emails"
  ON download_emails
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Create policy to allow service role to select
CREATE POLICY "Service role can select download emails"
  ON download_emails
  FOR SELECT
  TO service_role
  USING (true);
