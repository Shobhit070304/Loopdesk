import Link from "next/link";
import { BrandMark, DemoSignInButton } from "../components";
import { GoogleSignIn } from "./GoogleSignIn";

export default function LoginPage() {
  return (
    <main className="login-page">
      <div style={{ position: "absolute", top: "32px", left: "32px" }}>
        <Link href="/" className="brand">
          <BrandMark size={28} />
          <span>Loop<span className="brand-light">desk</span></span>
        </Link>
      </div>

      <div className="login-card">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
          <BrandMark size={48} />
        </div>

        <span style={{ fontSize: "11px", fontWeight: 700, color: "#818cf8", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          CUSTOMER OPERATIONS PLATFORM
        </span>
        <h1>Welcome Back</h1>
        <p className="login-copy">
          Sign in with your Google account to access your workflows, policy documents, and review queue.
        </p>

        {/* Google OAuth Component */}
        <GoogleSignIn />

        <div className="login-divider">or explore immediately</div>

        {/* 1-Click Demo Workspace Access for Recruiters & Evaluators */}
        <DemoSignInButton />

        <p style={{ margin: "20px 0 0", fontSize: "11.5px", color: "var(--text-muted)" }}>
          Secure session cookies · Powered by Google OAuth & JWT
        </p>
      </div>

      <div style={{ marginTop: "24px", fontSize: "12.5px", color: "var(--text-secondary)" }}>
        <Link href="/" style={{ color: "#a5b4fc" }}>← Back to home</Link>
        <span style={{ margin: "0 10px", color: "var(--border-subtle)" }}>•</span>
        <Link href="/help" style={{ color: "#a5b4fc" }}>Read documentation ↗</Link>
      </div>
    </main>
  );
}
