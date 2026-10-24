import Link from "next/link";
import { BrandMark } from "../components";
import { GoogleSignIn } from "./GoogleSignIn";

export default function LoginPage() {
  return <main className="login-page">
    <Link href="/" className="brand"><BrandMark /><span>Loop<span className="brand-light">desk</span></span></Link>
    <div className="login-card">
      <div className="login-orb" style={{ background: "transparent" }}><BrandMark size={52} /></div><p className="eyebrow">A MORE THOUGHTFUL CUSTOMER DESK</p>
      <h1>Come on in.</h1><p className="login-copy">Your team’s knowledge, AI assistant and customer workflows are ready when you are.</p>
      <GoogleSignIn />
      <p className="login-legal">By continuing, you’ll securely sign in with your Google account.</p>
    </div>
    <Link href="/help" className="login-help">New here? Take a quick tour <span>↗</span></Link>
  </main>;
}
