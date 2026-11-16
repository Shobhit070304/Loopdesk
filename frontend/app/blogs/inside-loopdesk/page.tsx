import Link from "next/link";
import { Nav } from "../../components";

export default function InsideLoopdeskBlog() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-canvas)", position: "relative" }}>
      <Nav active="blogs" />

      {/* ── Dotted Gradient Header Ambient Glow ─────────────────────────── */}
      <div className="hero-ambient-glow" />

      <main className="wrap" style={{ padding: "48px 0 100px", maxWidth: "860px", position: "relative", zIndex: 1 }}>
        {/* Back Link */}
        <div style={{ marginBottom: "28px" }}>
          <Link
            href="/blogs"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--text-muted)",
              fontSize: "13px",
              fontWeight: 550,
              textDecoration: "none",
              transition: "color 0.15s ease",
            }}
          >
            <span>←</span> Back to all articles
          </Link>
        </div>

        {/* ── Article Header ─────────────────────────────────────────── */}
        <header style={{ marginBottom: "40px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "4px 12px", borderRadius: "99px", background: "rgba(99, 102, 241, 0.12)", border: "1px solid rgba(99, 102, 241, 0.3)", color: "#a5b4fc", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "20px" }}>
            <span>ENGINEERING & ARCHITECTURE</span>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>•</span>
            <span>8 MIN READ</span>
          </div>

          <h1 style={{ fontSize: "clamp(32px, 4.5vw, 48px)", fontWeight: 750, color: "#ffffff", letterSpacing: "-0.035em", lineHeight: 1.15, margin: "0 0 18px" }}>
            Inside Loopdesk: Grounding Customer Support in Policy Truth with Dual-Tier Caching
          </h1>

          <p style={{ fontSize: "17px", color: "var(--text-secondary)", lineHeight: 1.65, margin: "0 0 28px" }}>
            How we engineered a deterministic, sub-50ms email triage pipeline combining Redis L1 caching, PostgreSQL pgvector semantic retrieval, frontier LLMs, and human-in-the-loop governance.
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: "14px", paddingBottom: "24px", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #06b6d4)", display: "grid", placeItems: "center", fontWeight: 700, color: "#ffffff", fontSize: "14px" }}>
              SS
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 650, color: "#ffffff" }}>Shobhit Sharma</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Architecture & Systems Deep-Dive · Loopdesk Core</div>
            </div>
          </div>
        </header>

        {/* ── Article Body ───────────────────────────────────────────── */}
        <article className="blog-article-body" style={{ color: "var(--text-secondary)", fontSize: "15px", lineHeight: 1.8 }}>
          {/* Section 1 */}
          <h2 style={{ fontSize: "23px", fontWeight: 700, color: "#ffffff", marginTop: "40px", marginBottom: "16px", letterSpacing: "-0.02em" }}>
            1. Why Generic AI Chatbots Fail in Customer Operations
          </h2>
          <p>
            When enterprise customer support teams attempt to automate email responses with off-the-shelf generative AI, they consistently run into three critical bottlenecks:
          </p>
          <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "10px", margin: "16px 0" }}>
            <li>
              <strong style={{ color: "#ffffff" }}>Hallucinated Commitments:</strong> Pure prompting without strict context boundaries produces confident but fictitious promises regarding refunds, warranties, and service tiers that bind the business to costly commitments.
            </li>
            <li>
              <strong style={{ color: "#ffffff" }}>Inference Cost & Latency Sprawl:</strong> Routing every routine query to a 70B+ frontier model incurs 2,000ms+ latency and burns compute dollars for identical questions that have already been answered hundreds of times.
            </li>
            <li>
              <strong style={{ color: "#ffffff" }}>Lack of Operational Oversight:</strong> Once automated, traditional bots dispatch replies directly to end-users without auditability, forcing operators into risky all-or-nothing rollouts.
            </li>
          </ul>
          <p>
            Loopdesk was built to solve this exact problem: a closed-loop customer intelligence copilot that strictly grounds decisions in uploaded company policy documents, accelerates repeat inquiries through dual-tier caching, and maintains a precision human review queue.
          </p>

          {/* Section 2 */}
          <h2 style={{ fontSize: "23px", fontWeight: 700, color: "#ffffff", marginTop: "48px", marginBottom: "16px", letterSpacing: "-0.02em" }}>
            2. The 4-Stage Email Processing Pipeline
          </h2>
          <p>
            Every customer email ingested by Loopdesk flows through four deterministic stages designed for policy compliance, zero latency waste, and safety:
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px", margin: "24px 0" }}>
            <div style={{ padding: "20px 24px", borderRadius: "12px", background: "var(--bg-card)", border: "1px solid var(--border-card)" }}>
              <div style={{ color: "#818cf8", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>STAGE 01 · INGESTION & HMAC VERIFICATION</div>
              <h3 style={{ fontSize: "16px", fontWeight: 650, color: "#ffffff", margin: "6px 0 8px" }}>Cryptographic Inbound Ingestion</h3>
              <p style={{ margin: 0, fontSize: "13.5px", lineHeight: 1.6 }}>
                Customer inquiries arrive via webhooks from providers like SendGrid, Postmark, or Resend. The ingestion engine strips noisy signatures, sanitizes user input, verifies webhook HMAC signatures, and creates a traceable execution record.
              </p>
            </div>

            <div id="caching" style={{ padding: "20px 24px", borderRadius: "12px", background: "var(--bg-card)", border: "1px solid var(--border-card)" }}>
              <div style={{ color: "#38bdf8", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>STAGE 02 · DUAL-TIER RETRIEVAL</div>
              <h3 style={{ fontSize: "16px", fontWeight: 650, color: "#ffffff", margin: "6px 0 8px" }}>Sub-50ms Exact + Semantic Caching</h3>
              <p style={{ margin: 0, fontSize: "13.5px", lineHeight: 1.6 }}>
                Before calling any language model, the system queries Redis L1 for exact SHA-256 hash matches (sub-10ms). On a miss, it queries PostgreSQL pgvector with 768-dim embeddings (<code style={{ color: "#38bdf8" }}>text-embedding-004</code>) for cosine-similar queries. Only novel queries proceed to full inference.
              </p>
            </div>

            <div style={{ padding: "20px 24px", borderRadius: "12px", background: "var(--bg-card)", border: "1px solid var(--border-card)" }}>
              <div style={{ color: "#34d399", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>STAGE 03 · GROUNDED REASONING & FALLBACK</div>
              <h3 style={{ fontSize: "16px", fontWeight: 650, color: "#ffffff", margin: "6px 0 8px" }}>Frontier AI Evaluation with Instant Fallback</h3>
              <p style={{ margin: 0, fontSize: "13.5px", lineHeight: 1.6 }}>
                The retrieved policy passages are assembled into a constrained prompt evaluated by Gemini 2.5 Flash. If Google’s API encounters rate limits or errors, the execution automatically falls back to Groq’s LLaMA 3.3 70B, ensuring 99.99% operational continuity. The model outputs a structured decision, confidence score, and drafted reply citing policy clauses.
              </p>
            </div>

            <div id="review-queue" style={{ padding: "20px 24px", borderRadius: "12px", background: "var(--bg-card)", border: "1px solid var(--border-card)" }}>
              <div style={{ color: "#fbbf24", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>STAGE 04 · DISPATCH OR REVIEW QUEUE</div>
              <h3 style={{ fontSize: "16px", fontWeight: 650, color: "#ffffff", margin: "6px 0 8px" }}>Automated Resolution vs. Human Governance</h3>
              <p style={{ margin: 0, fontSize: "13.5px", lineHeight: 1.6 }}>
                If confidence exceeds the workflow threshold and the workflow is configured for automatic mode, Loopdesk dispatches the email reply via webhook relay. If the workflow requires approval, or if confidence falls below threshold, the query is held in the Human Review Queue for 1-click inspection, editing, or rejection.
              </p>
            </div>
          </div>

          {/* Section 3 */}
          <h2 style={{ fontSize: "23px", fontWeight: 700, color: "#ffffff", marginTop: "48px", marginBottom: "16px", letterSpacing: "-0.02em" }}>
            3. Sub-50ms Dual-Tier Caching Architecture
          </h2>
          <p>
            The foundation of Loopdesk's speed is its dual-tier caching layer. High-volume customer inboxes frequently encounter duplicate inquiries (e.g., <em>"Where is my package?"</em>, <em>"What is the return window?"</em>, <em>"How do I cancel?"</em>).
          </p>
          <div style={{ padding: "24px", borderRadius: "12px", background: "#090b12", border: "1px solid var(--border-card)", margin: "20px 0" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.7 }}>
              <div style={{ color: "#818cf8" }}>Inbound Query</div>
              <div>&nbsp;│</div>
              <div>&nbsp;├──► [L1: Redis In-Memory] ──(SHA-256 Match)──► Return Cached Reply (&lt;10ms)</div>
              <div>&nbsp;│&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── Cache Miss</div>
              <div>&nbsp;│</div>
              <div>&nbsp;├──► [L2: pgvector Semantic Cache] ──(Cosine Similarity &gt; 0.94)──► Return (&lt;50ms)</div>
              <div>&nbsp;│&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── Semantic Miss</div>
              <div>&nbsp;│</div>
              <div style={{ color: "#34d399" }}>&nbsp;└──► [RAG + LLM Inference] ──► Gemini 2.5 Flash / Groq Fallback ──► Populate Caches</div>
            </div>
          </div>
          <p>
            This hybrid strategy drastically slashes token overhead while maintaining single-digit millisecond response rates for frequent inquiries.
          </p>

          {/* Section 4 */}
          <h2 style={{ fontSize: "23px", fontWeight: 700, color: "#ffffff", marginTop: "48px", marginBottom: "16px", letterSpacing: "-0.02em" }}>
            4. Human-in-the-Loop Governance
          </h2>
          <p>
            Full autonomy without operator guardrails is unsafe for customer-facing communication. Loopdesk bridges autonomy and precision through its Human Review Queue:
          </p>
          <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px", margin: "16px 0" }}>
            <li>Operators see the exact reasoning chain, policy clause citations, and computed confidence score.</li>
            <li>Low-confidence decisions are automatically routed to human reviewers rather than dispatched blind.</li>
            <li>Support agents can approve with a single click, tweak the drafted copy inline, or reject improper suggestions.</li>
          </ul>

          {/* Section 5 */}
          <h2 style={{ fontSize: "23px", fontWeight: 700, color: "#ffffff", marginTop: "48px", marginBottom: "16px", letterSpacing: "-0.02em" }}>
            5. Core Tech Stack
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", margin: "20px 0" }}>
            <div style={{ padding: "16px", borderRadius: "10px", background: "var(--bg-card)", border: "1px solid var(--border-card)" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>BACKEND</div>
              <div style={{ fontSize: "14px", fontWeight: 650, color: "#ffffff", marginTop: "4px" }}>FastAPI & Python 3.12</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>Async event processing</div>
            </div>
            <div style={{ padding: "16px", borderRadius: "10px", background: "var(--bg-card)", border: "1px solid var(--border-card)" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>VECTOR DATABASE</div>
              <div style={{ fontSize: "14px", fontWeight: 650, color: "#ffffff", marginTop: "4px" }}>PostgreSQL + pgvector</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>768-dim embeddings</div>
            </div>
            <div style={{ padding: "16px", borderRadius: "10px", background: "var(--bg-card)", border: "1px solid var(--border-card)" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>CACHE LAYER</div>
              <div style={{ fontSize: "14px", fontWeight: 650, color: "#ffffff", marginTop: "4px" }}>Redis 7.0 (Dockerized)</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>Sub-10ms key-value storage</div>
            </div>
            <div style={{ padding: "16px", borderRadius: "10px", background: "var(--bg-card)", border: "1px solid var(--border-card)" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>FRONTEND</div>
              <div style={{ fontSize: "14px", fontWeight: 650, color: "#ffffff", marginTop: "4px" }}>Next.js 16 + React 19</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>Modern SaaS Dark Design</div>
            </div>
          </div>

          <div style={{ marginTop: "48px", padding: "28px", borderRadius: "14px", background: "rgba(99, 102, 241, 0.08)", border: "1px solid rgba(99, 102, 241, 0.3)", textAlign: "center" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#ffffff", margin: "0 0 10px" }}>
              Experience Loopdesk in Action
            </h3>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", maxWidth: "480px", margin: "0 auto 20px" }}>
              Test deterministic RAG evaluation, query your knowledge base in Policy Copilot, and inspect the human review queue.
            </p>
            <Link href="/dashboard" className="button-primary">
              Launch Workspace <span>→</span>
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
