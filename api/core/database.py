import os
import json
import uuid
from pathlib import Path
import asyncpg
import redis.asyncio as redis
from core.config import DB_URL, REDIS_URL

async def init_db(app):
    """Initializes Redis and PostgreSQL connections, extensions, tables, and migrations."""
    # 1. Redis Connection (resilient)
    try:
        app.state.redis = redis.from_url(REDIS_URL, decode_responses=True)
    except Exception as redis_err:
        print(f"[STARTUP WARNING] Redis connection failed: {redis_err}")
        app.state.redis = None

    # 2. PostgreSQL Connection Pool
    app.state.pool = await asyncpg.create_pool(
        DB_URL,
        min_size=2,
        max_size=15,
        max_inactive_connection_lifetime=300
    )

    async with app.state.pool.acquire() as conn:
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")

        # 1. Documents table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS documents(
                id SERIAL PRIMARY KEY,
                content TEXT NOT NULL,
                embedding vector(768),
                workspace_id TEXT,
                file_id TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_documents_content_fts
            ON documents USING gin(to_tsvector('english', content));
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_documents_embedding_fts
            ON documents USING hnsw (embedding vector_cosine_ops);
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace_id);
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_documents_workspace_file ON documents(workspace_id, file_id);
        """)

        # 2. Knowledge Documents table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_documents (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                content_type TEXT NOT NULL,
                size_bytes BIGINT NOT NULL,
                chunk_count INTEGER NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_knowledge_documents_workspace ON knowledge_documents(workspace_id, created_at DESC);
        """)

        # 3. Semantic Cache table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS semantic_cache(
                query_hash VARCHAR(64) PRIMARY KEY,
                query_text TEXT NOT NULL,
                embedding vector(768) NOT NULL,
                response TEXT NOT NULL,
                workspace_id TEXT
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_semantic_cache_embedding
            ON semantic_cache USING hnsw (embedding vector_cosine_ops);
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_semantic_cache_workspace ON semantic_cache(workspace_id);
        """)

        # 4. Workflows table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS workflows (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                system_prompt TEXT NOT NULL,
                action_type VARCHAR(50) DEFAULT 'email',
                action_url TEXT,
                execution_mode VARCHAR(20) DEFAULT 'manual',
                require_approval BOOLEAN DEFAULT TRUE,
                webhook_token VARCHAR(64) UNIQUE,
                webhook_secret VARCHAR(64),
                webhook_enabled BOOLEAN DEFAULT TRUE,
                workspace_id TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_workflows_workspace ON workflows(workspace_id);
        """)

        # 5. Workflow Executions table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS workflow_executions (
                id SERIAL PRIMARY KEY,
                workflow_id INT REFERENCES workflows(id) ON DELETE CASCADE,
                trigger_payload JSONB NOT NULL,
                decision_output JSONB NOT NULL,
                status VARCHAR(50) DEFAULT 'pending_review',
                source VARCHAR(50) DEFAULT 'inbound_webhook',
                idempotency_key VARCHAR(255),
                reviewed_at TIMESTAMP WITH TIME ZONE,
                reviewed_by VARCHAR(255),
                executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """)
        await conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_executions_idempotency
            ON workflow_executions(workflow_id, idempotency_key)
            WHERE idempotency_key IS NOT NULL;
        """)

        # 6. Users table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                google_sub VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255),
                picture TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);
        """)

        # Run SQL migration script if present
        migration_path = Path(__file__).parent.parent / "migrations" / "001_customer_workspace.sql"
        if migration_path.exists():
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version VARCHAR(100) PRIMARY KEY,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            migration_applied = await conn.fetchval("SELECT 1 FROM schema_migrations WHERE version = '001_customer_workspace'")
            if not migration_applied:
                await conn.execute(migration_path.read_text(encoding="utf-8"))

        # Seed Demo Workspace Data if missing
        await _seed_demo_workspace(conn)


async def _seed_demo_workspace(conn):
    """Seeds sample data for demo-operator-101 so the demo workspace is immediately usable."""
    demo_workspace = "demo-operator-101"
    existing_wf = await conn.fetchval("SELECT id FROM workflows WHERE workspace_id = $1 LIMIT 1", demo_workspace)
    if existing_wf:
        return

    # 1. Seed sample workflow
    wf_id = await conn.fetchval("""
        INSERT INTO workflows (
            name, description, system_prompt, action_type, action_url,
            execution_mode, require_approval, webhook_token, webhook_secret,
            webhook_enabled, workspace_id
        ) VALUES (
            'Returns & Refund Review',
            'Strictly evaluate return window approvals and draft polite customer responses citing warranty terms.',
            'You are the Returns and Refund Review Copilot. Strictly evaluate customer return inquiries against our 30-day return policy. If the item was damaged in transit, approve replacement. If the request exceeds 30 days, politely decline.',
            'email',
            'https://webhook.site/sample-demo-endpoint',
            'manual',
            TRUE,
            'wh_live_demo101refunds',
            'whsec_demo101secretkey99',
            TRUE,
            $1
        ) RETURNING id;
    """, demo_workspace)

    # 2. Seed sample knowledge document
    doc_file_id = "demo-doc-policy-101"
    await conn.execute("""
        INSERT INTO knowledge_documents (
            id, workspace_id, filename, content_type, size_bytes, chunk_count
        ) VALUES (
            $1, $2, 'Company_Return_and_Warranty_Policy.md', 'text/markdown', 4096, 3
        ) ON CONFLICT (id) DO NOTHING;
    """, doc_file_id, demo_workspace)

    # 3. Seed sample passages in documents
    sample_passages = [
        "1. Standard Return Window: Customers may return undamaged items in original packaging within 30 days of delivery for a full refund to their original payment method. Shipping fees are non-refundable unless return is due to company error.",
        "2. Damaged in Transit Policy: If an item arrives damaged or defective, the customer is eligible for an immediate replacement or full refund. The customer must file a claim within 7 calendar days of delivery with photos of the damaged packaging and product.",
        "3. Non-Returnable Items: Custom-engraved products, personalized merchandise, and perishable goods are final sale and non-refundable unless an error was made by our fulfillment department."
    ]
    for chunk in sample_passages:
        await conn.execute("""
            INSERT INTO documents (content, workspace_id, file_id)
            VALUES ($1, $2, $3)
        """, chunk, demo_workspace, doc_file_id)

    # 4. Seed sample executions in workflow_executions
    await conn.execute("""
        INSERT INTO workflow_executions (
            workflow_id, trigger_payload, decision_output, status, source, executed_at
        ) VALUES (
            $1,
            '{"event_text": "Customer order #4092: Received damaged item with broken display, requesting immediate replacement.", "metadata": {"customer_email": "sarah.connor@example.com", "channel": "email"}}'::jsonb,
            '{"decision": "APPROVE", "confidence": 0.98, "reasoning": "Item damaged in transit meets policy section 2 criteria for replacement.", "action_payload": {"message": "Dear Sarah, We sincerely apologize for the damaged item in order #4092. Your replacement order has been approved and dispatched at no additional charge.", "recipient": "sarah.connor@example.com"}}'::jsonb,
            'pending_review',
            'inbound_webhook',
            NOW() - INTERVAL '15 minutes'
        );
    """, wf_id)

    await conn.execute("""
        INSERT INTO workflow_executions (
            workflow_id, trigger_payload, decision_output, status, source, executed_at, reviewed_at, reviewed_by
        ) VALUES (
            $1,
            '{"event_text": "Inquiry regarding order #3810: Purchased 48 days ago, customer changed mind and wants a full refund.", "metadata": {"customer_email": "marcus.v@example.com", "channel": "email"}}'::jsonb,
            '{"decision": "REJECT", "confidence": 0.95, "reasoning": "Request was submitted 48 days post-delivery, exceeding the 30-day refund window in policy section 1.", "action_payload": {"message": "Hello Marcus, Thank you for reaching out. Per our company return policy, returns must be initiated within 30 days of delivery. As order #3810 was delivered 48 days ago, we are unable to process a refund.", "recipient": "marcus.v@example.com"}}'::jsonb,
            'rejected',
            'inbound_webhook',
            NOW() - INTERVAL '3 hours',
            NOW() - INTERVAL '2 hours',
            'Alex Vance (Demo Operator)'
        );
    """, wf_id)

