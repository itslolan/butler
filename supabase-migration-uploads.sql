-- Migration: Create uploads table and backfill existing documents
-- This creates a proper 'uploads' entity and makes the feature backwards compatible

-- 1. Create uploads table
CREATE TABLE IF NOT EXISTS uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    upload_name TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'manual_upload' 
        CHECK (source_type IN ('manual_upload', 'plaid_sync', 'api')),
    status TEXT NOT NULL DEFAULT 'completed'
        CHECK (status IN ('processing', 'completed', 'failed')),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add upload_id column to documents (if not exists)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS upload_id UUID REFERENCES uploads(id) ON DELETE CASCADE;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_uploads_uploaded_at ON uploads(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_uploads_status ON uploads(status);
CREATE INDEX IF NOT EXISTS idx_documents_upload_id ON documents(upload_id);

-- 4. Migrate documents with batch_id (multi-file uploads)
-- Create one upload per unique batch_id, using batch_id as the upload id
INSERT INTO uploads (id, user_id, upload_name, source_type, status, uploaded_at, created_at)
SELECT DISTINCT ON (batch_id)
    batch_id as id,
    user_id,
    'Upload ' || TO_CHAR(uploaded_at AT TIME ZONE 'UTC', 'Mon DD, YYYY HH:MI AM') as upload_name,
    'manual_upload' as source_type,
    'completed' as status,
    uploaded_at,
    COALESCE(created_at, uploaded_at) as created_at
FROM documents
WHERE batch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM uploads WHERE uploads.id = documents.batch_id)
ORDER BY batch_id, uploaded_at ASC;

-- Link batched documents to their upload (batch_id becomes upload_id)
UPDATE documents 
SET upload_id = batch_id 
WHERE batch_id IS NOT NULL AND upload_id IS NULL;

-- 5. Migrate documents without batch_id (single-file uploads)
-- Use a DO block to handle each document individually
DO $$
DECLARE
    doc RECORD;
    new_upload_id UUID;
BEGIN
    FOR doc IN 
        SELECT id, user_id, uploaded_at, created_at, file_name
        FROM documents 
        WHERE batch_id IS NULL AND upload_id IS NULL
    LOOP
        -- Create a new upload for this document
        INSERT INTO uploads (user_id, upload_name, source_type, status, uploaded_at, created_at)
        VALUES (
            doc.user_id,
            'Upload ' || TO_CHAR(doc.uploaded_at AT TIME ZONE 'UTC', 'Mon DD, YYYY HH:MI AM'),
            'manual_upload',
            'completed',
            doc.uploaded_at,
            COALESCE(doc.created_at, doc.uploaded_at)
        )
        RETURNING id INTO new_upload_id;
        
        -- Link the document to the new upload
        UPDATE documents SET upload_id = new_upload_id WHERE id = doc.id;
    END LOOP;
END $$;

-- 6. Verify migration completed (optional - uncomment to run)
-- SELECT 
--     (SELECT COUNT(*) FROM documents) as total_documents,
--     (SELECT COUNT(*) FROM documents WHERE upload_id IS NOT NULL) as linked_documents,
--     (SELECT COUNT(*) FROM uploads) as total_uploads;
