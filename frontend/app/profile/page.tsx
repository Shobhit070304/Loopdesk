"use client";

import { DashboardLayout, useAuth } from "../components";

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <DashboardLayout
      active="profile"
      title="Workspace & Account Settings"
      subtitle="Manage your profile identity, active Google session, and security credentials."
    >
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "24px" }}>
        <div className="card" style={{ padding: "28px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "3px 10px", borderRadius: "99px", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399", fontSize: "11px", fontWeight: 600, marginBottom: "20px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399" }} />
            Active Session
          </div>
          {user?.picture ? (
            <img
              src={user.picture}
              alt={user.name}
              style={{ width: "72px", height: "72px", borderRadius: "16px", marginBottom: "14px", border: "2px solid rgba(255,255,255,0.15)" }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "16px",
                background: "linear-gradient(135deg, #6366f1, #3b82f6)",
                color: "#ffffff",
                display: "grid",
                placeItems: "center",
                fontSize: "26px",
                fontWeight: 700,
                marginBottom: "14px",
                border: "2px solid rgba(255,255,255,0.15)",
              }}
            >
              {user?.name?.slice(0, 1).toUpperCase() || "U"}
            </div>
          )}
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#ffffff", margin: "0 0 4px" }}>
            {user?.name || "Support Operator"}
          </h2>
          <p style={{ margin: "0 0 16px", fontSize: "12.5px", color: "var(--text-secondary)" }}>
            {user?.email || "operator@loopdesk.io"}
          </p>
          <span style={{ fontSize: "11.5px", color: "#34d399", display: "flex", alignItems: "center", gap: "6px", marginBottom: "24px" }}>
            ✓ Account verified & active
          </span>
          <form action="/api/auth/logout" method="post" style={{ width: "100%", marginTop: "auto" }}>
            <button
              type="submit"
              className="btn-secondary"
              style={{ width: "100%", justifyContent: "center", color: "#fb7185", borderColor: "rgba(244,63,94,0.3)" }}
            >
              Sign out of workspace
            </button>
          </form>
        </div>

        <div className="card" style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: "16px", color: "#ffffff" }}>Personal Information</h3>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--text-secondary)" }}>
              Authenticated identity information verified by session cookie.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderRadius: "8px", background: "#0e111a", border: "1px solid var(--border-subtle)" }}>
              <span style={{ color: "var(--text-muted)" }}>Full name:</span>
              <strong style={{ color: "#ffffff" }}>{user?.name || "—"}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderRadius: "8px", background: "#0e111a", border: "1px solid var(--border-subtle)" }}>
              <span style={{ color: "var(--text-muted)" }}>Email address:</span>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <strong style={{ color: "#ffffff" }}>{user?.email || "—"}</strong>
                <span style={{ padding: "1px 6px", borderRadius: "99px", background: "rgba(16,185,129,0.15)", color: "#34d399", fontSize: "10px", fontWeight: 600 }}>Verified</span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderRadius: "8px", background: "#0e111a", border: "1px solid var(--border-subtle)" }}>
              <span style={{ color: "var(--text-muted)" }}>Workspace ID:</span>
              <code style={{ color: "#a5b4fc" }}>{user?.sub || "default"}</code>
            </div>
          </div>

          <div style={{ padding: "14px 18px", borderRadius: "10px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", fontSize: "12px", color: "#c7d2fe", display: "flex", gap: "10px", alignItems: "center" }}>
            <span>🔒</span>
            <span>All workspace data, documents, and workflows are isolated to your authenticated account ID.</span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
