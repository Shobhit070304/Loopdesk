# pyrefly: ignore [missing-import]
from pydantic import Field, BaseModel
# pyrefly: ignore [missing-import]
from fastapi import FastAPI, HTTPException
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
import os
import json
from typing import Any, Dict, Optional
import httpx
# pyrefly: ignore [missing-import]
import asyncpg
import hashlib
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
from contextlib import asynccontextmanager
# pyrefly: ignore [missing-import]
from google import genai
# pyrefly: ignore [missing-import]
from langchain_text_splitters import RecursiveCharacterTextSplitter
# pyrefly: ignore [missing-import]
import redis.asyncio as redis

import io
from fastapi import UploadFile, File
import pypdf

load_dotenv()

DB_URL = os.getenv("DB_URL")
REDIS_URL = os.getenv("REDIS_URL")
CORS_ORIGINS = [os.getenv("CORS_ORIGINS", "http://localhost:3000")]
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "gemini-embedding-001")
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-2.5-flash")

@asynccontextmanager
async def lifeSpan(app:FastAPI):
    app.state.redis = redis.from_url(REDIS_URL, decode_responses=True)
    app.state.pool = await asyncpg.create_pool(DB_URL)
    async with app.state.pool.acquire() as conn:
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")

        # 1. Documents table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS documents(
                id SERIAL PRIMARY KEY,
                content TEXT NOT NULL,
                embedding vector(768)
            )
        """)
        # FTS index for keyword search
        await conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_documents_content_fts
        ON documents USING gin(to_tsvector('english', content));
        """)
        # HNSW index for vector similarity search
        await conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_documents_embedding_fts
        ON documents USING hnsw (embedding vector_cosine_ops);
        """)
        # Add created_at column if it does not exist
        await conn.execute("""
            ALTER TABLE documents
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        """)

        # 2. Semantic Cache table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS semantic_cache(
                query_hash VARCHAR(64) PRIMARY KEY,
                query_text TEXT NOT NULL,
                embedding vector(768) NOT NULL,
                response TEXT NOT NULL
            )
        """)
        # Add response column if the table existed before this column was introduced
        await conn.execute("""
            ALTER TABLE semantic_cache
            ADD COLUMN IF NOT EXISTS response TEXT;
        """)
        # HNSW index for vector similarity search
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_semantic_cache_embedding
            ON semantic_cache USING hnsw (embedding vector_cosine_ops);
        """)

        # 3. Workflows table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS workflows (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                system_prompt TEXT NOT NULL,
                action_type VARCHAR(50) DEFAULT 'webhook',
                action_url TEXT,
                require_approval BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """)
        await conn.execute("""
            ALTER TABLE workflows
            ADD COLUMN IF NOT EXISTS require_approval BOOLEAN DEFAULT FALSE;
        """)

        # 4. Workflow Execution History / Audit Trail
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS workflow_executions (
                id SERIAL PRIMARY KEY,
                workflow_id INT REFERENCES workflows(id) ON DELETE CASCADE,
                trigger_payload JSONB NOT NULL,
                decision_output JSONB NOT NULL,
                status VARCHAR(50) DEFAULT 'success',
                executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """)
    
    yield

    await app.state.pool.close()
    await app.state.redis.close()


app = FastAPI(title="Enterprise RAG", lifespan=lifeSpan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = genai.Client()
text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)

def reciprocal_rank_fusion(vector_results, keyword_results, k: int = 60):
    rrf_scores = {}
    doc_map = {}

    # Score Vector Rankings
    for rank, item in enumerate(vector_results, start=1):
        doc_id = item['id']
        doc_map[doc_id] = item['content']
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + 1 / (rank + k)

    # Score Keyword Rankings
    for rank, item in enumerate(keyword_results, start=1):
        doc_id = item['id']
        doc_map[doc_id] = item['content']
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + 1 / (rank + k)

    sorted_docs = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)

    return[
        {"id":doc_id, "content":doc_map[doc_id], "rrf_score":score} for doc_id, score in sorted_docs
    ]


async def check_semantic_cache(app, query_embedding:list, threshold=0.95):
    # query_embedding is already a plain list — no .values attribute
    query_vec_str = "[" + ",".join(map(str, query_embedding)) + "]"

    async with app.state.pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT query_hash, response, similarity
            FROM (
                SELECT query_hash, response, (1 - (embedding <=> $1::vector)) AS similarity
                FROM semantic_cache
            ) as sub
            WHERE similarity >= $2
            ORDER BY similarity DESC
            LIMIT 1
        """, query_vec_str, threshold)

        if row:
            query_hash = row["query_hash"]
            # Try Redis first (fast). Fall back to Postgres (durable) if expired.
            cached_response = await app.state.redis.get(f"cache:{query_hash}")
            answer = cached_response or row["response"]
            if answer:
                return {"hit": True, "answer": answer, "similarity": row["similarity"]}
    
    return {"hit": False}

