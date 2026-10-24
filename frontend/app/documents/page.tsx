"use client";

import { useCallback, useEffect, useState } from "react";
import { Nav } from "../components";

type UploadResult = { filename: string; message: string; chunks_count: number };
type KnowledgeDocument = { id: string; filename: string; content_type: string; size_bytes: number | null; chunk_count: number; created_at: string | null };

export default function DocumentsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoadingDocuments(true);
    try {
      const response = await fetch("/api/backend/documents?limit=100");
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not load your documents.");
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
    setBusy(true);
    setError("");
    setResult(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/backend/ingest/file", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "The document could not be uploaded.");
      setResult(data as UploadResult);
      setFile(null);
      await loadDocuments();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The document could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  async function removeDocument(document: KnowledgeDocument) {
    if (document.id === "legacy" || !window.confirm(`Remove “${document.filename}” and its indexed content?`)) return;
    setRemovingId(document.id);
    setError("");
    try {
      const response = await fetch(`/api/backend/documents/${encodeURIComponent(document.id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "The document could not be removed.");
      await loadDocuments();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The document could not be removed.");
    } finally {
      setRemovingId(null);
    }
  }

  return <div className="product-shell"><Nav active="documents" /><main className="page-container">
    <div className="page-heading"><p className="eyebrow">YOUR TEAM’S KNOWLEDGE</p><h1>Documents</h1><p>Upload a policy, playbook, or guide to make it available to your AI assistant and workflows.</p></div>
    <section className="card document-upload-card">
      <label className="document-dropzone">
        <input type="file" accept=".pdf,.txt,.md,.csv,.json" onChange={(event) => { setFile(event.target.files?.[0] || null); setError(""); setResult(null); }} />
        <span className="document-upload-icon" aria-hidden="true">↑</span>
        <strong>{file ? file.name : "Choose a document to upload"}</strong>
        <span>{file ? `${(file.size / 1024).toFixed(1)} KB · Choose another file` : "PDF, TXT, Markdown, CSV, or JSON"}</span>
      </label>
      <div className="document-upload-actions"><p>Text is extracted securely and indexed for answers and workflow context.</p><button className="button-primary" disabled={!file || busy} onClick={() => void upload()}>{busy ? "Uploading…" : "Upload document"}</button></div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {result && <p className="upload-success" role="status">✓ {result.message}</p>}
    </section>
    <section className="document-library" aria-labelledby="document-library-heading">
      <div className="document-library-heading"><div><p className="eyebrow">KNOWLEDGE LIBRARY</p><h2 id="document-library-heading">Uploaded documents</h2><p>Documents are private to this account and used for grounded answers and workflow decisions.</p></div><span>{documents.filter((item) => item.id !== "legacy").length} files</span></div>
      {loadingDocuments ? <div className="document-library-empty"><span className="spinner" /> Loading your documents…</div> : documents.length === 0 ? <div className="document-library-empty"><span>▤</span><strong>No documents yet</strong><small>Upload your first policy or playbook to give the assistant trusted context.</small></div> : <div className="document-library-list">{documents.map((document) => <article className="document-library-row" key={document.id}><span className="document-library-icon">▤</span><div className="document-library-info"><strong>{document.filename}</strong><small>{document.chunk_count} searchable sections{document.size_bytes ? ` · ${(document.size_bytes / 1024).toFixed(0)} KB` : ""}{document.created_at ? ` · Added ${new Date(document.created_at).toLocaleDateString()}` : ""}</small></div>{document.id !== "legacy" && <button className="document-remove" disabled={removingId === document.id} onClick={() => void removeDocument(document)} aria-label={`Remove ${document.filename}`}>{removingId === document.id ? "Removing…" : "Remove"}</button>}</article>)}</div>}
    </section>
  </main><footer className="product-footer"><span>Loopdesk · Your team’s knowledge</span></footer></div>;
}
