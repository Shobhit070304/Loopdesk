"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Nav, useAuth } from "../components";

type SourceRef = { filename: string; chunk_id?: number };
type Message = { role: "user" | "assistant"; content: string; source?: string; sources?: SourceRef[] };
type Conversation = { id: string; title: string; messages: Message[]; updatedAt: number };
const HISTORY_LIMIT = 40;

function isConversation(value: unknown): value is Conversation {
  if (!value || typeof value !== "object") return false;
  const conversation = value as Partial<Conversation>;
  return typeof conversation.id === "string" && typeof conversation.title === "string" &&
    Array.isArray(conversation.messages) && conversation.messages.every((message) =>
      !!message && (message.role === "user" || message.role === "assistant") && typeof message.content === "string"
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
  const input = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const accountConversations = historyFor === user?.sub ? conversations : [];
  const activeConversation = accountConversations.find((conversation) => conversation.id === activeId);
  const messages = activeConversation?.messages || [];

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
        messages: conversation.messages.slice(-200).map((message) => ({ ...message, content: message.content.slice(0, 20_000) })),
      }));
      window.localStorage.setItem(`loopdesk:ask-history:${user.sub}`, JSON.stringify(compact));
    } catch {
      setError("This browser could not save chat history. You can still continue this conversation.");
    }
  }, [conversations, historyFor, historyReady, user?.sub]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  function startNewChat() {
    setActiveId(null);
    setPrompt("");
    setError("");
    input.current?.focus();
  }

  async function sendMessage(value = prompt) {
    const query = value.trim();
    if (!query || busy) return;
    const conversationId = activeId || `${Date.now()}`;
    setActiveId(conversationId);
    setPrompt("");
    setError("");
    setConversations((current) => {
      const existing = current.find((conversation) => conversation.id === conversationId);
      if (!existing) return [{ id: conversationId, title: query.slice(0, 48), messages: [{ role: "user" as const, content: query }], updatedAt: Date.now() }, ...current].slice(0, HISTORY_LIMIT);
      return current.map((conversation) => conversation.id === conversationId
        ? { ...conversation, updatedAt: Date.now(), messages: [...conversation.messages, { role: "user", content: query }] }
        : conversation);
    });
    setBusy(true);
    try {
      const response = await fetch("/api/backend/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "The assistant could not answer right now.");
      setConversations((current) => current.map((conversation) => conversation.id === conversationId
        ? { ...conversation, updatedAt: Date.now(), messages: [...conversation.messages, { role: "assistant", content: data.answer, source: data.source, sources: data.sources }] }
        : conversation));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The assistant could not answer right now.");
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  function composer(centered: boolean) {
    return <form className={`chat-composer ${centered ? "centered" : ""}`} onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
      <textarea ref={input} rows={1} value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Message Loopdesk" aria-label="Message Loopdesk" disabled={busy} />
      <button type="submit" aria-label="Send message" disabled={busy || !prompt.trim()}>{busy ? <span className="spinner" /> : "↑"}</button>
      <small>Loopdesk can make mistakes. Check important information.</small>
    </form>;
  }

  return <div className="product-shell"><Nav active="ask" /><div className="assistant-layout">
    <aside className="assistant-sidebar" aria-label="Chat history">
      <button className="assistant-new-chat" onClick={startNewChat}><span>＋</span> New chat</button>
      <p className="assistant-sidebar-label">Recent</p>
      <div className="assistant-chat-list">{accountConversations.map((conversation) => <button key={conversation.id} className={`assistant-chat-link ${conversation.id === activeId ? "selected" : ""}`} onClick={() => { setActiveId(conversation.id); setPrompt(""); setError(""); }} title={conversation.title}>{conversation.title}</button>)}</div>
      <div className="assistant-sidebar-footer"><span className="assistant-sidebar-mark">✳</span><span><b>Loopdesk assistant</b><small>Grounded in your team’s context</small></span></div>
    </aside>

    <main className={`assistant-main ${messages.length === 0 ? "is-empty" : "has-messages"}`}>
      {messages.length === 0 ? <div className="ask-empty-state"><div><p className="eyebrow">YOUR CUSTOMER WORKSPACE</p><h1>How can I help?</h1><p>Ask a question and get a thoughtful answer from your team’s knowledge.</p></div>{composer(true)}</div> : <>
        <header className="assistant-chat-heading"><span>Loopdesk assistant</span><button onClick={startNewChat}>＋ New chat</button></header>
        <section className="chat-thread" aria-live="polite">
          {messages.map((message, index) => <article className={`chat-message ${message.role}`} key={`${activeId}-${index}`}>
            <div className="chat-message-label">{message.role === "user" ? "You" : <><span className="assistant-message-mark">✳</span> Loopdesk</>}</div>
            {message.role === "assistant" ? <MarkdownContent markdown={message.content} /> : <p>{message.content}</p>}
            {message.role === "assistant" && message.source && <small className="chat-source">{message.source === "documents_retrieved" ? "Based on your documents" : message.source === "cache" ? "Quick answer" : "Assistant response"}</small>}
            {message.role === "assistant" && message.sources?.length ? <div className="chat-source-list" aria-label="Sources">{message.sources.map((source, sourceIndex) => <span key={`${source.filename}-${sourceIndex}`}>Source {sourceIndex + 1}: {source.filename}</span>)}</div> : null}
          </article>)}
          {busy && <article className="chat-message assistant"><div className="chat-message-label"><span className="assistant-message-mark">✳</span> Loopdesk</div><p className="thinking-indicator"><span className="spinner" /> Thinking…</p></article>}
          {error && <p className="inline-error" role="alert">{error}</p>}
          <div ref={bottom} />
        </section>
        {composer(false)}
      </>}
    </main>
  </div></div>;
}

function MarkdownContent({ markdown }: { markdown: string }) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    const fence = line.match(/^\s*(```+|~~~+)([^ ]*)?.*$/);
    if (fence) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !new RegExp(`^\\s*${fence[1][0]}{${fence[1].length},}\\s*$`).test(lines[index])) codeLines.push(lines[index++]);
      if (index < lines.length) index += 1;
      blocks.push(<pre className="markdown-code" key={`code-${index}`}><code data-language={fence[2] || undefined}>{codeLines.join("\n")}</code></pre>);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(<MarkdownHeading key={`heading-${index}`} level={level}>{renderInline(heading[2])}</MarkdownHeading>);
      index += 1;
      continue;
    }

    if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) { blocks.push(<hr key={`rule-${index}`} />); index += 1; continue; }

    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) quote.push(lines[index++].replace(/^\s*>\s?/, ""));
      blocks.push(<blockquote key={`quote-${index}`}>{quote.map((text, row) => <p key={row}>{renderInline(text)}</p>)}</blockquote>);
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
      blocks.push(ordered ? <ol key={`list-${index}`}>{listItems}</ol> : <ul key={`list-${index}`}>{listItems}</ul>);
      continue;
    }

    if (line.includes("|") && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])) {
      const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      const headers = cells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|")) rows.push(cells(lines[index++]));
      blocks.push(<div className="markdown-table-wrap" key={`table-${index}`}><table><thead><tr>{headers.map((cell, cellIndex) => <th key={cellIndex}>{renderInline(cell)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, cellIndex) => <td key={cellIndex}>{renderInline(row[cellIndex] || "")}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,6})\s|^\s*>|^\s*([-*+]\s+|\d+[.)]\s+)|^\s*(```+|~~~+)/.test(lines[index])) paragraph.push(lines[index++]);
    blocks.push(<p key={`paragraph-${index}`}>{paragraph.map((text, row) => <span key={row}>{row > 0 && <br />}{renderInline(text)}</span>)}</p>);
  }
  return <div className="markdown-content">{blocks}</div>;
}

function MarkdownHeading({ level, children }: { level: number; children: ReactNode }) {
  switch (level) {
    case 1: return <h1>{children}</h1>;
    case 2: return <h2>{children}</h2>;
    case 3: return <h3>{children}</h3>;
    case 4: return <h4>{children}</h4>;
    case 5: return <h5>{children}</h5>;
    default: return <h6>{children}</h6>;
  }
}

function renderInline(text: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  return text.split(pattern).filter(Boolean).map((part, index) => {
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("~~") && part.endsWith("~~")) return <del key={index}>{part.slice(2, -2)}</del>;
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = link[2].trim();
      const safe = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(href);
      return safe ? <a key={index} href={href} target={/^https?:\/\//i.test(href) ? "_blank" : undefined} rel="noreferrer">{link[1]}</a> : link[1];
    }
    return part;
  });
}
