import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiGetBlobUrl } from "../lib/api";
//select
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
  buttonGradientStart: "#08debb",
  buttonGradientEnd: "#35598f",
  altRespBg: "rgba(97, 255, 163, 0.20)",
  altRespText: "#3A3A5C",
  surface: "#ffffff",
  hoverSurface: "#f9fafb",
  overlayBg: "rgba(0,0,0,.45)",
  modalShadow: "0 20px 60px rgba(0,0,0,.25)",
  mainText: "#374151",
  mutedText: "#6b7280",
  spinnerTrack: "#e5e7eb",
  spinnerArc: "#ec4899",
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
  grade?: string | null;
  teacher?: string | null;
  alignment_pct?: number | null;
  badges: string[];
};

const ISSUE_OPTIONS = ["Reading", "Modality", "Time", "Assessment", "Exec-Fx", "AT/Tech"];

// Spinner component
const Spinner = ({ size = 40 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 50 50"
    aria-hidden
    role="img"
    style={{ display: "block" }}
  >
    <circle
      cx="25"
      cy="25"
      r="20"
      fill="none"
      stroke={COLORS.spinnerTrack}
      strokeWidth="6"
      strokeLinecap="round"
    />
    <path
      d="M25 5 a20 20 0 0 1 0 40"
      fill="none"
      stroke={COLORS.spinnerArc}
      strokeWidth="6"
      strokeLinecap="round"
    >
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 25 25"
        to="360 25 25"
        dur="0.9s"
        repeatCount="indefinite"
      />
    </path>
  </svg>
);

// AutocompleteMulti component
const AutocompleteMulti = ({ label, options, selected, onChange, onEnter, inputRef }) => {
  const [q, setQ] = useState("");
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 14, fontWeight: 600, color: COLORS.mainText }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          type="text"
          placeholder={`type to search ${label.toLowerCase()}…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            const match = options.find(
              (o) => o.label.toLowerCase() === q.toLowerCase()
            );
            if (e.key === "Enter") {
              if (match) {
                if (!selected.includes(match.value)) {
                  onChange([...selected, match.value]);
                }
                setQ("");
              } else if (selected.length > 0 && onEnter) {
                onEnter();
              }
            }
          }}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.surface,
            color: COLORS.mainText,
          }}
        />
        {q && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
              maxHeight: 160,
              overflowY: "auto",
              zIndex: 100,
            }}
          >
            {filtered.length ? (
              filtered.slice(0, 6).map((o) => (
                <div
                  key={o.value}
                  onClick={() => {
                    if (!selected.includes(o.value)) {
                      onChange([...selected, o.value]);
                    }
                    setQ("");
                  }}
                  style={{
                    padding: "8px 12px",
                    cursor: "pointer",
                    borderBottom: `1px solid ${COLORS.border}`,
                    color: COLORS.mainText,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = COLORS.hoverSurface;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {o.label}
                </div>
              ))
            ) : (
              <div style={{ padding: "8px 12px", color: COLORS.mutedText }}>
                no match
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
        {selected.map((val) => {
          const opt = options.find((o) => o.value === val);
          return (
            <div
              key={val}
              style={{
                display: "flex",
                alignItems: "center",
                background: COLORS.altRespBg,
                color: COLORS.altRespText,
                borderRadius: 12,
                padding: "6px 10px",
                fontWeight: 600,
              }}
            >
              {opt?.label || val}
              <span
                onClick={() => onChange(selected.filter((x) => x !== val))}
                style={{
                  marginLeft: 8,
                  cursor: "pointer",
                  fontWeight: 800,
                  lineHeight: 1,
                }}
              >
                ×
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function statusBadge({ mean, spread, status }) {
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
  const [data, setData] = useState(null);
  const [activeCourse, setActiveCourse] = useState("");
  const [activeUnit, setActiveUnit] = useState("");
  const [dragIdx, setDragIdx] = useState(null);

  const [issueFilter, setIssueFilter] = useState("All Issues");
  const [minFit, setMinFit] = useState(0);
  const [atRiskOnly, setAtRiskOnly] = useState(false);

  const [focused, setFocused] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [busyAnalyze, setBusyAnalyze] = useState(false);

  // Generate report modal state
  const [showModal, setShowModal] = useState(false);
  const [allStudents, setAllStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [unitsDropdownOpen, setUnitsDropdownOpen] = useState(false);

  const studentsInputRef = useState(null);
  const coursesInputRef = useState(null);
  const unitsButtonRef = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await apiGet("/curriculum");
        setData(d);
        const firstCourse = Object.keys(d.courses)[0];
        if (firstCourse) {
          setActiveCourse(firstCourse);
          const firstUnit = Object.keys(d.courses[firstCourse])[0];
          if (firstUnit) setActiveUnit(firstUnit);
        }

        // Load students for generate modal
        const students = await apiGet("/students");
        setAllStudents(students);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    setSelectedUnits([]);
  }, [selectedCourses]);

  const courses = useMemo(() => Object.keys(data?.courses || {}), [data]);
  const units = useMemo(
    () => (activeCourse ? Object.keys(data?.courses[activeCourse] || {}) : []),
    [data, activeCourse]
  );

  const allResources = (data && activeCourse && activeUnit
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

  const modalUnits = useMemo(() => {
    if (!data || selectedCourses.length === 0) return [];
    const allUnits = [];
    selectedCourses.forEach((courseId) => {
      const courseUnits = Object.keys(data.courses[courseId] || {});
      courseUnits.forEach((unit) => {
        if (!allUnits.includes(unit)) {
          allUnits.push(unit);
        }
      });
    });
    return allUnits;
  }, [data, selectedCourses]);

  const handleReorder = async (newOrder) => {
    if (!data) return;
    const next = {
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

  const onDragStart = (i) => setDragIdx(i);
  const onDragOver = (e, i) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    const working = [...allResources];
    const [moved] = working.splice(dragIdx, 1);
    working.splice(i, 0, moved);
    setDragIdx(i);
    handleReorder(working);
  };

  const analyze = async (r) => {
    setBusyAnalyze(true);
    setFocused(r);
    setAnalysis(null);
    try {
      const res = await apiGet(
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

  async function openResource(r) {
    try {
      const url = await apiGetBlobUrl(`/curriculum/${r.path}`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {}
  }

  const handleGenerate = () => {
    setIsGenerating(true);
    console.log({
      students: selectedStudents,
      courses: selectedCourses,
      units: selectedUnits,
    });
    setTimeout(() => {
      setIsGenerating(false);
      setShowModal(false);
      alert("report generation complete! your report is ready.");
    }, 3000);
  };

  const generateDisabled =
    isGenerating ||
    !selectedStudents.length ||
    !selectedCourses.length ||
    !selectedUnits.length;

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
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
              color: "#ffffff",
              fontWeight: 650,
            }}
          >
            Generate
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
                style={{ padding: "4px 8px", fontSize: 13, fontWeight: 400 }}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".pdf";
                  input.multiple = true;
                  input.onchange = async (e) => {
                    const files = e.target.files;
                    if (!files) return;
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
                background: focused?.path === r.path ? COLORS.focusBg : "transparent",
                cursor: "grab",
              }}
            >
              <button
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
              <div className="card" style={{ background: COLORS.headerBg }}>
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

      {/* Generate Report Modal */}
      {showModal && (
        <div
          onClick={() => !isGenerating && setShowModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: COLORS.overlayBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(100%, 500px)",
              padding: 24,
              background: COLORS.surface,
              borderRadius: 16,
              boxShadow: COLORS.modalShadow,
              display: "flex",
              flexDirection: "column",
              gap: 18,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <h3
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: COLORS.mainText,
              }}
            >
              generate report
            </h3>

           

            <AutocompleteMulti
              label="select courses"
              options={courses.map((c) => ({ value: c, label: c }))}
              selected={selectedCourses}
              onChange={setSelectedCourses}
              inputRef={coursesInputRef}
            />

            {selectedCourses.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <label
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: COLORS.mainText,
                  }}
                >
                  select units
                </label>
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    ref={unitsButtonRef}
                    onClick={() =>
                      setUnitsDropdownOpen(!unitsDropdownOpen)
                    }
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: `1px solid ${COLORS.border}`,
                      backgroundColor: COLORS.surface,
                      color: COLORS.mainText,
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>
                      {selectedUnits.length === 0
                        ? "select units..."
                        : `${selectedUnits.length} unit${selectedUnits.length !== 1 ? "s" : ""} selected`}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      style={{
                        transform: unitsDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                      }}
                    >
                      <path
                        d="M4 6L8 10L12 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  {unitsDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 8,
                        backgroundColor: COLORS.surface,
                        maxHeight: 200,
                        overflowY: "auto",
                        zIndex: 100,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                    >
                      {modalUnits.map((u) => {
                        const isSelected = selectedUnits.includes(u);
                        return (
                          <div
                            key={u}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedUnits(selectedUnits.filter((unit) => unit !== u));
                              } else {
                                setSelectedUnits([...selectedUnits, u]);
                              }
                            }}
                            style={{
                              padding: "10px 12px",
                              cursor: "pointer",
                              borderBottom: `1px solid ${COLORS.border}`,
                              backgroundColor: isSelected ? COLORS.altRespBg : "transparent",
                              color: isSelected ? COLORS.altRespText : COLORS.mainText,
                              fontWeight: isSelected ? 600 : 400,
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.backgroundColor = COLORS.hoverSurface;
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.backgroundColor = "transparent";
                              }
                            }}
                          >
                            <div
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 4,
                                border: `2px solid ${isSelected ? COLORS.altRespText : COLORS.border}`,
                                backgroundColor: isSelected ? COLORS.altRespText : "transparent",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              {isSelected && (
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                  <path
                                    d="M2 6L5 9L10 3"
                                    stroke="white"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </div>
                            <span>{u}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {selectedUnits.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginTop: 4,
                    }}
                  >
                    {selectedUnits.map((u) => (
                      <div
                        key={u}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          background: COLORS.altRespBg,
                          color: COLORS.altRespText,
                          borderRadius: 12,
                          padding: "6px 10px",
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                      >
                        {u}
                        <span
                          onClick={() =>
                            setSelectedUnits(selectedUnits.filter((unit) => unit !== u))
                          }
                          style={{
                            marginLeft: 8,
                            cursor: "pointer",
                            fontWeight: 800,
                            lineHeight: 1,
                          }}
                        >
                          ×
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* generating status block */}
            {isGenerating && (
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background:
                    "linear-gradient(135deg, rgba(167, 139, 250, 0.1), rgba(236, 72, 153, 0.1))",
                  border: `1px solid ${COLORS.altRespBg}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Spinner size={24} />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      color: COLORS.mainText,
                      marginBottom: 4,
                    }}
                  >
                    generating your report...
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: COLORS.mutedText,
                    }}
                  >
                    this will take a few minutes. feel free to continue working.
                  </div>
                </div>
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 16,
              }}
            >
              <button
                onClick={() => setShowModal(false)}
                disabled={isGenerating}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                  background: "transparent",
                  color: COLORS.mainText,
                  fontWeight: 600,
                  cursor: isGenerating ? "default" : "pointer",
                  opacity: isGenerating ? 0.5 : 1,
                }}
              >
                cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={generateDisabled}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
                  color: "white",
                  fontWeight: 600,
                  border: "none",
                  cursor: generateDisabled ? "default" : "pointer",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                  opacity: generateDisabled ? 0.5 : 1,
                }}
              >
                {isGenerating ? "generating..." : "generate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}