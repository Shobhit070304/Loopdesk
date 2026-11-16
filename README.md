# Loopdesk

Loopdesk is an autonomous customer support copilot engineered for support teams and platform operators. It grounds every automated reply in verified company policy documents, accelerates repeated inquiries through sub-50ms dual-tier caching (Redis L1 + pgvector L2), and keeps operators in complete control with an inline human review queue.

Created and authored by **Shobhit Sharma**.

---

## Capabilities & Architecture

- **Grounding & Hybrid Search**: Documents (PDF, TXT, Markdown, CSV, JSON) are chunked via recursive character splitting and vectorized into 768-dimensional embeddings using `text-embedding-004`. Retrieval combines PostgreSQL full-text search (GIN index) and vector cosine similarity (HNSW index) via Reciprocal Rank Fusion (RRF).
- **Dual-Tier Acceleration & Semantic Cache**:
  - **L1 Cache (Redis)**: Sub-10ms exact-match query hash cache.
  - **L2 Cache (PostgreSQL pgvector)**: Sub-50ms cosine similarity semantic cache (\(\ge 0.96\) similarity threshold).
  - Cache is workspace-isolated and auto-invalidated whenever policy documents are uploaded or removed.
- **Workflow Automation & Execution Modes**:
  - **Manual Mode**: Every event enters the Human Review Queue where operators can inspect AI reasoning, edit reply text, and approve/reject before email dispatch.
  - **Automatic Mode**: High-confidence decisions execute instantly via webhook/email dispatch.
- **Resilient AI Pipeline**: Primary reasoning is executed using Google Gemini (`gemini-2.5-flash`), backed by automatic fallback to Groq (`llama-3.3-70b-versatile`) if rate limits or network errors occur.
- **Execution Trace & Sandbox Simulator**: Built-in 4-stage dry-run debugger (`/workflows/{id}/simulate`) that traces Intake, Retrieval, Reasoning, and Dispatch latencies without triggering live outbound calls.
- **Multi-Tenant Workspace Security**: Google OAuth ID token verification with HMAC-SHA256 signed session cookies, SSRF destination protection, and atomic database state transitions.

---

## System Architecture

```text
Next.js 16 (App Router + Tailwind CSS)
  ├─ Google Identity Services (Client-side token exchange)
  ├─ HTTP-only Signed Session Cookies
  ├─ Authenticated Backend Proxy (/api/backend/*) ─── FastAPI (Python 3.11+)
  └─ Inbound Webhook Forwarding ───────────────────────┘
                                                        ├─ Core (config, database, security)
                                                        ├─ Services (ai, search, cache)
                                                        ├─ Routers (auth, docs, workflows, executions, ask, webhooks, analytics)
                                                        ├─ PostgreSQL + pgvector (768-dim HNSW + GIN FTS)
                                                        ├─ Redis (Docker / Upstash)
                                                        └─ Google Gemini / Groq LLMs
```

---

## Local Development Quickstart

### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker (for local Redis)
- PostgreSQL with `pgvector` enabled (local or managed e.g. Neon, Supabase)

### 1. Redis
Start Redis in Docker:
```bash
docker run -d --name loopdesk-redis -p 6379:6379 redis:7-alpine
```

### 2. Backend (FastAPI)
```bash
cd api
python -m venv .venv
# On Windows PowerShell:
.venv\Scripts\Activate.ps1
# On macOS / Linux:
# source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env with your DB_URL, GEMINI_API_KEY, AUTH_SECRET, etc.

uvicorn main:app --reload --port 8000
```

### 3. Frontend (Next.js)
```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with matching AUTH_SECRET, BACKEND_URL=http://localhost:8000, etc.

npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

### Backend (`api/.env`)
| Variable | Description |
|---|---|
| `DB_URL` | PostgreSQL connection URL with `pgvector` enabled |
| `REDIS_URL` | Redis URL (default: `redis://localhost:6379`) |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `EMBEDDING_MODEL` | Default: `text-embedding-004` |
| `LLM_MODEL` | Default: `gemini-2.5-flash` |
| `GROQ_API_KEY` | Optional fallback Groq API key |
| `GROQ_MODEL` | Default: `llama-3.3-70b-versatile` |
| `AUTH_GOOGLE_ID` | Google OAuth Client ID |
| `AUTH_SECRET` | 32+ character HMAC session signing secret |
| `CORS_ORIGINS` | Allowed frontend origins (e.g. `http://localhost:3000`) |
| `ENVIRONMENT` | `development` or `production` (enforces HTTPS on webhooks) |

