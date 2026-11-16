import Link from "next/link";
import { BrandMark, Nav } from "./components";

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-canvas)", position: "relative" }}>
      {/* ── Ambient Radial Glow Behind Navbar & Hero ─────────────────── */}
      <div className="hero-ambient-glow" />

      <Nav active="home" />

      <main>
        {/* ── SECTION 1: HERO & ARCHITECTURE FLOW ────────────────────── */}
        <section className="landing-hero wrap">
          <div className="hero-pill">
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 10px #10b981" }} />
            <span>ENTERPRISE CUSTOMER OPERATIONS COPILOT · 2.0</span>
          </div>

          <h1 className="hero-headline">
            Autonomous customer support,<br />
            <em>grounded in your policies.</em>
          </h1>

          <p className="hero-subhead">
            Loopdesk automates inbound support emails using verified company knowledge, sub-50ms caching, and human-in-the-loop review.
          </p>

          <div className="hero-cta-group">
            <Link href="/dashboard" className="button-primary" style={{ padding: "14px 28px", fontSize: "14px" }}>
              Launch Workspace <span>→</span>
            </Link>
            <Link href="/blogs" className="button-secondary" style={{ padding: "14px 24px", fontSize: "14px" }}>
              Read Architecture Blog <span>↗</span>
            </Link>
          </div>

          {/* 4-Stage Architecture Pipeline Interactive Visual */}
          <div className="hero-pipeline-preview">
            <div className="pipeline-preview-label">
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#6366f1", boxShadow: "0 0 8px #6366f1" }} />
              DETERMINISTIC 4-STAGE EMAIL PROCESSING PIPELINE
            </div>

            <div className="pipeline-preview-stages">
              <div className="pipeline-preview-stage">
                <div className="pipeline-stage-num" style={{ color: "#818cf8", borderColor: "rgba(129, 140, 248, 0.4)", background: "rgba(129, 140, 248, 0.12)" }}>
                  01
                </div>
                <div>
                  <div className="pipeline-stage-name">Inbound Ingestion</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Webhook HMAC Verification</div>
                </div>
                <div className="pipeline-stage-arrow">→</div>
              </div>

              <div className="pipeline-preview-stage">
                <div className="pipeline-stage-num" style={{ color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.4)", background: "rgba(56, 189, 248, 0.12)" }}>
                  02
                </div>
                <div>
                  <div className="pipeline-stage-name">Dual-Tier Caching</div>
                  <div style={{ fontSize: "11px", color: "#38bdf8" }}>Redis L1 + pgvector L2</div>
                </div>
                <div className="pipeline-stage-arrow">→</div>
              </div>

              <div className="pipeline-preview-stage">
                <div className="pipeline-stage-num" style={{ color: "#34d399", borderColor: "rgba(52, 211, 153, 0.4)", background: "rgba(52, 211, 153, 0.12)" }}>
                  03
                </div>
                <div>
                  <div className="pipeline-stage-name">Grounded AI Reasoning</div>
                  <div style={{ fontSize: "11px", color: "#34d399" }}>Gemini 2.5 + Groq Fallback</div>
                </div>
                <div className="pipeline-stage-arrow">→</div>
              </div>

              <div className="pipeline-preview-stage">
                <div className="pipeline-stage-num" style={{ color: "#fbbf24", borderColor: "rgba(251, 191, 36, 0.4)", background: "rgba(251, 191, 36, 0.12)" }}>
                  04
                </div>
                <div>
                  <div className="pipeline-stage-name">Dispatch or Review</div>
                  <div style={{ fontSize: "11px", color: "#fbbf24" }}>1-Click Triage Approval</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 2: DUAL-TIER ENGINE ACCELERATION ────────────────── */}
        <section className="wrap landing-features-section" id="caching">
          <div className="landing-section-header">
            <p className="landing-section-tag">PERFORMANCE & CLOUD ECONOMICS</p>
            <h2 className="landing-section-title">
              Dual-tier acceleration that eliminates 90%+ of redundant LLM calls.
            </h2>
            <p className="landing-section-desc">
              Customer support inquiries follow heavy Pareto distributions. Loopdesk evaluates queries through
              an in-memory L1 cache and semantic L2 vector cache before ever touching generative models.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
            <div className="card" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.25)", color: "#34d399", display: "grid", placeItems: "center", fontSize: "18px" }}>
                  ⚡
                </span>
                <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#34d399", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "3px 10px", borderRadius: "99px", fontFamily: "var(--font-mono)" }}>
                  ~8ms Latency
                </span>
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: 650, color: "#ffffff", margin: 0 }}>
                Tier 1: In-Memory Redis Hash Cache
              </h3>
              <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.65 }}>
                Direct cryptographic SHA-256 hash lookups stored in Dockerized Redis. Resolves identically worded incoming inquiries
                with zero LLM token consumption and sub-10ms response time.
              </p>
              <div style={{ marginTop: "auto", padding: "12px 14px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid var(--border-subtle)", fontSize: "11.5px", color: "var(--text-muted)" }}>
                Key characteristic: <span style={{ color: "#34d399", fontWeight: 600 }}>100% token cost reduction</span>
              </div>
            </div>

            <div className="card" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(6, 182, 212, 0.12)", border: "1px solid rgba(6, 182, 212, 0.25)", color: "#38bdf8", display: "grid", placeItems: "center", fontSize: "18px" }}>
                  🧠
                </span>
                <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#38bdf8", background: "rgba(6, 182, 212, 0.1)", border: "1px solid rgba(6, 182, 212, 0.3)", padding: "3px 10px", borderRadius: "99px", fontFamily: "var(--font-mono)" }}>
                  ~45ms Latency
                </span>
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: 650, color: "#ffffff", margin: 0 }}>
                Tier 2: pgvector Semantic Cache
              </h3>
              <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.65 }}>
                768-dimensional vector cosine similarity indexing in PostgreSQL pgvector. Matches customer inquiries with distinct phrasing
                or colloquial wording that share identical intent (&gt;0.92 cosine threshold).
              </p>
              <div style={{ marginTop: "auto", padding: "12px 14px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid var(--border-subtle)", fontSize: "11.5px", color: "var(--text-muted)" }}>
                Key characteristic: <span style={{ color: "#38bdf8", fontWeight: 600 }}>Semantic intent matching</span>
              </div>
            </div>

            <div className="card" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(99, 102, 241, 0.12)", border: "1px solid rgba(99, 102, 241, 0.25)", color: "#818cf8", display: "grid", placeItems: "center", fontSize: "18px" }}>
                  ✦
                </span>
                <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#a5b4fc", background: "rgba(99, 102, 241, 0.1)", border: "1px solid rgba(99, 102, 241, 0.3)", padding: "3px 10px", borderRadius: "99px", fontFamily: "var(--font-mono)" }}>
                  High Availability
                </span>
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: 650, color: "#ffffff", margin: 0 }}>
                Frontier LLM with Instant Fallback
              </h3>
              <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.65 }}>
                Novel, out-of-distribution queries evaluate against indexed policy chunks using Gemini 2.5 Flash, with instant automated
                fallback to Groq Llama 3.3 70B if rate limits or upstream errors occur.
              </p>
              <div style={{ marginTop: "auto", padding: "12px 14px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid var(--border-subtle)", fontSize: "11.5px", color: "var(--text-muted)" }}>
                Key characteristic: <span style={{ color: "#a5b4fc", fontWeight: 600 }}>99.99% operational continuity</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 3: HUMAN-IN-THE-LOOP GOVERNANCE ────────────────── */}
        <section className="wrap landing-features-section" style={{ paddingTop: 0 }} id="governance">
          <div className="card" style={{ padding: "48px", background: "linear-gradient(180deg, #10121f 0%, #080911 100%)", border: "1px solid rgba(99, 102, 241, 0.3)" }}>
            <div style={{ maxWidth: "680px", marginBottom: "40px" }}>
              <p className="landing-section-tag">HUMAN SUPERVISION & SAFETY</p>
              <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 700, color: "#ffffff", letterSpacing: "-0.03em", margin: "8px 0 14px" }}>
                Full auditability with slide-out triage drawer.
              </h2>
              <p style={{ fontSize: "14.5px", color: "var(--text-secondary)", lineHeight: 1.65, margin: 0 }}>
                Never worry about autonomous emails slipping through unnoticed. Loopdesk routes borderline queries, policy exceptions,
                or custom confidence thresholds directly into an interactive review queue.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
              <div style={{ padding: "24px", borderRadius: "12px", background: "#0c0e18", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: "20px", marginBottom: "10px" }}>📥</div>
                <h4 style={{ fontSize: "16px", fontWeight: 650, color: "#ffffff", margin: "0 0 8px" }}>Unified Triage Inbox</h4>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
                  Filter by accepted, rejected, pending review, or failed dispatches. Operators inspect the incoming email, reasoning, and policy citations.
                </p>
              </div>

              <div style={{ padding: "24px", borderRadius: "12px", background: "#0c0e18", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: "20px", marginBottom: "10px" }}>✎</div>
                <h4 style={{ fontSize: "16px", fontWeight: 650, color: "#ffffff", margin: "0 0 8px" }}>In-Place Draft Editing</h4>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
                  Operators can edit the proposed outbound email draft directly within the slide-out panel before granting 1-click dispatch approval.
                </p>
              </div>

              <div style={{ padding: "24px", borderRadius: "12px", background: "#0c0e18", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: "20px", marginBottom: "10px" }}>🧪</div>
                <h4 style={{ fontSize: "16px", fontWeight: 650, color: "#ffffff", margin: "0 0 8px" }}>Live Trace Sandbox</h4>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
                  Simulate any customer email scenario across the 4 stages with real vector similarity scores, stage latency counters, and zero external side effects.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 4: ENTERPRISE INFRASTRUCTURE & CALL TO ACTION ──── */}
        <section className="wrap landing-cta-section">
          <div className="landing-cta-card">
            <h2 className="landing-cta-title">
              Built for high-scale customer operations.
            </h2>
            <p className="landing-cta-desc">
              Experience deterministic policy grounding, real-time performance telemetry, and seamless email workflow automation.
            </p>
            <div className="landing-cta-actions">
              <Link href="/dashboard" className="button-primary" style={{ padding: "14px 28px", fontSize: "14px" }}>
                Launch Dashboard <span>→</span>
              </Link>
              <Link href="/blogs" className="button-secondary" style={{ padding: "14px 24px", fontSize: "14px" }}>
                Read Technical Whitepaper ↗
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Modern Dark Footer ───────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="wrap landing-footer-inner">
          <div className="landing-footer-brand">
            <BrandMark size={22} />
            <span>Loopdesk</span>
            <span className="landing-footer-tagline">· Autonomous Customer Support Copilot</span>
          </div>
          <div className="landing-footer-links">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/blogs">Blogs</Link>
            <Link href="/workflows">Workflows</Link>
            <Link href="/approvals">Review Queue</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
