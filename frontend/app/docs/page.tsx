"use client";

import { useState } from "react";
import { Nav, SectionLabel } from "../components";

interface EndpointDoc {
  id: string;
  category: "Ingestion" | "Retrieval" | "Answers" | "Workflows" | "System";
  method: "GET" | "POST" | "DELETE";
  path: string;
  title: string;
  description: string;
  curlExample: string;
  requestBody?: string;
  requestFields?: { name: string; type: string; required: boolean; desc: string }[];
  responseBody: string;
}

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const ENDPOINTS: EndpointDoc[] = [
  {
    id: "ingest",
    category: "Ingestion",
    method: "POST",
    path: "/ingest",
    title: "Upload & Index a Document",
    description:
      "Paste any text content (policy manuals, help articles, notes). The system splits it into 500-character chunks, generates 768-dimensional Gemini embeddings, and indexes them in PostgreSQL for instant search.",
    curlExample: `curl -X POST "${API_BASE}/ingest" \\
  -H "Content-Type: application/json" \\
  -d '{"document_text": "Returns are accepted within 14 days with original receipt."}'`,
    requestBody: JSON.stringify(
      {
        document_text: "Returns are accepted within 14 days of purchase with original receipt.",
      },
      null,
      2
    ),
    requestFields: [
      {
        name: "document_text",
        type: "string",
        required: true,
        desc: "Raw text to be indexed into the knowledge base (1 to 50,000 characters).",
      },
    ],
    responseBody: JSON.stringify(
      {
        message: "Successfully ingested 2 chunks into the database.",
      },
      null,
      2
    ),
  },
  {
    id: "ingest-file",
    category: "Ingestion",
    method: "POST",
    path: "/ingest/file",
    title: "Upload & Parse Document File (PDF / Text)",
    description:
      "Upload a PDF, TXT, or Markdown document directly. The backend parses the file with pypdf, chunks the extracted text into 500-character segments, calculates embeddings, and indexes them in PostgreSQL.",
    curlExample: `curl -X POST "${API_BASE}/ingest/file" \\
  -F "file=@company_policy.pdf"`,
    requestFields: [
      {
        name: "file",
        type: "binary (multipart/form-data)",
        required: true,
        desc: "The file to upload (.pdf, .txt, .md, .csv).",
      },
    ],
    responseBody: JSON.stringify(
      {
        filename: "company_policy.pdf",
        message: "Successfully ingested 8 chunks from company_policy.pdf.",
        chunks_count: 8,
      },
      null,
      2
    ),
  },
  {
    id: "list-docs",
    category: "Ingestion",
    method: "GET",
    path: "/documents",
    title: "List Ingested Documents",
    description:
      "View a paginated list of all stored document chunks, including creation timestamps and snippets of the text content.",
    curlExample: `curl -X GET "${API_BASE}/documents?limit=10&offset=0"`,
    responseBody: JSON.stringify(
      {
        total: 14,
        documents: [
          {
            id: 1,
            snippet: "Returns are accepted within 14 days of purchase with original receipt...",
            created_at: "2026-10-15T10:30:00Z",
          },
        ],
      },
      null,
      2
    ),
  },
  {
    id: "delete-doc",
    category: "Ingestion",
    method: "DELETE",
    path: "/documents/{id}",
    title: "Delete a Document Chunk",
    description: "Remove a specific document chunk from your knowledge base by its numeric ID.",
    curlExample: `curl -X DELETE "${API_BASE}/documents/1"`,
    responseBody: JSON.stringify(
      {
        message: "Document 1 deleted successfully",
      },
      null,
      2
    ),
  },
  {
    id: "retrieve",
    category: "Retrieval",
    method: "POST",
    path: "/retrieve",
    title: "Hybrid Search (Vector + Keywords)",
    description:
      "Find the most relevant chunks for any search query. Combines dense vector similarity with full-text keyword indexing and blends them using Reciprocal Rank Fusion (RRF).",
    curlExample: `curl -X POST "${API_BASE}/retrieve" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "return window for headphones", "top_k": 3}'`,
    requestBody: JSON.stringify(
      {
        query: "What is the return window?",
        top_k: 3,
      },
      null,
      2
    ),
    requestFields: [
      {
        name: "query",
        type: "string",
        required: true,
        desc: "The search query or phrase you want to find.",
      },
      {
        name: "top_k",
        type: "number",
        required: false,
        desc: "Number of ranked chunks to return (default is 3, max 20).",
      },
    ],
    responseBody: JSON.stringify(
      {
        query: "What is the return window?",
        results: [
          {
            id: 1,
            content: "Returns are accepted within 14 days of purchase with original receipt.",
            rrf_score: 0.03278,
          },
        ],
      },
      null,
      2
    ),
  },
  {
    id: "ask",
    category: "Answers",
    method: "POST",
    path: "/ask",
    title: "Ask a Question (AI Generation & Cache)",
    description:
      "The complete RAG pipeline: First checks the high-speed Redis semantic cache. On a miss, performs hybrid search and prompts Gemini 2.5 Flash to generate a grounded, factual answer.",
    curlExample: `curl -X POST "${API_BASE}/ask" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "Can I return an item after 20 days?", "top_k": 3}'`,
    requestBody: JSON.stringify(
      {
        query: "Can I return an item after 20 days?",
        top_k: 3,
      },
      null,
      2
    ),
    requestFields: [
      {
        name: "query",
        type: "string",
        required: true,
        desc: "Your question in plain English.",
      },
      {
        name: "top_k",
        type: "number",
        required: false,
        desc: "How many context chunks to provide to the AI model.",
      },
    ],
    responseBody: JSON.stringify(
      {
        query: "Can I return an item after 20 days?",
        answer: "No, returns are strictly accepted within 14 days of purchase with original receipt.",
        source: "documents_retrieved",
      },
      null,
      2
    ),
  },
  {
    id: "create-workflow",
    category: "Workflows",
    method: "POST",
    path: "/workflows",
    title: "Create an Automation Workflow",
    description:
      "Define an automated decision rule. Set the instructions Gemini should use to evaluate incoming events and optionally provide a destination webhook URL.",
    curlExample: `curl -X POST "${API_BASE}/workflows" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Refund Policy Triager",
    "system_prompt": "Evaluate if the customer request meets our 14-day return window.",
    "action_type": "webhook",
    "action_url": "https://your-crm.com/api/refunds"
  }'`,
    requestBody: JSON.stringify(
      {
        name: "Refund Policy Triager",
        description: "Validates incoming refund tickets against our store policies.",
        system_prompt: "Evaluate if the customer request meets our 14-day return window.",
        action_type: "webhook",
        action_url: "https://your-crm.com/api/refunds",
        require_approval: true,
      },
      null,
      2
    ),
    requestFields: [
      {
        name: "name",
        type: "string",
        required: true,
        desc: "A friendly name for the workflow.",
      },
      {
        name: "system_prompt",
        type: "string",
        required: true,
        desc: "Instructions telling Gemini how to judge the event against your documents.",
      },
      {
        name: "action_type",
        type: "string",
        required: false,
        desc: "Action type: 'webhook', 'slack', or 'email'. Default is 'webhook'.",
      },
      {
        name: "action_url",
        type: "string",
        required: false,
        desc: "Destination URL where the decision payload will be automatically posted.",
      },
      {
        name: "require_approval",
        type: "boolean",
        required: false,
        desc: "When true, holds outbound actions in the Approval Queue for human sign-off before dispatching.",
      },
    ],
    responseBody: JSON.stringify(
      {
        id: 1,
        name: "Refund Policy Triager",
        description: "Validates incoming refund tickets against our store policies.",
        action_type: "webhook",
        action_url: "https://your-crm.com/api/refunds",
        require_approval: true,
        created_at: "2026-10-15T11:00:00Z",
      },
      null,
      2
    ),
  },
  {
    id: "trigger-workflow",
    category: "Workflows",
    method: "POST",
    path: "/workflows/{id}/trigger",
    title: "Trigger an Automation Event",
    description:
      "Send an incoming ticket, email, or webhook event to an active workflow. The engine pulls relevant knowledge, generates a structured JSON decision (APPROVE / REJECT / ESCALATE), and fires the action webhook.",
    curlExample: `curl -X POST "${API_BASE}/workflows/1/trigger" \\
  -H "Content-Type: application/json" \\
  -d '{"event_text": "Customer purchased 5 days ago, requests full refund with receipt."}'`,
    requestBody: JSON.stringify(
      {
        event_text: "Customer purchased 5 days ago, requests full refund with receipt.",
        metadata: { customer_id: "cust_1092" },
      },
      null,
      2
    ),
    requestFields: [
      {
        name: "event_text",
        type: "string",
        required: true,
        desc: "The inbound message or claim text to evaluate.",
      },
      {
        name: "metadata",
        type: "object",
        required: false,
        desc: "Optional key-value data (e.g. order_id, user_email).",
      },
    ],
    responseBody: JSON.stringify(
      {
        status: "executed",
        workflow_id: 1,
        decision: {
          decision: "APPROVE",
          confidence: 0.98,
          reasoning: "The customer made the request within 5 days, which satisfies our 14-day policy.",
          action_payload: {
            message: "Hello! Your return is approved. Here is your RMA prepaid label...",
          },
        },
        referenced_docs_count: 2,
      },
      null,
      2
    ),
  },
  {
    id: "list-executions",
    category: "Workflows",
    method: "GET",
    path: "/workflows/{id}/executions",
    title: "List Workflow Execution History",
    description:
      "Retrieve the historical audit log of runs for a workflow, including event input snippets, Gemini decisions, reasoning, and dispatch statuses.",
    curlExample: `curl -X GET "${API_BASE}/workflows/1/executions?limit=20"`,
    responseBody: JSON.stringify(
      [
        {
          id: 12,
          trigger_payload: { event_text: "Customer request for refund within 5 days" },
          decision_output: {
            decision: "APPROVE",
            confidence: 0.98,
            reasoning: "Request meets store policy criteria.",
            action_payload: { message: "Return authorized." },
          },
          status: "pending_approval",
          executed_at: "2026-10-16T12:00:00Z",
        },
      ],
      null,
      2
    ),
  },
  {
    id: "approve-execution",
    category: "Workflows",
    method: "POST",
    path: "/workflows/executions/{id}/approve",
    title: "Approve Queued Execution (Human-in-the-Loop)",
    description:
      "Approve a held workflow execution. Immediately triggers the outbound action (webhook/alert) and updates status to executed.",
    curlExample: `curl -X POST "${API_BASE}/workflows/executions/12/approve"`,
    responseBody: JSON.stringify(
      {
        status: "executed",
        execution_id: 12,
      },
      null,
      2
    ),
  },
  {
    id: "reject-execution",
    category: "Workflows",
    method: "POST",
    path: "/workflows/executions/{id}/reject",
    title: "Reject Queued Execution",
    description:
      "Reject a held workflow execution. Halts outbound dispatch and logs the status as rejected in the audit trail.",
    curlExample: `curl -X POST "${API_BASE}/workflows/executions/12/reject"`,
    responseBody: JSON.stringify(
      {
        status: "rejected",
        execution_id: 12,
      },
      null,
      2
    ),
  },
  {
    id: "health",
    category: "System",
    method: "GET",
    path: "/health",
    title: "System Health Check",
    description:
      "Quick heartbeat check to confirm that the API server is online and operational.",
    curlExample: `curl -X GET "${API_BASE}/health"`,
    responseBody: JSON.stringify(
      {
        status: "healthy",
        message: "System running",
      },
      null,
      2
    ),
  },
];