### Frontend (`frontend/.env.local`)
| Variable | Description |
|---|---|
| `BACKEND_URL` | Internal FastAPI service address (`http://localhost:8000`) |
| `NEXT_PUBLIC_AUTH_GOOGLE_ID` | Same Google OAuth Client ID |
| `AUTH_SECRET` | Same 32+ character HMAC session signing secret |

---

## API Reference

All protected endpoints require an authenticated signed session token via the Next.js API proxy (`/api/backend/*`).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` / `/ready` | Liveness and readiness probes |
| `POST` | `/auth/google/verify` | Verify Google ID token and return signed session token |
| `POST` | `/ingest/file` | Upload and chunk knowledge document (PDF, TXT, MD, CSV, JSON) |
| `GET` | `/documents` | List knowledge documents in active workspace |
| `GET` | `/documents/{id}/chunks` | Preview vectorized passages and chunk IDs for a document |
| `DELETE` | `/documents/{id}` | Delete document, vector chunks, and invalidate workspace cache |
| `POST` | `/ask` | Ask Policy Copilot (Dual-tier cache accelerated) |
| `GET` / `POST` | `/workflows` | List or create workflows |
| `GET` / `PATCH` / `DELETE` | `/workflows/{id}` | Retrieve, update, or remove workflow |
| `POST` | `/workflows/{id}/simulate` | 4-Stage execution trace & dry-run debugger |
| `POST` | `/workflows/{id}/webhook/test` | Trigger a test inquiry against workflow |
| `POST` | `/workflows/{id}/webhook/regenerate` | Rotate webhook token and secret |
| `POST` | `/workflows/{id}/webhook/toggle` | Enable or disable inbound webhook endpoint |
| `POST` | `/api/webhooks/{token}` | Public inbound webhook intake (Rate-limited, HMAC verified) |
| `GET` | `/workflow-executions` | List execution history and pending reviews |
| `POST` | `/workflows/executions/{id}/approve` | Approve review item, optionally edit message, and dispatch |
| `POST` | `/workflows/executions/{id}/reject` | Reject pending workflow execution |
| `POST` | `/workflows/executions/{id}/retry` | Retry action dispatch for failed executions |
| `GET` | `/analytics` | Real-time cache hit rates, p95 latencies, and token economics |

---

## Codebase Structure

```text
Loopdesk/
├── api/
│   ├── core/
│   │   ├── config.py         # Centralized configuration & environment validation
│   │   ├── database.py       # Asyncpg connection pooling, migrations & seeders
│   │   └── security.py       # HMAC session signing, Google OAuth & SSRF guards
│   ├── services/
│   │   ├── ai.py             # Lazy GenAI client, Gemini reasoning & Groq fallback
│   │   ├── cache.py          # L1 Redis + L2 pgvector semantic cache invalidation
│   │   └── search.py         # Hybrid search & Reciprocal Rank Fusion (RRF)
│   ├── routers/
│   │   ├── analytics.py      # Telemetry & cost-savings metrics
│   │   ├── ask.py            # Grounded Policy Copilot endpoint
│   │   ├── auth.py           # Google authentication, /health & /ready
│   │   ├── documents.py      # File ingestion, chunk listing & deletion
│   │   ├── executions.py     # Review queue triage, approvals & retries
│   │   ├── webhooks.py       # Public inbound webhook ingestion & verification
│   │   └── workflows.py      # Workflow management, simulation & action dispatch
│   ├── migrations/           # SQL migration scripts
│   ├── main.py               # Clean FastAPI app orchestrator & route mounting
│   └── requirements.txt      # Production Python dependencies
├── frontend/
│   ├── app/
│   │   ├── analytics/        # Analytics & telemetry dashboard
│   │   ├── approvals/        # Human-in-the-loop customer review queue
│   │   ├── ask/              # Policy Copilot chat interface
│   │   ├── blogs/            # Technical blog & documentation
│   │   ├── documents/        # Knowledge Base upload & passage preview drawer
│   │   ├── login/            # Authentication & demo mode portal
│   │   ├── workflows/        # Visual workflow builder & dry-run debugger
│   │   ├── components.tsx    # Shared UI: Navbar, Sidebar, Access Boundary
│   │   ├── globals.css       # Clean design tokens & minimal base styles
│   │   └── page.tsx          # High-converting dark SaaS landing page
│   ├── lib/
│   │   └── auth.ts           # HMAC session cookie parser & verifier
│   └── package.json          # Next.js 16 dependencies
└── docker-compose.yml        # Docker compose configuration for Redis
```

---

## License & Credits

Built with precision by **Shobhit Sharma**. Released under the MIT License.
