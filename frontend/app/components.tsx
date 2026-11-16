"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

export function DemoSignInButton({ onSignedIn }: { onSignedIn?: () => void }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleDemoLogin() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/demo", { method: "POST" });
      if (res.ok) {
        if (onSignedIn) onSignedIn();
        window.location.assign("/dashboard");
      }
    } catch {
      // fallback
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="demo-login-btn"
      disabled={busy}
      onClick={() => void handleDemoLogin()}
    >
      <span>⚡</span> {busy ? "Entering Workspace…" : "Explore Demo Workspace (Instant Access)"}
    </button>
  );
}

export function AppAccessBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading, refresh } = useAuth();
  const isPublic = pathname === "/" || pathname === "/login" || pathname === "/help";

  if (isPublic) return <>{children}</>;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", color: "var(--text-secondary)" }}>
        <span style={{ width: "16px", height: "16px", border: "2px solid rgba(99,102,241,0.2)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <span>Loading workspace…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <main className="login-page">
        <div className="login-card">
          <BrandMark size={44} />
          <h1>Welcome to Loopdesk</h1>
          <p className="login-copy">Sign in to access your customer operations copilot, policy documents, and automated email workflows.</p>
          <GoogleSignIn />
          <div className="login-divider">or explore immediately</div>
          <DemoSignInButton onSignedIn={() => void refresh()} />
          <p style={{ marginTop: "20px", fontSize: "11px", color: "var(--text-muted)" }}>
            256-bit encrypted session cookie · OAuth 2.0 verified
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}

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
        viewBox="0 0 32 32"
        fill="none"
        style={{ width: "100%", height: "100%" }}
      >
        <defs>
          <linearGradient id="bm-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#818cf8" />
            <stop offset="50%" stop-color="#6366f1" />
            <stop offset="100%" stop-color="#06b6d4" />
          </linearGradient>
        </defs>
        <path
          d="M10 16c0-3.314 2.686-6 6-6s6 2.686 6 6-2.686 6-6 6"
          stroke="url(#bm-grad)"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <path
          d="M22 16c0 3.314-2.686 6-6 6s-6-2.686-6-6 2.686-6 6-6"
          stroke="url(#bm-grad)"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeDasharray="14 12"
        />
        <circle cx="16" cy="16" r="2.4" fill="#38bdf8" />
      </svg>
    </span>
  );
}

export type NavSection = "home" | "documents" | "ask" | "workflows" | "approvals" | "profile" | "help" | "dashboard" | "blogs";

const sidebarNavItems: { href: string; label: string; icon: string; id: NavSection }[] = [
  { href: "/dashboard", label: "Analytics", icon: "📊", id: "dashboard" },
  { href: "/workflows", label: "Workflows", icon: "⚡", id: "workflows" },
  { href: "/approvals", label: "Review Queue", icon: "📥", id: "approvals" },
  { href: "/documents", label: "Knowledge Base", icon: "📚", id: "documents" },
  { href: "/ask", label: "Policy Copilot", icon: "💬", id: "ask" },
];

/**
 * Modern SaaS Dark Dashboard Shell:
 * Features a persistent left sidebar, clean navigation, user info with profile link,
 * and top navigation breadcrumbs.
 */
export function DashboardLayout({
  active,
  title,
  subtitle,
  actions,
  children,
  flush = false,
}: {
  active: NavSection;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <div className="dashboard-root">
      {/* ── Persistent Dark Sidebar ───────────────────────────────────── */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <Link href="/" className="brand">
            <BrandMark size={28} />
            <span>Loop<span className="brand-light">desk</span></span>
          </Link>
        </div>

        <nav className="sidebar-nav" aria-label="Dashboard Navigation">
          <div className="sidebar-section-title">Navigation</div>
          {sidebarNavItems.map((item) => {
            const isActive = pathname === item.href || active === item.id;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-nav-item ${isActive ? "active" : ""}`}
              >
                <span className="sidebar-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
                {item.id === "workflows" && (
                  <span className="sidebar-item-badge">Trace</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Footer with Profile Link & Sign Out */}
        <div className="sidebar-footer">
          <Link href="/profile" className="sidebar-user" title="Open Account Settings">
            {user?.picture ? (
              <img
                src={user.picture}
                alt=""
                className="sidebar-avatar"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="sidebar-avatar">
                {(user?.name || user?.email || "U").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.name || "Support Operator"}</span>
              <span className="sidebar-user-email">{user?.email || "operator@loopdesk.io"}</span>
            </div>
          </Link>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="sidebar-logout-btn" title="Sign out of workspace">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* ── Main Dashboard Canvas ─────────────────────────────────────── */}
      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="dashboard-breadcrumbs">
            <Link href="/dashboard">Workspace</Link>
            <span>/</span>
            <span className="active" style={{ textTransform: "capitalize" }}>
              {title || active}
            </span>
          </div>

          <div className="dashboard-topbar-actions">
            {actions}
            <Link
              href="/profile"
              className="topbar-user-btn"
              title="Profile & Settings"
            >
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt=""
                  style={{ width: "20px", height: "20px", borderRadius: "50%" }}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#6366f1", display: "grid", placeItems: "center", fontSize: "11px", fontWeight: 700 }}>
                  {(user?.name || user?.email || "U").slice(0, 1).toUpperCase()}
                </span>
              )}
              <span>Profile</span>
            </Link>
          </div>
        </header>

        <main className={`dashboard-content ${flush ? "dashboard-content-flush" : ""}`}>
          {!flush && (title || subtitle) && (
            <div style={{ marginBottom: "24px" }}>
              {title && (
                <h1 style={{ fontSize: "26px", fontWeight: 700, margin: "0 0 6px", color: "#ffffff", letterSpacing: "-0.03em" }}>
                  {title}
                </h1>
              )}
              {subtitle && (
                <p style={{ margin: 0, fontSize: "13.5px", color: "var(--text-secondary)" }}>
                  {subtitle}
                </p>
              )}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Public Navigation Topbar (for Landing and Blogs)
 * Shows only Dashboard and Blogs links slightly right of center,
 * and a sleek profile icon (no name, no open dashboard button).
 */
export function Nav({ active }: { active?: NavSection }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand">
          <BrandMark />
          <span>Loop<span className="brand-light">desk</span></span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link href="/dashboard" className={pathname === "/dashboard" ? "nav-link active" : "nav-link"}>
            Dashboard
          </Link>
          <Link href="/blogs" className={pathname === "/blogs" || pathname.startsWith("/blogs/") ? "nav-link active" : "nav-link"}>
            Blogs
          </Link>
        </nav>
        <div className="nav-actions">
          {user ? (
            <Link
              href="/profile"
              className="nav-profile-btn"
              title={user.name || user.email || "Profile & Account"}
            >
              {user.picture ? (
                <img
                  src={user.picture}
                  alt="Profile"
                  className="nav-profile-img"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="nav-profile-initial">
                  {(user.name || user.email || "U").slice(0, 1).toUpperCase()}
                </span>
              )}
            </Link>
          ) : (
            <Link href="/login" className="button-primary" style={{ padding: "8px 16px", fontSize: "12.5px" }}>
              Sign in <span>↗</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-muted)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "16px" }}>
      <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#6366f1" }} />
      <span>{children}</span>
      <span style={{ height: "1px", flex: 1, background: "linear-gradient(90deg, rgba(255,255,255,0.1), transparent)" }} />
    </div>
  );
}
