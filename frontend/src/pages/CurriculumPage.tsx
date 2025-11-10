// src/pages/CurriculumPage.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { apiGet, apiPost, apiGetBlobUrl } from "../lib/api";
import { useJobCenter } from "../components/jobs/JobCenter";

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

type StudentSummary = {
  id: string;
  name: string;
  alignment_pct?: number | null;
  grade?: string | null;
  teacher?: string | null;
  badges: string[];
};

const ISSUE_OPTIONS = ["Reading", "Modality", "Time", "Assessment", "Exec-Fx", "AT/Tech"];

function statusBadge({ mean, spread, status }: Resource["fit"]) {
  const symbol = status === "good" ? "▲" : status === "warn" ? "■" : "●";
  const color = status === "good" ? COLORS.good : status === "warn" ? COLORS.warn : COLORS.bad;
  return (
    <span title={`Mean ${mean}% • Spread ${spread}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, color }}>
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
  const [analysis, setAnalysis] = useState<{ affected: string[]; consensus: string[]; evidence: string } | null>(null);
  const [busyAnalyze, setBusyAnalyze] = useState(false);

  // JobCenter hookup (same pattern as StudentsPage)
  const { job, start, isModalOpen, open: openJobModal, close: closeJobModal } = useJobCenter();
  const [allStudents, setAllStudents] = useState<StudentSummary[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const studentsInputRef = useRef<HTMLInputElement>(null);

  // Lightweight multi-select for students (inline, mirrors your AutocompleteMulti style without pulling code over)
  const [qStu, setQStu] = useState("");
  const filteredStudents = useMemo(() => {
    const ql = qStu.toLowerCase();
    return allStudents.filter(s => s.name.toLowerCase().includes(ql));
  }, [allStudents, qStu]);

  useEffect(() => {
    (async () => {
      try {
        const [d, studs] = await Promise.all([
          apiGet<Curriculum>("/curriculum"),
          apiGet<StudentSummary[]>("/students").catch(() => [] as StudentSummary[])
        ]);
        setData(d);
        setAllStudents(studs);
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
  const units = useMemo(() => (activeCourse ? Object.keys(data?.courses[activeCourse] || {}) : []), [data, activeCourse]);

  const allResources: Resource[] =
    (data && activeCourse && activeUnit ? data.courses[activeCourse][activeUnit] : []) || [];

  const resources = useMemo(() => {
    let items = allResources;
    if (issueFilter !== "All Issues") items = items.filter((r) => (r.issues || []).includes(issueFilter));
    if (minFit > 0) items = items.filter((r) => r.fit.mean >= minFit);
    if (atRiskOnly) items = items.filter((r) => r.fit.status !== "good");
    return items;
  }, [allResources, issueFilter, minFit, atRiskOnly]);

  const handleReorder = async (newOrder: Resource[]) => {
    if (!data || !activeCourse || !activeUnit) return;
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

  // Analyze: fetch live analysis + try to pull prior runs for this worksheet
  const analyze = async (r: Resource) => {
    setBusyAnalyze(true);
    setFocused(r);
    setAnalysis(null);
    try {
      const res = await apiGet<{ affected: string[]; consensus: string[]; evidence: string }>(
        `/curriculum/${encodeURIComponent(activeCourse)}/${encodeURIComponent(activeUnit)}/analysis?resource=${encodeURIComponent(r.filename)}`
      );
      // Try history (optional backend)
      let prior: { consensus?: string[]; evidence?: string } | null = null;
      try {
        prior = await apiGet<{ consensus?: string[]; evidence?: string }>(
          `/align/history?course=${encodeURIComponent(activeCourse)}&unit=${encodeURIComponent(activeUnit)}&resource=${encodeURIComponent(r.filename)}`
        );
      } catch {
        prior = null;
      }
      const merged = {
        affected: res.affected || [],
        consensus: res.consensus?.length ? res.consensus : prior?.consensus || ["(demo) No change needed."],
        evidence: res.evidence || prior?.evidence || "(demo) No evidence.",
      };
      setAnalysis(merged);
    } catch {
      setAnalysis({ affected: [], consensus: ["(demo) No change needed."], evidence: "(demo) No evidence." });
    } finally {
      setBusyAnalyze(false);
    }
  };

  const openResource = async (r: Resource) => {
    try {
      const url = await apiGetBlobUrl(`/curriculum/${r.path}`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {}
  };

  // Generate via JobCenter: we reuse the same modal behavior as StudentsPage.
  function handleOpenGenerate() {
    setSelectedStudents([]); // reset
    openJobModal();
    // prefill Course/Unit shown in the modal and used in start()
  }
  function handleStartAlignment() {
    if (!selectedStudents.length || !activeCourse || !activeUnit) return;
    start({ students: selectedStudents, courses: [activeCourse], units: [activeUnit] });
  }

  if (!data) return <div className="card">Loading curriculum…</div>;

  return (
    <div style={{ padding: 24, position: "relative" }}>
      {/* Header */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 4 }}>Curriculum</h1>
          <div style={{ color: COLORS.graySub }}>Units • Resources • Alignment Overview</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn ghost"
            style={{ color: "white", background: `linear-gradient(135deg, #3DAFBC, #35598f)` }}
            onClick={handleOpenGenerate}
          >
            Generate
          </button>
        </div>
      </div>

      {/* Filter row */}
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
          style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}` }}
        >
          {courses.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>

        <select
          value={issueFilter}
          onChange={(e) => setIssueFilter(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}` }}
        >
          <option>All Issues</option>
          {ISSUE_OPTIONS.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ fontSize: 12, color: COLORS.muted }}>Min fit {minFit}%</label>
          <input type="range" min={0} max={100} value={minFit} onChange={(e) => setMinFit(parseInt(e.target.value, 10))} />
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={atRiskOnly} onChange={(e) => setAtRiskOnly(e.target.checked)} />
            At-risk only
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "end", gap: 8 }}>
          <button
            type="button"
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

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 380px", gap: 20 }}>
        {/* Units sidebar */}
        <aside className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Units</div>
          <div style={{ display: "grid", gap: 8 }}>
            {units.map((u) => (
              <button
                key={u}
                type="button"
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

        {/* Resources list */}
        <section className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 160px", padding: "10px 16px", fontWeight: 700 }}>
            <div>Resource</div>
            <div>Size</div>
            <div>Alignment</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Actions</span>
              <button
                type="button"
                className="btn ghost"
                style={{ padding: "4px 8px", fontSize: 13, fontWeight: 400, color: "white", background: `linear-gradient(135deg, #3DAFBC, #35598f)` }}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".pdf";
                  input.multiple = true;
                  input.onchange = (e) => {
                    const files = Array.from((e.target as HTMLInputElement).files || []);
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
                cursor: "grab",
              }}
            >
              <button
                type="button"
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
                    {(r.issues || []).length > 2 && <span className="badge warn">+{(r.issues || []).length - 2}</span>}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
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

          {!resources.length && <div style={{ padding: 16, color: COLORS.muted }}>No PDFs match current filters.</div>}
        </section>

        {/* Analysis sidebar */}
        <aside className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>
            {focused ? focused.name : "Select a resource to analyze"}
          </div>
          {focused && (
            <>
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>Group Fit</div>
                  {statusBadge(focused.fit)}
                </div>
                <div style={{ fontSize: 12, color: COLORS.muted }}>
                  Modified: {focused.uploaded_at?.split("T")[0] ?? "—"} • Size: {(focused.size / 1024).toFixed(1)} KB
                </div>
                {(focused.issues || []).length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(focused.issues || []).map((iss) => (
                      <span key={iss} className="badge warn">
                        ■ {iss}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="card" style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Affected students</div>
                <div style={{ color: COLORS.muted }}>
                  {analysis?.affected?.length ? analysis.affected.join(", ") : busyAnalyze ? "Loading…" : "—"}
                </div>
              </div>

              <div className="card" style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Consensus adaptation</div>
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
                <button type="button" className="btn primary">Insert</button>
                <button type="button" className="btn ghost">Save</button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    if (!analysis) return;
                    const text = `Adaptation:\n- ${analysis.consensus.join("\n- ")}\n\nEvidence: ${analysis.evidence}`;
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

      {/* JobCenter modal (mirrors StudentsPage flow, but pre-fills Course/Unit and adds student picker) */}
      {isModalOpen && (
        <div
          onClick={closeJobModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(100%, 980px)",
              height: "82vh",
              background: "#fff",
              borderRadius: 16,
              border: `1px solid ${COLORS.border}`,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 24px 80px rgba(0,0,0,.25)",
            }}
          >
            <div style={{ padding: 20, borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                {job.status === "running" ? "Generating report…" : job.status === "done" ? "Alignment result" : "Generate report"}
              </div>
              <button onClick={closeJobModal} className="btn ghost">Close</button>
            </div>

            <div style={{ padding: 20, overflow: "auto", display: "grid", gap: 16 }}>
              {(job.status === "idle" || job.status === "error") && (
                <>
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ fontWeight: 700 }}>Course & Unit</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <input value={activeCourse} readOnly style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}` }} />
                      <input value={activeUnit} readOnly style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}` }} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={{ fontSize: 14, fontWeight: 700 }}>Select students</label>
                    <input
                      ref={studentsInputRef}
                      placeholder="type to search students…"
                      value={qStu}
                      onChange={(e) => setQStu(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const exact = allStudents.find(s => s.name.toLowerCase() === qStu.toLowerCase());
                          if (exact) {
                            if (!selectedStudents.includes(exact.id)) setSelectedStudents([...selectedStudents, exact.id]);
                            setQStu("");
                          } else if (selectedStudents.length) {
                            handleStartAlignment();
                          }
                        }
                      }}
                      style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}` }}
                    />
                    {qStu && (
                      <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, maxHeight: 160, overflowY: "auto" }}>
                        {filteredStudents.slice(0, 8).map(s => (
                          <div
                            key={s.id}
                            onClick={() => {
                              if (!selectedStudents.includes(s.id)) setSelectedStudents([...selectedStudents, s.id]);
                              setQStu("");
                            }}
                            style={{ padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${COLORS.border}` }}
                          >
                            {s.name}
                          </div>
                        ))}
                        {!filteredStudents.length && <div style={{ padding: "8px 12px", color: COLORS.graySub }}>No match</div>}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {selectedStudents.map(id => {
                        const s = allStudents.find(x => x.id === id);
                        return (
                          <span key={id} style={{ background: "#e7f9f5", color: "#0b5f56", padding: "6px 10px", borderRadius: 999, fontWeight: 700, fontSize: 12 }}>
                            {s?.name || id}
                            <span
                              onClick={() => setSelectedStudents(selectedStudents.filter(x => x !== id))}
                              style={{ marginLeft: 8, cursor: "pointer", fontWeight: 900 }}
                            >
                              ×
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => setSelectedStudents(allStudents.map(s => s.id))}
                      className="btn ghost"
                    >
                      Select all students
                    </button>
                    <button
                      onClick={handleStartAlignment}
                      disabled={!selectedStudents.length}
                      className="btn primary"
                      style={{ opacity: selectedStudents.length ? 1 : 0.5 }}
                    >
                      Generate
                    </button>
                  </div>
                </>
              )}

              {job.status === "running" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ fontWeight: 700 }}>This runs locally. You can continue working.</div>
                  <div style={{ fontSize: 13, color: COLORS.graySub }}>Close this window anytime; reopen from the sidebar dock.</div>
                  <div style={{ fontSize: 12, color: COLORS.graySub }}>Selection</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {job.payload?.students?.map(s => <Chip key={s} text={`Student: ${s}`} />)}
                    {job.payload?.courses?.map(c => <Chip key={c} text={`Course: ${c}`} />)}
                    {job.payload?.units?.map(u => <Chip key={u} text={`Unit: ${u}`} />)}
                  </div>
                </div>
              )}

              {job.status === "done" && (
                <div style={{ display: "grid", gap: 16 }}>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <Stat title="Overall alignment" value={(job.meta?.summary?.overall ?? 0) + "%"} />
                    <Stat title="Students" value={String(job.meta?.summary?.studentCount ?? 0)} />
                    <Stat title="Worksheets" value={String(job.meta?.summary?.worksheetCount ?? 0)} />
                  </div>

                  <SectionCard title="Per student average">
                    <ListKV obj={job.meta?.summary?.avgPerStudent || {}} />
                  </SectionCard>

                  <SectionCard title="Per worksheet average">
                    <ListKV obj={job.meta?.summary?.avgPerWorksheet || {}} />
                  </SectionCard>

                  <SectionCard title="Worksheet alignment breakdown">
                    <div style={{ display: "grid", gap: 10 }}>
                      {(job.result?.matrix?.worksheets || []).map((w: string, idx: number) => {
                        const rowAvg = Array.isArray(job.result?.row_averages) ? job.result.row_averages[idx] : undefined;
                        const students: string[] = job.result?.matrix?.students || [];
                        return (
                          <div key={w} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                              <div style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w}</div>
                              <div style={{ fontWeight: 900 }}>{rowAvg != null ? `${Math.round(rowAvg)}%` : "—"}</div>
                            </div>
                            <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                              {students.map((stu) => {
                                const detail = job.result?.details?.[w]?.[stu] || {};
                                const u = detail.understanding_fit, a = detail.accessibility_fit, ac = detail.accommodation_fit, e = detail.engagement_fit, o = detail.overall_alignment;
                                return (
                                  <div key={stu} style={{ display: "grid", gap: 6 }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                      <div style={{ color: COLORS.graySub, fontSize: 12 }}>{stu}</div>
                                      <div style={{ fontWeight: 700 }}>{o != null ? `${o}%` : "—"}</div>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 6 }}>
                                      <MiniMetric label="Understanding" value={u} />
                                      <MiniMetric label="Accessibility" value={a} />
                                      <MiniMetric label="Accommodation" value={ac} />
                                      <MiniMetric label="Engagement" value={e} />
                                    </div>
                                    {!!detail.explanation && (
                                      <div style={{ fontSize: 12, color: COLORS.graySub }}>{String(detail.explanation).length > 220 ? String(detail.explanation).slice(0, 219) + "…" : String(detail.explanation)}</div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={() => {
                        const raw = JSON.stringify(job.result, null, 2);
                        const blob = new Blob([raw], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url; a.download = `alignment-${job.jobId}.json`; a.click();
                        setTimeout(()=>URL.revokeObjectURL(url), 0);
                      }}
                      className="btn primary"
                      style={{ minWidth: 220 }}
                    >
                      Download raw JSON
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ text }: { text: string }) {
  return <span style={{ background: "#e7f9f5", color: "#0b5f56", padding: "6px 10px", borderRadius: 999, fontWeight: 700, fontSize: 12 }}>{text}</span>;
}
function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${COLORS.border}`, background: "#fff", minWidth: 180 }}>
      <div style={{ fontSize: 12, color: COLORS.graySub, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 900 }}>{value}</div>
    </div>
  );
}
function ListKV({ obj }: { obj: Record<string, number> }) {
  const entries = Object.entries(obj);
  if (!entries.length) return <div style={{ color: COLORS.graySub, fontSize: 13 }}>No data</div>;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {entries.map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{k}</span>
          <span style={{ fontWeight: 700 }}>{Math.round((v ?? 0) * 10) / 10}%</span>
        </div>
      ))}
    </div>
  );
}
function MiniMetric({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ fontSize: 11, color: COLORS.graySub, marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 800 }}>{value != null ? `${Math.round(value)}%` : "—"}</div>
    </div>
  );
}
function SectionCard({ title, children }: { title: string; children: any }) {
  return (
    <div style={{ padding: 16, borderRadius: 14, border: `1px solid ${COLORS.border}`, background: "#fff", display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 800 }}>{title}</div>
      {children}
    </div>
  );
}
