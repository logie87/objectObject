import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet, apiGetBlobUrl, apiPostForm, apiPut } from "../lib/api";

const COLORS = {
  buttonGradientStart: "#a78bfa",
  buttonGradientEnd: "#ec4899",
  cardBg: "#ffffff",
  cardShadow: "0 6px 18px rgba(0,0,0,0.08)",
  mutedText: "#6b7280",
  mainText: "#374151",
  avatarBg: "#ecfeff",
};

type DocMeta = {
  id: string;
  filename: string;
  title: string;
  size: number;
  sha256: string;
  uploaded_at: string;
  tags: string[];
  source?: string | null;
};

const Icons = {
  Document: () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={COLORS.mainText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
};

export default function LibraryPage() {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const totalSize = useMemo(
    () => docs.reduce((s, d) => s + (d.size || 0), 0),
    [docs]
  );

  function tell(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  }

  async function refresh() {
    setBusy(true);
    try {
      const list = await apiGet<DocMeta[]>("/library");
      setDocs(list);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh().catch(err => tell(`Load failed: ${String(err)}`));
  }, []);

  async function onUpload(files: FileList) {
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("title", f.name.replace(/\.(pdf)$/i, ""));
        // optional tags, comma-separated: fd.append("tags", "guideline,bc");
        await apiPostForm<DocMeta>("/library/upload", fd);
      }
      tell("Upload complete.");
      await refresh();
    } catch (e) {
      tell(`Upload error: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function viewDoc(id: string) {
    try {
      const url = await apiGetBlobUrl(`/library/${id}/file`);
      window.open(url, "_blank", "noopener,noreferrer");
      // Caller will revokeObjectURL automatically on tab close; no manual revoke needed here.
    } catch (e) {
      tell(`Open failed: ${String(e)}`);
    }
  }

  async function renameDoc(id: string, current: string) {
    const title = prompt("New title", current);
    if (!title || title === current) return;
    try {
      await apiPut<DocMeta>(`/library/${id}`, { title });
      tell("Title updated.");
      await refresh();
    } catch (e) {
      tell(`Rename failed: ${String(e)}`);
    }
  }

  async function deleteDoc(id: string) {
    if (!confirm("Delete this document from the library?")) return;
    try {
      await apiDelete(`/library/${id}`);
      tell("Deleted.");
      await refresh();
    } catch (e) {
      tell(`Delete failed: ${String(e)}`);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 32, marginBottom: 4 }}>Library</h1>
          <div style={{ color: COLORS.mutedText }}>
            Ingested curriculum & guidance documents • {docs.length} files • {(totalSize/1024/1024).toFixed(1)} MB
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files) onUpload(e.target.files);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
          <button
            style={{
              padding: "14px 20px",
              borderRadius: 12,
              border: "none",
              fontWeight: 600,
              fontSize: 16,
              cursor: "pointer",
              color: "white",
              background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
              boxShadow: "0 4px 12px rgba(168,85,247,0.3)",
            }}
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Working…" : "Upload PDFs"}
          </button>
        </div>
      </div>

      {notice && (
        <div style={{
          marginBottom: 16, padding: "10px 12px", borderRadius: 12,
          border: "1px solid #e5e7eb", background: "#f8fafc", color: COLORS.mainText
        }}>
          {notice}
        </div>
      )}

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 24 }}>
        {docs.map((d) => (
          <div key={d.id}
               style={{ padding: 24, borderRadius: 16, backgroundColor: COLORS.cardBg, boxShadow: COLORS.cardShadow, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Icon + name */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%", backgroundColor: COLORS.avatarBg,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>
                <Icons.Document />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 18, color: COLORS.mainText, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}
                     title={d.title}>
                  {d.title}
                </div>
                <div style={{ color: COLORS.mutedText, fontSize: 13, marginTop: 4 }}>
                  {(d.size/1024/1024).toFixed(2)} MB • {new Date(d.uploaded_at).toLocaleString()}
                </div>
                {d.tags?.length ? (
                  <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {d.tags.map(t => (
                      <span key={t} style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, background: "#f3f4f6", color: COLORS.mainText }}>
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }}
                onClick={() => viewDoc(d.id)}
              >
                View
              </button>
              <button
                style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }}
                onClick={() => renameDoc(d.id, d.title)}
              >
                Rename
              </button>
              <button
                style={{
                  padding: "10px 16px", borderRadius: 12, border: "none", cursor: "pointer",
                  background: "linear-gradient(135deg, #ef4444, #dc2626)", color: "#fff"
                }}
                onClick={() => deleteDoc(d.id)}
                title="Delete from library"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {!docs.length && !busy && (
        <div style={{ marginTop: 24, color: COLORS.mutedText }}>
          No documents yet. Click “Upload PDFs” to add files.
        </div>
      )}
    </div>
  );
}
