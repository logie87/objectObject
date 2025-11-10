import { useEffect, useMemo, useState } from "react";
import { apiGet, apiGetBlobUrl, apiPut } from "../lib/api";

const LIGHT = {
  buttonGradientStart: "#3DAFBC",
  buttonGradientEnd: "#3DAFBC",
  cardBg: "#ffffff",
  cardShadow: "0 6px 18px rgba(0,0,0,0.08)",
  mutedText: "#6b7280",
  mainText: "#111827",
  avatarBg: "#f2f3f6",
  tagBg: "#f3f4f6",
  border: "#e5e7eb",
  noticeBg: "#f8fafc",
  white: "#fff",
  pageBg: "#ffffff",
};

const DARK = {
  buttonGradientStart: "#3DAFBC",
  buttonGradientEnd: "#35598f",
  cardBg: "#0f172a",
  cardShadow: "0 8px 20px rgba(0,0,0,0.35)",
  mutedText: "#9aa3b2",
  mainText: "#e5e7eb",
  avatarBg: "#111827",
  tagBg: "#0b1222",
  border: "#1f2937",
  noticeBg: "#0b1222",
  white: "#0b1020",
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
  Report: () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  Filter: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12 10 19 14 21 14 12 22 3" />
    </svg>
  ),
  Sort: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 16h13M3 12h9M3 8h5" />
    </svg>
  ),
};

type ReportMeta = {
  id: string;
  filename: string;
  title: string;
  size: number;
  sha256: string;
  generated_at: string;
  category: string;
  tags: string[];
};

type CategoriesResp = { categories: string[] };

type ParsedQuery = {
  terms: string[];
  tags: string[];
  file?: string;
  title?: string;
  category?: string;
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
      else if (k === "category" && v) out.category = v.toLowerCase();
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

function matchReport(r: ReportMeta, pq: ParsedQuery) {
  if (pq.tags.length && !pq.tags.every((t) => (r.tags || []).some((x) => x.toLowerCase().includes(t)))) return false;
  if (pq.isUntagged && (r.tags && r.tags.length)) return false;
  if (pq.file && !includes(r.filename, pq.file)) return false;
  if (pq.title && !includes(r.title, pq.title)) return false;
  if (pq.category && !includes(r.category, pq.category)) return false;
  if (pq.sha && !includes(r.sha256, pq.sha)) return false;
  if (pq.after && new Date(r.generated_at) < pq.after) return false;
  if (pq.before && new Date(r.generated_at) > pq.before) return false;
  if (pq.sizeGt != null && r.size <= pq.sizeGt) return false;
  if (pq.sizeLt != null && r.size >= pq.sizeLt) return false;
  if (pq.terms.length) {
    const hay = `${r.title} ${r.filename} ${(r.tags || []).join(" ")} ${r.category} ${r.sha256}`.toLowerCase();
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

export default function ReportsPage() {
  const C = usePalette();

  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string>("");
  const [sort, setSort] = useState<"recent" | "title" | "size">("recent");
  const [search, setSearch] = useState<string>("");

  const totalSize = useMemo(() => reports.reduce((s, d) => s + (d.size || 0), 0), [reports]);

  function tell(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2200);
  }

  async function refresh() {
    setBusy(true);
    try {
      const q = new URLSearchParams();
      if (category) q.set("category", category);
      if (sort) q.set("sort", sort);
      const list = await apiGet<ReportMeta[]>(`/reports?${q.toString()}`);
      setReports(list);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const cats = await apiGet<CategoriesResp>(`/reports/categories`);
        setCategories(cats.categories || []);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const initQ = new URLSearchParams(window.location.search).get("q") || "";
    if (initQ) setSearch(initQ);
  }, []);

  useEffect(() => {
    refresh().catch((err) => tell(`Load failed: ${String(err)}`));
  }, [category, sort]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (search) url.searchParams.set("q", search);
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url.toString());
  }, [search]);

  async function viewReport(id: string) {
    try {
      const url = await apiGetBlobUrl(`/reports/${id}/file`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      tell(`Open failed: ${String(e)}`);
    }
  }

  async function renameReport(id: string, current: string) {
    const title = prompt("New title", current);
    if (!title || title === current) return;
    try {
      await apiPut<ReportMeta>(`/reports/${id}`, { title });
      tell("Title updated.");
      await refresh();
    } catch (e) {
      tell(`Rename failed: ${String(e)}`);
    }
  }

  const parsed = useMemo(() => parseQuery(search), [search]);

  const filteredReports = useMemo(() => {
    if (!search.trim()) return reports;
    return reports.filter((r) => matchReport(r, parsed));
  }, [reports, search, parsed]);

  const highlightTerms = useMemo(() => {
    const t = [...parsed.terms];
    if (parsed.title) t.push(parsed.title);
    if (parsed.file) t.push(parsed.file);
    if (parsed.category) t.push(parsed.category);
    if (parsed.sha) t.push(parsed.sha);
    t.push(...parsed.tags);
    return t.filter(Boolean);
  }, [parsed]);

  return (
    <div style={{ padding: 24, color: C.mainText, minHeight: "100vh" }}>
      <div
        style={{
          marginBottom: 16,
          display: "grid",
          gridTemplateColumns: "1fr auto auto",
          alignItems: "center",
          gap: 12,
          color: C.mainText,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 4 }}>Reports</h1>
          <div style={{ color: C.mutedText }}>
            Generated reports • {filteredReports.length}/{reports.length} files • {(totalSize / 1024 / 1024).toFixed(1)} MB
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.mainText }}>
          <Icons.Filter />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: C.cardBg,
              color: C.mainText,
              outline: "none",
            }}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.mainText }}>
          <Icons.Sort />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: C.cardBg,
              color: C.mainText,
              outline: "none",
            }}
          >
            <option value="recent">Most recent</option>
            <option value="title">Title (A–Z)</option>
            <option value="size">Largest first</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='Filter by student/worksheet name'
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
        {filteredReports.map((r) => (
          <div
            key={r.id}
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
                <Icons.Report />
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
                  title={r.title}
                >
                  {highlight(r.title, highlightTerms, C.buttonGradientEnd)}
                </div>
                <div style={{ color: C.mutedText, fontSize: 13, marginTop: 4 }}>
                  {(r.size / 1024 / 1024).toFixed(2)} MB • {new Date(r.generated_at).toLocaleString()}
                </div>
                <div style={{ color: C.mutedText, fontSize: 12, marginTop: 6 }}>
                  {highlight(r.category, highlightTerms, C.buttonGradientEnd)}
                </div>
                {r.tags?.length ? (
                  <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {r.tags.map((t) => (
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
                  {highlight(r.filename, highlightTerms, C.buttonGradientEnd)}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 12,
                  border: "none",
                  background: readRootTheme() === "dark" ? "#1f2937" : "#e5e7eb",
                  color: readRootTheme() === "dark" ? C.mainText : "#374151",
                  fontWeight: 650,
                  cursor: "pointer",
                }}
                onClick={() => viewReport(r.id)}
              >
                View
              </button>
              <button
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 12,
                  border: "none",
                  background: `linear-gradient(135deg, #3DAFBC, #35598f)`,
                  color: "white",
                  fontWeight: 650,
                  cursor: "pointer",
                }}
                onClick={() => renameReport(r.id, r.title)}
              >
                Rename
              </button>
            </div>
          </div>
        ))}
      </div>

      {!filteredReports.length && !busy && (
        <div style={{ marginTop: 24, color: C.mutedText }}>
          No reports found{category ? ` in “${category}”` : ""}.
        </div>
      )}
    </div>
  );
}
