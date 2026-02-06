-- Migration: Add is_admin column to user_settings
-- This enables admin access control for the admin portal

-- Add is_admin column to user_settings
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Set the first admin user
INSERT INTO user_settings (user_id, is_admin, created_at, updated_at)
VALUES ('3d213fe2-788c-4e9e-9b83-beb42aa6782d', TRUE, NOW(), NOW())
ON CONFLICT (user_id) 
DO UPDATE SET is_admin = TRUE, updated_at = NOW();

-- Create index for fast admin lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_is_admin ON user_settings(is_admin) WHERE is_admin = TRUE;