async def save_to_cache(app, query_text:str, query_embedding:list, llm_response:str):
    query_hash = hashlib.sha256(query_text.strip().encode()).hexdigest()
    # query_embedding is already a plain list — no .values attribute
    query_vec_str = "[" + ",".join(map(str, query_embedding)) + "]"

    async with app.state.pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO semantic_cache(query_hash, query_text, embedding, response) 
            VALUES($1, $2, $3::vector, $4)
            ON CONFLICT (query_hash) DO NOTHING;
        """, query_hash, query_text.strip(), query_vec_str, llm_response)

    # Also cache in Redis for fast lookups (24h TTL)
    await app.state.redis.setex(f"cache:{query_hash}", 86400, llm_response)
    
    




class IngestRequest(BaseModel):
    document_text:str = Field(..., min_length=1, max_length=50_000)

class QueryResult(BaseModel):
    query:str = Field(..., min_length=1, max_length=1_000)
    top_k: int = Field(3, ge=1, le=20)  # default=3, min=1, max=20 (inclusive)

class WorkflowCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    system_prompt: str = Field(
        ...,
        description="Instruction for evaluating the event against knowledge chunks."
    )
    action_type: str = Field("webhook", description="Type of action: webhook, slack, or email")
    action_url: Optional[str] = Field(None, description="Destination URL for the action dispatch")
    require_approval: bool = Field(False, description="Require human approval before dispatching action")

class TriggerEventRequest(BaseModel):
    event_text: str = Field(..., description="The main text or summary to evaluate (e.g. customer message)")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


@app.get("/health")
async def health_check():
    return{
        "status":"healthy",
        "message":"System running"
    }

@app.post("/ingest")
async def ingest_document(request: IngestRequest):
    try:
        chunks = text_splitter.split_text(request.document_text)
        if not chunks:
            return {"message": "No text content found to ingest."}

        responses = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=chunks,
            config={"output_dimensionality": 768}
        )

        records = [
            (chunk, "[" + ",".join(map(str, embedding.values)) + "]")
            for chunk, embedding in zip(chunks, responses.embeddings)
        ]

        async with app.state.pool.acquire() as conn:
            await conn.executemany(
                "INSERT INTO documents (content, embedding) VALUES ($1, $2::vector)",
                records,
            )

        return {"message": f"Successfully ingested {len(chunks)} chunks into the database."}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Ingestion failed: {str(e)}")


@app.post("/ingest/file")
async def ingest_file(file: UploadFile = File(...)):
    filename = file.filename or "uploaded_file"
    file_bytes = await file.read()
    extracted_text = ""

    # Extract text based on file format
    if filename.lower().endswith(".pdf"):
        try:
            pdf_reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            pages_text = [page.extract_text() or "" for page in pdf_reader.pages]
            extracted_text = "\n".join(pages_text).strip()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")
    else:
        # Fallback to plain UTF-8 text (.txt, .md, .csv, .json)
        try:
            extracted_text = file_bytes.decode("utf-8").strip()
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="File must be a valid UTF-8 text file or PDF.")

    if not extracted_text:
        raise HTTPException(status_code=400, detail="The uploaded file contains no readable text.")

    # Reuse chunking & embedding pipeline
    chunks = text_splitter.split_text(extracted_text)
    if not chunks:
        raise HTTPException(status_code=400, detail="No text chunks could be extracted from the file.")

    try:
        responses = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=chunks,
            config={"output_dimensionality": 768}
        )

        records = [
            (chunk, "[" + ",".join(map(str, embedding.values)) + "]")
            for chunk, embedding in zip(chunks, responses.embeddings)
        ]
        async with app.state.pool.acquire() as conn:
            await conn.executemany(
                "INSERT INTO documents (content, embedding) VALUES ($1, $2::vector)",
                records,
            )

        return {
            "filename": filename,
            "message": f"Successfully ingested {len(chunks)} chunks from {filename}.",
            "chunks_count": len(chunks),
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Ingestion failed: {str(e)}")




@app.get("/documents")
async def list_documents(limit: int = 20, offset: int = 0):
    async with app.state.pool.acquire() as conn:
        total = await conn.fetchval("SELECT COUNT(*) FROM documents")
        rows = await conn.fetch("""
            SELECT id, LEFT(content, 120) AS snippet, created_at
            FROM documents
            ORDER BY id DESC
            LIMIT $1 OFFSET $2
        """, limit, offset)
        return {
            "total": total,
            "documents": [dict(r) for r in rows]
        }


@app.delete("/documents/{doc_id}")
async def delete_document(doc_id: int):
    async with app.state.pool.acquire() as conn:
        res = await conn.execute("DELETE FROM documents WHERE id = $1", doc_id)
        if res == "DELETE 0":
            raise HTTPException(status_code=404, detail="Document not found")
        return {"message": f"Document {doc_id} deleted successfully"}


async def _hybrid_search(query: str, top_k: int, raw_embedding: list = None):
    """Shared search logic used by /retrieve and /ask."""
    if raw_embedding is None:
        result = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=query,
            config={"output_dimensionality": 768}
        )
        raw_embedding = result.embeddings[0].values

    # raw_embedding is already a plain list here — no .values attribute
    query_vec_res = "[" + ",".join(map(str, raw_embedding)) + "]"
    async with app.state.pool.acquire() as conn:
        vector_rows = await conn.fetch("""
            SELECT id, content
            FROM documents
            ORDER BY embedding <=> $1::vector
            LIMIT 10;
        """, query_vec_res)
        vector_results = [dict(row) for row in vector_rows]

        keyword_rows = await conn.fetch("""
            SELECT id, content
            FROM documents
            WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
            ORDER BY ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) DESC
            LIMIT 10;
        """, query)
        keyword_results = [dict(row) for row in keyword_rows]

        fused_results = reciprocal_rank_fusion(vector_results, keyword_results)
        return {
            "query": query,
            "results": fused_results[:top_k]
        }

@app.post("/retrieve")
async def retrieve_hybrid_search(request: QueryResult):
     return await _hybrid_search(request.query, request.top_k)
        
@app.post("/ask")
async def ask_rag(request:QueryResult):
    # 1. L1 Exact-Match Cache Check (fast Redis lookup before embedding)
    query_hash = hashlib.sha256(request.query.strip().encode()).hexdigest()
    cached_response = await app.state.redis.get(f"cache:{query_hash}")
    if cached_response:
        return {
            "query": request.query,
            "answer": cached_response,
            "source": "cache",
            "similarity": 1.0,
        }

    # 2. Embed Query for L2 Semantic Cache & Retrieval
    try:
        query_embedding = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=request.query,
            config={"output_dimensionality": 768}
        )
        raw_embedding = query_embedding.embeddings[0].values
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Embedding failed: {str(e)}")

    # 3. L2 Semantic Cache Check (pgvector cosine similarity >= 0.95)
    cache_result = await check_semantic_cache(app, raw_embedding, threshold=0.95)
    if cache_result["hit"]:
        return {
            "query":request.query,
            "answer": cache_result["answer"],
            "source":"cache",
            "similarity": cache_result["similarity"]
        }

    # 4. Cache Miss - Hybrid Search (reuse precomputed embedding)
    retrieval_result = await _hybrid_search(request.query, request.top_k, raw_embedding=raw_embedding)
    retrieved_docs = retrieval_result.get("results", [])

    if not retrieved_docs:
        return{
            "query":request.query,
            "answer":"No relevant documents found",
            "source":"empty"
        }

    # 5. Construct Prompt and Generate with Gemini (gemini-2.5-flash)
    context_blocks = [item["content"] for item in retrieved_docs]
    context_text = "\n\n".join(context_blocks)
    
    system_prompt = f"""
    You are a precise enterprise assistant. Answer the user's question strictly 
    using the context provided below. If the context does not contain the answer, 
    say "I do not have enough information to answer this." Do not use outside knowledge.
    Context:
        {context_text}
    User Question:
        {request.query}
    """

    try:
        response = client.models.generate_content(
            model=LLM_MODEL,
            contents=[system_prompt]
        )
        generated_text = response.text
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM generation failed: {str(e)}")
    # 6. Cache the response (in Postgres and Redis)
    await save_to_cache(app, request.query, raw_embedding, generated_text)
    return {
        "query": request.query,
        "answer": generated_text,
        "source": "documents_retrieved",
    }


# ── Workflow Automation Endpoints ──────────────────────────────────────────

@app.post("/workflows")
async def create_workflow(req: WorkflowCreateRequest):
    async with app.state.pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO workflows (name, description, system_prompt, action_type, action_url, require_approval)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, name, description, system_prompt, action_type, action_url, require_approval, created_at;
        """, req.name, req.description, req.system_prompt, req.action_type, req.action_url, req.require_approval)
        return dict(row)


