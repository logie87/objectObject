import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiGetBlobUrl } from "../lib/api";

const COLORS = {
  good: "#16a34a",
  warn: "#f59e0b",
  bad: "#ef4444",
  graySub: "#6b7280",
  border: "#e5e7eb",
  headerBg: "#f8fafc",
  divider: "#eef2f7",
  focusBg: "#fafafa",
  link: "#4f46e5",
  muted: "var(--muted)",
};

type FitStatus = "good" | "warn" | "bad";
type Resource = {
  name: string;
  filename: string;
  path: string;
  size: number;
  uploaded_at: string;
  fit: { mean: number; spread: number; status: FitStatus };
  issues?: string[];
};
type Curriculum = {
  courses: Record<string, Record<string, Resource[]>>;
};

const ISSUE_OPTIONS = ["Reading", "Modality", "Time", "Assessment", "Exec-Fx", "AT/Tech"];

function statusBadge({ mean, spread, status }: Resource["fit"]) {
  const symbol = status === "good" ? "▲" : status === "warn" ? "■" : "●";
  const color =
    status === "good" ? COLORS.good : status === "warn" ? COLORS.warn : COLORS.bad;
  return (
    <span
      title={`Mean ${mean}% • Spread ${spread}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, color }}
    >
      {symbol} {mean}%
    </span>
  );
}

export default function CurriculumPage() {
  const [data, setData] = useState<Curriculum | null>(null);
  const [activeCourse, setActiveCourse] = useState("");
  const [activeUnit, setActiveUnit] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const [issueFilter, setIssueFilter] = useState<string>("All Issues");
  const [minFit, setMinFit] = useState<number>(0);
  const [atRiskOnly, setAtRiskOnly] = useState<boolean>(false);

  const [focused, setFocused] = useState<Resource | null>(null);
  const [analysis, setAnalysis] = useState<{
    affected: string[];
    consensus: string[];
    evidence: string;
  } | null>(null);
  const [busyAnalyze, setBusyAnalyze] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await apiGet<Curriculum>("/curriculum");
        setData(d);
        const firstCourse = Object.keys(d.courses)[0];
        if (firstCourse) {
          setActiveCourse(firstCourse);
          const firstUnit = Object.keys(d.courses[firstCourse])[0];
          if (firstUnit) setActiveUnit(firstUnit);
        }
      } catch {}
    })();
  }, []);

  const courses = useMemo(() => Object.keys(data?.courses || {}), [data]);
  const units = useMemo(
    () => (activeCourse ? Object.keys(data?.courses[activeCourse] || {}) : []),
    [data, activeCourse]
  );

  const allResources: Resource[] =
    (data && activeCourse && activeUnit
      ? data.courses[activeCourse][activeUnit]
      : []) || [];

  const resources = useMemo(() => {
    let items = allResources;
    if (issueFilter !== "All Issues") {
      items = items.filter((r) => (r.issues || []).includes(issueFilter));
    }
    if (minFit > 0) {
      items = items.filter((r) => r.fit.mean >= minFit);
    }
    if (atRiskOnly) {
      items = items.filter((r) => r.fit.status !== "good");
    }
    return items;
  }, [allResources, issueFilter, minFit, atRiskOnly]);

  const handleReorder = async (newOrder: Resource[]) => {
    if (!data) return;
    const next: Curriculum = {
      ...data,
      courses: {
        ...data.courses,
        [activeCourse]: {
          ...data.courses[activeCourse],
          [activeUnit]: newOrder,
        },
      },
    };
    setData(next);
    try {
      await apiPost(`/curriculum/${encodeURIComponent(activeCourse)}/${encodeURIComponent(activeUnit)}/reorder`, {
        order: newOrder.map((r) => r.filename),
      });
    } catch {}
  };

  const onDragStart = (i: number) => setDragIdx(i);
  const onDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    const working = [...allResources];
    const [moved] = working.splice(dragIdx, 1);
    working.splice(i, 0, moved);
    setDragIdx(i);
    handleReorder(working);
  };

  const analyze = async (r: Resource) => {
    setBusyAnalyze(true);
    setFocused(r);
    setAnalysis(null);
    try {
      const res = await apiGet<{
        affected: string[];
        consensus: string[];
        evidence: string;
      }>(
        `/curriculum/${encodeURIComponent(activeCourse)}/${encodeURIComponent(
          activeUnit
        )}/analysis?resource=${encodeURIComponent(r.filename)}`
      );
      setAnalysis(res);
    } catch {
      setAnalysis({
        affected: [],
        consensus: ["(demo) No change needed."],
        evidence: "(demo) No evidence.",
      });
    } finally {
      setBusyAnalyze(false);
    }
  };

  async function openResource(r: Resource) {
    try {
      const url = await apiGetBlobUrl(`/curriculum/${r.path}`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {}
  }

  if (!data) return <div className="card">Loading curriculum…</div>;

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 4 }}>Curriculum</h1>
          <div style={{ color: COLORS.graySub }}>
            Units • Resources • Alignment Overview
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{
          display: "grid",
          gridTemplateColumns: "auto 220px 180px 1fr auto",
          gap: 12,
          alignItems: "center",
          padding: "10px 16px",
          marginBottom: 16,
        }}
      >
        <label style={{ fontWeight: 700 }}>Course</label>
        <select
          value={activeCourse}
          onChange={(e) => {
            const c = e.target.value;
            setActiveCourse(c);
            const first = Object.keys(data.courses[c] || {})[0];
            setActiveUnit(first || "");
            setFocused(null);
            setAnalysis(null);
          }}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          {courses.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>

        <select
          value={issueFilter}
          onChange={(e) => setIssueFilter(e.target.value)}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <option>All Issues</option>
          {ISSUE_OPTIONS.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ fontSize: 12, color: COLORS.muted }}>
            Min fit {minFit}%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={minFit}
            onChange={(e) => setMinFit(parseInt(e.target.value, 10))}
          />
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={atRiskOnly}
              onChange={(e) => setAtRiskOnly(e.target.checked)}
            />
            At-risk only
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "end", gap: 8 }}>
          <button
            className="btn ghost"
            onClick={() => {
              setIssueFilter("All Issues");
              setMinFit(0);
              setAtRiskOnly(false);
            }}
          >
            Reset Filters
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 380px", gap: 20 }}>
        <aside className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Units</div>
          <div style={{ display: "grid", gap: 8 }}>
            {units.map((u) => (
              <button
                key={u}
                className={`unit-btn ${u === activeUnit ? "active" : ""}`}
                onClick={() => {
                  setActiveUnit(u);
                  setFocused(null);
                  setAnalysis(null);
                }}
              >
                <span aria-hidden className="unit-dot" />
                <span className="nav-label" style={{ color: "inherit" }}>
                  {u}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 160px",
              // background: COLORS.headerBg,
              padding: "10px 16px",
              fontWeight: 700,
            }}
          >
            <div>Resource</div>
            <div>Size</div>
            <div>Alignment</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Actions</span>
              <button
                className="btn ghost"
                style={{ padding: "4px 8px", fontSize: 13, fontWeight: 400 , color: "green",}}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".pdf";
                  input.multiple = true;
                  input.onchange = async (e) => {
                    const files = (e.target as HTMLInputElement).files;
                    if (!files) return;
                    // Handle upload logic here
                    console.log("Upload files:", files);
                  };
                  input.click();
                }}
              >
                + Upload
              </button>
            </div>
          </div>

          {resources.map((r, i) => (
            <div
              key={r.path}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragOver={(e) => onDragOver(e, i)}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 160px",
                padding: "10px 16px",
                borderTop: `1px solid ${COLORS.divider}`,
                alignItems: "center",
                // background: focused?.path === r.path ? COLORS.focusBg : "transparent",
                cursor: "grab",
              }}
            >
              <button
                className="btn resources"
                onClick={() => openResource(r)}
                style={{
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: COLORS.link,
                  fontWeight: 600,
                  cursor: "pointer",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title="Open PDF"
              >
                {r.name}
              </button>
              <div>{(r.size / 1024).toFixed(1)} KB</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {statusBadge(r.fit)}
                {(r.issues || []).length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(r.issues || []).slice(0, 2).map((iss) => (
                      <span key={iss} className="badge warn">
                        ■ {iss}
                      </span>
                    ))}
                    {(r.issues || []).length > 2 && (
                      <span className="badge warn">+{(r.issues || []).length - 2}</span>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn ghost curric-btn"
                  onClick={() => analyze(r)}
                  disabled={busyAnalyze && focused?.path === r.path}
                  title="Analyze alignment and get adaptation"
                >
                  {busyAnalyze && focused?.path === r.path ? "Analyzing…" : "Analyze"}
                </button>
              </div>
            </div>
          ))}

          {!resources.length && (
            <div style={{ padding: 16, color: COLORS.muted }}>
              No PDFs match current filters.
            </div>
          )}
        </section>

        <aside className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>
            {focused ? focused.name : "Select a resource to analyze"}
          </div>
          {focused && (
            <>
              <div className="card" style={{}}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>Group Fit</div>
                  {statusBadge(focused.fit)}
                </div>
                <div style={{ fontSize: 12, color: COLORS.muted }}>
                  Modified: {focused.uploaded_at.split("T")[0]} • Size: {(focused.size / 1024).toFixed(1)} KB
                </div>
                {(focused.issues || []).length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(focused.issues || []).map((iss) => (
                      <span key={iss} className="badge warn">■ {iss}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="card" style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Affected students</div>
                <div style={{ color: COLORS.muted }}>
                  {analysis?.affected?.length
                    ? analysis.affected.join(", ")
                    : busyAnalyze
                    ? "Loading…"
                    : "—"}
                </div>
              </div>

              <div className="card" style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  Consensus adaptation
                </div>
                {busyAnalyze && !analysis ? (
                  <div style={{ color: COLORS.muted }}>Analyzing…</div>
                ) : (
                  <ul style={{ margin: "0 0 0 18px", padding: 0 }}>
                    {(analysis?.consensus || []).map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}
                <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 8 }}>
                  Evidence: {analysis?.evidence || (busyAnalyze ? "…" : "—")}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="btn primary">Insert</button>
                <button className="btn ghost">Save</button>
                <button
                  className="btn ghost"
                  onClick={() => {
                    if (!analysis) return;
                    const text = `Adaptation:\n- ${analysis.consensus.join(
                      "\n- "
                    )}\n\nEvidence: ${analysis.evidence}`;
                    navigator.clipboard?.writeText(text);
                  }}
                >
                  Copy
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}