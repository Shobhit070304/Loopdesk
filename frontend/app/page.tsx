import Link from "next/link";
import { BrandMark, Nav } from "./components";

const steps = [
  { n: "01", title: "Bring your customer context", body: "Upload policies, playbooks and product knowledge. Loopdesk turns them into a searchable source of truth." },
  { n: "02", title: "Give every conversation a head start", body: "Ask grounded questions, surface the right details and draft thoughtful responses in seconds." },
  { n: "03", title: "Automate the repeatable moments", body: "Let workflows handle the predictable work, with a person in the loop whenever judgment matters." },
];

export default function Home() {
  return <div className="landing-page">
    <Nav active="home" />
    <main>
      <section className="landing-hero wrap">
        <div className="hero-copy">
          <div className="announcement"><span className="pulse-dot" /> CUSTOMER INTELLIGENCE, MADE HUMAN</div>
          <h1>Make every customer moment <em>feel considered.</em></h1>
          <p className="hero-lede">One warm, intelligent workspace for the knowledge, conversations and decisions that shape your customer relationships.</p>
          <div className="hero-actions"><Link href="/login" className="button-primary">Meet your new workspace <span>↗</span></Link><Link href="/help" className="button-secondary">See how it works <span>↓</span></Link></div>
          <div className="hero-proof"><div className="avatar-stack"><span>J</span><span>M</span><span>A</span><span>+</span></div><p>Thoughtful service, at every scale.<br /><b>Built for people who care about the details.</b></p></div>
        </div>
        <div className="hero-product" aria-label="Product preview">
          <div className="preview-top"><span className="preview-dots"><i /><i /><i /></span><span>PRODUCT PREVIEW · EXAMPLE DATA</span><span className="online-dot">● Loopdesk workspace</span></div>
          <div className="preview-body">
            <div className="preview-greeting"><div><small>GOOD MORNING, MAYA</small><h2>Your customer desk,<br />all in one place.</h2></div><div className="preview-portrait">m</div></div>
            <div className="preview-metrics"><div><small>OPEN CONVERSATIONS</small><strong>24 <i>+4 today</i></strong></div><div><small>READY FOR REVIEW</small><strong>3 <i className="gold-dot">●</i></strong></div></div>
            <div className="preview-label">A LITTLE HELP FROM AI</div>
            <div className="preview-answer"><div className="sparkle">✳</div><div><b>A return question, already understood</b><p>“The order is within the 30-day window. Your policy allows a prepaid label for unworn items.”</p><span>Grounded in Returns & Exchanges · 2 sources</span></div></div>
            <div className="preview-task"><span className="task-icon">↗</span><div><b>Refund eligibility check</b><small>Suggested action · awaiting your review</small></div><span className="review-pill">Review</span></div>
          </div>
        </div>
        <div className="hero-orb" />
      </section>

      <section className="signal-strip"><div className="wrap signal-inner"><span>YOUR CUSTOMER KNOWLEDGE</span><i /> <span>YOUR AI ASSISTANT</span><i /> <span>YOUR TEAM’S JUDGMENT</span><i /> <b>IN ONE FLOW</b></div></section>

      <section className="landing-section wrap value-section">
        <div className="section-intro"><p className="eyebrow">A BETTER WAY TO SHOW UP</p><h2>Less searching.<br /><em>More understanding.</em></h2><p>Great customer experiences aren’t made by another dashboard. They happen when the right context reaches the right person at exactly the right moment.</p></div>
        <div className="value-grid">
          <article className="value-card"><span className="value-icon">⌕</span><p className="eyebrow">KNOWLEDGE THAT CONNECTS</p><h3>Find the why behind the question.</h3><p>Bring your policies and product guidance together, so important details reach your team when they need them.</p><Link href="/documents">Explore your documents ↗</Link></article>
          <article className="value-card featured"><span className="value-icon">✳</span><p className="eyebrow">AI THAT KNOWS ITS SOURCES</p><h3>Helpful answers, with receipts.</h3><p>Give your team a grounded assistant that works from your own policies, product guidance and customer context.</p><Link href="/ask">Meet your assistant ↗</Link></article>
          <article className="value-card"><span className="value-icon">↗</span><p className="eyebrow">AUTOMATION WITH A HUMAN HEART</p><h3>Move routine work forward.</h3><p>Turn repeatable decisions into clear workflows. Keep people close when a decision needs care or a second look.</p><Link href="/workflows">See the workflows ↗</Link></article>
        </div>
      </section>

      <section className="story-band"><div className="wrap story-content"><div><p className="eyebrow">THE CALM IN THE BUSY</p><h2>Every answer has a source.<br />Every action has a person.</h2></div><p>Loopdesk brings retrieval, reasoning and review into one clear rhythm. AI handles the legwork. Your team brings the judgment, empathy and unmistakably human touch.</p></div></section>

      <section className="landing-section wrap how-section" id="how-it-works">
        <div className="section-intro centered"><p className="eyebrow">THOUGHTFUL BY DESIGN</p><h2>From scattered context<br /><em>to a clear next step.</em></h2><p>A simple flow that keeps your team in control from first question to final action.</p></div>
        <div className="steps-grid">{steps.map((step) => <article className="step-card" key={step.n}><span>{step.n}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></article>)}</div>
      </section>

      <section className="human-band"><div className="wrap human-content"><div className="human-art"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><span>✳</span><small>HUMAN<br />IN THE LOOP</small></div><div><p className="eyebrow">A HUMAN SIGNATURE ON EVERY DECISION</p><h2>Confidence is knowing<br />when to ask a person.</h2><p>Set the level of oversight that feels right. Review AI decisions, see the context behind them, and approve or reject with a clear audit trail.</p><Link href="/approvals" className="button-primary">Explore human review ↗</Link></div></div></section>

      <section className="closing-cta wrap"><div><p className="eyebrow">MAKE ROOM FOR BETTER SERVICE</p><h2>Let the busywork be busy.<br /><em>Let your people be people.</em></h2><p>Give your customer team a workspace that helps them feel prepared, present and in control.</p></div><Link href="/login" className="button-primary">Get started with Google <span>↗</span></Link></section>
    </main>
    <footer className="landing-footer wrap"><Link href="/" className="brand"><BrandMark size={28} /><span>Loop<span className="brand-light">desk</span></span></Link><span>Customer intelligence, with a human touch.</span><div><Link href="/help">Quick start</Link><Link href="/login">Sign in</Link></div></footer>
  </div>;
}
