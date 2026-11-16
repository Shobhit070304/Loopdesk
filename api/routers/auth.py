import os
import time
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from core.config import AUTH_SECRET, GOOGLE_CLIENT_ID
from core.security import verify_token_claims, create_session_token

router = APIRouter(tags=["Authentication"])

class GoogleTokenRequest(BaseModel):
    id_token: str = Field(..., min_length=50, max_length=10_000)


@router.get("/health")
async def health():
    return {"status": "ok", "service": "loopdesk-api"}


@router.get("/ready")
async def readiness(request: Request):
    app = request.app
    if not getattr(app.state, "pool", None):
        raise HTTPException(status_code=503, detail="Database pool is not ready")
    try:
        async with app.state.pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database readiness probe failed: {e}")
    return {"status": "ready"}


@router.post("/auth/google/verify")
async def verify_google_sign_in(request: Request, body: GoogleTokenRequest):
    auth_secret = os.getenv("AUTH_SECRET") or AUTH_SECRET
    google_client_id = os.getenv("AUTH_GOOGLE_ID") or GOOGLE_CLIENT_ID
    if not auth_secret or len(auth_secret) < 32 or not google_client_id:
        raise HTTPException(status_code=503, detail="Google authentication is not properly configured")

    try:
        claims = await verify_token_claims(body.id_token, google_client_id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        print(f"[AUTH ERROR] Google token rejected: {type(e).__name__}")
        raise HTTPException(status_code=401, detail=f"Google ID token is invalid: {str(e)}")

    email_verified = claims.get("email_verified") in (True, "true", "True", 1)
    if not email_verified or not claims.get("sub") or not claims.get("email"):
        raise HTTPException(status_code=401, detail="A verified Google account is required")
    try:
        if int(claims.get("exp", 0)) <= int(time.time()):
            raise HTTPException(status_code=401, detail="Google ID token has expired")
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Google ID token expiry is invalid")

    sub = str(claims["sub"])
    email = str(claims["email"]).lower().strip()
    name = str(claims.get("name") or email.split("@")[0]).strip()
    picture = str(claims.get("picture") or "").strip()

    try:
        async with request.app.state.pool.acquire() as conn:
            existing_by_email = await conn.fetchrow("SELECT google_sub FROM users WHERE email = $1", email)
            if existing_by_email and existing_by_email["google_sub"] != sub:
                raise HTTPException(status_code=409, detail="This email is already linked to a different Google account.")
            row = await conn.fetchrow(
                """
                INSERT INTO users (google_sub, email, name, picture, created_at, last_login_at)
                VALUES ($1, $2, $3, $4, NOW(), NOW())
                ON CONFLICT (google_sub) DO UPDATE SET
                    email = EXCLUDED.email,
                    name = COALESCE(NULLIF(EXCLUDED.name, ''), users.name),
                    picture = COALESCE(NULLIF(EXCLUDED.picture, ''), users.picture),
                    last_login_at = NOW()
                RETURNING id, name, picture
                """,
                sub, email, name, picture
            )
            user_id = row["id"]
            display_name = row["name"] or name
            display_picture = row["picture"] or picture
    except HTTPException:
        raise
    except Exception as db_err:
        print(f"[AUTH DB ERROR] Could not persist user ({db_err})")
        raise HTTPException(status_code=503, detail="Sign-in could not be completed because the account store is unavailable.")

    user_payload = {
        "id": str(user_id),
        "sub": sub,
        "workspace_id": sub,
        "email": email,
        "name": display_name,
    }
    if display_picture:
        user_payload["picture"] = display_picture

    token = create_session_token(user_payload, secret=auth_secret)
    return {
        "ok": True,
        "user": user_payload,
        "session_token": token,
    }
