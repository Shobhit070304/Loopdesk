"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "../components";

const API = "/api/backend";

type RunStatus = "all" | "approved" | "rejected" | "pending" | "failed";

type Execution = {
  id: number;
  workflow_id: number;
  workflow_name: string;
  trigger_payload: { event_text?: string; metadata?: Record<string, unknown> };
  decision_output: {
    decision?: string;
    confidence?: number;
    reasoning?: string;
    error?: string;
    action_payload?: { message?: string; recipient?: string };
    sources?: { filename: string; chunk_id?: number }[];
  };
  status: string;
  has_action?: boolean;
  source?: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  executed_at: string;
};

const filters: { id: RunStatus; label: string }[] = [
  { id: "all", label: "All requests" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
  { id: "failed", label: "Action failed" },
];

function category(status: string, rawDecision?: string): Exclude<RunStatus, "all"> | "other" {
  if (status === "pending_approval" || status === "pending_review") return "pending";
  if (status === "rejected") return "rejected";
  if (status === "approved" || status === "executed") return "approved";
  if (status.includes("failed") || status === "dispatching" || status === "ai_evaluation_failed" || status.includes("invalid")) return "failed";
  if (status === "auto_executed" || status === "auto_completed") {
    const decision = (rawDecision || "").toUpperCase();
    if (decision === "REJECT") return "rejected";
    return "approved";
  }
  return "other";
}

function getRecommendation(rawDecision?: string): {
  short: string;
  title: string;
  tone: "approve" | "reject" | "escalate" | "reply";
} {
  const d = (rawDecision || "").toUpperCase();
  if (d === "APPROVE") return { short: "Approve", title: "Recommended Action: Approve Request", tone: "approve" };
  if (d === "REJECT") return { short: "Reject", title: "Recommended Action: Reject Request", tone: "reject" };
  if (d === "ESCALATE") return { short: "Escalate", title: "Recommended Action: Escalate to Supervisor", tone: "escalate" };
  if (d === "REPLY") return { short: "Reply", title: "Recommended Action: Send Customer Response", tone: "reply" };
  return { short: d || "Review", title: `Recommended Action: ${d || "Review"}`, tone: "reply" };
}

function metadataString(item: Execution, key: string): string | null {
  const value = item.trigger_payload?.metadata?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

export default function ApprovalsPage() {
  const [items, setItems] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyAction, setBusyAction] = useState<"approve" | "reject" | null>(null);
  const [filter, setFilter] = useState<RunStatus>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [editedDraftText, setEditedDraftText] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`${API}/workflow-executions?limit=500`);
      if (!response.ok) throw new Error("Could not load workflow activity.");
      setItems(await response.json() as Execution[]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load workflow activity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Close drawer on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const selectedItem = useMemo(() => items.find((i) => i.id === selectedId) || null, [items, selectedId]);

  useEffect(() => {
    setIsEditingDraft(false);
    if (selectedItem?.decision_output?.action_payload?.message) {
      setEditedDraftText(selectedItem.decision_output.action_payload.message);
    } else {
      setEditedDraftText("");
    }
  }, [selectedId, selectedItem]);

  async function decide(id: number, action: "approve" | "reject", editedMessage?: string) {
    setBusyId(id);
    setBusyAction(action);
    setError("");
    try {
      const hasBody = action === "approve";
      const response = await fetch(`${API}/workflows/executions/${id}/${action}`, {
        method: "POST",
        headers: hasBody ? { "Content-Type": "application/json" } : {},
        body: hasBody ? JSON.stringify({ edited_message: editedMessage ?? null }) : undefined,
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.detail || `Could not ${action} this run.`);
      }
      setIsEditingDraft(false);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update this run.");
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  async function retryDispatch(id: number) {
    setBusyId(id);
    setError("");
    try {
      const response = await fetch(`${API}/workflows/executions/${id}/retry`, { method: "POST" });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.detail || "Could not retry action dispatch.");
      }
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not retry action dispatch.");
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(
    () => ({
      workflows: new Set(items.map((item) => item.workflow_id)).size,
      runs: items.length,
      approved: items.filter((item) => category(item.status, item.decision_output?.decision) === "approved").length,
      rejected: items.filter((item) => category(item.status, item.decision_output?.decision) === "rejected").length,
      pending: items.filter((item) => category(item.status, item.decision_output?.decision) === "pending").length,
      automatic: items.filter((item) => item.status === "auto_executed" || item.status === "auto_completed").length,
      failed: items.filter((item) => category(item.status) === "failed").length,
    }),
    [items]
  );

  const shown = filter === "all" ? items : items.filter((item) => category(item.status, item.decision_output?.decision) === filter);

  return (
    <DashboardLayout
      active="approvals"
      title="Customer Review Queue"
      subtitle="Human-in-the-loop triage inbox. Inspect AI reasoning and approve or edit email replies."
      actions={
        <button
          className="btn-secondary"
          style={{ padding: "7px 13px", fontSize: "12px" }}
          onClick={() => {
            setLoading(true);
            void refresh();
          }}
        >
          ↻ Refresh Feed
        </button>
      }
    >

        {/* ── Review Queue KPI Stat Cards ────────────────────────────── */}
        <section className="queue-stats-grid" aria-label="Workflow run statistics">
          <div className="queue-stat-card">
            <span className="queue-stat-label">Total Volume</span>
            <span className="queue-stat-value">{counts.runs}</span>
            <span className="queue-stat-sub">Across {counts.workflows} active workflows</span>
          </div>
          <div className="queue-stat-card highlight-amber">
            <span className="queue-stat-label">Pending Review</span>
            <span className="queue-stat-value" style={{ color: counts.pending > 0 ? "#fbbf24" : "#ffffff" }}>
              {counts.pending}
            </span>
            <span className="queue-stat-badge amber">Awaiting Human Triage</span>
          </div>
          <div className="queue-stat-card">
            <span className="queue-stat-label">Auto-Executed</span>
            <span className="queue-stat-value" style={{ color: "#34d399" }}>{counts.automatic}</span>
            <span className="queue-stat-badge emerald">Confidence Met</span>
          </div>
          <div className="queue-stat-card">
            <span className="queue-stat-label">Accepted</span>
            <span className="queue-stat-value" style={{ color: "#38bdf8" }}>{counts.approved}</span>
            <span className="queue-stat-badge cyan">Operator Approved</span>
          </div>
          <div className="queue-stat-card">
            <span className="queue-stat-label">Rejected</span>
            <span className="queue-stat-value" style={{ color: counts.rejected > 0 ? "#fb7185" : "var(--text-muted)" }}>
              {counts.rejected}
            </span>
            <span className="queue-stat-sub">Denied by Policy</span>
          </div>
          <div className="queue-stat-card">
            <span className="queue-stat-label">Failed Actions</span>
            <span className="queue-stat-value" style={{ color: counts.failed > 0 ? "#f43f5e" : "var(--text-muted)" }}>
              {counts.failed}
            </span>
            <span className="queue-stat-sub">Dispatch Errors</span>
          </div>
        </section>

        {/* ── Inbox Toolbar & Filter Pills ────────────────────────────── */}
        <div className="queue-toolbar-card">
          <div className="queue-toolbar-left">
            <div className="queue-filters" role="tablist" aria-label="Filter workflow runs">
              {filters.map((option) => {
                const count = option.id === "all" ? counts.runs : counts[option.id];
                return (
                  <button
                    key={option.id}
                    role="tab"
                    aria-selected={filter === option.id}
                    onClick={() => setFilter(option.id)}
                    className={`queue-filter-btn ${filter === option.id ? "selected" : ""}`}
                  >
                    <span>{option.label}</span>
                    <span className="queue-filter-count">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
            Click any row to open decision review
          </span>
        </div>

        {error && (
          <div className="inline-error" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="queue-loading">
            <span className="spinner" /> Loading customer review queue…
          </div>
        ) : shown.length === 0 ? (
          <div className="approval-empty">
            <div className="approval-empty-icon">✓</div>
            <h2>{filter === "pending" ? "Queue is clear — no pending reviews." : "No requests found."}</h2>
            <p>
              {filter === "all"
                ? "Customer inquiries and triggered workflow runs will appear here for review."
                : `There are no ${filter} requests right now.`}
            </p>
          </div>
        ) : (
          /* Compact list of requests */
          <div className="compact-review-list">
            {shown.map((item) => {
              const runCategory = category(item.status, item.decision_output?.decision);
              const isSelected = selectedId === item.id;

              return (
                <div
                  key={`${item.workflow_id}-${item.id}`}
                  className={`compact-review-item ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedId(item.id)}
                  title="Click to view details and decision actions"
                >
                  <span className="compact-req-id">RUN #{item.id}</span>
                  <span className="compact-issue-text">
                    {item.trigger_payload?.event_text || "No details provided in event payload."}
                  </span>
                  <div className="compact-essentials">
                    <span className="compact-workflow-name">{item.workflow_name}</span>
                    <span className={`compact-status-badge ${runCategory}`}>
                      {runCategory === "pending"
                        ? "Pending"
                        : runCategory === "approved"
                        ? "Accepted"
                        : runCategory === "rejected"
                        ? "Rejected"
                        : runCategory === "failed"
                        ? "Action failed"
                        : item.status.replaceAll("_", " ")}
                    </span>
                    <span className="compact-time">
                      {new Date(item.executed_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {(item.status === "pending_review" || item.status === "pending_approval" || item.status === "ai_evaluation_failed") && (
                      <div className="compact-review-actions" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          className="compact-review-action reject"
                          disabled={busyId === item.id}
                          onClick={() => void decide(item.id, "reject")}
                          title="Reject request directly from list"
                        >
                          {busyId === item.id && busyAction === "reject" ? "Rejecting…" : "✕ Reject"}
                        </button>
                        <button
                          type="button"
                          className="compact-review-action approve"
                          disabled={busyId === item.id}
                          onClick={() => void decide(item.id, "approve")}
                          title="Approve decision directly from list"
                        >
                          {busyId === item.id && busyAction === "approve" ? "Approving…" : "✓ Approve"}
                        </button>
                      </div>
                    )}
                    {category(item.status) === "failed" && item.has_action && (
                      <div className="compact-review-actions" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          className="compact-review-action approve"
                          disabled={busyId === item.id}
                          onClick={() => void retryDispatch(item.id)}
                          title="Retry outbound action dispatch"
                        >
                          {busyId === item.id ? "Retrying…" : "↻ Retry"}
                        </button>
                      </div>
                    )}
                    <span className="compact-arrow">→</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Slide-Over Side Drawer ─────────────────────────────────── */}
        <div
          className={`drawer-backdrop ${selectedItem ? "open" : ""}`}
          onClick={() => setSelectedId(null)}
          aria-hidden={!selectedItem}
        />

        <aside className={`drawer-panel ${selectedItem ? "open" : ""}`} aria-label="Review Details Panel">
          {selectedItem && (
            <>
              {/* Header */}
              <div className="drawer-header">
                <div className="drawer-header-content">
                  <div className="drawer-eyebrow-row">
                    <span className="drawer-req-id">RUN #{selectedItem.id}</span>
                    {(() => {
                      const rec = getRecommendation(selectedItem.decision_output?.decision);
                      return (
                        <span className={`drawer-rec-pill ${rec.tone}`}>
                          <span className="drawer-rec-dot">●</span>
                          <span>AI Suggests: {rec.short}</span>
                          {typeof selectedItem.decision_output?.confidence === "number" && (
                            <span className="drawer-conf-chip">
                              {Math.round(selectedItem.decision_output.confidence * 100)}%
                            </span>
                          )}
                        </span>
                      );
                    })()}
                  </div>
                  <h3 className="drawer-title">{selectedItem.workflow_name}</h3>
                </div>
                <button
                  className="drawer-close-btn"
                  onClick={() => setSelectedId(null)}
                  aria-label="Close review panel"
                  title="Close (ESC)"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Body: Customer Request & Agent Response are the primary focus */}
              <div className="drawer-body">
                {/* 1. Primary Card: Customer Request */}
                <div className="ticket-card incoming">
                  <div className="ticket-card-header">
                    <div className="ticket-sender-row">
                      <div className="ticket-avatar customer">👤</div>
                      <div className="ticket-sender-info">
                        <span className="ticket-sender-label">{metadataString(selectedItem, "customer_name") || "Customer Request"}</span>
                        <span className="ticket-channel-hint">
                          via {metadataString(selectedItem, "channel") || selectedItem.source?.replaceAll("_", " ") || "Workflow"}
                        </span>
                        {metadataString(selectedItem, "customer_email") && <span className="ticket-recipient-tag">{metadataString(selectedItem, "customer_email")}</span>}
                      </div>
                    </div>
                    <span className="ticket-header-meta">
                      {new Date(selectedItem.executed_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="ticket-card-body">
                    <p className="ticket-message-text">
                      {selectedItem.trigger_payload?.event_text || "No details provided in event payload."}
                    </p>
                  </div>
                </div>

                {/* 2. Primary Card: Proposed Agent Response */}
                {selectedItem.decision_output?.action_payload?.message ? (
                  <div className="ticket-card outgoing">
                    <div className="ticket-card-header">
                      <div className="ticket-sender-row">
                        <div className="ticket-avatar agent">⚡</div>
                        <div className="ticket-sender-info">
                          <span className="ticket-sender-label">Proposed Agent Response</span>
                          {selectedItem.decision_output.action_payload.recipient && (
                            <span className="ticket-recipient-tag">
                              To: {selectedItem.decision_output.action_payload.recipient}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="ticket-header-meta" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {(selectedItem.status === "pending_review" || selectedItem.status === "pending_approval" || selectedItem.status === "ai_evaluation_failed") && (
                          <button
                            type="button"
                            onClick={() => setIsEditingDraft((prev) => !prev)}
                            style={{
                              background: "rgba(99, 102, 241, 0.12)",
                              border: "1px solid rgba(99, 102, 241, 0.3)",
                              color: "#a5b4fc",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontSize: "11.5px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {isEditingDraft ? "Done Editing" : "✎ Edit Draft"}
                          </button>
                        )}
                        <span className="ticket-draft-badge">{isEditingDraft ? "Editing Draft" : "Draft for Review"}</span>
                      </div>
                    </div>
                    <div className="ticket-card-body">
                      {isEditingDraft ? (
                        <textarea
                          rows={4}
                          value={editedDraftText}
                          onChange={(e) => setEditedDraftText(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: "8px",
                            background: "var(--bg-input)",
                            border: "1px solid var(--border-card)",
                            color: "var(--text-primary)",
                            fontSize: "13px",
                            marginBottom: "8px",
                            fontFamily: "inherit",
                            lineHeight: 1.55,
                          }}
                        />
                      ) : (
                        <p className="ticket-message-text">
                          {editedDraftText || selectedItem.decision_output.action_payload.message}
                        </p>
                      )}

                      {/* Integrated Policy Assessment & Reasoning */}
                      {selectedItem.decision_output?.reasoning && (
                        <div className="ticket-policy-callout">
                          <div className="policy-callout-header">
                            <span className="policy-callout-icon">📋</span>
                            <span className="policy-callout-title">AI Policy Assessment & Justification</span>
                          </div>
                          <p className="policy-callout-text">{selectedItem.decision_output.reasoning}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : selectedItem.decision_output?.reasoning ? (
                  <div className="ticket-card outgoing">
                    <div className="ticket-card-header">
                      <div className="ticket-sender-row">
                        <div className="ticket-avatar agent">⚡</div>
                        <div className="ticket-sender-info">
                          <span className="ticket-sender-label">AI Decision & Policy Assessment</span>
                        </div>
                      </div>
                    </div>
                    <div className="ticket-card-body">
                      <div className="ticket-policy-callout" style={{ marginTop: 0 }}>
                        <div className="policy-callout-header">
                          <span className="policy-callout-icon">📋</span>
                          <span className="policy-callout-title">Policy Assessment & Justification</span>
                        </div>
                        <p className="policy-callout-text">{selectedItem.decision_output.reasoning}</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Failure Diagnostic Alert */}
                {selectedItem.decision_output?.error ? (
                  <div className="ticket-card" style={{ borderLeft: "3px solid #f43f5e", background: "rgba(244, 63, 94, 0.1)", borderRadius: "8px", padding: "14px 16px", margin: "14px 0", border: "1px solid rgba(244, 63, 94, 0.25)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#fb7185", fontWeight: 650, fontSize: "13px" }}>
                      <span>⚠️</span> Failure Diagnostic
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.5, wordBreak: "break-word" }}>
                      {selectedItem.decision_output.error}
                    </p>
                  </div>
                ) : null}

                {/* 3. Quiet Metadata Strip (Everything else just shows the info) */}
                <div className="drawer-info-strip">
                  <div className="info-strip-cell">
                    <span className="info-strip-label">Review Status</span>
                    <span className="info-strip-value">
                      {category(selectedItem.status, selectedItem.decision_output?.decision) === "pending"
                        ? "Pending"
                        : category(selectedItem.status, selectedItem.decision_output?.decision) === "approved"
                        ? "Accepted"
                        : category(selectedItem.status, selectedItem.decision_output?.decision) === "rejected"
                        ? "Rejected"
                        : category(selectedItem.status, selectedItem.decision_output?.decision) === "failed"
                        ? "Action failed"
                        : selectedItem.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="info-strip-cell">
                    <span className="info-strip-label">Source</span>
                    <span className="info-strip-value">
                      {metadataString(selectedItem, "channel") || selectedItem.source?.replaceAll("_", " ") || "Workflow"}
                    </span>
                  </div>
                  <div className="info-strip-cell">
                    <span className="info-strip-label">Request ID</span>
                    <span className="info-strip-value">#{selectedItem.id}</span>
                  </div>
                  <div className="info-strip-cell">
                    <span className="info-strip-label">Received</span>
                    <span className="info-strip-value">
                      {new Date(selectedItem.executed_at).toLocaleString([], {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  {selectedItem.reviewed_by && (
                    <div className="info-strip-cell full-width">
                      <span className="info-strip-label">Reviewed By</span>
                      <span className="info-strip-value" style={{ color: "#34d399" }}>
                        {selectedItem.reviewed_by}
                      </span>
                    </div>
                  )}
                </div>
                {!!selectedItem.decision_output?.sources?.length && <div className="review-source-list"><strong>Knowledge used</strong>{selectedItem.decision_output.sources.map((source, index) => <span key={`${source.filename}-${index}`}>{source.filename}{source.chunk_id ? ` · section ${source.chunk_id}` : ""}</span>)}</div>}
              </div>

              {/* Sticky Footer Action Bar */}
              {selectedItem.status === "pending_review" || selectedItem.status === "pending_approval" || selectedItem.status === "ai_evaluation_failed" ? (
                <div className="drawer-footer">
                  <button
                    className="drawer-btn reject"
                    disabled={busyId === selectedItem.id}
                    onClick={() => void decide(selectedItem.id, "reject")}
                  >
                    {busyId === selectedItem.id && busyAction === "reject" ? "Rejecting…" : "✕ Reject Request"}
                  </button>
                  <button
                    className="drawer-btn approve"
                    disabled={busyId === selectedItem.id}
                    onClick={() => void decide(selectedItem.id, "approve", editedDraftText)}
                  >
                    {busyId === selectedItem.id ? "Processing…" : selectedItem.has_action ? "✓ Approve & Send" : "✓ Approve Decision"}
                  </button>
                </div>
              ) : category(selectedItem.status) === "failed" && selectedItem.has_action ? (
                <div className="drawer-footer">
                  <button
                    className="drawer-btn approve"
                    style={{ width: "100%" }}
                    disabled={busyId === selectedItem.id}
                    onClick={() => void retryDispatch(selectedItem.id)}
                  >
                    {busyId === selectedItem.id ? "Retrying…" : "↻ Retry Action Dispatch"}
                  </button>
                </div>
              ) : (
                <div className="drawer-footer-readonly">
                  <span>
                    Resolution:{" "}
                    <strong>
                      {category(selectedItem.status, selectedItem.decision_output?.decision) === "approved" ? "Accepted" : category(selectedItem.status, selectedItem.decision_output?.decision) === "rejected" ? "Rejected" : category(selectedItem.status, selectedItem.decision_output?.decision) === "pending" ? "Pending" : "Action needs attention"}
                    </strong>
                    {selectedItem.reviewed_by ? ` by ${selectedItem.reviewed_by}` : ""}
                  </span>
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>Read-only</span>
                </div>
              )}
            </>
          )}
        </aside>
    </DashboardLayout>
  );
}
