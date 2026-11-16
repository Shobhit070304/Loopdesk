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


GROQ_MODELS_CASCADE = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
]


async def generate_chat_response_groq(messages: list[dict], temperature: float = 0.2) -> str:
    """
    Direct Groq chat completion for Policy Copilot Q&A.
    Iterates through the model cascade (120B -> 20B -> Qwen -> Llama) so it never breaks.
    """
    groq_key = (os.getenv("GROQ_API_KEY") or GROQ_API_KEY or "").strip()
    if not groq_key:
        raise RuntimeError("GROQ_API_KEY is not configured in environment.")

    configured_model = (os.getenv("GROQ_MODEL") or GROQ_MODEL or "").strip()
    models_to_try = [configured_model] + GROQ_MODELS_CASCADE
    models_to_try = [m for m in dict.fromkeys(models_to_try) if m]

    last_error = None
    for model_name in models_to_try:
        try:
            async with httpx.AsyncClient(timeout=20.0) as http_client:
                response = await http_client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {groq_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model_name,
                        "messages": messages,
                        "temperature": temperature,
                    },
                )
                if response.status_code == 200:
                    data = response.json()
                    content = (data["choices"][0]["message"].get("content") or "").strip()
                    if not content and data["choices"][0]["message"].get("reasoning"):
                        content = data["choices"][0]["message"]["reasoning"].strip()
                    if content:
                        print(f"[GROQ CHAT] Generated answer using model '{model_name}'")
                        return content
                else:
                    err_msg = response.text
                    print(f"[GROQ CHAT] Model '{model_name}' returned HTTP {response.status_code}: {err_msg}. Trying fallback...")
                    last_error = f"{model_name} (HTTP {response.status_code}): {err_msg}"
        except Exception as e:
            print(f"[GROQ CHAT] Model '{model_name}' failed with {type(e).__name__}: {e}. Trying fallback...")
            last_error = f"{model_name}: {e}"

    raise RuntimeError(f"All Groq models failed. Last error: {last_error}")


def _normalize_workflow_decision(data: dict) -> dict:
    """Safely normalizes LLM JSON output to conform strictly to WorkflowDecision schema."""
    decision_raw = str(data.get("decision") or data.get("action") or "ESCALATE").upper()
    if "APPROV" in decision_raw:
        clean_decision = "APPROVE"
    elif "REJECT" in decision_raw or "DENY" in decision_raw:
        clean_decision = "REJECT"
    elif "REPLY" in decision_raw:
        clean_decision = "REPLY"
    else:
        clean_decision = "ESCALATE"

    try:
        conf_val = float(data.get("confidence", 0.85))
        confidence = max(0.0, min(1.0, conf_val))
    except (ValueError, TypeError):
        confidence = 0.85

    reasoning = str(data.get("reasoning") or data.get("explanation") or data.get("reason") or "Evaluated against policy.").strip()
    action_payload = data.get("action_payload")
    if not isinstance(action_payload, dict):
        action_payload = {"message": str(data.get("message") or reasoning)}

    return {
        "decision": clean_decision,
        "confidence": confidence,
        "reasoning": reasoning,
        "action_payload": action_payload,
    }


async def generate_workflow_decision(prompt: str) -> dict:
    """
    Evaluates workflow decision using Groq as primary engine with json_mode
    and automatic cascade across models, falling back to Gemini if needed.
    """
    groq_key = (os.getenv("GROQ_API_KEY") or GROQ_API_KEY or "").strip()
    if groq_key:
        configured_model = (os.getenv("GROQ_MODEL") or GROQ_MODEL or "").strip()
        models_to_try = [configured_model] + GROQ_MODELS_CASCADE
        models_to_try = [m for m in dict.fromkeys(models_to_try) if m]

        for model_name in models_to_try:
            try:
                async with httpx.AsyncClient(timeout=15.0) as http_client:
                    groq_resp = await http_client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {groq_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": model_name,
                            "messages": [
                                {
                                    "role": "system",
                                    "content": (
                                        "You are a customer support copilot decision engine. You must output only a valid JSON object matching this schema: "
                                        "{\"decision\": \"APPROVE\"|\"REJECT\"|\"ESCALATE\"|\"REPLY\", \"confidence\": <float between 0.0 and 1.0>, "
                                        "\"reasoning\": \"<explanation>\", \"action_payload\": {\"message\": \"<summary or reply>\"}}"
                                    )
                                },
                                {"role": "user", "content": prompt}
                            ],
                            "response_format": {"type": "json_object"},
                            "temperature": 0.1,
                        }
                    )
                    if groq_resp.status_code == 200:
                        groq_json = groq_resp.json()
                        raw_text = groq_json["choices"][0]["message"]["content"].strip()
                        raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text, flags=re.IGNORECASE)
                        raw_text = re.sub(r"\s*```$", "", raw_text)
                        parsed = json.loads(raw_text.strip())
                        normalized = _normalize_workflow_decision(parsed)
                        decision = WorkflowDecision.model_validate(normalized).model_dump()
                        decision["ai_provider"] = f"groq:{model_name}"
                        print(f"[AI EVALUATION] Groq succeeded with model '{model_name}': {decision.get('decision')}")
                        return decision
                    else:
                        print(f"[AI EVALUATION] Groq model '{model_name}' returned {groq_resp.status_code}: {groq_resp.text}. Trying next...")
            except Exception as e:
                print(f"[AI EVALUATION] Groq model '{model_name}' failed: {e}. Trying next...")

    # Fallback to Google Gemini
    configured_gemini = os.getenv("LLM_MODEL") or LLM_MODEL or "gemini-3.8-flash"
    gemini_models = [configured_gemini, "gemini-3.8-flash", "gemini-2.0-flash"]
    gemini_models = list(dict.fromkeys(gemini_models))
    last_gemini_err = None

    for g_model in gemini_models:
        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=g_model,
                contents=[prompt],
                config={"response_mime_type": "application/json"}
            )
            raw_text = (response.text or "").strip()
            raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text, flags=re.IGNORECASE)
            raw_text = re.sub(r"\s*```$", "", raw_text)
            parsed = json.loads(raw_text.strip())
            normalized = _normalize_workflow_decision(parsed)
            decision = WorkflowDecision.model_validate(normalized).model_dump()
            decision["ai_provider"] = f"gemini:{g_model}"
            return decision
        except Exception as e:
            last_gemini_err = e
            print(f"[AI EVALUATION] Gemini '{g_model}' failed: {e}")

    raise RuntimeError(f"Workflow decision evaluation failed: {last_gemini_err}")
