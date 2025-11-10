import { useEffect, useMemo, useState } from "react";
import { apiGet, apiGetBlobUrl, apiPut } from "../lib/api";

/* light & dark palettes pulled from :root[data-theme] */
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

/* read current theme from :root */
type Theme = "light" | "dark";
function readRootTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const root = document.documentElement;
  const attr = root.getAttribute("data-theme");
  if (attr === "dark" || root.classList.contains("dark")) return "dark";
  return "light";
}

/* react to outside theme changes (your existing toggle updates :root) */
function usePalette() {
  const [theme, setTheme] = useState<Theme>(readRootTheme());
  useEffect(() => {
    const root = document.documentElement;
    const mo = new MutationObserver(() => setTheme(readRootTheme()));
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme", "class"] });
    // also reflect cross-tab storage changes if your switch writes to localStorage
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

/* icons inherit color from parent via currentColor */
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

export default function ReportsPage() {
  const C = usePalette();

  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string>("");
  const [sort, setSort] = useState<"recent" | "title" | "size">("recent");

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
    refresh().catch((err) => tell(`Load failed: ${String(err)}`));
  }, [category, sort]);

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
            Generated reports • {reports.length} files • {(totalSize / 1024 / 1024).toFixed(1)} MB
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
        {reports.map((r) => (
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
                  {r.title}
                </div>
                <div style={{ color: C.mutedText, fontSize: 13, marginTop: 4 }}>
                  {(r.size / 1024 / 1024).toFixed(2)} MB • {new Date(r.generated_at).toLocaleString()}
                </div>
                <div style={{ color: C.mutedText, fontSize: 12, marginTop: 6 }}>{r.category}</div>
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
                        {t}
                      </span>
                    ))}
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

      {!reports.length && !busy && (
        <div style={{ marginTop: 24, color: C.mutedText }}>
          No reports found{category ? ` in “${category}”` : ""}.
        </div>
      )}
    </div>
  );
}
