"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Nav } from "../components";

const API = "/api/backend";

type RunStatus = "all" | "approved" | "rejected" | "pending";

type Execution = {
  id: number;
  workflow_id: number;
  workflow_name: string;
  trigger_payload: { event_text?: string; metadata?: Record<string, unknown> };
  decision_output: {
    decision?: string;
    confidence?: number;
    reasoning?: string;
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
];

function category(status: string, rawDecision?: string): Exclude<RunStatus, "all"> | "failed" | "other" {
  if (status === "pending_approval" || status === "pending_review") return "pending";
  if (status === "rejected") return "rejected";
  if (status === "approved" || status === "executed") return "approved";
  if (status === "auto_executed" || status === "auto_completed") {
    const decision = (rawDecision || "").toUpperCase();
    if (decision === "REJECT") return "rejected";
    if (decision === "APPROVE" || decision === "REPLY") return "approved";
    return "pending";
  }
  if (status.includes("failed")) return "failed";
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

  async function decide(id: number, action: "approve" | "reject") {
    setBusyId(id);
    setBusyAction(action);
    setError("");
    try {
      const response = await fetch(`${API}/workflows/executions/${id}/${action}`, { method: "POST" });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.detail || `Could not ${action} this run.`);
      }
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update this run.");
    } finally {
      setBusyId(null);
      setBusyAction(null);
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
  const selectedItem = useMemo(() => items.find((i) => i.id === selectedId) || null, [items, selectedId]);

  return (
    <div className="product-shell">
      <Nav active="approvals" />
      <main className="page-container approvals-page">
        <header className="page-heading approvals-heading">
          <p className="eyebrow">HUMAN-IN-THE-LOOP TRUST ENGINE</p>
          <h1>Customer Review Queue</h1>
          <p>Compact inbox of customer requests. Click any row to inspect AI analysis and approve in the side panel.</p>
        </header>

        <section className="approval-stats" aria-label="Workflow run statistics">
          <div>
            <small>Active Workflows</small>
            <strong>{counts.workflows}</strong>
          </div>
          <div>
            <small>Total Requests</small>
            <strong>{counts.runs}</strong>
          </div>
          <div>
            <small>Accepted</small>
            <strong>{counts.approved}</strong>
          </div>
          <div>
            <small>Automatic runs</small>
            <strong>{counts.automatic}</strong>
          </div>
          <div>
            <small>Rejected</small>
            <strong>{counts.rejected}</strong>
          </div>
          <div>
            <small>Needs Review</small>
            <strong>{counts.pending}</strong>
          </div>
          <div>
            <small>Action failed</small>
            <strong>{counts.failed}</strong>
          </div>
        </section>

        <section className="approval-list-heading">
          <div>
            <p className="eyebrow">TRIAGE INBOX</p>
            <h2>Incoming Customer Decisions</h2>
            <p>Click any item to open the slide-out review panel.</p>
          </div>
          <button
            className="refresh-button"
            onClick={() => {
              setLoading(true);
              void refresh();
            }}
          >
            ↻ Refresh feed
          </button>
        </section>

        <section className="approval-toolbar">
          <div className="approval-filters" role="tablist" aria-label="Filter workflow runs">
            {filters.map((option) => {
              const count = option.id === "all" ? counts.runs : counts[option.id];
              return (
                <button
                  key={option.id}
                  role="tab"
                  aria-selected={filter === option.id}
                  onClick={() => setFilter(option.id)}
                  className={`approval-filter ${filter === option.id ? "selected" : ""}`}
                >
                  {option.label}
                  <span>{count}</span>
                </button>
              );
            })}
          </div>
        </section>

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
          <div className="approval-empty card">
            <span>✓</span>
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
                    {(item.status === "pending_review" || item.status === "pending_approval") && (
                      <div className="compact-review-actions" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          className="compact-review-action reject"
                          disabled={busyId === item.id}
                          onClick={() => void decide(item.id, "reject")}
                        >
                          {busyId === item.id && busyAction === "reject" ? "Rejecting…" : "Reject"}
                        </button>
                        <button
                          type="button"
                          className="compact-review-action approve"
                          disabled={busyId === item.id}
                          onClick={() => void decide(item.id, "approve")}
                        >
                          {busyId === item.id && busyAction === "approve" ? "Approving…" : "Approve"}
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
                      <div className="ticket-header-meta">
                        <span className="ticket-draft-badge">Draft for Review</span>
                      </div>
                    </div>
                    <div className="ticket-card-body">
                      <p className="ticket-message-text">
                        {selectedItem.decision_output.action_payload.message}
                      </p>

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
                      <span className="info-strip-value" style={{ color: "#2e6a28" }}>
                        {selectedItem.reviewed_by}
                      </span>
                    </div>
                  )}
                </div>
                {!!selectedItem.decision_output?.sources?.length && <div className="review-source-list"><strong>Knowledge used</strong>{selectedItem.decision_output.sources.map((source, index) => <span key={`${source.filename}-${index}`}>{source.filename}{source.chunk_id ? ` · section ${source.chunk_id}` : ""}</span>)}</div>}
              </div>

              {/* Sticky Footer Action Bar */}
              {selectedItem.status === "pending_review" || selectedItem.status === "pending_approval" ? (
                <div className="drawer-footer">
                  <button
                    className="drawer-btn reject"
                    disabled={busyId === selectedItem.id}
                    onClick={() => void decide(selectedItem.id, "reject")}
                  >
                    ✕ Reject Request
                  </button>
                  <button
                    className="drawer-btn approve"
                    disabled={busyId === selectedItem.id}
                    onClick={() => void decide(selectedItem.id, "approve")}
                  >
                    {busyId === selectedItem.id ? "Processing…" : selectedItem.has_action ? "✓ Approve & Send" : "✓ Approve Decision"}
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
                  <span style={{ color: "#8a7b69", fontSize: 11 }}>Read-only</span>
                </div>
              )}
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
