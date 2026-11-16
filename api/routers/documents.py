import io
import uuid
import asyncio
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
import pypdf
from core.config import EMBEDDING_MODEL
from core.security import workspace_id
from services.ai import client, text_splitter
from services.cache import invalidate_workspace_cache

router = APIRouter(tags=["Knowledge Base"])

@router.post("/ingest/file")
async def ingest_file(request: Request, file: UploadFile = File(...)):
    app = request.app
    active_workspace = workspace_id(request)

    # Portfolio limit: Maximum 5 documents for one account for all time
    async with app.state.pool.acquire() as conn:
        doc_count = await conn.fetchval(
            "SELECT COUNT(*) FROM knowledge_documents WHERE workspace_id = $1",
            active_workspace
        )
        if (doc_count or 0) >= 5:
            raise HTTPException(
                status_code=400,
                detail="Portfolio limit reached: Maximum 5 documents allowed per account. Please delete an existing file to upload a new one."
            )

    filename = (file.filename or "uploaded_file").replace("\\", "/").split("/")[-1].strip()
    extension = Path(filename).suffix.lower()
    if extension not in {".pdf", ".txt", ".md", ".csv", ".json"}:
        raise HTTPException(status_code=415, detail="Upload a PDF, TXT, Markdown, CSV, or JSON file.")
    max_bytes = 15 * 1024 * 1024
    file_bytes = await file.read(max_bytes + 1)
    if len(file_bytes) > max_bytes:
        raise HTTPException(status_code=413, detail="Files must be 15 MB or smaller.")
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
        try:
            extracted_text = file_bytes.decode("utf-8").strip()
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="File must be a valid UTF-8 text file or PDF.")

    if not extracted_text:
        raise HTTPException(status_code=400, detail="The uploaded file contains no readable text.")

    chunks = text_splitter.split_text(extracted_text)
    if not chunks:
        raise HTTPException(status_code=400, detail="No text chunks could be extracted from the file.")

    try:
        batch_size = 100
        all_embeddings = []
        for i in range(0, len(chunks), batch_size):
            chunk_batch = chunks[i : i + batch_size]
            responses = await asyncio.to_thread(
                client.models.embed_content,
                model=EMBEDDING_MODEL,
                contents=chunk_batch,
                config={"output_dimensionality": 768}
            )
            all_embeddings.extend(responses.embeddings)

        records = [
            (chunk, "[" + ",".join(map(str, embedding.values)) + "]")
            for chunk, embedding in zip(chunks, all_embeddings)
        ]
        file_id = uuid.uuid4().hex
        async with app.state.pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    "INSERT INTO knowledge_documents (id, workspace_id, filename, content_type, size_bytes, chunk_count) VALUES ($1, $2, $3, $4, $5, $6)",
                    file_id, active_workspace, filename, file.content_type or "application/octet-stream", len(file_bytes), len(records)
                )
                await conn.executemany(
                    "INSERT INTO documents (content, embedding, workspace_id, file_id) VALUES ($1, $2::vector, $3, $4)",
                    [(content, embedding, active_workspace, file_id) for content, embedding in records],
                )
        await invalidate_workspace_cache(app, active_workspace)

        return {
            "filename": filename,
            "document_id": file_id,
            "size_bytes": len(file_bytes),
            "message": f"Successfully ingested {len(chunks)} chunks from {filename}.",
            "chunks_count": len(chunks),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Ingestion failed: {str(e)}")


@router.get("/documents")
async def list_documents(request: Request, limit: int = 20, offset: int = 0):
    active_workspace = workspace_id(request)
    async with request.app.state.pool.acquire() as conn:
        total = await conn.fetchval("SELECT COUNT(*) FROM knowledge_documents WHERE workspace_id = $1", active_workspace)
        rows = await conn.fetch("""
            SELECT id, filename, content_type, size_bytes, chunk_count, created_at
            FROM knowledge_documents
            WHERE workspace_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
        """, active_workspace, max(1, min(limit, 100)), max(0, offset))
        legacy_chunks = await conn.fetchval("SELECT COUNT(*) FROM documents WHERE workspace_id = $1 AND file_id IS NULL", active_workspace)
        documents = [dict(row) for row in rows]
        if legacy_chunks:
            documents.append({
                "id": "legacy",
                "filename": "Previously uploaded content",
                "content_type": "legacy",
                "size_bytes": None,
                "chunk_count": legacy_chunks,
                "created_at": None
            })
        return {
            "total": total + (1 if legacy_chunks else 0),
            "documents": documents
        }


@router.delete("/documents/{doc_id}")
async def delete_document(request: Request, doc_id: str):
    app = request.app
    active_workspace = workspace_id(request)
    async with app.state.pool.acquire() as conn:
        async with conn.transaction():
            res = await conn.execute(
                "DELETE FROM knowledge_documents WHERE id = $1 AND workspace_id = $2",
                doc_id, active_workspace
            )
            if res == "DELETE 0" and doc_id.isdigit():
                res = await conn.execute(
                    "DELETE FROM documents WHERE id = $1 AND workspace_id = $2 AND file_id IS NULL",
                    int(doc_id), active_workspace
                )
            if res == "DELETE 0" and doc_id == "legacy":
                res = await conn.execute(
                    "DELETE FROM documents WHERE workspace_id = $1 AND file_id IS NULL",
                    active_workspace
                )
            if res == "DELETE 0":
                raise HTTPException(status_code=404, detail="Document not found")
    await invalidate_workspace_cache(app, active_workspace)
    return {"ok": True, "message": "Document deleted successfully."}


@router.get("/documents/{doc_id}/chunks")
async def get_document_chunks(doc_id: str, request: Request):
    """Retrieves extracted text passages and vector chunks for a specific document."""
    active_workspace = workspace_id(request)
    async with request.app.state.pool.acquire() as conn:
        if doc_id == "legacy":
            chunks = await conn.fetch("""
                SELECT id, content FROM documents
                WHERE workspace_id = $1 AND file_id IS NULL
                ORDER BY id ASC LIMIT 50
            """, active_workspace)
            return {
                "document_id": "legacy",
                "filename": "Previously uploaded content",
                "chunks": [{"id": c["id"], "content": c["content"]} for c in chunks]
            }

        doc = await conn.fetchrow("""
            SELECT id, filename, chunk_count FROM knowledge_documents
            WHERE id = $1 AND workspace_id = $2
        """, doc_id, active_workspace)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        chunks = await conn.fetch("""
            SELECT id, content FROM documents
            WHERE file_id = $1 AND workspace_id = $2
            ORDER BY id ASC LIMIT 100
        """, doc_id, active_workspace)

        return {
            "document_id": doc_id,
            "filename": doc["filename"],
            "chunks": [{"id": c["id"], "content": c["content"]} for c in chunks]
        }
