import os
import re
import json
import asyncio
from typing import Any, Dict, Literal, Optional
import httpx
from pydantic import BaseModel, Field
from google import genai
from langchain_text_splitters import RecursiveCharacterTextSplitter
from core.config import LLM_MODEL, EMBEDDING_MODEL, GROQ_API_KEY, GROQ_MODEL

class WorkflowDecision(BaseModel):
    decision: Literal["APPROVE", "REJECT", "ESCALATE", "REPLY"]
    confidence: float = Field(..., ge=0, le=1)
    reasoning: str = Field(..., min_length=1)
    action_payload: Dict[str, Any] = Field(default_factory=dict)


class LazyGenAIClient:
    """Lazily initializes the Google GenAI client upon first call, preventing crashes on import."""
    def __init__(self):
        self._client = None

    def _get(self):
        if self._client is None:
            api_key = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
            if api_key:
                self._client = genai.Client(api_key=api_key, http_options={"api_version": "v1beta"})
            else:
                self._client = genai.Client(http_options={"api_version": "v1beta"})
        return self._client

    @property
    def models(self):
        return self._get().models


client = LazyGenAIClient()
text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)


async def generate_embedding(content: str) -> list:
    """
    Generates 768-dim vector embedding with automatic model fallback
    between gemini-embedding-001 and text-embedding-004.
    """
    configured_model = os.getenv("EMBEDDING_MODEL") or EMBEDDING_MODEL or "gemini-embedding-001"
    models_to_try = [configured_model, "gemini-embedding-001", "text-embedding-004"]
    models_to_try = list(dict.fromkeys(models_to_try))
    last_err = None

    for model_name in models_to_try:
        try:
            result = await asyncio.to_thread(
                client.models.embed_content,
                model=model_name,
                contents=content,
                config={"output_dimensionality": 768}
            )
            return result.embeddings[0].values
        except Exception as e:
            last_err = e
            print(f"[EMBEDDING] Model '{model_name}' failed: {e}. Trying fallback...")

    raise RuntimeError(f"Embedding failed across models: {last_err}")


async def generate_embeddings_batch(contents: list[str]) -> list:
    """
    Generates batch 768-dim vector embeddings with automatic model fallback.
    """
    configured_model = os.getenv("EMBEDDING_MODEL") or EMBEDDING_MODEL or "gemini-embedding-001"
    models_to_try = [configured_model, "gemini-embedding-001", "text-embedding-004"]
    models_to_try = list(dict.fromkeys(models_to_try))
    last_err = None

    for model_name in models_to_try:
        try:
            responses = await asyncio.to_thread(
                client.models.embed_content,
                model=model_name,
                contents=contents,
                config={"output_dimensionality": 768}
            )
            return responses.embeddings
        except Exception as e:
            last_err = e
            print(f"[EMBEDDING BATCH] Model '{model_name}' failed: {e}. Trying fallback...")

    raise RuntimeError(f"Embedding batch failed across models: {last_err}")


async def generate_workflow_decision(prompt: str) -> dict:
    """
    Evaluates workflow decision using Gemini, with an automatic fallback to Groq
    if Gemini encounters a rate limit, quota, network error, or invalid output.
    """
    gemini_error = None

    # 1. Primary: Google Gemini
    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=LLM_MODEL,
            contents=[prompt],
            config={"response_mime_type": "application/json"}
        )
        raw_text = (response.text or "").strip()
        raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text, flags=re.IGNORECASE)
        raw_text = re.sub(r"\s*```$", "", raw_text)
        decision = WorkflowDecision.model_validate(json.loads(raw_text.strip())).model_dump()
        decision["ai_provider"] = "gemini"
        return decision
    except Exception as e:
        gemini_error = str(e)
        print(f"[AI EVALUATION] Gemini primary failed: {type(e).__name__} - {gemini_error}")

    # 2. Secondary Fallback: Groq (if configured)
    groq_key = os.getenv("GROQ_API_KEY") or GROQ_API_KEY
    if groq_key and groq_key.strip():
        active_groq_model = os.getenv("GROQ_MODEL") or GROQ_MODEL or "llama-3.3-70b-versatile"
        try:
            print(f"[AI EVALUATION] Attempting Groq fallback using model {active_groq_model}...")
            async with httpx.AsyncClient(timeout=15.0) as http_client:
                groq_resp = await http_client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {groq_key.strip()}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": active_groq_model,
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are a customer support copilot decision engine. You must output only a valid, strict JSON object following the schema requested by the user."
                            },
                            {"role": "user", "content": prompt}
                        ],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.1,
                    }
                )
                groq_resp.raise_for_status()
                groq_json = groq_resp.json()
                raw_text = groq_json["choices"][0]["message"]["content"].strip()
                raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text, flags=re.IGNORECASE)
                raw_text = re.sub(r"\s*```$", "", raw_text)
                decision = WorkflowDecision.model_validate(json.loads(raw_text.strip())).model_dump()
                decision["ai_provider"] = f"groq:{active_groq_model}"
                print(f"[AI EVALUATION] Groq fallback succeeded with decision: {decision.get('decision')}")
                return decision
        except Exception as groq_err:
            print(f"[AI EVALUATION] Groq fallback failed: {type(groq_err).__name__} - {groq_err}")
            raise RuntimeError(f"Gemini failed ({gemini_error}); Groq fallback failed ({groq_err})")

    raise RuntimeError(f"Gemini evaluation failed: {gemini_error}")
