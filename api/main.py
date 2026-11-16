import time
import json
import base64
import hmac
import hashlib
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from core.config import IS_PRODUCTION, CORS_ORIGINS, AUTH_SECRET
from core.database import lifespan
from routers import auth, documents, workflows, executions, ask, webhooks, analytics

app = FastAPI(
    title="Loopdesk",
    lifespan=lifespan,
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

@app.middleware("http")
async def require_signed_session(request: Request, call_next):
    if (
        request.url.path in {"/health", "/ready", "/auth/google/verify", "/docs", "/redoc", "/openapi.json"}
        or request.url.path.startswith("/api/webhooks/")
        or request.url.path.startswith("/webhooks/")
        or request.method == "OPTIONS"
    ):
        return await call_next(request)

    secret = AUTH_SECRET
    token = request.headers.get("authorization", "")
    if token.startswith("Bearer "):
        token = token.removeprefix("Bearer ")
    try:
        payload, signature = token.split(".", 1)
        expected = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest()
        supplied = base64.urlsafe_b64decode(signature + "=" * (-len(signature) % 4))
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        valid = bool(secret) and hmac.compare_digest(expected, supplied) and claims.get("exp", 0) > time.time() and claims.get("sub") and claims.get("email")
        if valid:
            request.state.user = claims
    except Exception:
        valid = False
    if not valid:
        return JSONResponse({"detail": "A valid Google sign-in session is required."}, status_code=401)
    return await call_next(request)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"[UNHANDLED EXCEPTION] {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Server processing error: {str(exc)}"}
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Feature Routers
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(workflows.router)
app.include_router(executions.router)
app.include_router(ask.router)
app.include_router(webhooks.router)
app.include_router(analytics.router)
