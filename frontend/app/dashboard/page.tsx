"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "../components";

type AnalyticsData = {
  summary: {
    total_runs: number;
    workflows_count: number;
    documents_indexed: number;
    chunks_stored: number;
    automation_rate_pct: number;
  };
  resolution: {
    auto_executed: number;
    approved: number;
    rejected: number;
    pending_review: number;
    failed: number;
  };
  performance: {
    cache_hit_rate_pct: number;
    cache_hits_l1: number;
    cache_hits_l2_semantic: number;
    llm_calls: number;
    avg_cache_latency_ms: number;
    avg_llm_latency_ms: number;
    latency_reduction_pct: number;
    estimated_tokens_saved: number;
    estimated_dollars_saved: number;
  };
  timeline: { date: string; count: number }[];
};

export default function AnalyticsDashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/backend/analytics");
      if (!res.ok) throw new Error("Could not load telemetry metrics.");
      const json = await res.json();
      setData(json);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  return (
    <DashboardLayout
      active="dashboard"
      title="Analytics & Telemetry"
      subtitle="Unified operational velocity, resolution rates, and dual-tier cache efficiency."
      actions={
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            onClick={() => void loadMetrics()}
            className="btn-secondary"
            style={{ padding: "7px 13px", fontSize: "12px" }}
          >
            ↻ Refresh Data
          </button>
          <Link
            href="/workflows"
            className="button-primary"
            style={{ padding: "7px 14px", fontSize: "12px" }}
          >
            <span>+</span> Create Workflow
          </Link>
        </div>
      }
    >
      {error && (
        <div className="inline-error" style={{ marginBottom: "20px" }}>
          {error}
        </div>
      )}

      {loading && !data ? (
        <div style={{ padding: "80px 0", textAlign: "center", color: "var(--text-secondary)" }}>
          <span style={{ display: "inline-block", width: "20px", height: "20px", border: "2px solid rgba(99,102,241,0.2)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite", marginRight: "12px", verticalAlign: "middle" }} />
          <span>Aggregating real-time telemetry from Redis L1 and pgvector...</span>
        </div>
      ) : data ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* ── 1. PRIMARY OPERATIONAL METRICS ──────────────────────── */}
          <div className="hero-stats-grid">
            {/* Automation Rate */}
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Autonomous Resolution Rate</span>
                <span className="metric-icon">🛡</span>
              </div>
              <div className="metric-value-row">
                <span className="metric-value">{data.summary.automation_rate_pct}%</span>
                <span className="metric-badge emerald">
                  {data.resolution.auto_executed} auto-executed
                </span>
              </div>
              <p className="metric-description">
                Queries evaluated above confidence threshold without requiring human review.
              </p>
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.max(5, data.summary.automation_rate_pct)}%` }}
                />
              </div>
            </div>

            {/* Latency Reduction */}
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Avg Latency Reduction</span>
                <span className="metric-icon">⚡</span>
              </div>
              <div className="metric-value-row">
                <span className="metric-value">{data.performance.latency_reduction_pct}%</span>
                <span className="metric-badge cyan">
                  {data.performance.avg_cache_latency_ms}ms avg cache
                </span>
              </div>
              <p className="metric-description">
                Sub-second resolution via L1 Redis and L2 pgvector vs {data.performance.avg_llm_latency_ms}ms fresh LLM.
              </p>
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.max(5, data.performance.latency_reduction_pct)}%` }}
                />
              </div>
            </div>

            {/* Avoided Cloud Spend */}
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Avoided Token Compute</span>
                <span className="metric-icon">✦</span>
              </div>
              <div className="metric-value-row">
                <span className="metric-value">${data.performance.estimated_dollars_saved.toFixed(2)}</span>
                <span className="metric-badge emerald">
                  ~{(data.performance.estimated_tokens_saved / 1000).toFixed(0)}k tokens
                </span>
              </div>
              <p className="metric-description">
                Cumulative cloud inference dollars saved by caching recurring customer inquiries.
              </p>
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${Math.min(100, Math.max(8, data.performance.cache_hit_rate_pct))}%`,
                    background: "linear-gradient(90deg, #06b6d4, #10b981)",
                  }}
                />
              </div>
            </div>

            {/* Dual-Tier Cache Hit Rate */}
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Cache Hit Rate</span>
                <span className="metric-icon">🧠</span>
              </div>
              <div className="metric-value-row">
                <span className="metric-value">{data.performance.cache_hit_rate_pct}%</span>
                <span className="metric-badge amber">
                  {data.performance.cache_hits_l1 + data.performance.cache_hits_l2_semantic} hits
                </span>
              </div>
              <p className="metric-description">
                {data.performance.cache_hits_l1} exact Redis + {data.performance.cache_hits_l2_semantic} semantic vector hits.
              </p>
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.max(5, data.performance.cache_hit_rate_pct)}%` }}
                />
              </div>
            </div>
          </div>

          {/* ── 2. VELOCITY CHART & RESOLUTION BREAKDOWN ─────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "20px" }}>
            {/* 7-Day Velocity Bar Chart */}
            <div className="card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", color: "#ffffff" }}>7-Day Operational Velocity</h3>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
                    Daily inbound email inquiries processed across active workflows.
                  </p>
                </div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  Total events: {data.summary.total_runs}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "flex-end", gap: "14px", height: "160px", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                {data.timeline.map((point) => {
                  const maxVal = Math.max(...data.timeline.map((t) => t.count), 1);
                  const heightPct = Math.max(12, Math.round((point.count / maxVal) * 100));
                  return (
                    <div key={point.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", height: "100%", justifyContent: "flex-end" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 600 }}>{point.count}</span>
                      <div
                        style={{
                          width: "100%",
                          maxWidth: "36px",
                          height: `${heightPct}%`,
                          borderRadius: "6px 6px 0 0",
                          background: "linear-gradient(180deg, #6366f1 0%, #312e81 100%)",
                          border: "1px solid rgba(99,102,241,0.4)",
                        }}
                      />
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {point.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Resolution Breakdown */}
            <div className="card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", color: "#ffffff" }}>Resolution Breakdown</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
                    <span style={{ color: "var(--text-secondary)" }}>Auto-Executed:</span>
                  </span>
                  <strong style={{ color: "#ffffff" }}>{data.resolution.auto_executed}</strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#38bdf8" }} />
                    <span style={{ color: "var(--text-secondary)" }}>Accepted via Review:</span>
                  </span>
                  <strong style={{ color: "#ffffff" }}>{data.resolution.approved}</strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }} />
                    <span style={{ color: "var(--text-secondary)" }}>Pending Review:</span>
                  </span>
                  <strong style={{ color: "#fbbf24" }}>{data.resolution.pending_review}</strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f43f5e" }} />
                    <span style={{ color: "var(--text-secondary)" }}>Rejected Inquiries:</span>
                  </span>
                  <strong style={{ color: "#ffffff" }}>{data.resolution.rejected}</strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#64748b" }} />
                    <span style={{ color: "var(--text-secondary)" }}>Failed Actions:</span>
                  </span>
                  <strong style={{ color: "var(--text-muted)" }}>{data.resolution.failed}</strong>
                </div>
              </div>

              <Link href="/approvals" className="button-secondary" style={{ marginTop: "auto", justifyContent: "center", fontSize: "12.5px" }}>
                Open Review Queue ({data.resolution.pending_review} pending) <span>→</span>
              </Link>
            </div>
          </div>

          {/* ── 3. DUAL-TIER CACHE BREAKDOWN ─────────────────────────── */}
          <div className="cache-tier-grid">
            <div className="cache-tier-card highlight">
              <div className="cache-tier-header">
                <div className="cache-tier-title">
                  <span>⚡</span> L1 In-Memory Exact Cache
                </div>
                <span className="cache-tier-badge l1">~10ms</span>
              </div>
              <div style={{ fontSize: "32px", fontWeight: 700, color: "#ffffff" }}>
                {data.performance.cache_hits_l1}
                <small style={{ fontSize: "13px", color: "var(--text-muted)", marginLeft: "8px", fontWeight: 400 }}>hits</small>
              </div>
              <p style={{ margin: 0, fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                SHA-256 exact match hash lookups in Redis. Bypasses models completely for repeated identical inquiries.
              </p>
            </div>

            <div className="cache-tier-card">
              <div className="cache-tier-header">
                <div className="cache-tier-title">
                  <span>🧠</span> L2 Semantic Vector Cache
                </div>
                <span className="cache-tier-badge l2">~45ms</span>
              </div>
              <div style={{ fontSize: "32px", fontWeight: 700, color: "#ffffff" }}>
                {data.performance.cache_hits_l2_semantic}
                <small style={{ fontSize: "13px", color: "var(--text-muted)", marginLeft: "8px", fontWeight: 400 }}>hits</small>
              </div>
              <p style={{ margin: 0, fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                768-dim cosine similarity search in PostgreSQL pgvector. Matches semantic intent across varied phrasing.
              </p>
            </div>

            <div className="cache-tier-card">
              <div className="cache-tier-header">
                <div className="cache-tier-title">
                  <span>✦</span> Fresh Frontier AI Inference
                </div>
                <span className="cache-tier-badge llm">~{data.performance.avg_llm_latency_ms}ms</span>
              </div>
              <div style={{ fontSize: "32px", fontWeight: 700, color: "#ffffff" }}>
                {data.performance.llm_calls}
                <small style={{ fontSize: "13px", color: "var(--text-muted)", marginLeft: "8px", fontWeight: 400 }}>calls</small>
              </div>
              <p style={{ margin: 0, fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Novel inquiries evaluated over policy passages using Gemini 2.5 Flash with Groq Llama 3.3 fallback.
              </p>
            </div>
          </div>

          {/* ── 4. INFRASTRUCTURE & KNOWLEDGE STATUS STRIP ────────────── */}
          <div className="card" style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "20px", flexWrap: "wrap", fontSize: "12.5px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
              <span style={{ color: "var(--text-secondary)" }}>Indexed Policies:</span>
              <strong style={{ color: "#ffffff" }}>{data.summary.documents_indexed} files ({data.summary.chunks_stored} passages)</strong>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Workflows:</span>
              <strong style={{ color: "#ffffff" }}>{data.summary.workflows_count} active webhooks</strong>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Models:</span>
              <span style={{ color: "#38bdf8", fontFamily: "var(--font-mono)" }}>gemini-2.5-flash / llama-3.3</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Vector Dim:</span>
              <span style={{ color: "#a5b4fc", fontFamily: "var(--font-mono)" }}>768-dim pgvector</span>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
