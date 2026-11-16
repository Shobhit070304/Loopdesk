import os
import json
import time
import base64
import hashlib
import hmac
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from routers.workflows import evaluate_and_execute_workflow

router = APIRouter(tags=["Webhooks"])

@router.post("/api/webhooks/{webhook_token}")
@router.post("/webhooks/{webhook_token}")
async def handle_inbound_webhook(webhook_token: str, request: Request):
    body_chunks = []
    body_size = 0
    async for chunk in request.stream():
        body_size += len(chunk)
        if body_size > 1_000_000:
            raise HTTPException(status_code=413, detail="Webhook payloads must be 1 MB or smaller.")
        body_chunks.append(chunk)
    raw_body = b"".join(body_chunks)

    async with request.app.state.pool.acquire() as conn:
        wf_record = await conn.fetchrow("SELECT * FROM workflows WHERE webhook_token = $1", webhook_token)
        if not wf_record:
            raise HTTPException(status_code=404, detail="Inbound webhook endpoint not found or inactive")
        wf = dict(wf_record)
        if not wf.get("webhook_enabled", True):
            raise HTTPException(status_code=403, detail="Inbound webhook is disabled for this workflow")

        minute = int(time.time() // 60)
        rate_key = f"webhook-rate:{wf['id']}:{minute}"
        if getattr(request.app.state, "redis", None):
            try:
                rate = await request.app.state.redis.incr(rate_key)
                if rate == 1:
                    await request.app.state.redis.expire(rate_key, 120)
                if rate > int(os.getenv("WEBHOOK_RATE_LIMIT_PER_MINUTE", "50")):
                    raise HTTPException(status_code=429, detail="Webhook rate limit exceeded. Retry shortly.")
            except HTTPException:
                raise
            except Exception as redis_err:
                print(f"[WEBHOOK RATE LIMIT WARNING] Redis check failed: {redis_err}")

        # 1. Plain secret header (X-Loopdesk-Secret or X-Webhook-Secret)
        supplied_secret = request.headers.get("x-loopdesk-secret") or request.headers.get("x-webhook-secret")
        if supplied_secret and wf.get("webhook_secret"):
            if not hmac.compare_digest(supplied_secret, wf["webhook_secret"]):
                await conn.execute("""
                    INSERT INTO workflow_executions (workflow_id, trigger_payload, decision_output, status, source)
                    VALUES ($1, $2::jsonb, $3::jsonb, 'webhook_signature_failed', 'inbound_webhook')
                """, wf["id"], json.dumps({"event_text": "Secret header verification failed."}), json.dumps({"error": "Invalid webhook secret provided in header.", "decision": "REJECT", "reasoning": "Plain secret header did not match workflow secret."}))
                raise HTTPException(status_code=401, detail="Invalid webhook secret")

        # 2. Cryptographic HMAC signature header (X-Loopdesk-Signature or X-Hub-Signature-256 or Stripe-Signature)
        supplied_sig = (
            request.headers.get("x-loopdesk-signature")
            or request.headers.get("x-hub-signature-256")
            or request.headers.get("stripe-signature")
            or request.headers.get("x-shopify-hmac-sha256")
        )
        if supplied_sig and wf.get("webhook_secret"):
            digest = hmac.new(wf["webhook_secret"].encode(), raw_body, hashlib.sha256).digest()
            expected_hex = digest.hex()
            expected_b64 = base64.b64encode(digest).decode()
            valid_sig = hmac.compare_digest(supplied_sig, expected_hex) or hmac.compare_digest(supplied_sig, f"sha256={expected_hex}") or hmac.compare_digest(supplied_sig, expected_b64)
            stripe_header = request.headers.get("stripe-signature")
            if stripe_header:
                pieces = [part.split("=", 1) for part in stripe_header.split(",") if "=" in part]
                values = {key: value for key, value in pieces}
                timestamp = values.get("t", "")
                signatures = [value for key, value in pieces if key == "v1"]
                try:
                    timestamp_valid = abs(int(time.time()) - int(timestamp)) <= 300
                except ValueError:
                    timestamp_valid = False
                stripe_expected = hmac.new(wf["webhook_secret"].encode(), f"{timestamp}.".encode() + raw_body, hashlib.sha256).hexdigest()
                valid_sig = timestamp_valid and any(hmac.compare_digest(signature, stripe_expected) for signature in signatures)
            if not valid_sig:
                await conn.execute("""
                    INSERT INTO workflow_executions (workflow_id, trigger_payload, decision_output, status, source)
                    VALUES ($1, $2::jsonb, $3::jsonb, 'webhook_signature_failed', 'inbound_webhook')
                """, wf["id"], json.dumps({"event_text": "HMAC signature verification failed.", "raw_preview": raw_body[:500].decode("utf-8", errors="replace")}), json.dumps({"error": "Cryptographic signature mismatch. Please check your HMAC signing secret.", "decision": "REJECT", "reasoning": "Signature mismatch."}))
                raise HTTPException(status_code=401, detail="Invalid webhook signature")

        # Parse body
        try:
            payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
        except Exception:
            await conn.execute("""
                INSERT INTO workflow_executions (workflow_id, trigger_payload, decision_output, status, source)
                VALUES ($1, $2::jsonb, $3::jsonb, 'webhook_payload_invalid', 'inbound_webhook')
            """, wf["id"], json.dumps({"event_text": "Malformed non-JSON payload received.", "raw_preview": raw_body[:500].decode("utf-8", errors="replace")}), json.dumps({"error": "Payload could not be parsed as valid JSON.", "decision": "REJECT", "reasoning": "Invalid JSON format."}))
            raise HTTPException(status_code=400, detail="Invalid JSON in webhook payload")

        # Extract text description
        if isinstance(payload, dict):
            event_text = (
                payload.get("event_text")
                or payload.get("text")
                or payload.get("message")
                or payload.get("description")
                or payload.get("issue")
                or payload.get("customer_message")
                or payload.get("query")
            )
            ticket_payload = payload.get("ticket") if isinstance(payload.get("ticket"), dict) else {}
            if not event_text and ticket_payload:
                event_text = "\n\n".join(str(value) for value in (ticket_payload.get("subject"), ticket_payload.get("description")) if value)
            if not event_text and "order" in payload and isinstance(payload["order"], dict):
                event_text = payload["order"].get("note") or f"Order #{payload['order'].get('id', '')}"
            if not event_text:
                event_text = ", ".join(f"{k}: {v}" for k, v in payload.items() if isinstance(v, (str, int, float, bool)))
            if not event_text:
                event_text = json.dumps(payload)
            ticket = payload.get("ticket") if isinstance(payload.get("ticket"), dict) else {}
            requester = payload.get("requester") if isinstance(payload.get("requester"), dict) else {}
            customer = payload.get("customer") if isinstance(payload.get("customer"), dict) else {}
            normalized_metadata = {
                "channel": payload.get("channel") or payload.get("source") or "webhook",
                "event_type": payload.get("event_type") or payload.get("type"),
                "ticket_id": payload.get("ticket_id") or payload.get("id") or ticket.get("id"),
                "customer_id": payload.get("customer_id") or customer.get("id") or requester.get("id"),
                "customer_name": payload.get("customer_name") or customer.get("name") or requester.get("name"),
                "customer_email": payload.get("customer_email") or customer.get("email") or requester.get("email"),
                "subject": payload.get("subject") or ticket.get("subject"),
            }
            idempotency_key = request.headers.get("idempotency-key") or request.headers.get("x-webhook-event-id") or payload.get("event_id")
        else:
            event_text = str(payload)
            normalized_metadata = {"channel": "webhook", "payload": {"raw": payload}}
            idempotency_key = request.headers.get("idempotency-key") or request.headers.get("x-webhook-event-id")
        event_text = str(event_text).strip()
        if not event_text or event_text in {"{}", "null", "[]"}:
            await conn.execute("""
                INSERT INTO workflow_executions (workflow_id, trigger_payload, decision_output, status, source)
                VALUES ($1, $2::jsonb, $3::jsonb, 'webhook_payload_invalid', 'inbound_webhook')
            """, wf["id"], json.dumps({"event_text": "Empty event payload or missing customer inquiry text.", "raw_preview": str(payload)[:500]}), json.dumps({"error": "Webhook payload must include a customer message, ticket, or event description.", "decision": "REJECT", "reasoning": "No event text extracted."}))
            raise HTTPException(status_code=422, detail="Webhook payload must include a customer message or event description.")
        if len(event_text) > 10_000:
            raise HTTPException(status_code=413, detail="Customer event text must be 10,000 characters or fewer.")
        if idempotency_key is not None:
            idempotency_key = str(idempotency_key).strip()
            if not idempotency_key or len(idempotency_key) > 255:
                raise HTTPException(status_code=422, detail="Idempotency key must be between 1 and 255 characters.")

        return await evaluate_and_execute_workflow(
            request.app, conn, wf, event_text, normalized_metadata, source="inbound_webhook", idempotency_key=idempotency_key
        )
