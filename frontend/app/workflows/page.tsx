"use client";

import { useCallback, useEffect, useState } from "react";
import { Nav } from "../components";

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
  action: "webhook" | "slack" | "email";
  approval: boolean;
};

const examples: Template[] = [
  {
    icon: "↩",
    name: "Returns & refunds",
    description: "Triage refund requests against your policy.",
    prompt: "Evaluate the customer’s request against our return window and condition guidelines. Approve eligible refunds and explain the policy reason for ineligible requests.",
    action: "webhook",
    approval: true,
  },
  {
    icon: "◉",
    name: "Priority escalation",
    description: "Spot service issues that need a fast response.",
    prompt: "Identify production incidents and priority SLA breaches. Escalate critical service disruption with a concise incident summary; otherwise suggest a helpful first response.",
    action: "slack",
    approval: false,
  },
  {
    icon: "▤",
    name: "Contract review",
    description: "Flag contract terms that need a closer look.",
    prompt: "Review vendor contract terms against our approved liability and payment guidelines. Explain any clauses that require legal review.",
    action: "webhook",
    approval: true,
  },
];

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [action, setAction] = useState<"webhook" | "slack" | "email">("webhook");
  const [url, setUrl] = useState("");
  const [approval, setApproval] = useState(true);
  const [activeExample, setActiveExample] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Extension 4: Inbound Webhook State
  const [expandedWebhookId, setExpandedWebhookId] = useState<number | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<number, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [modeSavingId, setModeSavingId] = useState<number | null>(null);
  const [testingWorkflowId, setTestingWorkflowId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<Record<number, any>>({});
  const [customTestText, setCustomTestText] = useState<Record<number, string>>({});

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

  function useExample(example: Template) {
    setActiveExample(example.name);
    setName(example.name);
    setDescription(example.description);
    setPrompt(example.prompt);
    setAction(example.action);
    setApproval(example.approval);
    setUrl("");
  }

  async function createWorkflow(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !prompt.trim()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API}/workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          system_prompt: prompt.trim(),
          action_type: action,
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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create this workflow.");
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
        `Regenerate webhook credentials for “${workflow.name}”?\n\nAny external tool using the previous URL or secret will stop working until updated.`
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

  async function sendTestEvent(workflow: Workflow) {
    setTestingWorkflowId(workflow.id);
    setError("");
    setMessage("");
    try {
      const payloadText = customTestText[workflow.id]?.trim() || `Test inquiry for ${workflow.name}: customer inquired about order status and policy requirements.`;
      const res = await fetch(`${API}/workflows/${workflow.id}/webhook/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_text: payloadText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to trigger test event.");
      setTestResult((prev) => ({ ...prev, [workflow.id]: data }));
      setMessage(`Test event evaluated for ${workflow.name}! Result: ${data.decision?.decision || "Completed"}.`);
      await loadWorkflows();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to run test event.");
    } finally {
      setTestingWorkflowId(null);
    }
  }

  return (
    <div className="product-shell">
      <Nav active="workflows" />
      <main className="page-container workflow-page">
        <header className="page-heading workflow-page-heading">
          <div>
            <p className="eyebrow">CUSTOMER OPERATIONS</p>
            <h1>Workflows & Webhooks</h1>
            <p>Build automated AI decisions, connect inbound webhooks from any tool, and route actions on autopilot.</p>
          </div>
          <a href="#workflow-builder" className="button-primary">
            Create a workflow <span>↗</span>
          </a>
        </header>

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

        <section className="workflow-workspace-grid">
          <aside className="workflow-examples card">
            <div className="workflow-panel-heading">
              <p className="eyebrow">START WITH AN EXAMPLE</p>
              <h2>Common workflows</h2>
              <p>Choose a starting point. You can tailor every detail before saving.</p>
            </div>
            <div className="workflow-example-list">
              {examples.map((example) => (
                <button
                  key={example.name}
                  className={`workflow-example ${activeExample === example.name ? "selected" : ""}`}
                  onClick={() => useExample(example)}
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

          <section className="workflow-builder card" id="workflow-builder">
            <div className="workflow-panel-heading">
              <p className="eyebrow">WORKFLOW CREATOR</p>
              <h2>Build a workflow</h2>
              <p>Give it clear instructions and choose what happens after a decision.</p>
            </div>
            <form className="workflow-form" onSubmit={(event) => void createWorkflow(event)}>
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
                  placeholder="What should this workflow handle?"
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
                  placeholder="Describe how to evaluate an incoming request…"
                />
              </label>
              <div className="workflow-form-row">
                <label>
                  Next action
                  <select value={action} onChange={(event) => setAction(event.target.value as typeof action)}>
                    <option value="webhook">Generic webhook</option>
                    <option value="slack">Slack via your webhook receiver</option>
                    <option value="email">Email relay via your webhook receiver</option>
                  </select>
                </label>
                <label>
                  Outbound Action URL <span>(optional; required to send an external action)</span>
                  <input
                    type="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://your-api.com/dispatch"
                  />
                </label>
              </div>
              <fieldset className="workflow-mode-selector">
                <legend>Execution mode <small>Applies to every event received by this workflow.</small></legend>
                <div>
                  <button type="button" className={approval ? "selected" : ""} aria-pressed={approval} onClick={() => setApproval(true)}>
                    <strong>Manual review</strong><small>Pause every result in the review queue. A person decides whether to send the configured action.</small>
                  </button>
                  <button type="button" className={!approval ? "selected" : ""} aria-pressed={!approval} onClick={() => setApproval(false)}>
                    <strong>Automatic</strong><small>Run every event without per-query approval. External actions send only when a destination is configured.</small>
                  </button>
                </div>
              </fieldset>
              <button
                className="button-primary workflow-save"
                type="submit"
                disabled={busy || !name.trim() || !prompt.trim()}
              >
                {busy ? "Saving…" : "Create workflow"}
                <span>↗</span>
              </button>
            </form>
          </section>
        </section>

        <section className="workflow-created card" aria-labelledby="saved-workflows-title">
          <div className="workflow-saved-heading">
            <div className="workflow-panel-heading">
              <p className="eyebrow">YOUR WORKSPACE</p>
              <h2 id="saved-workflows-title">Your workflows & inbound triggers</h2>
            <p>Each workflow has a dedicated inbound webhook URL. Its manual or automatic mode applies to every event it receives.</p>
            </div>
            <span className="workflow-total">
              {workflows.length} {workflows.length === 1 ? "workflow" : "workflows"}
            </span>
          </div>

          {workflows.length === 0 ? (
            <div className="workflow-created-empty">
              <span>✳</span>
              <strong>Your workflows will appear here.</strong>
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

                return (
                  <div key={workflow.id} style={{ display: "grid", gap: 0 }}>
                    <div className="workflow-created-item">
                      <span className="workflow-created-icon">
                        {workflow.action_type === "email" ? "✉" : workflow.action_type === "slack" ? "◉" : "↗"}
                      </span>
                      <span className="workflow-created-copy">
                        <strong>{workflow.name}</strong>
                        <small>{workflow.description || "Customer operations workflow"}</small>
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
                          title="View inbound webhook details and signing secret"
                        >
                          <span>⚡</span> {isExpanded ? "Hide Webhook" : "Inbound Webhook"}
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

                    {/* Extension 4: Inbound Webhook Drawer */}
                    {isExpanded && (
                      <div className="workflow-webhook-panel">
                        <div className="webhook-panel-header">
                          <h3>
                            <span>⚡</span> Inbound Webhook Integration
                            <span className={`webhook-status-badge ${isEnabled ? "active" : "inactive"}`}>
                              {isEnabled ? "Live & Listening" : "Paused"}
                            </span>
                          </h3>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              className="webhook-toggle-btn"
                              onClick={() => void toggleWebhookActive(workflow)}
                            >
                              {isEnabled ? "Pause Inbound Events" : "Resume Webhook"}
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
                            <label>Inbound Webhook URL (Public Endpoint)</label>
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
                            <label>Signing Secret Key (HMAC / Header)</label>
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

                        {/* Test Event Section */}
                        <div style={{ marginTop: "16px", padding: "16px", borderRadius: "10px", background: "#fbf6ee", border: "1px solid #ebdccb" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <label style={{ fontWeight: 650, fontSize: "0.82rem", color: "#594939", textTransform: "uppercase", letterSpacing: "0.04em" }}>Simulate Inbound Test Event</label>
                            <button
                              type="button"
                              className="button-primary"
                              style={{ padding: "6px 14px", fontSize: "0.8rem", borderRadius: "99px", cursor: "pointer" }}
                              disabled={testingWorkflowId === workflow.id}
                              onClick={() => void sendTestEvent(workflow)}
                            >
                              {testingWorkflowId === workflow.id ? "Evaluating…" : "▶ Send Test Event"}
                            </button>
                          </div>
                          <input
                            type="text"
                            placeholder={`e.g. Customer message: "Can I get a refund on order #1234?"`}
                            value={customTestText[workflow.id] || ""}
                            onChange={(e) => setCustomTestText((prev) => ({ ...prev, [workflow.id]: e.target.value }))}
                            style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", background: "#fffdf9", border: "1px solid #ded3c3", color: "#30291f", fontSize: "0.85rem" }}
                          />
                          {testResult[workflow.id] && (
                            <div style={{ marginTop: "12px", padding: "12px 14px", borderRadius: "8px", background: "#fff", border: "1px solid #e2d5c3", fontSize: "0.84rem", boxShadow: "0 2px 8px rgba(84,60,30,.04)" }}>
                              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
                                <strong style={{ color: "#30291f" }}>Decision:</strong>
                                <span className={`compact-status-badge ${testResult[workflow.id].decision?.decision === "REJECT" ? "rejected" : "approved"}`} style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600 }}>
                                  {testResult[workflow.id].decision?.decision || "COMPLETED"}
                                </span>
                                <span style={{ color: "#746a5c", fontSize: "0.78rem" }}>
                                  ({Math.round((testResult[workflow.id].decision?.confidence || 1) * 100)}% confidence)
                                </span>
                              </div>
                              <p style={{ margin: "4px 0", color: "#4c4439", lineHeight: 1.6 }}>{testResult[workflow.id].decision?.reasoning}</p>
                              {testResult[workflow.id].requires_human_approval && (
                                <p style={{ margin: "6px 0 0", color: "#b46b24", fontSize: "0.78rem", fontWeight: 500 }}>
                                  ⓘ Execution paused in Review Queue for human approval.
                                </p>
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
      </main>
      <footer className="product-footer">
        <span>Loopdesk · Customer operations workflows & webhooks</span>
        <a href="/help#guide-03">Workflow guide ↗</a>
      </footer>
    </div>
  );
}
