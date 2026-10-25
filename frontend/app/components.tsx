"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { GoogleSignIn } from "./login/GoogleSignIn";

export type UserProfile = { sub: string; email: string; name: string; picture?: string };
type AuthState = { user: UserProfile | null; loading: boolean; refresh: () => Promise<void> };
const AuthContext = createContext<AuthState>({ user: null, loading: true, refresh: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const data = await response.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  return <AuthContext.Provider value={{ user, loading, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }

export function AppAccessBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const isPublic = pathname === "/" || pathname === "/login" || pathname === "/help";
  if (isPublic) return <>{children}</>;
  if (loading) return <div className="auth-loading"><span className="spinner" /> Preparing your workspace…</div>;
  if (!user) return <main className="auth-wall"><div className="auth-wall-card"><BrandMark size={44} /><p className="eyebrow">Your customer workspace</p><h1>Good work starts with good context.</h1><p>Sign in to manage your documents, conversations, workflows and approvals in one calm workspace.</p><GoogleSignIn /><small>Secure sign-in powered by Google OAuth.</small></div></main>;
  return <>{children}</>;
}

const navItems = [
  { href: "/documents", label: "Documents" },
  { href: "/ask", label: "AI assistant" },
  { href: "/workflows", label: "Workflows" },
  { href: "/approvals", label: "Review queue" },
];

export function BrandMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`brand-mark ${className}`.trim()}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: Math.round(size * 0.54), height: Math.round(size * 0.54) }}
      >
        <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z" />
      </svg>
    </span>
  );
}

export function Nav({ active }: { active: "home" | "documents" | "ask" | "workflows" | "approvals" | "profile" | "help" }) {
  const pathname = usePathname();
  const { user } = useAuth();
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand"><BrandMark /><span>Loop<span className="brand-light">desk</span></span></Link>
        <nav className="main-nav" aria-label="Main navigation">
          {(user ? navItems : [{ href: "/", label: "Product" }, { href: "/help", label: "How it works" }]).map((item) => (
            <Link key={item.href} href={item.href} className={pathname === item.href || (active === "profile" && item.href === "/profile") ? "nav-link active" : "nav-link"}>{item.label}</Link>
          ))}
        </nav>
        <div className="nav-actions">
          {user ? <>
            <Link href="/profile" className="user-chip" aria-label="Open profile">{user.picture ? <img className="user-photo" src={user.picture} alt="" referrerPolicy="no-referrer" /> : <span className="user-photo">{(user.name || user.email || "U").slice(0, 1).toUpperCase()}</span>}<b>{(user.name || user.email || "User").split(" ")[0]}</b></Link>
            <form action="/api/auth/logout" method="post"><button className="sign-out-button" type="submit">Sign out</button></form>
          </> : <Link href="/login" className="nav-cta">Sign in <span>↗</span></Link>}
        </div>
      </div>
    </header>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="section-label"><span className="section-dot" /><span>{children}</span><i /></div>;
}
