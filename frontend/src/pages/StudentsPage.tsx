import React, { useEffect, useMemo, useState } from "react"; 

const COLORS = {
  readingBadgeBg: "rgba(251, 191, 191, 0.15)",
  readingBadgeText: "#ef4444",
  timeBadgeBg: "rgba(253, 230, 138, 0.15)",
  timeBadgeText: "#f59e0b",
  altRespBg: "rgba(191, 219, 254, 0.18)",
  altRespText: "#2563eb",
  pieGradientStart: "#34d399",
  pieGradientEnd: "#22c55e",
  pieEmpty: "#e5e7eb",
  buttonGradientStart: "#a78bfa",
  buttonGradientEnd: "#ec4899",
  cardShadow: "0 6px 18px rgba(0,0,0,0.08)",
  mutedText: "#6b7280",
  mainText: "#374151",
  avatarBg: "#eef2ff",
  border: "#e5e7eb",
  surface: "#ffffff",
};

type StudentSummary = {
  id: string;
  name: string;
  grade?: string | null;
  teacher?: string | null;
  alignment_pct?: number | null;
  badges: string[];
};

type StudentFull = {
  id: string;
  data: any;
};

type Resource = {
  name: string;
  filename: string;
  path: string;
  size: number;
  uploaded_at: string;
  fit: { mean: number; spread: number; status: string };
  issues?: string[];
};

type Curriculum = {
  courses: Record<string, Record<string, Resource[]>>;
};

// Mock data
const mockStudents: StudentSummary[] = [
  {
    id: "1",
    name: "Emma Thompson",
    grade: "5",
    teacher: "Ms. Johnson",
    alignment_pct: 85,
    badges: ["Reading", "Time Management"],
  },
  {
    id: "2",
    name: "Liam Chen",
    grade: "4",
    teacher: "Mr. Davis",
    alignment_pct: 72,
    badges: ["Alternate Response"],
  },
  {
    id: "3",
    name: "Sophia Martinez",
    grade: "6",
    teacher: "Mrs. Williams",
    alignment_pct: 93,
    badges: ["Reading", "Alternate Response"],
  },
];

const mockCurriculum: Curriculum = {
  courses: {
    "Mathematics": {
      "Unit 1: Numbers": [],
      "Unit 2: Algebra": [],
      "Unit 3: Geometry": [],
    },
    "Science": {
      "Unit 1: Biology": [],
      "Unit 2: Chemistry": [],
      "Unit 3: Physics": [],
    },
    "English": {
      "Unit 1: Grammar": [],
      "Unit 2: Literature": [],
      "Unit 3: Writing": [],
    },
  },
};

// Reusable Autocomplete multi-select input
const AutocompleteMulti: React.FC<{
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  COLORS: typeof COLORS;
  onEnter?: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}> = ({ label, options, selected, onChange, COLORS, onEnter, inputRef }) => {
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
          placeholder={`Type to search ${label.toLowerCase()}…`}
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
          }}
        />
        {q && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              background: "#fff",
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
                  }}
                >
                  {o.label}
                </div>
              ))
            ) : (
              <div style={{ padding: "8px 12px", color: COLORS.mutedText }}>
                No match
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

// Badge
const Badge: React.FC<{ kind: string }> = ({ kind }) => {
  let bg = COLORS.timeBadgeBg,
    fg = COLORS.timeBadgeText;
  if (kind === "Reading") {
    bg = COLORS.readingBadgeBg;
    fg = COLORS.readingBadgeText;
  }
  if (kind === "Alternate Response") {
    bg = COLORS.altRespBg;
    fg = COLORS.altRespText;
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        backgroundColor: bg,
        color: fg,
      }}
    >
      {kind}
    </span>
  );
};

