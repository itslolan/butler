-- Migration: Update source_type check constraint for uploads table
-- Allows 'extension_capture' as a valid source type

ALTER TABLE uploads DROP CONSTRAINT IF EXISTS uploads_source_type_check;

ALTER TABLE uploads
    ADD CONSTRAINT uploads_source_type_check 
    CHECK (source_type IN ('manual_upload', 'plaid_sync', 'api', 'extension_capture'));

