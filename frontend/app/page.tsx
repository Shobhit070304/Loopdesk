import Link from "next/link";
import { Nav, SectionLabel } from "./components";

export default function Home() {
  return (
    <div className="relative z-[1] min-h-screen flex flex-col bg-bg text-fg font-sans">
      <Nav active="home" />

      <main className="flex-1 pb-20">
        <div className="max-w-[1140px] mx-auto px-8">

          {/* ── Hero Section ─────────────────────────────────── */}
          <section className="pt-24 pb-16 border-b border-rim">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gold/30 bg-gold/5 text-gold text-xs tracking-[0.16em] uppercase mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-gold pulse-dot" />
              Enterprise Search & Decision Automation
            </div>

            <h1 className="font-serif text-[3.75rem] leading-[1.08] mb-6 max-w-[720px] cursor">
              Find what matters,<br />
              <em className="text-gold">act with intelligence.</em>
            </h1>

            <p className="text-subtle text-base max-w-[600px] leading-[1.8] mb-10">
              A hybrid retrieval platform uniting dense vector embeddings and full-text keyword
              search via Reciprocal Rank Fusion. Power your company knowledge base and automate
              decisions with Gemini 2.5 Flash.
            </p>

            <div className="flex gap-4 flex-wrap">
              <Link
                href="/rag"
                className="inline-flex items-center gap-2 font-sans text-xs tracking-[0.12em] uppercase
                           px-6 py-3 rounded-md bg-gold text-bg font-bold shadow-lg shadow-gold/20
                           hover:bg-amber-400 transition-all no-underline"
              >
                Open Query Console →
              </Link>
              <Link
                href="/workflows"
                className="inline-flex items-center gap-2 font-sans text-xs tracking-[0.12em] uppercase
                           px-6 py-3 rounded-md border border-white/[0.12] text-fg bg-surface
                           hover:border-gold hover:text-gold transition-all no-underline"
              >
                Automations →
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 font-sans text-xs tracking-[0.12em] uppercase
                           px-6 py-3 rounded-md border border-white/[0.12] text-subtle bg-surface/50
                           hover:border-gold hover:text-gold transition-all no-underline"
              >
                Explore API Docs →
              </Link>
            </div>
          </section>

          {/* ── Feature Grid ─────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-rim border border-rim rounded-xl overflow-hidden mt-14 shadow-xl">
            {[
              {
                icon: "◈",
                title: "Dense Vector Search",
                desc: "HNSW index on 768-dimensional Gemini embeddings. Cosine distance retrieves documents based on deep semantic intent.",
              },
              {
                icon: "◉",
                title: "Lexical Keyword Search",
                desc: "PostgreSQL GIN index with full-text search and ts_rank scoring guarantees exact matches for technical codes, SKUs, and jargon.",
              },
              {
                icon: "⊕",
                title: "Reciprocal Rank Fusion",
                desc: "RRF scoring (k=60) normalizes and fuses both retrieval candidate pools into a single calibrated ranking list.",
              },
            ].map(({ icon, title, desc }, i) => (
              <div key={i} className="p-8 bg-surface/90 backdrop-blur-md transition-colors hover:bg-white/[0.02]">
                <div className="text-gold text-2xl mb-4">{icon}</div>
                <div className="font-serif text-fg text-lg mb-2">{title}</div>
                <div className="text-subtle text-sm leading-[1.7]">{desc}</div>
              </div>
            ))}
          </div>

          {/* ── SaaS Platform Capabilities Banner ─────────────── */}
          <div className="my-14 border border-rim rounded-xl bg-surface/80 p-8 backdrop-blur-md">
            <SectionLabel>Core SaaS Engines</SectionLabel>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="p-5 border border-rim/70 rounded-lg bg-[#080a10]/60 space-y-2.5">
                <div className="text-xs tracking-wider uppercase text-gold font-bold">1. Ingest & Index</div>
                <h3 className="font-serif text-base text-fg">Knowledge Engine</h3>
                <p className="text-subtle text-xs leading-relaxed">
                  Upload text documents, guidelines, and manuals. The engine chunks text, calculates embeddings, and maintains persistent HNSW indices.
                </p>
                <Link href="/rag" className="text-xs text-gold inline-flex items-center gap-1 hover:underline pt-2">
                  Launch Ingest Console →
                </Link>
              </div>

              <div className="p-5 border border-rim/70 rounded-lg bg-[#080a10]/60 space-y-2.5">
                <div className="text-xs tracking-wider uppercase text-gold font-bold">2. Ask & Cache</div>
                <h3 className="font-serif text-base text-fg">Grounded Q&A Feed</h3>
                <p className="text-subtle text-xs leading-relaxed">
                  Interactive typewriter Q&A feed backed by sub-millisecond Redis exact caching, pgvector semantic similarity caching, and Gemini 2.5 Flash.
                </p>
                <Link href="/ask" className="text-xs text-gold inline-flex items-center gap-1 hover:underline pt-2">
                  Open Answer Engine →
                </Link>
              </div>

              <div className="p-5 border border-rim/70 rounded-lg bg-[#080a10]/60 space-y-2.5">
                <div className="text-xs tracking-wider uppercase text-gold font-bold">3. Action Automations</div>
                <h3 className="font-serif text-base text-fg">Event-Driven SaaS Workflows</h3>
                <p className="text-subtle text-xs leading-relaxed">
                  Define business rules that monitor incoming events, evaluate compliance against company policies, and dispatch actions to external webhooks.
                </p>
                <Link href="/workflows" className="text-xs text-gold inline-flex items-center gap-1 hover:underline pt-2">
                  Configure Workflows →
                </Link>
              </div>
            </div>
          </div>

          {/* ── Architecture Strip ───────────────────────────── */}
          <SectionLabel>System Pipeline</SectionLabel>
          <div className="border border-rim rounded-xl bg-surface/90 overflow-hidden grid grid-cols-5 text-center shadow-lg">
            {[
              ["1. CLIENT", "Web / API Trigger"],
              ["2. INGEST", "/ingest Chunking"],
              ["3. EMBED",  "768-dim Vector"],
              ["4. FUSE",   "HNSW + GIN (RRF)"],
              ["5. REASON", "Gemini 2.5 Flash"],
            ].map(([title, sub], i) => (
              <div key={i} className={`py-6 px-3 ${i < 4 ? "border-r border-rim" : ""} bg-white/[0.01]`}>
                <div className="font-serif text-fg text-sm mb-1">{title}</div>
                <div className="text-subtle text-xs">{sub}</div>
              </div>
            ))}
          </div>

          {/* ── Tech Stack Badges ────────────────────────────── */}
          <div className="flex gap-2.5 flex-wrap mt-14 items-center justify-between border-t border-rim pt-8">
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-subtle text-xs mr-2">Powered by</span>
              {["FastAPI", "PostgreSQL", "pgvector", "Redis L1/L2", "Gemini 2.5 Flash", "Next.js 16"].map((t) => (
                <span key={t} className="text-[11px] tracking-wider uppercase border border-white/[0.08] text-subtle px-3 py-1 rounded-md bg-surface/60">
                  {t}
                </span>
              ))}
            </div>

            <Link href="/docs" className="text-xs text-gold hover:underline tracking-wider uppercase">
              View API Reference →
            </Link>
          </div>
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-rim py-6 bg-surface/40">
        <div className="max-w-[1140px] mx-auto px-8 flex justify-between items-center text-xs text-subtle tracking-[0.06em]">
          <span>Enterprise RAG · Full-Stack Platform</span>
          <span>FastAPI · PostgreSQL · Redis · Gemini</span>
        </div>
      </footer>
    </div>
  );
}
