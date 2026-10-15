"use client";

import { useState } from "react";
import { Nav, SectionLabel } from "../components";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface RetrieveResult {
  id: number;
  content: string;
  rrf_score: number;
}

export default function RagPage() {
  const [ingestText, setIngestText] = useState("");
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestMsg, setIngestMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(3);
  const [queryLoading, setQueryLoading] = useState(false);
  const [results, setResults] = useState<RetrieveResult[] | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  async function handleIngest() {
    if (!ingestText.trim()) return;
    setIngestLoading(true);
    setIngestMsg(null);
    try {
      const res = await fetch(`${API}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_text: ingestText }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.detail;
        const msg = Array.isArray(detail)
          ? "Invalid input. Please check your fields."
          : (detail ?? "Ingestion failed");
        throw new Error(msg);
      }
      setIngestMsg({ text: data.message });
      setIngestText("");
    } catch (e: unknown) {
      setIngestMsg({ text: e instanceof Error ? e.message : "Unknown error", error: true });
    } finally {
      setIngestLoading(false);
    }
  }

  async function handleQuery() {
    if (!query.trim()) return;
    setQueryLoading(true);
    setQueryError(null);
    setResults(null);
    try {
      const res = await fetch(`${API}/retrieve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, top_k: topK }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.detail;
        const msg = Array.isArray(detail)
          ? "Invalid input. Please check your fields."
          : (detail ?? "Query failed");
        throw new Error(msg);
      }
      setResults(data.results);
    } catch (e: unknown) {
      setQueryError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setQueryLoading(false);
    }
  }

  const inputCls =
    "w-full bg-[#0b0d14] border border-rim rounded-lg text-fg font-sans text-sm px-4 py-3 outline-none " +
    "transition-all focus:border-gold/60 focus:ring-1 focus:ring-gold/20 placeholder:text-subtle/50 resize-y leading-relaxed";

  const btnPrimary =
    "inline-flex items-center justify-center gap-2 font-sans text-xs tracking-[0.12em] uppercase " +
    "px-5 py-2.5 rounded-md bg-gold text-bg font-bold shadow-md shadow-gold/20 hover:bg-amber-400 " +
    "transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="relative z-1 min-h-screen flex flex-col bg-bg text-fg font-sans">
      <Nav active="rag" />

      <div className="max-w-285 mx-auto px-8 w-full pt-10 flex-1 flex flex-col pb-16">
        {/* ── Page Header ───────────────────────────────── */}
        <div className="border-b border-rim pb-6 mb-8 flex justify-between items-end flex-wrap gap-4">
          <div>
            <p className="text-subtle text-xs tracking-[0.22em] uppercase mb-2">
              Workbench · Ingest & Search
            </p>
            <h1 className="font-serif text-[2.25rem] text-fg">
              Retrieval <em className="text-gold">Interface</em>
            </h1>
            <p className="text-subtle text-sm mt-2 max-w-145 leading-relaxed">
              Ingest business documents into pgvector and inspect hybrid semantic + keyword
              search results scored via Reciprocal Rank Fusion.
            </p>
          </div>

          <div className="flex gap-4 items-center">
            <HealthIndicator />
          </div>
        </div>

        {/* ── Two-Column Grid ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT: Ingest Card */}
          <div className="border border-rim rounded-xl bg-surface/80 p-8 backdrop-blur-md shadow-lg flex flex-col">
            <SectionLabel>1. Document Ingestion</SectionLabel>

            <div className="flex flex-col gap-1.5 mb-5">
              <label className="text-subtle text-xs tracking-widest uppercase">Document text</label>
              <textarea
                id="ingest-text"
                rows={9}
                className={inputCls}
                placeholder="Paste your document or policy text here. It will be chunked (500 chars, 50 overlap), embedded via Gemini, and indexed in pgvector…"
                value={ingestText}
                onChange={(e) => setIngestText(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-4">
              <button
                id="ingest-btn"
                className={btnPrimary}
                onClick={handleIngest}
                disabled={ingestLoading || !ingestText.trim()}
              >
                {ingestLoading ? <span className="spinner" /> : null}
                {ingestLoading ? "Indexing Chunks…" : "Ingest Document →"}
              </button>
              {ingestText.length > 0 && (
                <span className="text-subtle text-xs font-mono">{ingestText.length} characters</span>
              )}
            </div>

            {ingestMsg && (
              <div
                className={`mt-4 text-xs px-4 py-3 rounded-lg border-l-2 ${
                  ingestMsg.error
                    ? "border-danger bg-danger/5 text-danger"
                    : "border-gold bg-gold/5 text-fg"
                }`}
              >
                {ingestMsg.text}
              </div>
            )}

            <div className="border-t border-rim my-8" />
            <SectionLabel>Pipeline Architecture</SectionLabel>
            <div className="text-subtle text-xs leading-loose space-y-1 font-mono">
              <div>① Recursive text split (500 char chunk / 50 overlap)</div>
              <div>② Dense embeddings generated (768-dim)</div>
              <div>③ PostgreSQL storage with HNSW vector index</div>
              <div>④ GIN English full-text index updated simultaneously</div>
            </div>
          </div>

          {/* RIGHT: Query Card */}
          <div className="border border-rim rounded-xl bg-surface/80 p-8 backdrop-blur-md shadow-lg flex flex-col">
            <SectionLabel>2. Hybrid Search Engine</SectionLabel>

            <div className="flex flex-col gap-1.5 mb-5">
              <label className="text-subtle text-xs tracking-widest uppercase">Search Query</label>
              <input
                type="text"
                id="query-input"
                className={inputCls}
                placeholder="Enter query to test hybrid retrieval…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              />
            </div>

            <div className="flex items-end gap-4 mb-6">
              <div className="flex flex-col gap-1.5 w-28">
                <label className="text-subtle text-xs tracking-widest uppercase">Top K</label>
                <input
                  type="number"
                  id="top-k"
                  className={inputCls}
                  min={1}
                  max={20}
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                />
              </div>
              <button
                id="query-btn"
                className={btnPrimary}
                onClick={handleQuery}
                disabled={queryLoading || !query.trim()}
              >
                {queryLoading ? <span className="spinner" /> : null}
                {queryLoading ? "Searching…" : "Search Index →"}
              </button>
            </div>

            <div className="border-t border-rim my-2" />

            {/* Empty State */}
            {!results && !queryError && !queryLoading && (
              <div className="py-12 text-center text-subtle text-xs leading-relaxed">
                Enter a query above to see ranked candidate chunks. Retrieval merges cosine vector
                similarity and full-text keyword ranking via RRF (k=60).
              </div>
            )}

            {/* Error Message */}
            {queryError && (
              <div className="text-xs px-4 py-3 rounded-lg border-l-2 border-danger bg-danger/5 text-danger my-4">
                {queryError}
              </div>
            )}

            {/* No Results Found */}
            {results && results.length === 0 && (
              <div className="text-xs px-4 py-3 rounded-lg border-l-2 border-gold bg-gold/5 text-fg my-4">
                No matching documents found. Ingest some text on the left first.
              </div>
            )}

            {/* Results List */}
            {results && results.length > 0 && (
              <div className="space-y-4 mt-4">
                <SectionLabel>
                  {results.length} Ranked Result{results.length !== 1 ? "s" : ""}
                </SectionLabel>

                <div className="space-y-3 overflow-y-auto max-h-95 pr-1">
                  {results.map((r, i) => (
                    <div
                      key={r.id}
                      className="p-4 rounded-lg border border-rim bg-[#0b0d14]/70 hover:border-gold/40 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs tracking-widest text-subtle uppercase mb-2">
                        <span className="font-bold text-fg">Rank #{i + 1}</span>
                        <span className="text-gold font-mono">rrf={r.rrf_score.toFixed(5)}</span>
                        <span className="font-mono text-[11px]">Chunk #{r.id}</span>
                      </div>
                      <p className="text-ink text-xs leading-[1.75] font-sans">{r.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="border-t border-rim py-5 bg-surface/40">
        <div className="max-w-285 mx-auto px-8 flex justify-between items-center text-xs text-subtle tracking-[0.06em]">
          <span>Enterprise RAG · Query Workbench</span>
          <span>FastAPI · PostgreSQL · Gemini</span>
        </div>
      </footer>
    </div>
  );
}

/* ── Health Ping Indicator ────────────────────────────────── */
function HealthIndicator() {
  const [status, setStatus] = useState<"unknown" | "healthy" | "error">("unknown");

  async function check() {
    try {
      const res = await fetch(`${API}/health`);
      const data = await res.json();
      setStatus(data.status === "healthy" ? "healthy" : "error");
    } catch {
      setStatus("error");
    }
  }

  const dotColor =
    status === "healthy" ? "bg-emerald-400" :
    status === "error"   ? "bg-rose-500"    :
                           "bg-subtle";

  const label =
    status === "healthy" ? "API Online" :
    status === "error"   ? "Unreachable" :
                           "Check Status";

  return (
    <button
      onClick={check}
      title="Click to ping backend health"
      className="inline-flex items-center gap-2 text-subtle text-xs tracking-widest uppercase
                 bg-surface border border-rim px-3 py-1.5 rounded-md hover:text-fg hover:border-gold/40 transition-colors cursor-pointer"
    >
      <span className={`w-2 h-2 rounded-full pulse-dot ${dotColor}`} />
      <span>{label}</span>
    </button>
  );
}
