import Link from "next/link";
import { Nav, SectionLabel } from "../components";

const guides = [
  { n: "01", title: "Give your AI good context", text: "Upload policy documents and team guidance. Loopdesk makes the material available to your assistant and workflows.", link: "/documents", cta: "Upload documents" },
  { n: "02", title: "Ask a question in plain language", text: "Use the AI assistant to ask about your own content. Answers are grounded in retrieved passages; if there is no useful context, the assistant says so.", link: "/ask", cta: "Ask a question" },
  { n: "03", title: "Choose how each workflow runs", text: "Set a workflow to manual review so every event waits for a person, or automatic so every event follows its configured action. The setting applies to the whole workflow, not individual customer queries.", link: "/workflows", cta: "Configure workflows" },
  { n: "04", title: "Review customer decisions", text: "Inspect the incoming request, AI decision, supporting knowledge and action status. Approve or reject workflows configured for manual review from the Review queue.", link: "/approvals", cta: "Open the Review queue" },
];

export default function HelpPage() {
  return <div className="product-shell"><Nav active="help" /><main className="page-container help-container">
    <div className="page-heading"><p className="eyebrow">THE LOOPDESK FIELD GUIDE</p><h1>A clear path from<br /><em>question to action.</em></h1><p>Start with the knowledge your team already has, then let your people and AI work from the same context.</p></div>
    <div className="help-layout"><aside className="help-toc"><SectionLabel>In this guide</SectionLabel>{guides.map((guide) => <a key={guide.n} href={`#guide-${guide.n}`}><span>{guide.n}</span>{guide.title}</a>)}</aside>
      <div className="help-guides">{guides.map((guide) => <article id={`guide-${guide.n}`} className="help-guide card" key={guide.n}><span className="guide-index">{guide.n}</span><div><h2>{guide.title}</h2><p>{guide.text}</p><Link href={guide.link}>{guide.cta} <span>↗</span></Link></div></article>)}
        <div className="help-note"><span>✳</span><p><b>A note on AI:</b> Generated answers and workflow decisions can be wrong. Use manual review for actions that affect customers until the workflow has been validated for your process.</p></div>
      </div>
    </div>
  </main><footer className="product-footer"><span>Loopdesk · Customer intelligence, with a human touch.</span><Link href="/profile">Your workspace ↗</Link></footer></div>;
}