@app.get("/workflows")
async def list_workflows():
    async with app.state.pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT w.id, w.name, w.description, w.system_prompt, w.action_type, w.action_url, w.require_approval, w.created_at,
                   COUNT(e.id)::int as execution_count
            FROM workflows w
            LEFT JOIN workflow_executions e ON w.id = e.workflow_id
            GROUP BY w.id
            ORDER BY w.id DESC;
        """)
        return [dict(r) for r in rows]


@app.delete("/workflows/{workflow_id}")
async def delete_workflow(workflow_id: int):
    async with app.state.pool.acquire() as conn:
        res = await conn.execute("DELETE FROM workflows WHERE id = $1", workflow_id)
        if res == "DELETE 0":
            raise HTTPException(status_code=404, detail="Workflow not found")
        return {"message": "Workflow deleted successfully"}


@app.post("/workflows/{workflow_id}/trigger")
async def trigger_workflow(workflow_id: int, event: TriggerEventRequest):
    # 1. Fetch Workflow Definition
    async with app.state.pool.acquire() as conn:
        wf = await conn.fetchrow("SELECT * FROM workflows WHERE id = $1", workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # 2. Retrieve relevant internal docs using existing hybrid search
    retrieval = await _hybrid_search(event.event_text, top_k=3)
    matched_chunks = [item["content"] for item in retrieval.get("results", [])]
    context_str = "\n\n".join(matched_chunks) if matched_chunks else "No specific policy docs found."

    # 3. Instruct Gemini 2.5 Flash to return a STRICT JSON decision
    prompt = f"""
    You are an automated enterprise decision engine executing workflow: "{wf['name']}".
    
    SYSTEM INSTRUCTION:
    {wf['system_prompt']}

    ENTERPRISE KNOWLEDGE CONTEXT:
    {context_str}

    INCOMING EVENT PAYLOAD:
    Text: {event.event_text}
    Metadata: {json.dumps(event.metadata)}

    Respond ONLY with a valid JSON object with the following exact keys:
    {{
        "decision": "APPROVE" | "REJECT" | "ESCALATE" | "REPLY",
        "confidence": <float between 0.0 and 1.0>,
        "reasoning": "<concise explanation citing policy context>",
        "action_payload": {{
            "message": "<automated email reply or action summary>",
            "recipient": "<extracted or default recipient>"
        }}
    }}
    """

    try:
        response = client.models.generate_content(
            model=LLM_MODEL,
            contents=[prompt],
            config={"response_mime_type": "application/json"}
        )
        raw_text = response.text.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1]
            if raw_text.endswith("```"):
                raw_text = raw_text.rsplit("```", 1)[0]
        decision = json.loads(raw_text.strip())
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI evaluation failed: {str(e)}")

    # 4. Outbound Action Dispatch (or hold in Approval Queue)
    if wf.get("require_approval", False):
        action_status = "pending_approval"
    else:
        action_status = "executed"
        if wf["action_url"]:
            try:
                async with httpx.AsyncClient(timeout=5.0) as http_client:
                    await http_client.post(
                        wf["action_url"],
                        json={
                            "workflow_id": workflow_id,
                            "workflow_name": wf["name"],
                            "decision": decision,
                            "original_event": event.model_dump(),
                        }
                    )
            except Exception:
                action_status = "action_dispatch_failed"

    # 5. Record in Audit Log
    async with app.state.pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO workflow_executions (workflow_id, trigger_payload, decision_output, status)
            VALUES ($1, $2::jsonb, $3::jsonb, $4)
            RETURNING id
        """, workflow_id, json.dumps(event.model_dump()), json.dumps(decision), action_status)
        execution_id = row["id"]

    return {
        "status": action_status,
        "execution_id": execution_id,
        "workflow_id": workflow_id,
        "decision": decision,
        "referenced_docs_count": len(matched_chunks)
    }


