import hashlib

def cache_key(workspace: str, query: str) -> str:
    digest = hashlib.sha256(query.strip().encode()).hexdigest()
    return hashlib.sha256(f"{workspace}:{digest}".encode()).hexdigest()


async def check_semantic_cache(app, workspace: str, query_embedding: list, threshold=0.95):
    """Checks PostgreSQL pgvector L2 semantic cache for existing answers with similarity >= threshold."""
    query_vec_str = "[" + ",".join(map(str, query_embedding)) + "]"

    async with app.state.pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT query_hash, response, similarity
            FROM (
                SELECT query_hash, response, (1 - (embedding <=> $1::vector)) AS similarity
                FROM semantic_cache
                WHERE workspace_id = $2
            ) as sub
            WHERE similarity >= $3
            ORDER BY similarity DESC
            LIMIT 1
        """, query_vec_str, workspace, threshold)

        if row:
            query_hash = row["query_hash"]
            cached_response = None
            if getattr(app.state, "redis", None):
                try:
                    cached_response = await app.state.redis.get(f"cache:{workspace}:{query_hash}")
                except Exception as err:
                    print(f"[CACHE WARNING] Redis read failed: {err}")
            answer = cached_response or row["response"]
            if answer:
                return {"hit": True, "answer": answer, "similarity": row["similarity"]}

    return {"hit": False}


async def save_to_cache(app, workspace: str, query_text: str, query_embedding: list, llm_response: str):
    """Persists answer into PostgreSQL pgvector L2 semantic cache and Redis L1 fast cache."""
    q_hash = cache_key(workspace, query_text)
    query_vec_str = "[" + ",".join(map(str, query_embedding)) + "]"

    async with app.state.pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO semantic_cache(query_hash, query_text, embedding, response, workspace_id)
            VALUES($1, $2, $3::vector, $4, $5)
            ON CONFLICT (query_hash) DO NOTHING;
        """, q_hash, query_text.strip(), query_vec_str, llm_response, workspace)

    if getattr(app.state, "redis", None):
        try:
            await app.state.redis.setex(f"cache:{workspace}:{q_hash}", 86400, llm_response)
        except Exception as err:
            print(f"[CACHE WARNING] Redis write failed: {err}")


async def invalidate_workspace_cache(app, workspace: str):
    """Flushes cached answers when new documents are added or removed."""
    async with app.state.pool.acquire() as conn:
        await conn.execute("DELETE FROM semantic_cache WHERE workspace_id = $1", workspace)

    if getattr(app.state, "redis", None):
        try:
            keys = [key async for key in app.state.redis.scan_iter(match=f"cache:{workspace}:*")]
            if keys:
                await app.state.redis.delete(*keys)
        except Exception as error:
            print(f"[CACHE WARNING] Redis cache cleanup failed: {error}")
