"use client";

import { useEffect, useRef, useState } from "react";
import { Nav, SectionLabel } from "../components";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface AskResponse {
  query: string;
  answer: string;
  source: "cache" | "documents_retrieved" | "empty";
  similarity?: number;
}

interface HistoryEntry {
  id: number;
  query: string;
  answer: string;
  source: AskResponse["source"];
  similarity?: number;
  timestamp: Date;
}

/* ── Typewriter hook ───────────────────────────────────────── */
function useTypewriter(text: string, speed = 10) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return { displayed, done };
}

/* ── Source badge ──────────────────────────────────────────── */
function SourceBadge({
  source,
  similarity,
}: {
  source: AskResponse["source"];
  similarity?: number;
}) {
  if (source === "cache") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] tracking-widest uppercase border border-gold/40 text-gold px-2.5 py-0.5 rounded-full bg-gold/10">
        <span className="w-1.5 h-1.5 rounded-full bg-gold pulse-dot" />
        L1/L2 Cache Hit
        {similarity !== undefined && (
          <span className="text-gold/70 ml-1 font-mono">· {(similarity * 100).toFixed(0)}%</span>
        )}
      </span>
    );
  }
  if (source === "documents_retrieved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] tracking-widest uppercase border border-sky-500/40 text-sky-400 px-2.5 py-0.5 rounded-full bg-sky-500/10">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
        Hybrid Retrieved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] tracking-widest uppercase border border-danger/40 text-danger px-2.5 py-0.5 rounded-full bg-danger/10">
      No Matching Docs
    </span>
  );
}

