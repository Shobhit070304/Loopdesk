"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DashboardLayout, useAuth } from "../components";

type SourceRef = { filename: string; chunk_id?: number };
type Message = { role: "user" | "assistant"; content: string; source?: string; sources?: SourceRef[] };
type Conversation = { id: string; title: string; messages: Message[]; updatedAt: number };
const HISTORY_LIMIT = 40;

const SUGGESTED_PROMPTS = [
  "What is our standard return and refund window?",
  "How are shipping damages and claims handled?",
  "Explain policy exceptions for custom orders",
];

function isConversation(value: unknown): value is Conversation {
  if (!value || typeof value !== "object") return false;
  const conversation = value as Partial<Conversation>;
  return (
    typeof conversation.id === "string" &&
    typeof conversation.title === "string" &&
    Array.isArray(conversation.messages) &&
    conversation.messages.every(
      (message) =>
        !!message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string"
    )
  );
}

export default function AskPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const historyOwner = useRef<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  function copyAnswer(text: string, idx: number) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  }

  const accountConversations = historyFor === user?.sub ? conversations : [];
  const activeConversation = accountConversations.find((conversation) => conversation.id === activeId);
  const messages = useMemo(() => activeConversation?.messages || [], [activeConversation]);

  useEffect(() => {
    if (!user?.sub) return;
    historyOwner.current = null;
    const key = `loopdesk:ask-history:${user.sub}`;
    try {
      const stored = window.localStorage.getItem(key);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      setConversations(Array.isArray(parsed) ? parsed.filter(isConversation).slice(0, HISTORY_LIMIT) : []);
    } catch {
      setConversations([]);
    } finally {
      setActiveId(null);
      historyOwner.current = user.sub;
      setHistoryFor(user.sub);
      setHistoryReady(true);
    }
  }, [user?.sub]);

  useEffect(() => {
    if (!historyReady || !user?.sub || historyFor !== user.sub || historyOwner.current !== user.sub) return;
    try {
      const compact = conversations.slice(0, HISTORY_LIMIT).map((conversation) => ({
        ...conversation,
        messages: conversation.messages.slice(-200).map((message) => ({
          ...message,
          content: message.content.slice(0, 20_000),
        })),
      }));
      window.localStorage.setItem(`loopdesk:ask-history:${user.sub}`, JSON.stringify(compact));
    } catch {
      setError("Browser storage is full. Conversation will remain active in current session.");
    }
  }, [conversations, historyFor, historyReady, user?.sub]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);

  function startNewChat() {
    setActiveId(null);
    setPrompt("");
    setError("");
    input.current?.focus();
  }

  function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setConversations((current) => current.filter((c) => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setPrompt("");
      setError("");
    }
  }

  function clearAllConversations() {
    if (!window.confirm("Clear all your saved conversation history on this device?")) return;
    setConversations([]);
    setActiveId(null);
    setPrompt("");
    setError("");
  }

  async function sendMessage(value = prompt) {
    const query = value.trim();
    if (!query || busy) return;
    if (query.length > 1000) {
      setError("Inquiries must be 1,000 characters or fewer.");
      return;
    }

    const now = Date.now();
    let conversationId = activeId;

    if (!conversationId) {
      conversationId = `conv-${now}-${Math.random().toString(36).slice(2, 8)}`;
      const title = query.slice(0, 48) + (query.length > 48 ? "…" : "");
      setConversations((current) => [{ id: conversationId!, title, messages: [{ role: "user", content: query }], updatedAt: now }, ...current]);
      setActiveId(conversationId);
    } else {
      setConversations((current) =>
        current.map((c) => (c.id === conversationId ? { ...c, updatedAt: now, messages: [...c.messages, { role: "user", content: query }] } : c))
      );
    }

    setPrompt("");
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/backend/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "The assistant could not retrieve policy answers right now.");
      }
      setConversations((current) =>
        current.map((c) =>
          c.id === conversationId
            ? { ...c, updatedAt: now, messages: [...c.messages, { role: "assistant", content: data.answer, source: data.source, sources: data.sources }] }
            : c
        )
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The assistant could not answer right now.");
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  return (
    <DashboardLayout
      active="ask"
      title="Policy Copilot"
      flush={true}
      actions={
        <button className="button-primary" onClick={startNewChat} style={{ padding: "7px 14px", fontSize: "12px" }}>
          <span>＋</span> New Chat
        </button>
      }
    >
      <div className="copilot-container">
        {/* ── Left Sidebar History ──────────────────────────────────── */}
        <aside className="copilot-sidebar">
          <button className="copilot-new-chat-btn" onClick={startNewChat}>
            <span>＋</span> New Conversation
          </button>

          <div className="copilot-history-header">
            <span>Recent Queries</span>
            {accountConversations.length > 0 && (
              <button type="button" onClick={clearAllConversations} className="copilot-clear-btn">
                Clear all
              </button>
            )}
          </div>

          <div className="copilot-history-list">
            {accountConversations.length === 0 ? (
              <div style={{ padding: "16px 10px", fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
                No saved chats yet
              </div>
            ) : (
              accountConversations.map((conv) => (
                <div key={conv.id} className={`copilot-history-item ${conv.id === activeId ? "active" : ""}`} onClick={() => setActiveId(conv.id)}>
                  <span className="copilot-item-title">{conv.title}</span>
                  <button
                    type="button"
                    className="copilot-item-delete"
                    onClick={(e) => deleteConversation(conv.id, e)}
                    title="Delete chat"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="copilot-sidebar-footer">
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
            <span>RAG Grounding: 768-dim pgvector</span>
          </div>
        </aside>

        {/* ── Main Chat Area ────────────────────────────────────────── */}
        <main className="copilot-main">
          {messages.length === 0 ? (
            <div className="copilot-empty-state">
              <div className="copilot-welcome-badge">
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#6366f1" }} />
                <span>POLICY COPILOT · ZERO HALLUCINATION</span>
              </div>
              <h2 className="copilot-welcome-title">How can I assist your operations?</h2>
              <p className="copilot-welcome-desc">
                Ask any question regarding your uploaded playbooks, customer terms, or warranty guidelines. Every answer is grounded directly in document passages.
              </p>

              {/* Suggested Prompt Chips */}
              <div className="copilot-prompt-chips">
                {SUGGESTED_PROMPTS.map((sample) => (
                  <button key={sample} type="button" className="copilot-chip" onClick={() => void sendMessage(sample)}>
                    <span>💬</span>
                    <span>{sample}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="copilot-chat-thread">
              {messages.map((message, index) => (
                <div key={`${activeId}-${index}`} className={`copilot-message-row ${message.role}`}>
                  <div className="copilot-avatar">{message.role === "user" ? "You" : "LD"}</div>
                  <div className="copilot-message-bubble">
                    <div className="copilot-message-sender">
                      {message.role === "user" ? "Operator" : "Loopdesk Copilot"}
                    </div>
                    {message.role === "assistant" ? (
                      <MarkdownContent markdown={message.content} />
                    ) : (
                      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{message.content}</p>
                    )}

                    {message.role === "assistant" && message.sources && message.sources.length > 0 && (
                      <div className="copilot-citations">
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                          Cited Sources:
                        </span>
                        <div className="copilot-citation-tags">
                          {message.sources.map((src, i) => (
                            <span key={i} className="copilot-citation-pill">
                              📄 {src.filename} {src.chunk_id ? `(#${src.chunk_id})` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {message.role === "assistant" && (
                      <div style={{ marginTop: "10px", display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          onClick={() => copyAnswer(message.content, index)}
                          style={{
                            fontSize: "11px",
                            background: "rgba(255, 255, 255, 0.04)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "6px",
                            padding: "3px 8px",
                            color: copiedIndex === index ? "var(--accent-emerald)" : "var(--text-secondary)",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            transition: "all 0.15s ease",
                          }}
                          title="Copy response to clipboard"
                        >
                          {copiedIndex === index ? "✓ Copied" : "📋 Copy answer"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {busy && (
                <div className="copilot-message-row assistant">
                  <div className="copilot-avatar">LD</div>
                  <div className="copilot-message-bubble" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ width: "14px", height: "14px", border: "2px solid rgba(99,102,241,0.2)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Searching knowledge passages & formulating answer…</span>
                  </div>
                </div>
              )}

              {error && <div className="inline-error">{error}</div>}
              <div ref={bottom} />
            </div>
          )}

          {/* ── Input Composer ────────────────────────────────────────── */}
          <div className="copilot-composer-container">
            <form
              className="copilot-composer-box"
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage();
              }}
            >
              <textarea
                ref={input}
                rows={1}
                maxLength={1000}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Ask about policy exceptions, refund rules, warranty clauses…"
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !prompt.trim()}
                className="copilot-send-button"
                title="Send inquiry (Enter)"
              >
                ↑
              </button>
            </form>
            <div className="copilot-footer-note">
              <span>🔒 100% Policy Grounded</span>
              <span>•</span>
              <span>Dual-Tier Redis & pgvector Acceleration</span>
            </div>
          </div>
        </main>
      </div>
    </DashboardLayout>
  );
}

function MarkdownContent({ markdown }: { markdown: string }) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index++]);
      }
      index += 1;
      blocks.push(
        <pre key={`code-${index}`} style={{ background: "#080910", padding: "12px 16px", borderRadius: "8px", overflowX: "auto", border: "1px solid var(--border-subtle)", fontSize: "12.5px" }}>
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    const listMatch = line.match(/^\s*([-*+]\s+|\d+[.)]\s+)/);
    if (listMatch) {
      const ordered = /^\d/.test(listMatch[1]);
      const listItems: ReactNode[] = [];
      while (index < lines.length) {
        const item = lines[index].match(/^\s*([-*+]\s+|\d+[.)]\s+)(.+)$/);
        if (!item || /^\d/.test(item[1]) !== ordered) break;
        listItems.push(<li key={`item-${index}`}>{renderInline(item[2])}</li>);
        index += 1;
      }
      blocks.push(ordered ? <ol key={`list-${index}`} style={{ paddingLeft: "20px", margin: "8px 0" }}>{listItems}</ol> : <ul key={`list-${index}`} style={{ paddingLeft: "20px", margin: "8px 0" }}>{listItems}</ul>);
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,6})\s|^\s*>|^\s*([-*+]\s+|\d+[.)]\s+)|^\s*(```+)/.test(lines[index])) {
      paragraph.push(lines[index++]);
    }
    blocks.push(
      <p key={`p-${index}`} style={{ margin: "0 0 10px", lineHeight: 1.65 }}>
        {paragraph.map((text, row) => (
          <span key={row}>{row > 0 && <br />}{renderInline(text)}</span>
        ))}
      </p>
    );
  }
  return <div>{blocks}</div>;
}

function renderInline(text: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g;
  return text.split(pattern).filter(Boolean).map((part, index) => {
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={index} style={{ color: "#ffffff" }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} style={{ background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: "4px", color: "#a5b4fc", fontSize: "0.9em" }}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}
