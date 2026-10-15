"use client";

import { useEffect, useState } from "react";
import { Nav, SectionLabel } from "../components";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface Workflow {
  id: number;
  name: string;
  description?: string | null;
  system_prompt: string;
  action_type: string;
  action_url?: string | null;
  created_at: string;
  execution_count?: number;
}

interface WorkflowDecision {
  decision: "APPROVE" | "REJECT" | "ESCALATE" | "REPLY" | string;
  confidence: number;
  reasoning: string;
  action_payload?: {
    message?: string;
    recipient?: string;
    [key: string]: unknown;
  };
}

interface TriggerResponse {
  status: string;
  workflow_id: number;
  decision: WorkflowDecision;
  referenced_docs_count: number;
}

interface ExecutionRecord {
  id: number;
  trigger_payload: { event_text?: string; [key: string]: unknown };
  decision_output: WorkflowDecision;
  status: string;
  executed_at: string;
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWf, setSelectedWf] = useState<Workflow | null>(null);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);

  // Creation Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState(
    "Verify if this customer request complies with our return and exchange policy. Cite policy conditions."
  );
  const [actionType, setActionType] = useState("webhook");
  const [actionUrl, setActionUrl] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Trigger / Simulation State
  const [eventText, setEventText] = useState(
    "Customer purchased noise-canceling headphones 8 days ago and has the original receipt. Requesting full refund."
  );
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [triggerResult, setTriggerResult] = useState<TriggerResponse | null>(null);

  // Feedback State
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  useEffect(() => {
    if (selectedWf) {
      fetchExecutions(selectedWf.id);
    } else {
      setExecutions([]);
    }
  }, [selectedWf]);

  async function fetchWorkflows() {
    try {
      const res = await fetch(`${API}/workflows`);
      if (!res.ok) throw new Error("Failed to load workflows");
      const data: Workflow[] = await res.json();
      setWorkflows(data);
      if (data.length > 0) {
        setSelectedWf((prev) => (prev ? data.find((w) => w.id === prev.id) || data[0] : data[0]));
      } else {
        setSelectedWf(null);
      }
    } catch (e: unknown) {
      console.error(e);
    }
  }

  async function fetchExecutions(workflowId: number) {
    try {
      const res = await fetch(`${API}/workflows/${workflowId}/executions`);
      if (res.ok) {
        const data: ExecutionRecord[] = await res.json();
        setExecutions(data);
      }
    } catch (e: unknown) {
      console.error(e);
    }
  }

  async function handleCreateWorkflow(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !prompt.trim()) return;

    setCreateLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`${API}/workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          system_prompt: prompt.trim(),
          action_type: actionType,
          action_url: actionUrl.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create workflow");

      setName("");
      setDescription("");
      setActionUrl("");
      setSuccessMsg(`Workflow "${data.name}" created successfully.`);
      await fetchWorkflows();
      setSelectedWf(data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Creation failed");
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleDeleteWorkflow(id: number) {
    if (!confirm("Delete this workflow and its execution history?")) return;
    try {
      const res = await fetch(`${API}/workflows/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await fetchWorkflows();
      setTriggerResult(null);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  async function handleRunTrigger() {
    if (!selectedWf || !eventText.trim() || triggerLoading) return;

    setTriggerLoading(true);
    setErrorMsg(null);
    setTriggerResult(null);

    try {
      const res = await fetch(`${API}/workflows/${selectedWf.id}/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_text: eventText.trim(),
          metadata: { timestamp: new Date().toISOString() },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Execution failed");

      setTriggerResult(data);
      fetchExecutions(selectedWf.id);
      fetchWorkflows(); // update execution counts
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setTriggerLoading(false);
    }
  }

  function handleCopyAction() {
    if (!triggerResult?.decision?.action_payload?.message) return;
    navigator.clipboard.writeText(triggerResult.decision.action_payload.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const inputCls =
    "w-full bg-[#0b0d14] border border-rim rounded-lg text-fg font-sans text-sm px-4 py-2.5 outline-none " +
    "transition-all focus:border-gold/60 focus:ring-1 focus:ring-gold/20 placeholder:text-subtle/50 leading-relaxed";

  const btnPrimary =
    "inline-flex items-center justify-center gap-2 font-sans text-xs tracking-[0.12em] uppercase " +
    "px-5 py-2.5 rounded-md bg-gold text-bg font-bold shadow-md shadow-gold/20 hover:bg-amber-400 " +
    "transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="relative z-[1] min-h-screen flex flex-col bg-bg text-fg font-sans">
      <Nav active="workflows" />

      <main className="max-w-[1140px] mx-auto px-8 w-full pt-10 flex-1 pb-20">
        {/* ── Page Header ────────────────────────────────────────── */}
        <div className="border-b border-rim pb-6 mb-8 flex justify-between items-end flex-wrap gap-4">
          <div>
            <p className="text-subtle text-xs tracking-[0.22em] uppercase mb-2">
              Action Engine · SaaS Automation
            </p>
            <h1 className="font-serif text-[2.25rem] text-fg">
              Knowledge-Grounded <em className="text-gold">Workflows</em>
            </h1>
            <p className="text-subtle text-sm mt-2 max-w-[620px] leading-relaxed">
              Evaluate incoming events against your enterprise documents in real time.
              Gemini determines policy compliance and automatically dispatches outbound actions.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex gap-6 border border-rim rounded-lg bg-surface px-5 py-3 text-xs tracking-[0.08em] uppercase">
            <div>
              <span className="text-subtle block">Workflows</span>
              <span className="text-gold font-serif text-base">{workflows.length}</span>
            </div>
            <div className="w-px bg-rim" />
            <div>
              <span className="text-subtle block">Total Executions</span>
              <span className="text-fg font-serif text-base">
                {workflows.reduce((acc, w) => acc + (w.execution_count || 0), 0)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Notification Banners ───────────────────────────────── */}
        {errorMsg && (
          <div className="mb-6 text-xs px-4 py-3 rounded-lg border-l-2 border-danger bg-danger/5 text-danger flex justify-between items-center">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-xs uppercase tracking-widest text-danger hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 text-xs px-4 py-3 rounded-lg border-l-2 border-gold bg-gold/5 text-fg flex justify-between items-center">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="text-xs uppercase tracking-widest text-gold hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* ── Two-Column Main Layout ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* LEFT: Builder & Workflow Directory */}
          <div className="flex flex-col gap-8">
            {/* 1. Workflow Builder Form */}
            <div className="border border-rim rounded-xl bg-surface/80 p-7 backdrop-blur-md shadow-lg">
              <SectionLabel>1. Define Automation Rule</SectionLabel>

              <form onSubmit={handleCreateWorkflow} className="space-y-4">
                <div>
                  <label className="block text-subtle text-xs tracking-[0.1em] uppercase mb-1">
                    Workflow Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Return Policy Auto-Triager"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-subtle text-xs tracking-[0.1em] uppercase mb-1">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Validates incoming customer return requests"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-subtle text-xs tracking-[0.1em] uppercase mb-1">
                    Decision Instructions (System Prompt) *
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Instruct Gemini how to judge the incoming event against your indexed policy documents..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-subtle text-xs tracking-[0.1em] uppercase mb-1">
                      Action Type
                    </label>
                    <select
                      value={actionType}
                      onChange={(e) => setActionType(e.target.value)}
                      className={`${inputCls} cursor-pointer`}
                    >
                      <option value="webhook">Webhook POST</option>
                      <option value="slack">Slack Alert</option>
                      <option value="email">Email Draft</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-subtle text-xs tracking-[0.1em] uppercase mb-1">
                      Destination Webhook URL (optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://your-crm.com/api/events"
                      value={actionUrl}
                      onChange={(e) => setActionUrl(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={createLoading || !name.trim()} className={btnPrimary}>
                    {createLoading ? <span className="spinner" /> : null}
                    {createLoading ? "Saving Workflow…" : "Save Automation Workflow →"}
                  </button>
                </div>
              </form>
            </div>

            {/* 2. Active Workflows Directory */}
            <div className="border border-rim rounded-xl bg-surface/80 p-7 backdrop-blur-md shadow-lg">
              <SectionLabel>Configured Workflows ({workflows.length})</SectionLabel>

              {workflows.length === 0 ? (
                <p className="text-subtle text-xs leading-relaxed">
                  No workflows created yet. Define your first workflow above to get started.
                </p>
              ) : (
                <div className="divide-y divide-rim">
                  {workflows.map((wf) => {
                    const isSelected = selectedWf?.id === wf.id;
                    return (
                      <div
                        key={wf.id}
                        onClick={() => setSelectedWf(wf)}
                        className={`py-3.5 px-3 -mx-3 rounded-lg flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? "bg-white/[0.04] border-l-2 border-gold pl-3"
                            : "hover:bg-white/[0.02]"
                        }`}
                      >
                        <div className="min-w-0 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="font-serif text-sm text-fg truncate">{wf.name}</span>
                            <span className="text-[10px] tracking-wider uppercase px-2 py-0.5 rounded border border-rim text-subtle bg-white/[0.02]">
                              {wf.action_type}
                            </span>
                          </div>
                          {wf.description && (
                            <p className="text-subtle text-xs truncate mt-1">{wf.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-subtle tracking-wider uppercase font-mono">
                            {wf.execution_count ?? 0} runs
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteWorkflow(wf.id);
                            }}
                            title="Delete Workflow"
                            className="text-subtle hover:text-danger text-xs px-2 py-1 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Live Trigger Simulator & Decision Inspection */}
          <div className="border border-rim rounded-xl bg-surface/80 p-7 backdrop-blur-md shadow-lg flex flex-col gap-6">
            <div>
              <SectionLabel>2. Simulate Incoming Event</SectionLabel>
              <p className="text-subtle text-xs mb-4">
                Test how your active workflow retrieves knowledge, reasons, and produces decisions.
              </p>

              {selectedWf ? (
                <div className="mb-4 text-xs border border-rim rounded-lg bg-[#0b0d14] p-3 flex justify-between items-center">
                  <div>
                    <span className="text-subtle uppercase tracking-widest mr-2">Target Workflow:</span>
                    <span className="text-gold font-serif">{selectedWf.name}</span>
                  </div>
                  <span className="text-subtle text-[11px] font-mono">ID #{selectedWf.id}</span>
                </div>
              ) : (
                <div className="mb-4 text-xs border border-danger/40 rounded-lg bg-danger/5 p-3 text-danger">
                  Select or create a workflow first to simulate triggers.
                </div>
              )}

              <div className="space-y-3">
                <label className="block text-subtle text-xs tracking-[0.1em] uppercase">
                  Incoming Event Text (Ticket / Message / Claim)
                </label>
                <textarea
                  rows={4}
                  value={eventText}
                  onChange={(e) => setEventText(e.target.value)}
                  placeholder="Paste the inbound message or claim to evaluate..."
                  className={inputCls}
                />

                <button
                  onClick={handleRunTrigger}
                  disabled={triggerLoading || !selectedWf || !eventText.trim()}
                  className={btnPrimary}
                >
                  {triggerLoading ? <span className="spinner" /> : null}
                  {triggerLoading ? "Evaluating via Gemini & RAG…" : "Trigger Automation →"}
                </button>
              </div>
            </div>

            {/* 3. Output Decision Card */}
            {triggerResult && (
              <div className="border border-rim rounded-xl bg-[#0b0d14]/80 p-6 space-y-4 shadow-inner">
                <div className="flex items-center justify-between border-b border-rim pb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-subtle text-xs tracking-widest uppercase">Decision:</span>
                    <DecisionBadge decision={triggerResult.decision.decision} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-subtle">
                    <span>
                      Confidence:{" "}
                      <strong className="text-fg font-normal font-mono">
                        {(triggerResult.decision.confidence * 100).toFixed(0)}%
                      </strong>
                    </span>
                    <span>·</span>
                    <span className="font-mono">{triggerResult.referenced_docs_count} docs retrieved</span>
                  </div>
                </div>

                {/* Reasoning */}
                <div>
                  <span className="text-subtle text-xs tracking-[0.1em] uppercase block mb-1">
                    AI Policy Reasoning
                  </span>
                  <p className="text-ink text-xs leading-[1.75] rounded-lg bg-surface border border-rim p-3.5">
                    {triggerResult.decision.reasoning}
                  </p>
                </div>

                {/* Generated Action Payload */}
                {triggerResult.decision.action_payload?.message && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-subtle text-xs tracking-[0.1em] uppercase">
                        Generated Action / Reply Payload
                      </span>
                      <button
                        onClick={handleCopyAction}
                        className="text-xs text-gold hover:underline tracking-wider uppercase cursor-pointer"
                      >
                        {copied ? "Copied ✓" : "Copy Payload"}
                      </button>
                    </div>
                    <p className="text-ink text-xs font-mono rounded-lg bg-[#06070a] border border-rim p-3 leading-relaxed whitespace-pre-wrap">
                      {triggerResult.decision.action_payload.message}
                    </p>
                  </div>
                )}

                {/* Outbound Webhook Status */}
                <div className="flex items-center justify-between text-xs text-subtle pt-2 border-t border-rim">
                  <span>Outbound Dispatch Status:</span>
                  <span
                    className={`uppercase tracking-wider px-2 py-0.5 rounded border text-[11px] ${
                      triggerResult.status === "executed"
                        ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                        : triggerResult.status === "action_dispatch_failed"
                        ? "border-danger/40 text-danger bg-danger/10"
                        : "border-rim text-subtle"
                    }`}
                  >
                    {triggerResult.status}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Historical Execution Audit Log ─────────────────────── */}
        <div className="mt-12 border border-rim rounded-xl bg-surface/80 p-7 backdrop-blur-md shadow-lg">
          <SectionLabel>
            Execution Audit Trail {selectedWf ? `— ${selectedWf.name}` : ""}
          </SectionLabel>

          {executions.length === 0 ? (
            <p className="text-subtle text-xs leading-relaxed">
              No executions logged yet for this workflow. Use the simulator above or send a POST request
              to <code className="text-gold">/workflows/&#123;id&#125;/trigger</code> to start logging.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-rim text-subtle uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3">Run ID</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Input Snippet</th>
                    <th className="py-2.5 px-3">Decision</th>
                    <th className="py-2.5 px-3">Reasoning</th>
                    <th className="py-2.5 px-3">Dispatch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rim text-ink">
                  {executions.map((ex) => (
                    <tr key={ex.id} className="hover:bg-white/[0.01]">
                      <td className="py-3 px-3 font-mono text-subtle">#{ex.id}</td>
                      <td className="py-3 px-3 text-subtle whitespace-nowrap font-mono text-[11px]">
                        {new Date(ex.executed_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-3 max-w-[200px] truncate" title={ex.trigger_payload?.event_text}>
                        {ex.trigger_payload?.event_text || "—"}
                      </td>
                      <td className="py-3 px-3">
                        <DecisionBadge decision={ex.decision_output?.decision || "UNKNOWN"} />
                      </td>
                      <td className="py-3 px-3 max-w-[280px] truncate" title={ex.decision_output?.reasoning}>
                        {ex.decision_output?.reasoning || "—"}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${
                            ex.status === "executed"
                              ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                              : "border-danger/40 text-danger bg-danger/10"
                          }`}
                        >
                          {ex.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-rim py-5 bg-surface/40">
        <div className="max-w-[1140px] mx-auto px-8 flex justify-between items-center text-xs text-subtle tracking-[0.06em]">
          <span>Enterprise RAG · Automation Engine</span>
          <span>FastAPI · PostgreSQL · Gemini 2.5 Flash</span>
        </div>
      </footer>
    </div>
  );
}

function DecisionBadge({ decision }: { decision: string }) {
  const normalized = decision?.toUpperCase() || "";

  if (normalized.includes("APPROVE")) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs tracking-wider uppercase border border-gold/40 text-gold px-2.5 py-0.5 rounded-full bg-gold/10 font-bold">
        <span className="w-1.5 h-1.5 rounded-full bg-gold" />
        {decision}
      </span>
    );
  }

  if (normalized.includes("REJECT")) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs tracking-wider uppercase border border-danger/40 text-danger px-2.5 py-0.5 rounded-full bg-danger/10 font-bold">
        <span className="w-1.5 h-1.5 rounded-full bg-danger" />
        {decision}
      </span>
    );
  }

  if (normalized.includes("ESCALATE")) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs tracking-wider uppercase border border-amber-500/40 text-amber-400 px-2.5 py-0.5 rounded-full bg-amber-500/10 font-bold">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        {decision}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs tracking-wider uppercase border border-rim text-subtle px-2.5 py-0.5 rounded-full bg-white/[0.02]">
      {decision}
    </span>
  );
}