/* ── Single answer card ────────────────────────────────────── */
function AnswerCard({ entry, animate }: { entry: HistoryEntry; animate: boolean }) {
  const { displayed, done } = useTypewriter(animate ? entry.answer : "", 8);

  const shownText = animate ? displayed : entry.answer;
  const showCursor = animate && !done;

  return (
    <div className="border border-rim rounded-xl bg-surface/80 backdrop-blur-md overflow-hidden shadow-lg transition-all hover:border-gold/30">
      {/* Card Header */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-rim bg-white/1">
        <div className="flex items-center gap-3">
          <span className="text-gold font-serif text-base">⊕</span>
          <span className="text-fg text-sm font-medium leading-snug max-w-130 truncate" title={entry.query}>
            {entry.query}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <SourceBadge source={entry.source} similarity={entry.similarity} />
          <span className="text-subtle text-xs font-mono">
            {entry.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      {/* Answer Body */}
      <div className="px-6 py-5 bg-[#090b10]/40">
        <p className="text-ink text-sm leading-[1.85] whitespace-pre-wrap">
          {shownText}
          {showCursor && <span className="text-gold animate-pulse">▌</span>}
        </p>
      </div>
    </div>
  );
}

/* ── Main Ask Page Component ───────────────────────────────── */
export default function AskPage() {
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [latestId, setLatestId] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to latest answer
  useEffect(() => {
    if (latestId !== null) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [latestId]);

  async function handleAsk() {
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, top_k: topK }),
      });
      const data: AskResponse = await res.json();
      if (!res.ok) throw new Error((data as { detail?: string }).detail ?? "Request failed");

      const entry: HistoryEntry = {
        id: Date.now(),
        query: data.query,
        answer: data.answer,
        source: data.source,
        similarity: data.similarity,
        timestamp: new Date(),
      };
      setHistory((prev) => [entry, ...prev]);
      setLatestId(entry.id);
      setQuery("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  const inputCls =
    "flex-1 bg-[#0b0d14] border border-rim rounded-lg text-fg font-sans text-sm px-4 py-3 outline-none " +
    "transition-all focus:border-gold/60 focus:ring-1 focus:ring-gold/20 placeholder:text-subtle/50 leading-relaxed";

  const btnCls =
    "inline-flex items-center justify-center gap-2 font-sans text-xs tracking-[0.12em] uppercase " +
    "px-6 py-3 rounded-lg bg-gold text-bg font-bold shadow-md shadow-gold/20 hover:bg-amber-400 " +
    "transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0";

  return (
    <div className="relative z-1 min-h-screen flex flex-col bg-bg text-fg font-sans">
      <Nav active="ask" />

      <div className="max-w-285 mx-auto px-8 w-full pt-10 flex-1 flex flex-col pb-16">
        {/* ── Page Header ──────────────────────────────────── */}
        <div className="border-b border-rim pb-6 mb-8 flex justify-between items-end flex-wrap gap-4">
          <div>
            <p className="text-subtle text-xs tracking-[0.22em] uppercase mb-2">AI Answer Engine</p>
            <h1 className="font-serif text-[2.25rem] text-fg">
              Ask your documents<em className="text-gold">,</em>
            </h1>
            <p className="text-subtle text-sm mt-2 max-w-150 leading-relaxed">
              Sub-millisecond Redis exact caching, vector similarity caching, and Gemini 2.5 Flash
              generates grounded answers without hallucination.
            </p>
          </div>

          {/* Metrics bar */}
          {history.length > 0 && (
            <div className="flex gap-4 border border-rim rounded-lg bg-surface px-4 py-2 text-xs">
              <StatPill label="Queries" value={history.length} />
              <div className="w-px bg-rim" />
              <StatPill
                label="Cache Hits"
                value={history.filter((h) => h.source === "cache").length}
                highlight
              />
              <div className="w-px bg-rim" />
              <StatPill
                label="Retrieved"
                value={history.filter((h) => h.source === "documents_retrieved").length}
              />
            </div>
          )}
        </div>

        {/* ── Input Row ────────────────────────────────────── */}
        <div className="flex gap-3 mb-4 items-center">
          <input
            ref={inputRef}
            id="ask-input"
            type="text"
            className={inputCls}
            placeholder="Ask a question about your ingested documents…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            disabled={loading}
          />
          <div className="flex items-center gap-2 border border-rim rounded-lg px-3 py-2 bg-[#0b0d14] shrink-0">
            <label className="text-subtle text-[11px] tracking-wider uppercase">Top K</label>
            <input
              id="top-k"
              type="number"
              min={1}
              max={10}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="bg-transparent text-fg font-sans text-xs w-10 text-center outline-none"
            />
          </div>
          <button
            id="ask-btn"
            className={btnCls}
            onClick={handleAsk}
            disabled={loading || !query.trim()}
          >
            {loading ? <span className="spinner" /> : null}
            {loading ? "Thinking…" : "Ask Question →"}
          </button>
        </div>

        {/* ── Error Banner ─────────────────────────────────── */}
        {error && (
          <div className="mb-4 text-xs px-4 py-3 rounded-lg border-l-2 border-danger bg-danger/5 text-danger">
            {error}
          </div>
        )}

        {/* ── Answer Feed ──────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4 pb-10 mt-4">
          {/* Empty State */}
          {history.length === 0 && !loading && (
            <div className="border border-rim rounded-xl bg-surface/80 p-8 backdrop-blur-md shadow-lg flex flex-col items-start gap-6">
              <SectionLabel>Architecture & Performance</SectionLabel>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-rim w-full border border-rim rounded-lg overflow-hidden">
                {[
                  ["①", "Dual-Layer Cache", "Instant exact match in Redis, plus cosine similarity (≥95%) in pgvector."],
                  ["②", "Hybrid Search", "HNSW cosine vector distance blended with GIN English full-text search via RRF."],
                  ["③", "Gemini 2.5 Flash", "Strict zero-hallucination prompt synthesizes a clear, direct answer with citations."],
                ].map(([num, title, desc]) => (
                  <div key={title} className="bg-surface/90 p-6 space-y-2">
                    <div className="text-gold text-base font-serif">{num}</div>
                    <div className="text-fg text-sm font-medium">{title}</div>
                    <div className="text-subtle text-xs leading-relaxed">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading Skeleton */}
          {loading && (
            <div className="border border-rim rounded-xl bg-surface/80 p-6 backdrop-blur-md animate-pulse space-y-3">
              <div className="flex items-center gap-3">
                <span className="spinner" />
                <span className="text-subtle text-xs tracking-wider uppercase">
                  Processing Query & Searching Indices…
                </span>
              </div>
              <div className="h-3 bg-white/6 rounded w-3/4 mt-4" />
              <div className="h-3 bg-white/6 rounded w-1/2" />
            </div>
          )}

          {/* Answer Cards */}
          {history.map((entry) => (
            <AnswerCard
              key={entry.id}
              entry={entry}
              animate={entry.id === latestId}
            />
          ))}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-rim py-5 bg-surface/40">
        <div className="max-w-285 mx-auto px-8 flex justify-between items-center text-xs text-subtle tracking-[0.06em]">
          <span>Enterprise RAG · AI Answer Engine</span>
          <span>Gemini 2.5 Flash · Redis · pgvector</span>
        </div>
      </footer>
    </div>
  );
}

/* ── Small Stat Pill ───────────────────────────────────────── */
function StatPill({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xs font-serif ${highlight ? "text-gold font-bold" : "text-fg"}`}>{value}</span>
      <span className="text-subtle text-[11px] uppercase tracking-wider">{label}</span>
    </div>
  );
}
