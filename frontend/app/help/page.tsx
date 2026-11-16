import Link from "next/link";
import { BrandMark, Nav } from "../components";

const guides = [
  {
    n: "01",
    title: "Ground AI in Verified Policies",
    text: "Upload customer policies, terms of service, and company playbooks. Loopdesk vectorizes your files with 768-dim embeddings in PostgreSQL pgvector so every answer and decision is strictly grounded.",
    link: "/documents",
    cta: "Upload documents",
  },
  {
    n: "02",
    title: "Ask Questions in Plain Language",
    text: "Use the Policy Copilot to ask questions about your company documents. Answers cite specific policy sections; if there is insufficient context in your knowledge base, the assistant explicitly alerts you.",
    link: "/ask",
    cta: "Open Copilot",
  },
  {
    n: "03",
    title: "Configure Email Ingestion Workflows",
    text: "Set up email-triggered workflows with custom prompts and confidence thresholds. Choose between automatic dispatch or routing to the human review queue for supervisor approval.",
    link: "/workflows",
    cta: "Configure workflows",
  },
  {
    n: "04",
    title: "Human-in-the-Loop Review Queue",
    text: "Inspect incoming customer requests, AI reasoning, retrieved policy passages, and proposed email replies. Approve, edit draft, or reject decisions with a single click.",
    link: "/approvals",
    cta: "Open Review Queue",
  },
];

export default function HelpPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-canvas)" }}>
      <Nav active="help" />

      <main className="wrap" style={{ padding: "60px 0 100px" }}>
        <div style={{ maxWidth: "680px", marginBottom: "50px" }}>
          <p style={{ color: "#818cf8", fontSize: "11px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 12px" }}>
            LOOPDESK DOCUMENTATION
          </p>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 700, color: "#ffffff", margin: "0 0 16px", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            A clear path from<br /><em>question to action.</em>
          </h1>
          <p style={{ fontSize: "16px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.65 }}>
            Start with the knowledge your team already has, then let your operators and AI work from the same grounded context.
          </p>
        </div>

        <div className="help-layout">
          <aside className="help-toc">
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>
              Quick Navigation
            </div>
            {guides.map((guide) => (
              <a key={guide.n} href={`#guide-${guide.n}`}>
                <span>{guide.n}</span>
                {guide.title}
              </a>
            ))}
          </aside>

          <div className="help-guides">
            {guides.map((guide) => (
              <article id={`guide-${guide.n}`} className="help-guide card" key={guide.n}>
                <span className="guide-index">{guide.n}</span>
                <div style={{ flex: 1 }}>
                  <h2>{guide.title}</h2>
                  <p>{guide.text}</p>
                  <Link href={guide.link} className="button-secondary" style={{ padding: "6px 14px", fontSize: "12.5px" }}>
                    {guide.cta} <span>↗</span>
                  </Link>
                </div>
              </article>
            ))}

            <div className="help-note">
              <span>ⓘ</span>
              <p style={{ margin: 0 }}>
                <b>Operator Note:</b> Generated answers and workflow decisions reflect your indexed documents. Use manual review for workflows that directly email customers until your policy documents and prompts are fully tuned.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="wrap landing-footer-inner">
          <div className="landing-footer-brand">
            <BrandMark size={22} />
            <span>Loopdesk</span>
            <span className="landing-footer-tagline">· Documentation & Field Guide</span>
          </div>
          <div className="landing-footer-links">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/workflows">Workflows</Link>
            <Link href="/approvals">Review Queue</Link>
            <Link href="/login">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
