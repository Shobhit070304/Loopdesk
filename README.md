# Loopdesk

Loopdesk is an agent-facing customer support copilot. It grounds answers and workflow decisions in a support team's own knowledge, accepts customer events through inbound webhooks, and keeps a human review step available for workflows that need one.

The initial product scope is a support-team workspace, not a customer-facing chatbot or a replacement for a ticketing system. A workflow can run **manually** (every event waits in the review queue) or **automatically** (every event follows the workflow's configured action). The mode belongs to the workflow; callers do not choose it for each customer event.

## Current capabilities

- Google Identity Services sign-in. FastAPI verifies the Google ID token and issues a signed session used by the Next.js server-side API proxy.
- Account-scoped PDF, TXT, Markdown, CSV and JSON uploads. Text is chunked, embedded, searchable, listable and removable.
- Grounded assistant answers using hybrid vector and keyword retrieval, with source names in the answer.
- Account-scoped semantic answer caching. Uploading or removing knowledge invalidates that account's cache.
- Workflow creation, webhook credentials, inbound event normalization, test events, workflow-wide manual/automatic mode, action dispatch and a customer review queue.
- Browser-local Ask history. It stays in local storage on the signed-in browser and is not sent to the server.

Slack and email workflow types currently use the generic outbound webhook contract; they are not native Slack or email integrations. A support platform can send events to an inbound webhook and receive an action payload at the configured HTTPS destination. Native ticket-system authentication and reply APIs require a provider-specific connector.

## Architecture

```text
Next.js frontend (Vercel or Node host)
  ├─ Google sign-in and HTTP-only signed session
  ├─ authenticated API proxy ─────────── FastAPI backend
  └─ public inbound webhook proxy ───────┘
                                           ├─ PostgreSQL + pgvector
                                           ├─ Redis
                                           └─ Google Gemini API
```

The backend derives the workspace key from the signed Google subject. Documents, retrieval, workflow records, executions and cache entries are scoped to that key. This release provides one private workspace per Google account; shared team memberships and organization administration are a later product capability.

## Local development

Requirements: Node.js 20+, Python 3.11+, PostgreSQL with pgvector, Redis, and a Gemini API key.

1. Start PostgreSQL/Redis from `api/docker-compose.yaml`, or use compatible managed services.
2. Create `api/.env` from `api/.env.example`. Configure `DB_URL`, `REDIS_URL`, `GEMINI_API_KEY`, `AUTH_GOOGLE_ID`, and a random `AUTH_SECRET` of at least 32 characters.
3. Install and start FastAPI:

   ```powershell
   cd api
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```

4. Create `frontend/.env.local` from `frontend/.env.example`. Set `BACKEND_URL`, `NEXT_PUBLIC_AUTH_GOOGLE_ID`, and the exact same `AUTH_SECRET` used by the API.
5. In Google Cloud, configure a Web OAuth client and add the local frontend origin (`http://localhost:3000`) to its authorized JavaScript origins.
6. Install and start Next.js:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

The backend applies the base schema and the versioned SQL migration at startup. `/health` is a liveness check. `/ready` checks PostgreSQL, Redis and Gemini configuration and is suitable for a deployment readiness probe.

## Environment variables

### FastAPI (`api/.env`)

| Variable | Purpose |
|---|---|
| `DB_URL` | PostgreSQL connection string with pgvector available |
| `REDIS_URL` | Redis connection string |
| `GEMINI_API_KEY` | Gemini API key |
| `AUTH_GOOGLE_ID` | Google web client ID used to verify ID tokens |
| `AUTH_SECRET` | Random session signing secret; must match the frontend value and be at least 32 characters |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins |
| `ENVIRONMENT` | Set to `production` to require HTTPS for outbound actions |
| `LEGACY_WORKSPACE_ID` | Optional Google `sub` to assign unowned legacy documents, workflows and cache rows during migration |
| `WEBHOOK_RATE_LIMIT_PER_MINUTE` | Optional per-workflow inbound event limit (default `300`) |
| `EMBEDDING_MODEL` | Optional embedding model override |
| `LLM_MODEL` | Optional generation model override |

### Next.js (`frontend/.env.local`)

| Variable | Purpose |
|---|---|
| `BACKEND_URL` | Private URL of the FastAPI service |
| `NEXT_PUBLIC_AUTH_GOOGLE_ID` | Same Google web client ID as the API |
| `AUTH_SECRET` | Same random session signing secret as the API |

## Existing database migration

The workspace migration adds ownership columns but does not guess which account owns existing global documents or workflows. Those records remain stored but are hidden from account-scoped requests until assigned.

For a single-account legacy install, identify the intended Google account's `google_sub` in the `users` table, set that value as `LEGACY_WORKSPACE_ID` on the API service, and restart the backend. The migration assigns only rows whose workspace is still empty. Review the account and database backup before doing this on production data. Do not set this value when old records belong to multiple customers; assign those records with a deliberate tenant migration first.

## Deployment checklist

1. Provision managed PostgreSQL with pgvector and managed Redis; take a database backup before the first migration.
2. Deploy the API container from `api/DockerFile`. Set the API environment variables above. Set `ENVIRONMENT=production`, use HTTPS, configure `CORS_ORIGINS`, and expose `/health` and `/ready` as liveness/readiness probes.
3. Deploy `frontend/` to Vercel or a Node host. Set `BACKEND_URL`, `NEXT_PUBLIC_AUTH_GOOGLE_ID`, and `AUTH_SECRET` in that environment. Keep `BACKEND_URL` private where the host supports private service networking.
4. Add the production frontend origin to Google OAuth authorized JavaScript origins. Use the same OAuth client ID and exact same session secret across frontend and API.
5. Send a test login, document upload, grounded Ask query, manual workflow event, approval, automatic workflow event, and action failure through staging before directing customer traffic.
6. Monitor API error rates, readiness, model failures, action dispatch failures and webhook throttling. Keep customer payloads and credentials out of application logs.

## API routes

All routes except `/health`, `/ready`, Google verification, framework docs, and tokenized inbound webhooks require a signed session through the frontend proxy.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/auth/google/verify` | Verify ID token, create/update account and issue signed session |
| `POST` | `/ingest/file` | Upload and index a supported knowledge file (15 MB maximum) |
| `GET` | `/documents` | List files in the current account workspace |
| `DELETE` | `/documents/{id}` | Remove an uploaded file and its indexed chunks |
| `POST` | `/ask` | Retrieve grounded support knowledge and answer a question |
| `POST` / `GET` | `/workflows` | Create/list workflows in the current account workspace |
| `PATCH` | `/workflows/{id}/execution-mode` | Change a workflow-wide `manual` or `automatic` mode |
| `POST` | `/api/webhooks/{token}` | Accept a customer event, evaluate the workflow and record the run |
| `GET` | `/workflow-executions` | List recent workflow activity for the current workspace |
| `POST` | `/workflows/executions/{id}/approve` | Approve a pending run and dispatch its action |
| `POST` | `/workflows/executions/{id}/reject` | Reject a pending run |

Inbound events accept common message fields (`event_text`, `text`, `message`, `description`, `customer_message`, `query`) and ticket-like payloads with `ticket.subject` / `ticket.description`. Include a stable `event_id` or `Idempotency-Key` so retries do not dispatch duplicate actions. The high-entropy webhook URL token is a bearer credential; optional HMAC or secret headers provide an additional check.

Outbound actions require a public destination. Local/private IPs and local hostnames are rejected, DNS results are checked before dispatch, production destinations must use HTTPS, redirects are not followed, and non-success HTTP responses are recorded as failures. Network-level egress controls are still recommended in production.

## Project layout

```text
api/
  main.py
  migrations/001_customer_workspace.sql
  DockerFile
frontend/
  app/                 # Next.js App Router pages and API routes
  lib/auth.ts          # Signed session verification for Next.js
```