export default function DocsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const categories = ["All", "Ingestion", "Retrieval", "Answers", "Workflows", "System"];

  const filtered = ENDPOINTS.filter((ep) => {
    const matchesCat = selectedCategory === "All" || ep.category === selectedCategory;
    const matchesSearch =
      ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  function handleCopyCurl(id: string, curl: string) {
    navigator.clipboard.writeText(curl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="relative z-1 min-h-screen flex flex-col bg-bg text-fg font-sans">
      <Nav active="docs" />

      <main className="max-w-285 mx-auto px-8 w-full pt-10 flex-1 pb-20">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="border-b border-rim pb-8 mb-10 flex justify-between items-end flex-wrap gap-6">
          <div>
            <p className="text-subtle text-xs tracking-[0.22em] uppercase mb-2">
              Developer Reference & Guides
            </p>
            <h1 className="font-serif text-[2.5rem] leading-tight text-fg">
              API <em className="text-gold">Documentation</em>
            </h1>
            <p className="text-subtle text-sm mt-2 max-w-160 leading-relaxed">
              Integrate enterprise retrieval, question answering, and decision automations into
              your own applications with simple JSON REST endpoints.
            </p>
          </div>

          <div className="flex items-center gap-2 border border-rim px-4 py-2.5 rounded-lg bg-surface text-xs text-subtle">
            <span>Base URL:</span>
            <code className="text-gold font-mono">{API_BASE}</code>
          </div>
        </div>

        {/* ── Filter Bar ─────────────────────────────────────────── */}
        <div className="flex justify-between items-center gap-4 flex-wrap mb-8">
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs uppercase tracking-[0.12em] px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-gold text-bg font-bold shadow-md shadow-gold/20"
                    : "bg-surface border border-rim text-subtle hover:text-fg hover:border-gold/40"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Search endpoints (e.g. /ask, workflows)…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-[#0b0d14] border border-rim rounded-md px-3.5 py-1.5 text-xs text-fg outline-none focus:border-gold/60 w-64 placeholder:text-subtle/60"
          />
        </div>

        {/* ── Endpoints List ─────────────────────────────────────── */}
        <div className="space-y-8">
          {filtered.length === 0 ? (
            <div className="p-12 text-center border border-rim bg-surface rounded-xl">
              <p className="text-subtle text-sm">No matching API endpoints found.</p>
            </div>
          ) : (
            filtered.map((ep) => (
              <div
                key={ep.id}
                id={ep.id}
                className="border border-rim bg-surface/80 rounded-xl overflow-hidden backdrop-blur-md transition-all hover:border-gold/30"
              >
                {/* Endpoint Header Bar */}
                <div className="p-6 border-b border-rim/80 flex justify-between items-start gap-4 flex-wrap bg-white/1">
                  <div>
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span
                        className={`text-[11px] font-bold tracking-wider px-2.5 py-0.5 rounded border ${
                          ep.method === "GET"
                            ? "border-sky-500/40 text-sky-400 bg-sky-500/10"
                            : ep.method === "POST"
                            ? "border-gold/40 text-gold bg-gold/10"
                            : "border-danger/40 text-danger bg-danger/10"
                        }`}
                      >
                        {ep.method}
                      </span>
                      <span className="font-mono text-sm text-fg font-medium">{ep.path}</span>
                      <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 border border-rim text-subtle rounded">
                        {ep.category}
                      </span>
                    </div>
                    <h2 className="font-serif text-lg text-fg">{ep.title}</h2>
                    <p className="text-subtle text-xs mt-1.5 max-w-175 leading-relaxed">
                      {ep.description}
                    </p>
                  </div>

                  <button
                    onClick={() => handleCopyCurl(ep.id, ep.curlExample)}
                    className="inline-flex items-center gap-1.5 text-xs tracking-wider uppercase px-3.5 py-2 border border-gold/40 text-gold rounded hover:bg-gold hover:text-bg transition-colors"
                  >
                    <span>{copiedId === ep.id ? "Copied ✓" : "Copy cURL"}</span>
                  </button>
                </div>

                {/* Details Grid */}
                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-[#090b10]/60">
                  {/* Left: Request Parameters */}
                  <div className="space-y-4">
                    <SectionLabel>Request Details</SectionLabel>

                    {ep.requestFields && ep.requestFields.length > 0 && (
                      <div className="border border-rim rounded-lg overflow-hidden bg-surface/50 text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-rim text-subtle uppercase tracking-wider text-[10px]">
                              <th className="py-2 px-3">Field</th>
                              <th className="py-2 px-3">Type</th>
                              <th className="py-2 px-3">Required</th>
                              <th className="py-2 px-3">Description</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-rim/60">
                            {ep.requestFields.map((f) => (
                              <tr key={f.name}>
                                <td className="py-2.5 px-3 font-mono text-gold">{f.name}</td>
                                <td className="py-2.5 px-3 text-subtle font-mono text-[11px]">
                                  {f.type}
                                </td>
                                <td className="py-2.5 px-3">
                                  {f.required ? (
                                    <span className="text-danger font-medium">Yes</span>
                                  ) : (
                                    <span className="text-subtle">No</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-ink leading-relaxed">{f.desc}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {ep.requestBody && (
                      <div>
                        <span className="text-subtle text-[11px] uppercase tracking-wider block mb-1.5">
                          Example Request Body (JSON)
                        </span>
                        <pre className="p-3.5 rounded-lg bg-[#06070a] border border-rim text-ink text-xs font-mono overflow-x-auto leading-relaxed">
                          {ep.requestBody}
                        </pre>
                      </div>
                    )}

                    {!ep.requestBody && !ep.requestFields && (
                      <p className="text-subtle text-xs italic">No request body required for this endpoint.</p>
                    )}
                  </div>

                  {/* Right: Response Example */}
                  <div className="space-y-4">
                    <SectionLabel>Example Response (JSON)</SectionLabel>
                    <div>
                      <pre className="p-3.5 rounded-lg bg-[#06070a] border border-rim text-ink text-xs font-mono overflow-x-auto leading-relaxed">
                        {ep.responseBody}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-rim py-6 bg-surface/40">
        <div className="max-w-285 mx-auto px-8 flex justify-between items-center text-xs text-subtle tracking-[0.06em]">
          <span>Enterprise RAG · Developer Documentation</span>
          <span>FastAPI · PostgreSQL · Gemini 2.5 Flash</span>
        </div>
      </footer>
    </div>
  );
}
