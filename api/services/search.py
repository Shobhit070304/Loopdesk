import asyncio
from services.ai import client, generate_embedding
from core.config import EMBEDDING_MODEL

def reciprocal_rank_fusion(vector_results, keyword_results, k: int = 60):
    rrf_scores = {}
    doc_map = {}

    # Score Vector Rankings
    for rank, item in enumerate(vector_results, start=1):
        doc_id = item["id"]
        doc_map[doc_id] = item["content"]
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + 1 / (rank + k)

    # Score Keyword Rankings
    for rank, item in enumerate(keyword_results, start=1):
        doc_id = item["id"]
        doc_map[doc_id] = item["content"]
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + 1 / (rank + k)

    sorted_docs = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)

    return [
        {"id": doc_id, "content": doc_map[doc_id], "rrf_score": score}
        for doc_id, score in sorted_docs
    ]


async def hybrid_search(app, query: str, top_k: int, workspace: str, raw_embedding: list = None):
    """Shared retrieval logic used by Policy Copilot and Workflow Runner."""
    if raw_embedding is None:
        raw_embedding = await generate_embedding(query)

    query_vec_res = "[" + ",".join(map(str, raw_embedding)) + "]"
    async with app.state.pool.acquire() as conn:
        vector_rows = await conn.fetch("""
            SELECT d.id, d.content, COALESCE(k.filename, 'Team knowledge') AS filename
            FROM documents d
            LEFT JOIN knowledge_documents k ON k.id = d.file_id AND k.workspace_id = d.workspace_id
            WHERE d.workspace_id = $2
            ORDER BY d.embedding <=> $1::vector
            LIMIT 10;
        """, query_vec_res, workspace)
        vector_results = [dict(row) for row in vector_rows]

        keyword_rows = await conn.fetch("""
            SELECT d.id, d.content, COALESCE(k.filename, 'Team knowledge') AS filename
            FROM documents d
            LEFT JOIN knowledge_documents k ON k.id = d.file_id AND k.workspace_id = d.workspace_id
            WHERE d.workspace_id = $2
              AND to_tsvector('english', d.content) @@ plainto_tsquery('english', $1)
            ORDER BY ts_rank(to_tsvector('english', d.content), plainto_tsquery('english', $1)) DESC
            LIMIT 10;
        """, query, workspace)
        keyword_results = [dict(row) for row in keyword_rows]

        fused_results = reciprocal_rank_fusion(vector_results, keyword_results)
        filenames = {row["id"]: row["filename"] for row in vector_results + keyword_results}
        for item in fused_results:
            item["filename"] = filenames.get(item["id"], "Team knowledge")
        return {
            "query": query,
            "results": fused_results[:top_k]
        }
