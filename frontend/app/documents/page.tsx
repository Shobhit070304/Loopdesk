"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "../components";

type UploadResult = { filename: string; message: string; chunks_count: number };
type KnowledgeDocument = { id: string; filename: string; content_type: string; size_bytes: number | null; chunk_count: number; created_at: string | null };

function formatDetail(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((err) => (typeof err === "object" && err && "msg" in err ? String(err.msg) : JSON.stringify(err))).join("; ");
  }
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return fallback;
}

export default function DocumentsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewingDoc, setViewingDoc] = useState<KnowledgeDocument | null>(null);
  const [docChunks, setDocChunks] = useState<Array<{ id: number; content: string; created_at?: string }>>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nonLegacyDocs = documents.filter((item) => item.id !== "legacy");
  const isLimitReached = nonLegacyDocs.length >= 5;

  const totalChunks = useMemo(
    () => documents.reduce((acc, doc) => acc + (doc.chunk_count || 0), 0),
    [documents]
  );
  const totalBytes = useMemo(
    () => documents.reduce((acc, doc) => acc + (doc.size_bytes || 0), 0),
    [documents]
  );

  const filteredDocuments = documents.filter((doc) =>
    doc.filename.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  const loadDocuments = useCallback(async () => {
    setLoadingDocuments(true);
    try {
      const response = await fetch("/api/backend/documents?limit=100");
      const data = await response.json();
      if (!response.ok) throw new Error(formatDetail(data.detail, "Could not load your documents."));
      setDocuments(data.documents || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load your documents.");
    } finally {
      setLoadingDocuments(false);
    }
  }, []);

  useEffect(() => { void loadDocuments(); }, [loadDocuments]);

  async function upload() {
    if (!file || busy) return;
    if (isLimitReached) {
      setError("Portfolio limit reached: Maximum 5 documents allowed per account. Please delete an existing file first.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("Files must be 15 MB or smaller.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/backend/ingest/file", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(formatDetail(data.detail, "The document could not be uploaded."));
      setResult(data as UploadResult);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadDocuments();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The document could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  async function removeDocument(document: KnowledgeDocument) {
    if (!window.confirm(`Remove “${document.filename}” and its indexed content?`)) return;
    setRemovingId(document.id);
    setError("");
    try {
      const response = await fetch(`/api/backend/documents/${encodeURIComponent(document.id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(formatDetail(data.detail, "The document could not be removed."));
      if (viewingDoc?.id === document.id) setViewingDoc(null);
      await loadDocuments();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The document could not be removed.");
    } finally {
      setRemovingId(null);
    }
  }

  async function openPassages(doc: KnowledgeDocument) {
    setViewingDoc(doc);
    setLoadingChunks(true);
    setDocChunks([]);
    try {
      const response = await fetch(`/api/backend/documents/${encodeURIComponent(doc.id)}/chunks`);
      const data = await response.json();
      if (!response.ok) throw new Error(formatDetail(data.detail, "Could not fetch document passages."));
      setDocChunks(data.chunks || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not fetch passages.");
    } finally {
      setLoadingChunks(false);
    }
  }

  return (
    <DashboardLayout
      active="documents"
      title="Knowledge Base & Documents"
      subtitle="Upload customer policies, playbooks, and guidelines to vectorize into PostgreSQL pgvector (768-dim)."
    >
      {/* ── Knowledge Base Telemetry Metrics ── */}
      <section className="queue-stats-grid" style={{ marginBottom: "24px" }} aria-label="Knowledge Base statistics">
        <div className="queue-stat-card">
          <span className="queue-stat-label">Indexed Documents</span>
          <span className="queue-stat-value">{nonLegacyDocs.length} <small style={{ fontSize: "14px", color: "var(--text-muted)" }}>/ 5</small></span>
          <span className="queue-stat-sub">{isLimitReached ? "Portfolio capacity reached" : `${5 - nonLegacyDocs.length} upload slots remaining`}</span>
        </div>
        <div className="queue-stat-card">
          <span className="queue-stat-label">Vector Passages</span>
          <span className="queue-stat-value" style={{ color: "#38bdf8" }}>{totalChunks}</span>
          <span className="queue-stat-badge cyan">Searchable Embeddings</span>
        </div>
        <div className="queue-stat-card">
          <span className="queue-stat-label">Indexed Storage</span>
          <span className="queue-stat-value" style={{ color: "#34d399" }}>{(totalBytes / 1024).toFixed(1)} KB</span>
          <span className="queue-stat-badge emerald">Parsed & Sanitized</span>
        </div>
        <div className="queue-stat-card">
          <span className="queue-stat-label">Vector Model</span>
          <span className="queue-stat-value" style={{ fontSize: "18px", color: "#a5b4fc", fontFamily: "var(--font-mono)" }}>768-dim</span>
          <span className="queue-stat-sub">text-embedding-004 in pgvector</span>
        </div>
      </section>

      <section className="card document-upload-card" style={{ padding: "28px", marginBottom: "28px" }}>
      <label className="document-dropzone" style={{ opacity: isLimitReached ? 0.7 : 1 }}>
        <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.csv,.json" disabled={isLimitReached} onChange={(event) => { setFile(event.target.files?.[0] || null); setError(""); setResult(null); }} />
        <span className="document-upload-icon" aria-hidden="true">↑</span>
        <strong>{isLimitReached ? "Upload limit reached (5 of 5 files indexed)" : file ? file.name : "Choose a document to upload"}</strong>
        <span>{isLimitReached ? "Remove an existing document below to upload a new one" : file ? `${(file.size / 1024).toFixed(1)} KB · Choose another file` : "PDF, TXT, Markdown, CSV, or JSON (max 15 MB)"}</span>
      </label>
      <div className="document-upload-actions">
        <p>{isLimitReached ? "You have reached the 5-document portfolio demo cap. Delete an unused file to add another." : "Text is extracted securely and indexed for answers and workflow context."}</p>
        <button className="button-primary" disabled={!file || busy || isLimitReached} onClick={() => void upload()}>{busy ? "Uploading…" : isLimitReached ? "Limit reached (5/5)" : "Upload document"}</button>
      </div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {result && <p className="upload-success" role="status">✓ {result.message}</p>}
    </section>
    <section className="document-library" aria-labelledby="document-library-heading">
      <div className="document-library-heading">
        <div>
          <p className="eyebrow">KNOWLEDGE LIBRARY</p>
          <h2 id="document-library-heading">Uploaded documents</h2>
          <p>Documents are private to this account and used for grounded answers and workflow decisions.</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {documents.length > 0 && (
            <input
              type="search"
              placeholder="Filter documents…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: "7px 14px",
                borderRadius: "8px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-card)",
                color: "var(--text-primary)",
                fontSize: "12.5px",
                width: "200px",
              }}
            />
          )}
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>
            {nonLegacyDocs.length} / 5 files {isLimitReached && <span style={{ color: "var(--accent-rose)", marginLeft: "4px" }}>(Cap reached)</span>}
          </span>
        </div>
      </div>
      {loadingDocuments ? (
        <div className="document-library-empty"><span className="spinner" /> Loading your documents…</div>
      ) : documents.length === 0 ? (
        <div className="document-library-empty"><span>▤</span><strong>No documents yet</strong><small>Upload your first policy or playbook to give the assistant trusted context.</small></div>
      ) : filteredDocuments.length === 0 ? (
        <div className="document-library-empty"><span>⌕</span><strong>No matching documents</strong><small>No files match “{searchTerm}”. Clear filter to see all files.</small></div>
      ) : (
        <div className="document-library-list">
          {filteredDocuments.map((document) => (
            <article className="document-library-row" key={document.id}>
              <span className="document-library-icon">▤</span>
              <div className="document-library-info">
                <strong>{document.filename}</strong>
                <small>{document.chunk_count} searchable sections{document.size_bytes ? ` · ${(document.size_bytes / 1024).toFixed(0)} KB` : ""}{document.created_at ? ` · Added ${new Date(document.created_at).toLocaleDateString()}` : ""}</small>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  type="button"
                  className="button-secondary"
                  style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "8px" }}
                  onClick={() => void openPassages(document)}
                >
                  View Passages
                </button>
                <button className="document-remove" disabled={removingId === document.id} onClick={() => void removeDocument(document)} aria-label={`Remove ${document.filename}`}>
                  {removingId === document.id ? "Removing…" : "Remove"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>

    {/* ── Slide-over Passages Drawer ── */}
    {viewingDoc && (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.65)",
          backdropFilter: "blur(4px)",
          zIndex: 999,
          display: "flex",
          justifyContent: "flex-end",
        }}
        onClick={() => setViewingDoc(null)}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "560px",
            height: "100%",
            background: "var(--bg-card)",
            borderLeft: "1px solid var(--border-card)",
            display: "flex",
            flexDirection: "column",
            boxShadow: "-8px 0 32px rgba(0, 0, 0, 0.4)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-card)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p className="eyebrow" style={{ marginBottom: "4px" }}>INDEXED VECTOR CHUNKS</p>
              <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text-primary)" }}>{viewingDoc.filename}</h3>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                {viewingDoc.chunk_count} passages stored in PostgreSQL pgvector (768-dim)
              </p>
            </div>
            <button
              type="button"
              className="button-secondary"
              style={{ padding: "4px 10px", fontSize: "12px" }}
              onClick={() => setViewingDoc(null)}
            >
              ✕ Close
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {loadingChunks ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: "13px" }}>
                <span className="spinner" style={{ marginRight: "8px" }} /> Loading vector passages…
              </div>
            ) : docChunks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: "13px" }}>
                No passages indexed for this document.
              </div>
            ) : (
              docChunks.map((chunk, idx) => (
                <div
                  key={chunk.id}
                  style={{
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "10px",
                    padding: "16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>
                      PASSAGE #{idx + 1} · ID {chunk.id}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {chunk.content.length} chars
                    </span>
                  </div>
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontSize: "12.5px",
                      color: "var(--text-secondary)",
                      margin: 0,
                      lineHeight: "1.6",
                      fontFamily: "inherit",
                    }}
                  >
                    {chunk.content}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    )}
    </DashboardLayout>
  );
}
