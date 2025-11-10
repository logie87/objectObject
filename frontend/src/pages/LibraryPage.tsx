import { useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet, apiGetBlobUrl, apiPostForm, apiPut } from "../lib/api";

const LIGHT = {
  buttonGradientStart: "#3DAFBC",
  buttonGradientEnd: "#35598f",
  deleteButton: "#ff6a59",
  cardBg: "#ffffff",
  cardShadow: "0 6px 18px rgba(0,0,0,0.08)",
  mutedText: "#6b7280",
  mainText: "#111827",
  avatarBg: "#f2f3f6",
  tagBg: "#f3f4f6",
  border: "#e5e7eb",
  noticeBg: "#f8fafc",
  pageBg: "#ffffff",
};
const DARK = {
  buttonGradientStart: "#3DAFBC",
  buttonGradientEnd: "#35598f",
  deleteButton: "#ff8b7f",
  cardBg: "#0f172a",
  cardShadow: "0 8px 20px rgba(0,0,0,0.35)",
  mutedText: "#9aa3b2",
  mainText: "#e5e7eb",
  avatarBg: "#111827",
  tagBg: "#0b1222",
  border: "#1f2937",
  noticeBg: "#0b1222",
  pageBg: "#0b1020",
};

type Theme = "light" | "dark";
function readRootTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const root = document.documentElement;
  const attr = root.getAttribute("data-theme");
  if (attr === "dark" || root.classList.contains("dark")) return "dark";
  return "light";
}

