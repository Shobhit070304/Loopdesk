import os
import json
import time
import asyncio
import base64
import hmac
import hashlib
import ipaddress
import socket
from urllib.parse import urlsplit
from typing import Any, Dict, Optional
import httpx
from fastapi import HTTPException, Request
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from core.config import AUTH_SECRET, GOOGLE_CLIENT_ID, IS_PRODUCTION

def workspace_id(request: Request) -> str:
    """Extracts authenticated workspace ID (user sub) from request state."""
    claims = getattr(request.state, "user", None) or {}
    value = claims.get("workspace_id") or claims.get("sub")
    if not value:
        raise HTTPException(status_code=401, detail="A signed-in workspace is required.")
    return str(value)


def create_session_token(user: Dict[str, Any], secret: Optional[str] = None) -> str:
    """Generates an HMAC-SHA256 signed session cookie token."""
    active_secret = secret or AUTH_SECRET
    payload_data = {**user, "exp": int(time.time()) + 60 * 60 * 24 * 7}
    payload = base64.urlsafe_b64encode(
        json.dumps(payload_data, separators=(",", ":"), ensure_ascii=False).encode()
    ).decode().rstrip("=")
    signature = hmac.new(active_secret.encode(), payload.encode(), hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    return f"{payload}.{encoded_signature}"


async def verify_token_claims(token: str, client_id: str) -> Dict[str, Any]:
    """Verifies Google ID token cryptographically, with fallback to Google tokeninfo."""
    try:
        idinfo = google_id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            client_id,
            clock_skew_in_seconds=10,
        )
        return idinfo
    except Exception as local_err:
        print(f"[AUTH WARNING] Local Google token validation failed: {type(local_err).__name__}. Falling back to tokeninfo...")

    # Fallback to Google's official tokeninfo endpoint
    try:
        async with httpx.AsyncClient(timeout=10.0) as http_client:
            res = await http_client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": token}
            )
            if res.status_code == 200:
                claims = res.json()
                aud = claims.get("aud")
                if aud != client_id:
                    raise ValueError(f"Token audience mismatch: got {aud}, expected {client_id}")
                iss = claims.get("iss", "")
                if iss not in ("accounts.google.com", "https://accounts.google.com"):
                    raise ValueError(f"Invalid token issuer: {iss}")
                return claims
            else:
                raise ValueError(f"Google tokeninfo rejected token with status {res.status_code}")
    except Exception as remote_err:
        raise ValueError(f"Google token verification failed: {remote_err}")


def validate_action_url_syntax(value: str) -> str:
    """Validates destination action URLs for syntax, protocol, and absence of credentials."""
    parsed = urlsplit(value)
    if parsed.scheme not in {"https", "http"} or not parsed.hostname or parsed.username or parsed.password:
        raise HTTPException(
            status_code=422,
            detail="Action destinations must be valid public HTTP(S) URLs without embedded credentials."
        )
    if parsed.scheme != "https" and IS_PRODUCTION:
        raise HTTPException(status_code=422, detail="Production action destinations must use HTTPS.")
    host = parsed.hostname.lower().rstrip(".")
    if IS_PRODUCTION:
        if host in {"localhost", "localhost.localdomain"} or host.endswith((".localhost", ".local", ".internal", ".test")):
            raise HTTPException(status_code=422, detail="Private or local action destinations are not allowed in production.")
        try:
            ip = ipaddress.ip_address(host)
            if not ip.is_global:
                raise HTTPException(status_code=422, detail="Private or reserved action destinations are not allowed in production.")
        except ValueError:
            pass
    return value


async def validate_action_url_destination(value: str) -> str:
    """Guards against SSRF attacks by resolving DNS and verifying non-private IP addresses."""
    value = validate_action_url_syntax(value)
    if not IS_PRODUCTION:
        return value
    host = urlsplit(value).hostname or ""
    try:
        resolved = await asyncio.wait_for(
            asyncio.to_thread(socket.getaddrinfo, host, None, 0, socket.SOCK_STREAM),
            timeout=4
        )
    except Exception:
        raise HTTPException(status_code=422, detail="Action destination could not be resolved to a public address.")
    addresses = {entry[4][0] for entry in resolved}
    if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise HTTPException(status_code=422, detail="Action destination resolves to a private or reserved address.")
    return value