@app.get("/workflows/{workflow_id}/executions")
async def get_workflow_executions(workflow_id: int, limit: int = 20):
    async with app.state.pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, trigger_payload, decision_output, status, executed_at
            FROM workflow_executions
            WHERE workflow_id = $1
            ORDER BY id DESC
            LIMIT $2;
        """, workflow_id, limit)
        return [
            {
                "id": r["id"],
                "trigger_payload": json.loads(r["trigger_payload"]) if isinstance(r["trigger_payload"], str) else r["trigger_payload"],
                "decision_output": json.loads(r["decision_output"]) if isinstance(r["decision_output"], str) else r["decision_output"],
                "status": r["status"],
                "executed_at": r["executed_at"]
            }
            for r in rows
        ]


@app.post("/workflows/executions/{execution_id}/approve")
async def approve_execution(execution_id: int):
    async with app.state.pool.acquire() as conn:
        ex = await conn.fetchrow("""
            SELECT e.*, w.action_url, w.name as workflow_name
            FROM workflow_executions e
            JOIN workflows w ON e.workflow_id = w.id
            WHERE e.id = $1
        """, execution_id)

        if not ex:
            raise HTTPException(status_code=404, detail="Execution not found")

        decision = json.loads(ex["decision_output"]) if isinstance(ex["decision_output"], str) else ex["decision_output"]
        trigger_payload = json.loads(ex["trigger_payload"]) if isinstance(ex["trigger_payload"], str) else ex["trigger_payload"]

        # Dispatch action now that human approved
        dispatch_status = "executed"
        if ex["action_url"]:
            try:
                async with httpx.AsyncClient(timeout=5.0) as http_client:
                    await http_client.post(
                        ex["action_url"],
                        json={
                            "workflow_id": ex["workflow_id"],
                            "workflow_name": ex["workflow_name"],
                            "decision": decision,
                            "original_event": trigger_payload,
                        }
                    )
            except Exception:
                dispatch_status = "action_dispatch_failed"

        await conn.execute("UPDATE workflow_executions SET status = $1 WHERE id = $2", dispatch_status, execution_id)
        return {"status": dispatch_status, "execution_id": execution_id}


@app.post("/workflows/executions/{execution_id}/reject")
async def reject_execution(execution_id: int):
    async with app.state.pool.acquire() as conn:
        res = await conn.execute("UPDATE workflow_executions SET status = 'rejected' WHERE id = $1", execution_id)
        if res == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Execution not found")
        return {"status": "rejected", "execution_id": execution_id}



    