function usePalette() {
  const [theme, setTheme] = useState<Theme>(readRootTheme());
  useEffect(() => {
    const root = document.documentElement;
    const mo = new MutationObserver(() => setTheme(readRootTheme()));
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme", "class"] });
    const onStorage = (e: StorageEvent) => {
      if (e.key === "theme") setTheme(readRootTheme());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      mo.disconnect();
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return theme === "dark" ? DARK : LIGHT;
}

const Icons = {
  Document: () => (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
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

type ParsedQuery = {
  terms: string[];
  tags: string[];
  file?: string;
  title?: string;
  source?: string;
  sha?: string;
  after?: Date;
  before?: Date;
  sizeGt?: number;
  sizeLt?: number;
  isUntagged?: boolean;
};

function parseSize(v: string): number | null {
  const m = v.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = m[2] || "b";
  if (unit === "gb") return n * 1024 * 1024 * 1024;
  if (unit === "mb") return n * 1024 * 1024;
  if (unit === "kb") return n * 1024;
  return n;
}

function parseDate(v: string): Date | null {
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function parseQuery(q: string): ParsedQuery {
  const out: ParsedQuery = { terms: [], tags: [] };
  const parts = q
    .trim()
    .match(/("[^"]+"|\S+)/g)
    ?.map((p) => p.replace(/^"(.+)"$/, "$1")) || [];
  for (const raw of parts) {
    const p = raw.trim();
    const [k, ...rest] = p.split(":");
    const val = rest.join(":");
    if (rest.length) {
      const v = val.trim();
      if (k === "tag" && v) out.tags.push(v.toLowerCase());
      else if (k === "file" && v) out.file = v.toLowerCase();
      else if (k === "title" && v) out.title = v.toLowerCase();
      else if (k === "source" && v) out.source = v.toLowerCase();
      else if (k === "sha" && v) out.sha = v.toLowerCase();
      else if (k === "after") {
        const d = parseDate(v);
        if (d) out.after = d;
      } else if (k === "before") {
        const d = parseDate(v);
        if (d) out.before = d;
      } else if (k === "size>") {
        const n = parseSize(v);
        if (n != null) out.sizeGt = n;
      } else if (k === "size<") {
        const n = parseSize(v);
        if (n != null) out.sizeLt = n;
      } else {
        out.terms.push(p.toLowerCase());
      }
    } else if (p === "is:untagged") {
      out.isUntagged = true;
    } else {
      out.terms.push(p.toLowerCase());
    }
  }
  return out;
}

function includes(hay: string | null | undefined, needle: string) {
  return (hay || "").toLowerCase().includes(needle);
}

function matchDoc(d: DocMeta, pq: ParsedQuery) {
  if (pq.tags.length && !pq.tags.every((t) => (d.tags || []).some((x) => x.toLowerCase().includes(t)))) return false;
  if (pq.isUntagged && (d.tags && d.tags.length)) return false;
  if (pq.file && !includes(d.filename, pq.file)) return false;
  if (pq.title && !includes(d.title, pq.title)) return false;
  if (pq.source && !includes(d.source || "", pq.source)) return false;
  if (pq.sha && !includes(d.sha256, pq.sha)) return false;
  if (pq.after && new Date(d.uploaded_at) < pq.after) return false;
  if (pq.before && new Date(d.uploaded_at) > pq.before) return false;
  if (pq.sizeGt != null && d.size <= pq.sizeGt) return false;
  if (pq.sizeLt != null && d.size >= pq.sizeLt) return false;
  if (pq.terms.length) {
    const hay =
      `${d.title} ${d.filename} ${(d.tags || []).join(" ")} ${d.source || ""} ${d.sha256}`.toLowerCase();
    for (const term of pq.terms) {
      if (!hay.includes(term)) return false;
    }
  }
  return true;
}

function highlight(text: string, needles: string[], color: string) {
  if (!needles.length) return text;
  const uniq = Array.from(new Set(needles.filter(Boolean))).sort((a, b) => b.length - a.length);
  if (!uniq.length) return text;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(`(${uniq.map(esc).join("|")})`, "ig");
  const parts = text.split(rx);
  return parts.map((part, i) =>
    uniq.some((n) => part.toLowerCase() === n.toLowerCase()) ? (
      <mark key={i} style={{ background: "transparent", color, fontWeight: 700 }}>{part}</mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function LibraryPage() {
  const C = usePalette();

  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const totalSize = useMemo(() => docs.reduce((s, d) => s + (d.size || 0), 0), [docs]);

  const parsed = useMemo(() => parseQuery(search), [search]);

  const filteredDocs = useMemo(() => {
    if (!search.trim()) return docs;
    return docs.filter((d) => matchDoc(d, parsed));
  }, [docs, search, parsed]);

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
    refresh().catch((err) => tell(`Load failed: ${String(err)}`));
  }, []);

  async function onUpload(files: FileList) {
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("title", f.name.replace(/\.(pdf)$/i, ""));
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

  const neutralBtnBg = readRootTheme() === "dark" ? "#1f2937" : "#e5e7eb";
  const neutralBtnFg = readRootTheme() === "dark" ? C.mainText : "#374151";

  const highlightTerms = useMemo(() => {
    const t = [...parsed.terms];
    if (parsed.title) t.push(parsed.title);
    if (parsed.file) t.push(parsed.file);
    if (parsed.source) t.push(parsed.source);
    if (parsed.sha) t.push(parsed.sha);
    t.push(...parsed.tags);
    return t.filter(Boolean);
  }, [parsed]);

  return (
    <div style={{ padding: 24, color: C.mainText, minHeight: "100vh" }}>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 4, color: C.mainText }}>Library</h1>
          <div style={{ color: C.mutedText }}>
            Ingested curriculum & guidance documents • {filteredDocs.length}/{docs.length} files • {(totalSize / 1024 / 1024).toFixed(1)} MB
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
              border: `1px solid ${C.border}`,
              fontWeight: 600,
              fontSize: 16,
              cursor: "pointer",
              color: "#fff",
              background: `linear-gradient(135deg, ${C.buttonGradientStart}, ${C.buttonGradientEnd})`,
              boxShadow: C.cardShadow,
            }}
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Working…" : "Upload PDFs"}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='Filter by title'
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: C.cardBg,
            color: C.mainText,
            fontSize: 15,
            boxShadow: C.cardShadow,
          }}
        />
      </div>

      {notice && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: C.noticeBg,
            color: C.mainText,
          }}
        >
          {notice}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
          gap: 24,
        }}
      >
        {filteredDocs.map((d) => (
          <div
            key={d.id}
            style={{
              padding: 24,
              borderRadius: 16,
              backgroundColor: C.cardBg,
              boxShadow: C.cardShadow,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              border: `1px solid ${C.border}`,
              color: C.mainText,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  backgroundColor: C.avatarBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: C.mainText,
                }}
              >
                <Icons.Document />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 18,
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                  }}
                  title={d.title}
                >
                  {highlight(d.title, highlightTerms, C.buttonGradientEnd)}
                </div>
                <div style={{ color: C.mutedText, fontSize: 13, marginTop: 4 }}>
                  {(d.size / 1024 / 1024).toFixed(2)} MB • {new Date(d.uploaded_at).toLocaleString()}
                </div>
                {d.tags?.length ? (
                  <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {d.tags.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: 12,
                          padding: "3px 8px",
                          borderRadius: 999,
                          background: C.tagBg,
                          color: C.mainText,
                          border: `1px solid ${C.border}`,
                        }}
                      >
                        {highlight(t, highlightTerms, C.buttonGradientEnd)}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div style={{ color: C.mutedText, fontSize: 12, marginTop: 6, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                  {highlight(d.filename, highlightTerms, C.buttonGradientEnd)}
                </div>
                {d.source ? (
                  <div style={{ color: C.mutedText, fontSize: 12, marginTop: 2, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                    {highlight(d.source, highlightTerms, C.buttonGradientEnd)}
                  </div>
                ) : null}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 12,
                  border: "none",
                  background: neutralBtnBg,
                  color: neutralBtnFg,
                  fontWeight: 650,
                  cursor: "pointer",
                }}
                onClick={() => viewDoc(d.id)}
              >
                View
              </button>
              <button
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 12,
                  border: "none",
                  background: `linear-gradient(135deg, ${C.buttonGradientStart}, ${C.buttonGradientEnd})`,
                  color: "white",
                  fontWeight: 650,
                  cursor: "pointer",
                }}
                onClick={() => renameDoc(d.id, d.title)}
              >
                Rename
              </button>
              <button
                style={{
                  padding: "10px 16px",
                  borderRadius: 12,
                  border: `2px solid ${C.deleteButton}`,
                  cursor: "pointer",
                  fontWeight: 650,
                  background: "transparent",
                  color: C.deleteButton,
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

      {!filteredDocs.length && !busy && (
        <div style={{ marginTop: 24, color: C.mutedText }}>
          No results.
        </div>
      )}
    </div>
  );
}
