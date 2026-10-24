CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_documents (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    chunk_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS workspace_id TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_id TEXT;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS workspace_id TEXT;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS execution_mode VARCHAR(20);
ALTER TABLE semantic_cache ADD COLUMN IF NOT EXISTS workspace_id TEXT;
ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_file_id_fkey') THEN
        ALTER TABLE documents ADD CONSTRAINT documents_file_id_fkey
            FOREIGN KEY (file_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE;
    END IF;
END $$;

UPDATE workflows
SET execution_mode = CASE WHEN COALESCE(require_approval, FALSE) THEN 'manual' ELSE 'automatic' END
WHERE execution_mode IS NULL;

UPDATE workflow_executions
SET status = CASE
    WHEN status = 'executed' AND reviewed_at IS NOT NULL THEN 'approved'
    WHEN status = 'executed' THEN 'auto_executed'
    WHEN status = 'pending_approval' THEN 'pending_review'
    ELSE status
END
WHERE status IN ('executed', 'pending_approval');

CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_documents_workspace_file ON documents(workspace_id, file_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_workspace ON knowledge_documents(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflows_workspace ON workflows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_semantic_cache_workspace ON semantic_cache(workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_executions_idempotency
    ON workflow_executions(workflow_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

INSERT INTO schema_migrations(version)
VALUES ('001_customer_workspace')
ON CONFLICT (version) DO NOTHING;