// Student Card
const StudentCard: React.FC<{
  s: StudentSummary;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
}> = ({ s, onView }) => {
  const pct =
    typeof s.alignment_pct === "number"
      ? Math.max(0, Math.min(100, s.alignment_pct))
      : null;
  const deg = pct != null ? pct * 3.6 : 0;
  return (
    <div
      style={{
        padding: 24,
        borderRadius: 16,
        backgroundColor: COLORS.surface,
        boxShadow: COLORS.cardShadow,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            backgroundColor: COLORS.avatarBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-hidden
        >
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke={COLORS.mainText}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21a8 8 0 0 0-16 0" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 18,
              color: COLORS.mainText,
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              overflow: "hidden",
            }}
          >
            {s.name}
          </div>
          <div style={{ color: COLORS.mutedText, fontSize: 13 }}>
            {s.grade ? `Grade ${s.grade}` : "—"} {s.teacher ? `• ${s.teacher}` : ""}
          </div>
        </div>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background:
              pct != null
                ? `conic-gradient(${COLORS.pieGradientStart} ${deg}deg, ${COLORS.pieEmpty} ${deg}deg)`
                : COLORS.pieEmpty,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 13,
              color: COLORS.mainText,
            }}
          >
            {pct != null ? `${pct}%` : "—"}
          </div>
        </div>
      </div>
      {!!s.badges?.length && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {s.badges.map((b) => (
            <Badge key={b} kind={b} />
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          style={{
            flex: 1,
            padding: "10px 0",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "#fff",
            color: "#374151",
            fontWeight: 700,
            cursor: "pointer",
          }}
          onClick={() => onView(s.id)}
        >
          Open
        </button>
        <button
          style={{
            flex: 1,
            padding: "10px 0",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(135deg, #a78bfa, #ec4899)",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
          onClick={() =>
            alert("Reports: quick-generate/view for this student (coming soon)")
          }
        >
          Reports
        </button>
      </div>
    </div>
  );
};

const Spinner: React.FC<{ size?: number }> = ({ size = 40 }) => (
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
      stroke="#e5e7eb"
      strokeWidth="6"
      strokeLinecap="round"
    />
    <path
      d="M25 5 a20 20 0 0 1 0 40"
      fill="none"
      stroke="#ec4899"
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

export default function StudentsPage() {
  const [all, setAll] = useState<StudentSummary[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [unitsDropdownOpen, setUnitsDropdownOpen] = useState(false);
  
  const studentsInputRef = React.useRef<HTMLInputElement>(null);
  const coursesInputRef = React.useRef<HTMLInputElement>(null);
  const unitsButtonRef = React.useRef<HTMLButtonElement>(null);

  const filtered = useMemo(
    () => all.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())),
    [all, q]
  );

  const courses = useMemo(() => Object.keys(curriculum?.courses || {}), [curriculum]);

  const units = useMemo(() => {
    if (!curriculum || selectedCourses.length === 0) return [];
    const allUnits: string[] = [];
    selectedCourses.forEach((courseId) => {
      const courseUnits = Object.keys(curriculum.courses[courseId] || {});
      courseUnits.forEach((unit) => {
        if (!allUnits.includes(unit)) {
          allUnits.push(unit);
        }
      });
    });
    return allUnits;
  }, [curriculum, selectedCourses]);

  async function load() {
    setBusy(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      setAll(mockStudents);
      setCurriculum(mockCurriculum);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    // Reset selected units when courses change
    setSelectedUnits([]);
  }, [selectedCourses]);

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
      alert("Report generation complete! Your report is ready.");
    }, 3000);
  };

  const focusCoursesInput = () => {
    setTimeout(() => coursesInputRef.current?.focus(), 100);
  };

  const focusUnitsDropdown = () => {
    setTimeout(() => {
      unitsButtonRef.current?.focus();
      setUnitsDropdownOpen(true);
    }, 100);
  };

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 4 }}>Students</h1>
          <div style={{ color: COLORS.mutedText }}>
            Manage profiles and IEP details
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search students…"
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: `1px solid ${COLORS.border}`,
              minWidth: 220,
            }}
          />
          <button
            onClick={load}
            disabled={busy}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
              color: "#fff",
              fontWeight: 700,
            }}
          >
            {busy ? "Refreshing…" : "Refresh"}
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
              color: "#fff",
              fontWeight: 700,
            }}
          >
            Generate
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        {filtered.map((s) => (
          <StudentCard key={s.id} s={s} onView={() => {}} onEdit={() => {}} />
        ))}
      </div>

      {showModal && (
        <div
          onClick={() => !isGenerating && setShowModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
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
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,.25)",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <h3
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: COLORS.mainText,
              }}
            >
              Generate Report
            </h3>

            <AutocompleteMulti
              label="Select Students"
              options={all.map((s) => ({ value: s.id, label: s.name }))}
              selected={selectedStudents}
              onChange={setSelectedStudents}
              COLORS={COLORS}
            />

            <AutocompleteMulti
              label="Select Courses"
              options={courses.map((c) => ({ value: c, label: c }))}
              selected={selectedCourses}
              onChange={setSelectedCourses}
              COLORS={COLORS}
            />

            {selectedCourses.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: COLORS.mainText }}>
                  Select Units
                </label>
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => setUnitsDropdownOpen(!unitsDropdownOpen)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: `1px solid ${COLORS.border}`,
                      backgroundColor: "#fff",
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
                        ? "Select units..."
                        : `${selectedUnits.length} unit${selectedUnits.length !== 1 ? 's' : ''} selected`}
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
                        backgroundColor: "#fff",
                        maxHeight: 200,
                        overflowY: "auto",
                        zIndex: 100,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                    >
                      {units.map((u) => {
                        const isSelected = selectedUnits.includes(u);
                        return (
                          <div
                            key={u}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedUnits(selectedUnits.filter(unit => unit !== u));
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
                                e.currentTarget.style.backgroundColor = "#f9fafb";
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
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
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
                          onClick={() => setSelectedUnits(selectedUnits.filter(unit => unit !== u))}
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

            {isGenerating && (
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: "linear-gradient(135deg, rgba(167, 139, 250, 0.1), rgba(236, 72, 153, 0.1))",
                  border: `1px solid ${COLORS.altRespBg}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Spinner size={24} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: COLORS.mainText, marginBottom: 4 }}>
                    Generating your report...
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.mutedText }}>
                    This will take a few minutes. Feel free to continue working.
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setShowModal(false)}
                disabled={isGenerating}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                  background: "#fff",
                  color: COLORS.mainText,
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: isGenerating ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={
                  isGenerating || !selectedStudents.length || !selectedCourses.length || !selectedUnits.length
                }
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
                  color: "white",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                  opacity: isGenerating || !selectedStudents.length || !selectedCourses.length || !selectedUnits.length ? 0.5 : 1,
                }}
              >
                {isGenerating ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}