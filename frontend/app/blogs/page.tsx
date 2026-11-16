import Link from "next/link";
import { Nav } from "../components";

export default function BlogsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-canvas)", position: "relative" }}>
      <Nav active="blogs" />

      {/* ── Dotted Gradient Header Ambient Glow ─────────────────────────── */}
      <div className="hero-ambient-glow" />

      <main className="wrap" style={{ padding: "64px 0 100px", maxWidth: "900px", position: "relative", zIndex: 1 }}>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className="blogs-header">
          <div className="blogs-tag">
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#6366f1" }} />
            <span>ENGINEERING & ARCHITECTURE</span>
          </div>
          <h1 className="blogs-title">
            Technical Insights & System Architecture
          </h1>
          <p className="blogs-subtitle">
            In-depth write-ups on building deterministic AI pipelines, dual-tier caching, and grounded customer operations.
          </p>
        </header>

        {/* ── Articles Listing Grid ───────────────────────────────────── */}
        <div className="blogs-grid">
          {/* Featured Post */}
          <Link href="/blogs/inside-loopdesk" className="blog-featured-card">
            <div className="blog-meta-row">
              <span className="blog-badge">SYSTEM ARCHITECTURE</span>
              <span>•</span>
              <span>8 MIN READ</span>
              <span>•</span>
              <span style={{ color: "#34d399" }}>CORE DEEP-DIVE</span>
            </div>

            <h2 className="blog-card-title">
              Inside Loopdesk: Grounding Customer Support in Policy Truth with Dual-Tier Caching
            </h2>

            <p className="blog-card-desc">
              How we engineered a deterministic, sub-50ms email triage pipeline combining Redis L1 caching, PostgreSQL pgvector semantic retrieval, frontier LLMs, and human-in-the-loop governance.
            </p>

            <div className="blog-author-bar">
              <div className="blog-author-info">
                <div className="blog-author-avatar">SS</div>
                <div>
                  <div className="blog-author-name">Shobhit Sharma</div>
                  <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>Loopdesk Core</div>
                </div>
              </div>
              <span className="blog-read-cta">
                Read Article <span>→</span>
              </span>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
