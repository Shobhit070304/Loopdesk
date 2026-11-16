"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "../components";

const API = "/api/backend";

async function readApiResponse<T>(response: Response, action: string): Promise<T> {
  const body = await response.text();
  let data: unknown;
  try {
    data = body ? JSON.parse(body) : null;
  } catch {
    if (!response.ok) {
      throw new Error(`Could not ${action} (HTTP ${response.status}). The API returned a non-JSON error; check the backend logs.`);
    }
    throw new Error(`Could not ${action}: the API returned an invalid response.`);
  }

  if (!response.ok) {
    const detail = data && typeof data === "object" && "detail" in data
      ? (data as { detail?: unknown }).detail
      : null;
    let message: string;
    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail)) {
      message = detail.map((err) => (typeof err === "object" && err && "msg" in err ? String(err.msg) : JSON.stringify(err))).join("; ");
    } else if (detail) {
      message = JSON.stringify(detail);
    } else {
      message = `Could not ${action} (HTTP ${response.status}).`;
    }
    throw new Error(message);
  }
  return data as T;
}

type Workflow = {
  id: number;
  name: string;
  description?: string | null;
  system_prompt: string;
  action_type: string;
  action_url?: string | null;
  require_approval?: boolean;
  execution_mode?: "automatic" | "manual";
  webhook_token?: string;
  webhook_secret?: string;
  webhook_enabled?: boolean;
  execution_count?: number;
};

type Template = {
  icon: string;
  name: string;
  description: string;
  prompt: string;
  action: "email";
  approval: boolean;
};

type ExecutionTraceChunk = {
  id: number;
  filename: string;
  similarity_score: number;
  excerpt: string;
};

type OutboundEmailPreview = {
  channel: string;
  to: string;
  subject: string;
  body: string;
  headers: Record<string, string>;
  dispatch_url: string;
};

type ExecutionTraceStage = {
  stage: string;
  latency_ms: number;
  // Stage 1
  channel?: string;
  sender?: string;
  subject?: string;
  payload_bytes?: number;
  status?: string;
  sanitized_text?: string;
  // Stage 2
  retrieved_count?: number;
  chunks?: ExecutionTraceChunk[];
  context_found?: boolean;
  // Stage 3
  provider?: string;
  decision?: string;
  confidence?: number;
  reasoning?: string;
  prompt_tokens_est?: number;
  completion_tokens_est?: number;
  // Stage 4
  dry_run?: boolean;
  dispatched?: boolean;
  payload?: OutboundEmailPreview;
};

type ExecutionTraceResult = {
  workflow_id: number;
  workflow_name: string;
  mode: string;
  total_latency_ms: number;
  stages: ExecutionTraceStage[];
  decision: {
    decision?: string;
    confidence?: number;
    reasoning?: string;
    ai_provider?: string;
    action_payload?: {
      message?: string;
      recipient?: string;
    };
  };
};

const examples: Template[] = [
  {
    icon: "✉",
    name: "Returns & refunds email responder",
    description: "Triage customer refund email requests against return policy.",
    prompt: "Evaluate the customer's email request against our 30-day return window and condition guidelines. Approve eligible refunds and explain the exact policy reason for ineligible requests.",
    action: "email",
    approval: true,
  },
  {
    icon: "🧾",
    name: "Billing & invoice inquiry responder",
    description: "Clarify subscription charges and payment discrepancies via email.",
    prompt: "Analyze billing questions against company pricing and billing policy. Provide a clear, polite itemized breakdown and suggest next steps.",
    action: "email",
    approval: false,
  },
  {
    icon: "🛠",
    name: "Product warranty & technical triage",
    description: "Verify warranty coverage and provide troubleshooting steps via email.",
    prompt: "Review the customer's issue description against standard hardware warranty coverage. If covered under warranty, provide replacement instructions; otherwise provide troubleshooting steps.",
    action: "email",
    approval: true,
  },
];

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [action, setAction] = useState<"email">("email");
  const [url, setUrl] = useState("");
  const [approval, setApproval] = useState(true);
  const [activeExample, setActiveExample] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingWorkflowId, setEditingWorkflowId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Inbound Webhooks & Dry-Run Trace Sandbox State
  const [expandedWebhookId, setExpandedWebhookId] = useState<number | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<number, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [modeSavingId, setModeSavingId] = useState<number | null>(null);

  // Feature 2: Interactive Execution Trace State
  const [simulatingWorkflowId, setSimulatingWorkflowId] = useState<number | null>(null);
  const [traceResults, setTraceResults] = useState<Record<number, ExecutionTraceResult>>({});
  const [testEmail, setTestEmail] = useState<Record<number, string>>({});
  const [testSubject, setTestSubject] = useState<Record<number, string>>({});
  const [testBody, setTestBody] = useState<Record<number, string>>({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const loadWorkflows = useCallback(async () => {
    try {
      const response = await fetch(`${API}/workflows`);
      if (!response.ok) throw new Error("Could not load workflows.");
      const data = (await response.json()) as Workflow[];
      setWorkflows(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load workflows.");
    }
  }, []);

  useEffect(() => {
    void loadWorkflows();
  }, [loadWorkflows]);

  function selectExample(example: Template) {
    setActiveExample(example.name);
    setName(example.name);
    setDescription(example.description);
    setPrompt(example.prompt);
    setAction(example.action);
    setApproval(example.approval);
    setUrl("");
    setEditingWorkflowId(null);
  }

  function startEditingWorkflow(workflow: Workflow) {
    setEditingWorkflowId(workflow.id);
    setName(workflow.name);
    setDescription(workflow.description || "");
    setPrompt(workflow.system_prompt);
    setAction("email");
    setUrl(workflow.action_url || "");
    setApproval((workflow.execution_mode || (workflow.require_approval ? "manual" : "automatic")) === "manual");
    setActiveExample("");
    setError("");
    setMessage(`Editing “${workflow.name}”. Modify instructions or destinations and click “Save changes”.`);
    const builder = document.getElementById("workflow-builder");
    if (builder) builder.scrollIntoView({ behavior: "smooth" });
  }

  function cancelEditing() {
    setEditingWorkflowId(null);
    setName("");
    setDescription("");
    setPrompt("");
    setUrl("");
    setActiveExample("");
    setMessage("");
    setError("");
  }

  async function saveWorkflow(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !prompt.trim()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (editingWorkflowId) {
        const response = await fetch(`${API}/workflows/${editingWorkflowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            system_prompt: prompt.trim(),
            action_type: "email",
            action_url: url.trim() || null,
            execution_mode: approval ? "manual" : "automatic",
          }),
        });
        const data = await readApiResponse<Workflow>(response, "update this workflow");
        setMessage(`Workflow “${data.name}” updated successfully.`);
        setEditingWorkflowId(null);
        setName("");
        setDescription("");
        setPrompt("");
        setUrl("");
        await loadWorkflows();
      } else {
        const response = await fetch(`${API}/workflows`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            system_prompt: prompt.trim(),
            action_type: "email",
            action_url: url.trim() || null,
            execution_mode: approval ? "manual" : "automatic",
            require_approval: approval,
          }),
        });
        const data = await readApiResponse<Workflow>(response, "create this workflow");
        setName("");
        setDescription("");
        setPrompt("");
        setUrl("");
        setActiveExample("");
        setMessage(`${data.name} is ready with an active Inbound Webhook.`);
        await loadWorkflows();
        if (data.id) {
          setExpandedWebhookId(data.id);
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Could not ${editingWorkflowId ? "update" : "create"} this workflow.`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteWorkflow(workflow: Workflow) {
    if (!window.confirm(`Delete “${workflow.name}” and its execution history?`)) return;
    try {
      const response = await fetch(`${API}/workflows/${workflow.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete this workflow.");
      setMessage(`${workflow.name} was deleted.`);
      if (expandedWebhookId === workflow.id) setExpandedWebhookId(null);
      await loadWorkflows();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete this workflow.");
    }
  }

  async function updateWorkflowMode(workflow: Workflow) {
    const currentMode = workflow.execution_mode || (workflow.require_approval ? "manual" : "automatic");
    const nextMode = currentMode === "manual" ? "automatic" : "manual";
    setModeSavingId(workflow.id);
    setError("");
    try {
      const response = await fetch(`${API}/workflows/${workflow.id}/execution-mode`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ execution_mode: nextMode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not update this workflow mode.");
      setWorkflows((items) => items.map((item) => item.id === workflow.id ? { ...item, execution_mode: data.execution_mode, require_approval: data.require_approval } : item));
      setMessage(`${workflow.name} will now run in ${nextMode === "manual" ? "manual review" : "automatic"} mode for every incoming event.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update this workflow mode.");
    } finally {
      setModeSavingId(null);
    }
  }

  async function copyToClipboard(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // fallback
    }
  }

  async function toggleWebhookActive(workflow: Workflow) {
    try {
      const res = await fetch(`${API}/workflows/${workflow.id}/webhook/toggle`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to toggle webhook status.");
      const data = await res.json();
      setWorkflows((prev) =>
        prev.map((w) => (w.id === workflow.id ? { ...w, webhook_enabled: data.webhook_enabled } : w))
      );
      setMessage(`Inbound webhook for ${workflow.name} is now ${data.webhook_enabled ? "Active" : "Paused"}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update webhook status.");
    }
  }

  async function regenerateSecret(workflow: Workflow) {
    if (
      !window.confirm(
        `Regenerate webhook credentials for “${workflow.name}”?\n\nAny external mail forwarder using the previous URL or secret will stop working until updated.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`${API}/workflows/${workflow.id}/webhook/regenerate`, { method: "POST" });
      if (!res.ok) throw new Error("Could not regenerate webhook credentials.");
      const data = await res.json();
      setWorkflows((prev) =>
        prev.map((w) =>
          w.id === workflow.id
            ? { ...w, webhook_token: data.webhook_token, webhook_secret: data.webhook_secret }
            : w
        )
      );
      setMessage(`New webhook credentials generated for ${workflow.name}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not regenerate credentials.");
    }
  }

  async function runSimulation(workflow: Workflow) {
    setSimulatingWorkflowId(workflow.id);
    setError("");
    setMessage("");
    try {
      const customerEmail = (testEmail[workflow.id] || "customer@example.com").trim();
      const subject = (testSubject[workflow.id] || `Inquiry regarding ${workflow.name}`).trim();
      const bodyText = (testBody[workflow.id] || `Hello, I am writing to ask about my recent order and eligibility under the ${workflow.name} policy.`).trim();

      const res = await fetch(`${API}/workflows/${workflow.id}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_email: customerEmail,
          subject: subject,
          event_text: bodyText,
        }),
      });
      const data = await readApiResponse<ExecutionTraceResult>(res, "run interactive execution trace");
      setTraceResults((prev) => ({ ...prev, [workflow.id]: data }));
      setMessage(`Interactive execution trace completed in ${data.total_latency_ms}ms.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to run execution trace.");
    } finally {
      setSimulatingWorkflowId(null);
    }
  }

  return (
    <DashboardLayout
      active="workflows"
      title="Workflows & Execution Trace"
      subtitle="Create automated AI email responders, connect inbound webhooks, and run dry-run trace simulations."
      actions={
        <a href="#workflow-builder" className="button-primary" style={{ padding: "7px 14px", fontSize: "12px" }}>
          <span>+</span> Create a workflow
        </a>
      }
    >

        {(error || message) && (
          <div
            className={error ? "inline-error workflow-notice" : "workflow-success workflow-notice"}
            role={error ? "alert" : "status"}
          >
            {error || message}
            <button
              onClick={() => {
                setError("");
                setMessage("");
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        <section className="workflow-created card" aria-labelledby="saved-workflows-title">
          <div className="workflow-saved-heading">
            <div className="workflow-panel-heading">
              <p className="eyebrow">YOUR WORKSPACE</p>
              <h2 id="saved-workflows-title">Your email workflows & triggers</h2>
              <p>Each workflow has a dedicated inbound webhook URL for email ingestion. Test them in the interactive sandbox below.</p>
            </div>
            <span className="workflow-total">
              {workflows.length} {workflows.length === 1 ? "workflow" : "workflows"}
            </span>
          </div>

          {workflows.length === 0 ? (
            <div className="workflow-created-empty">
              <span>✉</span>
              <strong>Your email workflows will appear here.</strong>
              <small>Start with an example or create one from scratch to get an inbound webhook link.</small>
            </div>
          ) : (
            <div className="workflow-created-list">
              {workflows.map((workflow) => {
                const isExpanded = expandedWebhookId === workflow.id;
                const isSecretRevealed = revealedSecrets[workflow.id] || false;
                const fullWebhookUrl = workflow.webhook_token
                  ? `${origin || "http://localhost:3000"}/api/webhooks/${workflow.webhook_token}`
                  : "";
                const isEnabled = workflow.webhook_enabled !== false;
                const trace = traceResults[workflow.id];

                return (
                  <div key={workflow.id} style={{ display: "grid", gap: 0 }}>
                    <div className="workflow-created-item">
                      <span className="workflow-created-icon">✉</span>
                      <span className="workflow-created-copy">
                        <strong>{workflow.name}</strong>
                        <small>{workflow.description || "Email customer operations workflow"}</small>
                      </span>
                      <div className="workflow-created-actions">
                        <span className="workflow-row-meta">{workflow.execution_count || 0} runs</span>
                        <span className={`workflow-approval-tag ${(workflow.execution_mode || (workflow.require_approval ? "manual" : "automatic")) === "manual" ? "required" : "automatic"}`}>
                          {(workflow.execution_mode || (workflow.require_approval ? "manual" : "automatic")) === "manual" ? "Manual review" : "Automatic"}
                        </span>
                        <button className="workflow-mode-switch" disabled={modeSavingId === workflow.id} onClick={() => void updateWorkflowMode(workflow)}>
                          {modeSavingId === workflow.id ? "Saving…" : `Switch to ${(workflow.execution_mode || (workflow.require_approval ? "manual" : "automatic")) === "manual" ? "automatic" : "manual"}`}
                        </button>
                        <button
                          className={`workflow-webhook-btn ${isExpanded ? "active" : ""}`}
                          onClick={() => setExpandedWebhookId(isExpanded ? null : workflow.id)}
                          title="View inbound email webhook details and sandbox trace"
                        >
                          {isExpanded ? "Hide Sandbox & Webhook" : "Trace Sandbox & Webhook"}
                        </button>
                        <button
                          className="workflow-edit-btn"
                          onClick={() => startEditingWorkflow(workflow)}
                          title={`Edit ${workflow.name} settings and instructions`}
                        >
                          Edit
                        </button>
                        <button
                          className="workflow-delete"
                          onClick={() => void deleteWorkflow(workflow)}
                          aria-label={`Delete ${workflow.name}`}
                          title="Delete workflow"
                        >
                          ×
                        </button>
                      </div>
                    </div>

                    {/* Inbound Webhook Drawer & Feature 2 Sandbox */}
                    {isExpanded && (
                      <div className="workflow-webhook-panel">
                        <div className="webhook-panel-header">
                          <h3>
                            Inbound Email Ingestion Webhook
                            <span className={`webhook-status-badge ${isEnabled ? "active" : "inactive"}`}>
                              {isEnabled ? "Live & Listening" : "Paused"}
                            </span>
                          </h3>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              className="webhook-toggle-btn"
                              onClick={() => void toggleWebhookActive(workflow)}
                            >
                              {isEnabled ? "Pause Inbound Emails" : "Resume Webhook"}
                            </button>
                            <button
                              className="webhook-toggle-btn"
                              onClick={() => void regenerateSecret(workflow)}
                              title="Generate a new private token and secret"
                            >
                              ↻ Regenerate Keys
                            </button>
                          </div>
                        </div>

                        {/* Webhook URL & Secret Fields */}
                        <div className="webhook-fields-grid">
                          <div className="webhook-field-card">
                            <label>Inbound Webhook URL (SendGrid / Postmark / Resend endpoint)</label>
                            <div className="webhook-field-row">
                              <input
                                className="webhook-field-input"
                                readOnly
                                suppressHydrationWarning
                                value={fullWebhookUrl || "Generating endpoint…"}
                              />
                              <button
                                className={`webhook-copy-btn ${copiedKey === `url-${workflow.id}` ? "copied" : ""}`}
                                onClick={() => void copyToClipboard(fullWebhookUrl, `url-${workflow.id}`)}
                              >
                                {copiedKey === `url-${workflow.id}` ? "Copied! ✓" : "Copy URL"}
                              </button>
                            </div>
                          </div>

                          <div className="webhook-field-card">
                            <label>HMAC Signing Secret Key</label>
                            <div className="webhook-field-row">
                              <input
                                className="webhook-field-input"
                                readOnly
                                type={isSecretRevealed ? "text" : "password"}
                                value={workflow.webhook_secret || "••••••••••••••••"}
                              />
                              <button
                                className="webhook-reveal-btn"
                                onClick={() =>
                                  setRevealedSecrets((prev) => ({
                                    ...prev,
                                    [workflow.id]: !isSecretRevealed,
                                  }))
                                }
                              >
                                {isSecretRevealed ? "Hide" : "Show"}
                              </button>
                              <button
                                className={`webhook-copy-btn ${copiedKey === `sec-${workflow.id}` ? "copied" : ""}`}
                                onClick={() =>
                                  workflow.webhook_secret &&
                                  void copyToClipboard(workflow.webhook_secret, `sec-${workflow.id}`)
                                }
                              >
                                {copiedKey === `sec-${workflow.id}` ? "Copied! ✓" : "Copy Secret"}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* FEATURE 2: Interactive Execution Trace & Webhook Sandbox */}
                        <div className="trace-sandbox-container">
                          <div className="trace-sandbox-header">
                            <div className="trace-sandbox-title">
                              <h4>Interactive Execution Trace & Webhook Sandbox</h4>
                              <p>Simulate customer email inquiries through the 4-stage pipeline with real-time latency telemetry, vector similarity scores, and zero external side effects.</p>
                            </div>
                            <button
                              type="button"
                              className="trace-run-btn"
                              disabled={simulatingWorkflowId === workflow.id}
                              onClick={() => void runSimulation(workflow)}
                            >
                              {simulatingWorkflowId === workflow.id ? "Tracing Pipeline…" : "▶ Run Interactive Trace"}
                            </button>
                          </div>

                          <div className="trace-input-grid">
                            <div className="trace-field">
                              <label>Customer Sender Email</label>
                              <input
                                type="email"
                                placeholder="customer@example.com"
                                value={testEmail[workflow.id] ?? "customer@example.com"}
                                onChange={(e) => setTestEmail((prev) => ({ ...prev, [workflow.id]: e.target.value }))}
                              />
                            </div>
                            <div className="trace-field">
                              <label>Email Subject</label>
                              <input
                                type="text"
                                placeholder={`Inquiry regarding ${workflow.name}`}
                                value={testSubject[workflow.id] ?? `Inquiry regarding ${workflow.name}`}
                                onChange={(e) => setTestSubject((prev) => ({ ...prev, [workflow.id]: e.target.value }))}
                              />
                            </div>
                          </div>

                          <div className="trace-field">
                            <label>Inbound Email Body / Request Text</label>
                            <textarea
                              rows={3}
                              placeholder="Type sample customer email text to test policy retrieval and decision logic…"
                              value={testBody[workflow.id] ?? "Hello, I purchased an item 12 days ago and would like to request a refund. The item is unopened. Could you assist me?"}
                              onChange={(e) => setTestBody((prev) => ({ ...prev, [workflow.id]: e.target.value }))}
                            />
                          </div>

                          {/* 4-Stage Trace Pipeline Visualization */}
                          {trace && (
                            <div className="trace-pipeline">
                              <div className="trace-pipeline-summary">
                                <div>
                                  <strong>Execution Trace Result:</strong>{" "}
                                  <span style={{ textTransform: "capitalize", color: "#fbbf24", fontWeight: 600 }}>{trace.mode} mode</span>
                                </div>
                                <div className="trace-summary-metrics">
                                  <span>Total Pipeline Latency:</span>
                                  <span className="trace-latency-pill">{trace.total_latency_ms} ms</span>
                                </div>
                              </div>

                              {/* Stage 1: Intake & Validation */}
                              {trace.stages[0] && (
                                <div className="trace-stage-card">
                                  <div className="trace-stage-header">
                                    <div className="trace-stage-title">
                                      <span className="trace-stage-step-num">1</span>
                                      <span>Email Intake & Validation</span>
                                    </div>
                                    <span className="trace-stage-latency">{trace.stages[0].latency_ms} ms</span>
                                  </div>
                                  <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "6px" }}>
                                    <div><strong>Sender:</strong> {trace.stages[0].sender}</div>
                                    <div><strong>Subject:</strong> {trace.stages[0].subject}</div>
                                    <div><strong>Payload:</strong> {trace.stages[0].payload_bytes} bytes</div>
                                    <div><strong>Status:</strong> <span style={{ color: "#34d399", fontWeight: 600 }}>{trace.stages[0].status}</span></div>
                                  </div>
                                </div>
                              )}

                              {/* Stage 2: Knowledge Retrieval */}
                              {trace.stages[1] && (
                                <div className="trace-stage-card">
                                  <div className="trace-stage-header">
                                    <div className="trace-stage-title">
                                      <span className="trace-stage-step-num">2</span>
                                      <span>Policy Knowledge Retrieval (Hybrid Vector + Keyword)</span>
                                    </div>
                                    <span className="trace-stage-latency">{trace.stages[1].latency_ms} ms</span>
                                  </div>
                                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "6px" }}>
                                    {trace.stages[1].retrieved_count ? `${trace.stages[1].retrieved_count} relevant policy passage(s) matched customer intent:` : "No direct policy passages matched. Evaluated with base workflow instructions."}
                                  </div>
                                  {trace.stages[1].chunks && trace.stages[1].chunks.length > 0 && (
                                    <div className="trace-chunk-list">
                                      {trace.stages[1].chunks.map((chunk) => (
                                        <div key={chunk.id} className="trace-chunk-item">
                                          <div className="trace-chunk-meta">
                                            <strong>📄 {chunk.filename} (section #{chunk.id})</strong>
                                            <span className="trace-score-pill">Relevance: {chunk.similarity_score}</span>
                                          </div>
                                          <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.5 }}>{chunk.excerpt}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Stage 3: AI Reasoning & Evaluation */}
                              {trace.stages[2] && (
                                <div className="trace-stage-card">
                                  <div className="trace-stage-header">
                                    <div className="trace-stage-title">
                                      <span className="trace-stage-step-num">3</span>
                                      <span>AI Evaluation & Confidence Scoring</span>
                                    </div>
                                    <span className="trace-stage-latency">{trace.stages[2].latency_ms} ms</span>
                                  </div>
                                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px", flexWrap: "wrap" }}>
                                    <span className={`compact-status-badge ${trace.stages[2].decision === "REJECT" ? "rejected" : "approved"}`} style={{ padding: "3px 9px", borderRadius: "4px", fontSize: "11px", fontWeight: 700 }}>
                                      DECISION: {trace.stages[2].decision || "REPLY"}
                                    </span>
                                    <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 600 }}>
                                      Confidence: {Math.round((trace.stages[2].confidence || 1) * 100)}%
                                    </span>
                                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                      Provider: <strong style={{ color: "var(--text-primary)" }}>{trace.stages[2].provider?.toUpperCase() || "GEMINI"}</strong>
                                    </span>
                                    <span style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "auto" }}>
                                      ~{trace.stages[2].prompt_tokens_est || 0} in / ~{trace.stages[2].completion_tokens_est || 0} out tokens
                                    </span>
                                  </div>
                                  <div style={{ background: "rgba(99, 102, 241, 0.08)", padding: "12px 14px", borderRadius: "8px", border: "1px solid rgba(99, 102, 241, 0.2)", fontSize: "12px", color: "var(--text-primary)", lineHeight: 1.6 }}>
                                    <strong style={{ color: "#a5b4fc" }}>AI Reasoning:</strong> {trace.stages[2].reasoning}
                                  </div>
                                </div>
                              )}

                              {/* Stage 4: Outbound Email Dispatch Preview */}
                              {trace.stages[3] && trace.stages[3].payload && (
                                <div className="trace-stage-card">
                                  <div className="trace-stage-header">
                                    <div className="trace-stage-title">
                                      <span className="trace-stage-step-num">4</span>
                                      <span>Outbound Email Dispatch Preview (Safe Dry-Run)</span>
                                    </div>
                                    <span className="trace-stage-latency">{trace.stages[3].latency_ms} ms</span>
                                  </div>
                                  <div className="trace-email-box">
                                    <div className="trace-email-meta">
                                      <div><strong>To:</strong> {trace.stages[3].payload.to}</div>
                                      <div><strong>Subject:</strong> {trace.stages[3].payload.subject}</div>
                                      <div><strong>Destination URL:</strong> {trace.stages[3].payload.dispatch_url}</div>
                                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                        <strong>Headers:</strong> {Object.entries(trace.stages[3].payload.headers).map(([k, v]) => `${k}=${v}`).join(" | ")}
                                      </div>
                                    </div>
                                    <div className="trace-email-body">
                                      {trace.stages[3].payload.body}
                                    </div>
                                  </div>
                                  <div style={{ marginTop: "10px", fontSize: "11px", color: "#fbbf24", display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span>ⓘ</span> Verified dry-run simulation: External outbound dispatch was bypassed. Zero external network side effects.
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Workflow Creator & Example Templates (Placed below active workflows) ── */}
        <section className="workflow-workspace-grid" id="workflow-builder" style={{ marginTop: "32px" }}>
          <aside className="workflow-examples card">
            <div className="workflow-panel-heading">
              <p className="eyebrow">START WITH AN EXAMPLE</p>
              <h2>Common workflows</h2>
              <p>Choose an email-first starting point. You can tailor every detail before saving.</p>
            </div>
            <div className="workflow-example-list">
              {examples.map((example) => (
                <button
                  key={example.name}
                  className={`workflow-example ${activeExample === example.name ? "selected" : ""}`}
                  onClick={() => selectExample(example)}
                >
                  <span className="workflow-example-icon">{example.icon}</span>
                  <span>
                    <strong>{example.name}</strong>
                    <small>{example.description}</small>
                  </span>
                  <span className="workflow-example-arrow">↗</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="workflow-builder card">
            <div className="workflow-panel-heading">
              <p className="eyebrow">{editingWorkflowId ? "EDITING WORKFLOW" : "WORKFLOW CREATOR"}</p>
              <h2>{editingWorkflowId ? `Edit “${name}”` : "Build an email workflow"}</h2>
              <p>{editingWorkflowId ? "Update instructions, mode, or dispatch destinations without losing execution history." : "Give it clear instructions and configure your outbound email dispatch."}</p>
            </div>
            <form className="workflow-form" onSubmit={(event) => void saveWorkflow(event)}>
              <label>
                Workflow name
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Refund request review"
                />
              </label>
              <label>
                Short description
                <input
                  maxLength={255}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What customer queries should this email workflow handle?"
                />
              </label>
              <label>
                Decision instructions
                <textarea
                  required
                  rows={5}
                  maxLength={10000}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Describe how to evaluate an incoming customer email against your policy documents…"
                />
              </label>
              <div className="workflow-form-row">
                <label>
                  Next action
                  <select value={action} onChange={(event) => setAction(event.target.value as typeof action)}>
                    <option value="email">Email Auto-Reply (via your outbound email service or webhook)</option>
                  </select>
                </label>
                <label>
                  Outbound Email Dispatch URL <span>(optional; webhook or API endpoint called to send email)</span>
                  <input
                    type="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://api.yourdomain.com/send-email or email webhook relay"
                  />
                </label>
              </div>
              <fieldset className="workflow-mode-selector">
                <legend>Execution mode <small>Applies to every customer email received by this workflow.</small></legend>
                <div>
                  <button type="button" className={approval ? "selected" : ""} aria-pressed={approval} onClick={() => setApproval(true)}>
                    <strong>Manual review</strong><small>Pause every result in the review queue. A human approves or edits the drafted email response.</small>
                  </button>
                  <button type="button" className={!approval ? "selected" : ""} aria-pressed={!approval} onClick={() => setApproval(false)}>
                    <strong>Automatic</strong><small>Auto-evaluate and dispatch email replies when confident, with no human bottleneck.</small>
                  </button>
                </div>
              </fieldset>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  className="button-primary workflow-save"
                  type="submit"
                  disabled={busy || !name.trim() || !prompt.trim()}
                >
                  {busy ? "Saving…" : editingWorkflowId ? "Save changes" : "Create workflow"}
                  <span>↗</span>
                </button>
                {editingWorkflowId && (
                  <button
                    type="button"
                    className="workflow-cancel-btn"
                    onClick={cancelEditing}
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </form>
          </section>
        </section>
    </DashboardLayout>
  );
}
