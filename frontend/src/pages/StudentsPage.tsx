import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPut, apiPost } from "../lib/api";

// theme palettes (light + dark)
const THEME_COLORS = {
  light: {
    readingBadgeBg: "rgba(226, 255, 129, 0.45)",
    readingBadgeText: "#3A3A5C",
    timeBadgeBg: "rgba(208, 255, 179, 0.45)",
    timeBadgeText: "#3A3A5C",
    altRespBg: "rgba(97, 255, 163, 0.20)",
    altRespText: "#3A3A5C",
    pieGradientStart: "#34d399",
    pieGradientEnd: "#22c55e",
    pieEmpty: "#e5e7eb",
    buttonGradientStart: "#08debb",
    buttonGradientEnd: "#35598f",
    spinnerTrack: "#e5e7eb",
    spinnerArc: "#ec4899",
    cardShadow: "0 6px 18px rgba(0,0,0,0.08)",
    mutedText: "#6b7280",
    mainText: "#374151",
    avatarBg: "#f2f3f6ff",
    border: "#e5e7eb",
    surface: "#ffffff",
    hoverSurface: "#f9fafb",
    overlayBg: "rgba(0,0,0,.45)",
    modalShadow: "0 20px 60px rgba(0,0,0,.25)",
  },
  dark: {
    readingBadgeBg: "rgba(226, 255, 129, 0.18)",
    readingBadgeText: "#e5e7eb",
    timeBadgeBg: "rgba(208, 255, 179, 0.18)",
    timeBadgeText: "#e5e7eb",
    altRespBg: "rgba(97, 255, 163, 0.12)",
    altRespText: "#e5e7eb",
    pieGradientStart: "#34d399",
    pieGradientEnd: "#22c55e",
    pieEmpty: "#374151",
    buttonGradientStart: "#08debb",
    buttonGradientEnd: "#35598f",
    spinnerTrack: "#374151",
    spinnerArc: "#ec4899",
    cardShadow: "0 6px 24px rgba(0,0,0,0.35)",
    mutedText: "#9ca3af",
    mainText: "#e5e7eb",
    avatarBg: "#0b1324",
    border: "#334155",
    surface: "#0b1324",
    hoverSurface: "#111827",
    overlayBg: "rgba(0,0,0,.55)",
    modalShadow: "0 24px 80px rgba(0,0,0,.55)",
  },
};

// small hook to detect whether current app theme is dark
function useIsDark(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document === "undefined") return false;
    const root = document.documentElement;
    const attr = root.getAttribute("data-theme");
    if (attr === "dark") return true;
    if (attr === "light") return false;
    return root.classList.contains("dark");
  });

  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const get = () =>
      root.getAttribute("data-theme") === "dark" ||
      root.classList.contains("dark");

    const obs = new MutationObserver(() => setIsDark(get()));
    obs.observe(root, { attributes: true, attributeFilter: ["data-theme", "class"] });

    const onStorage = (e: StorageEvent) => {
      if (e.key !== "theme") return;
      setIsDark(get());
    };
    window.addEventListener("storage", onStorage);

    const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onMql = () => setIsDark(get());
    mql?.addEventListener?.("change", onMql);

    setIsDark(get());

    return () => {
      obs.disconnect();
      window.removeEventListener("storage", onStorage);
      mql?.removeEventListener?.("change", onMql);
    };
  }, []);

  return isDark;
}

// basic types
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

// alignment response (from /align/iep-selected)
type IEPAlignResponse = {
  meta: { students: string[]; worksheets: string[] };
  matrix: { students: string[]; worksheets: string[]; matrix: number[][] };
  details: Record<string, Record<string, any>>;
  row_averages?: number[];
  column_averages?: number[];
};

// animated modal shell
const ModalShell: React.FC<{
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  COLORS: typeof THEME_COLORS.light;
  width?: string;
  height?: string;
}> = ({ open, onClose, children, COLORS, width = "min(100%, 500px)", height }) => {
  const [shouldRender, setShouldRender] = React.useState(open);
  const [visible, setVisible] = React.useState(open);
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const dialogRef  = React.useRef<HTMLDivElement | null>(null);
  const prefersReduced = React.useMemo(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  React.useEffect(() => {
    if (open) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        setVisible(true);
        if (!prefersReduced) {
          overlayRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: "ease-out" });
          dialogRef.current?.animate(
            [
              { transform: "translateY(24px) scale(.98)", opacity: 0 },
              { transform: "translateY(-2px) scale(1)", opacity: 1, offset: 0.86 },
              { transform: "translateY(0) scale(1)",  opacity: 1 }
            ],
            { duration: 260, easing: "cubic-bezier(.22,.61,.36,1)" }
          );
        }
      });
    } else {
      setVisible(false);
    }
  }, [open, prefersReduced]);

  const handleDialogTransitionEnd = () => {
    if (!visible) setShouldRender(false);
  };

  if (!shouldRender) return null;

  return (
    <div
      ref={overlayRef}
      onClick={() => onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: COLORS.overlayBg,
        transition: "opacity 200ms ease",
        opacity: visible ? 1 : 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        onTransitionEnd={handleDialogTransitionEnd}
        style={{
          width,
          ...(height ? { height } : {}),
          transform: visible ? "translateY(0) scale(1)" : "translateY(12px) scale(.98)",
          opacity: visible ? 1 : 0,
          transition: "transform 220ms cubic-bezier(.22,.61,.36,1), opacity 220ms ease",
          background: COLORS.surface,
          borderRadius: 16,
          boxShadow: COLORS.modalShadow,
          border: `1px solid ${COLORS.border}`,
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
};

// autocomplete multi-select
const AutocompleteMulti: React.FC<{
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  COLORS: typeof THEME_COLORS.light;
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

// small bits
const Spinner: React.FC<{ size?: number; COLORS: typeof THEME_COLORS.light }> = ({
  size = 40,
  COLORS,
}) => (
  <svg width={size} height={size} viewBox="0 0 50 50" aria-hidden role="img" style={{ display: "block" }}>
    <circle cx="25" cy="25" r="20" fill="none" stroke={COLORS.spinnerTrack} strokeWidth="6" strokeLinecap="round" />
    <path d="M25 5 a20 20 0 0 1 0 40" fill="none" stroke={COLORS.spinnerArc} strokeWidth="6" strokeLinecap="round">
      <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.9s" repeatCount="indefinite" />
    </path>
  </svg>
);

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  COLORS: typeof THEME_COLORS.light;
}> = ({ label, value, onChange, textarea, COLORS }) => (
  <label style={{ display: "grid", gap: 6 }}>
    <span style={{ fontSize: 12, color: COLORS.mutedText }}>{label}</span>
    {textarea ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: `1px solid ${COLORS.border}`,
          resize: "vertical",
          background: COLORS.surface,
          color: COLORS.mainText,
        }}
      />
    ) : (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: `1px solid ${COLORS.border}`,
          background: COLORS.surface,
          color: COLORS.mainText,
        }}
      />
    )}
  </label>
);

const SectionCard: React.FC<{ title: string; children: React.ReactNode; COLORS: typeof THEME_COLORS.light }> = ({
  title,
  children,
  COLORS,
}) => (
  <div
    style={{
      padding: 16,
      borderRadius: 14,
      border: `1px solid ${COLORS.border}`,
      background: COLORS.surface,
      display: "grid",
      gap: 12,
    }}
  >
    <div style={{ fontWeight: 800, color: COLORS.mainText }}>{title}</div>
    {children}
  </div>
);

const Badge: React.FC<{ kind: string; COLORS: typeof THEME_COLORS.light }> = ({ kind, COLORS }) => {
  let bg = THEME_COLORS.light.timeBadgeBg, fg = THEME_COLORS.light.timeBadgeText;
  if (kind === "Reading") { bg = THEME_COLORS.light.readingBadgeBg; fg = THEME_COLORS.light.readingBadgeText; }
  if (kind === "Alternate Response") { bg = THEME_COLORS.light.altRespBg; fg = THEME_COLORS.light.altRespText; }
  // respect theme
  const themedBg = kind === "Reading" ? COLORS.readingBadgeBg : kind === "Alternate Response" ? COLORS.altRespBg : COLORS.timeBadgeBg;
  const themedFg = kind === "Reading" ? COLORS.readingBadgeText : kind === "Alternate Response" ? COLORS.altRespText : COLORS.timeBadgeText;
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
        backgroundColor: themedBg,
        color: themedFg,
      }}
    >
      {kind}
    </span>
  );
};

const StudentCard: React.FC<{
  s: StudentSummary;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  COLORS: typeof THEME_COLORS.light;
}> = ({ s, onView, COLORS }) => {
  const pct = typeof s.alignment_pct === "number" ? Math.max(0, Math.min(100, s.alignment_pct)) : null;
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
            width: 64, height: 64, borderRadius: "50%", backgroundColor: COLORS.avatarBg,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          aria-hidden
        >
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={COLORS.mainText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21a8 8 0 0 0-16 0" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: COLORS.mainText, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
            {s.name}
          </div>
          <div style={{ color: COLORS.mutedText, fontSize: 13 }}>
            {s.grade ? `Grade ${s.grade}` : "—"} {s.teacher ? `• ${s.teacher}` : ""}
          </div>
        </div>
        <div
          style={{
            width: 64, height: 64, borderRadius: "50%",
            background: pct != null ? `conic-gradient(${COLORS.pieGradientStart} ${deg}deg, ${COLORS.pieEmpty} ${deg}deg)` : COLORS.pieEmpty,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 40, height: 40, borderRadius: "50%", background: COLORS.surface,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 13, color: COLORS.mainText, border: `1px solid ${COLORS.border}`,
            }}
          >
            {pct != null ? `${pct}%` : "—"}
          </div>
        </div>
      </div>
      {!!s.badges?.length && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {s.badges.map((b) => <Badge key={b} kind={b} COLORS={COLORS} />)}
        </div>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          style={{
            flex: 1, padding: "10px 0", borderRadius: 12, border: `1px solid ${COLORS.border}`,
            background: "transparent", color: COLORS.mainText, fontWeight: 650, cursor: "pointer",
          }}
          onClick={() => onView(s.id)}
        >
          Open
        </button>
        <button
          style={{
            flex: 1, padding: "10px 0", borderRadius: 12, border: "none",
            background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
            color: "white", fontWeight: 650, cursor: "pointer",
          }}
          onClick={() =>
            alert("reports: quick-generate/view for this student (coming soon)")
          }
        >
          Reports
        </button>
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────────
// Main Page
// ───────────────────────────────────────────────────────────────────────────────

export default function StudentsPage() {
  const isDark = useIsDark();
  const COLORS = useMemo(() => (isDark ? THEME_COLORS.dark : THEME_COLORS.light), [isDark]);

  const [all, setAll] = useState<StudentSummary[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  // profile modal
  const [modalOpen, setModalOpen] = useState(false);
  const [active, setActive] = useState<StudentFull | null>(null);
  const [tab, setTab] = useState<"profile" | "goals" | "accom" | "notes" | "people">("profile");

  // generate report modal
  const [showModal, setShowModal] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [unitsDropdownOpen, setUnitsDropdownOpen] = useState(false);

  // alignment result state
  const [alignResult, setAlignResult] = useState<IEPAlignResponse | null>(null);
  const [showRaw, setShowRaw] = useState(false);

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
        if (!allUnits.includes(unit)) allUnits.push(unit);
      });
    });
    return allUnits;
  }, [curriculum, selectedCourses]);

  async function load() {
    setBusy(true);
    try {
      const list = await apiGet<StudentSummary[]>("/students");
      setAll(list);
      const curriculumData = await apiGet<Curriculum>("/curriculum");
      setCurriculum(curriculumData);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { setSelectedUnits([]); }, [selectedCourses]);

  const generateDisabled =
    isGenerating || !selectedStudents.length || !selectedCourses.length || !selectedUnits.length;

  async function handleGenerate() {
    setIsGenerating(true);
    setAlignResult(null);
    try {
      const payload = {
        student_ids: selectedStudents,
        courses: selectedCourses,
        units: selectedUnits,
      };
      const res = await apiPost<IEPAlignResponse>("/align/iep-selected", payload);
      setAlignResult(res);
    } catch (e) {
      console.error("alignment failed", e);
      setAlignResult(null);
      alert("Alignment failed. Check server logs.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function openView(id: string) {
    try {
      const data = await apiGet<StudentFull>(`/students/${id}`);
      setActive(data);
      setTab("profile");
      setModalOpen(true);
    } catch (err) {
      console.error("failed to load student", err);
      alert("unable to load student profile.");
    }
  }

  const openEdit = openView;

  function mutateActive(path: string[], value: any) {
    if (!active) return;
    const next: StudentFull = JSON.parse(JSON.stringify(active));
    if (!next.data) next.data = {};
    let node = next.data;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (typeof node[key] !== "object" || node[key] === null) node[key] = {};
      node = node[key];
    }
    node[path[path.length - 1]] = value;
    setActive(next);
  }

  async function saveActive() {
    if (!active) return;
    const src = active.data || {};
    const payload: any = {};
    if (src.student) payload.student = src.student;
    if (src.education_goals) payload.education_goals = src.education_goals;
    if (src.accommodations) payload.accommodations = src.accommodations;
    if (typeof src.performance_progress === "string") payload.performance_progress = src.performance_progress;
    if (typeof src.assessments === "string") payload.assessments = src.assessments;
    if (typeof src.transition_goals === "string") payload.transition_goals = src.transition_goals;
    if (Array.isArray(src.participants)) payload.participants = src.participants;
    if (typeof src.alignment_pct === "number") payload.alignment_pct = src.alignment_pct;

    const saved = await apiPut<StudentFull>(`/students/${active.id}`, payload);
    setActive(saved);
    await load();
  }

  function addParticipant() {
    if (!active) return;
    const arr = Array.isArray(active.data?.participants) ? [...active.data.participants] : [];
    arr.push({ name: "", role: "" });
    setActive({ ...active, data: { ...active.data, participants: arr } });
  }

  function removeParticipant(index: number) {
    if (!active) return;
    const arr = Array.isArray(active.data?.participants) ? [...active.data.participants] : [];
    arr.splice(index, 1);
    setActive({ ...active, data: { ...active.data, participants: arr } });
  }

  // ── alignment helpers
  function avg(nums: number[]) {
    if (!nums.length) return 0;
    const s = nums.reduce((a, b) => a + b, 0);
    return Math.round((s / nums.length) * 100) / 100;
  }

  function computeOverallMean(res: IEPAlignResponse | null): number {
    if (!res) return 0;
    const m = res.matrix.matrix;
    const flat = m.flat();
    return avg(flat);
  }

  function bucketCounts(res: IEPAlignResponse | null) {
    // ▲ good ≥80, ■ at-risk 50–79, ● gap <50
    const out = { good: 0, warn: 0, bad: 0, total: 0 };
    if (!res) return out;
    for (const row of res.matrix.matrix) {
      for (const v of row) {
        out.total++;
        if (v >= 80) out.good++;
        else if (v >= 50) out.warn++;
        else out.bad++;
      }
    }
    return out;
  }

  function bestWorst<T extends string>(labels: T[], values: number[]) {
    if (!labels.length || !values.length || labels.length !== values.length) return { best: null as null | { label: T; val: number }, worst: null as null | { label: T; val: number } };
    let bi = 0, wi = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[bi]) bi = i;
      if (values[i] < values[wi]) wi = i;
    }
    return { best: { label: labels[bi], val: values[bi] }, worst: { label: labels[wi], val: values[wi] } };
  }

  // ───────── render ─────────
  return (
    <div style={{ padding: 24 }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 4, color: COLORS.mainText }}>Students</h1>
          <div style={{ color: COLORS.mutedText }}>Manage profiles and IEP details</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search students…"
            style={{
              padding: "8px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`,
              minWidth: 220, background: COLORS.surface, color: COLORS.mainText,
            }}
          />
          <button
            onClick={load}
            disabled={busy}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: `1px solid ${COLORS.buttonGradientEnd}`,
              background: "transparent",
              color: COLORS.buttonGradientEnd,
              cursor: "pointer",
              fontWeight: 600,
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "refreshing…" : "Refresh"}
          </button>
          <button
            onClick={() => { setShowModal(true); setAlignResult(null); }}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
              color: THEME_COLORS.light.surface,
              fontWeight: 650,
            }}
          >
            Generate
          </button>
        </div>
      </div>

      {/* grid of students */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        {filtered.map((s) => (
          <StudentCard key={s.id} s={s} onView={openView} onEdit={openEdit} COLORS={COLORS} />
        ))}
      </div>

      {/* Generate Alignment Modal */}
      <ModalShell open={showModal} onClose={() => !isGenerating && setShowModal(false)} COLORS={COLORS} width="min(100%, 1000px)" height="86vh">
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18, height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: COLORS.mainText, margin: 0 }}>Generate alignment</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={isGenerating}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: `1px solid ${COLORS.border}`,
                  background: "transparent",
                  color: COLORS.mainText,
                  cursor: isGenerating ? "default" : "pointer",
                  opacity: isGenerating ? 0.6 : 1,
                }}
              >
                Close
              </button>
              <button
                onClick={handleGenerate}
                disabled={
                  isGenerating ||
                  !selectedStudents.length ||
                  !selectedCourses.length ||
                  !selectedUnits.length
                }
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
                  color: "white",
                  fontWeight: 700,
                  border: "none",
                  cursor:
                    isGenerating ||
                    !selectedStudents.length ||
                    !selectedCourses.length ||
                    !selectedUnits.length
                      ? "default"
                      : "pointer",
                  opacity:
                    isGenerating ||
                    !selectedStudents.length ||
                    !selectedCourses.length ||
                    !selectedUnits.length
                      ? 0.6
                      : 1,
                }}
              >
                {isGenerating ? "generating…" : "Generate"}
              </button>
            </div>
          </div>

          {/* selectors & status + results */}
          <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16, minHeight: 0, flex: "1 1 auto" }}>
            {/* left column: selectors */}
            <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
                <button
                  type="button"
                  onClick={() => setSelectedStudents(all.map((s) => s.id))}
                  style={{
                    fontSize: 12, padding: "4px 8px", borderRadius: 6,
                    border: `1px solid ${COLORS.border}`, background: COLORS.surface,
                    color: COLORS.mainText, cursor: "pointer",
                  }}
                >
                  Select all students
                </button>
              </div>
              <AutocompleteMulti
                label="select students"
                options={all.map((s) => ({ value: s.id, label: s.name }))}
                selected={selectedStudents}
                onChange={setSelectedStudents}
                COLORS={COLORS}
              />
              <AutocompleteMulti
                label="select courses"
                options={Object.keys(curriculum?.courses || {}).map((c) => ({ value: c, label: c }))}
                selected={selectedCourses}
                onChange={(v) => { setSelectedCourses(v); setSelectedUnits([]); }}
                COLORS={COLORS}
              />

              {/* units chooser */}
              {selectedCourses.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 14, fontWeight: 600, color: COLORS.mainText }}>
                    Select units
                  </label>
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => setUnitsDropdownOpen(!unitsDropdownOpen)}
                      ref={unitsButtonRef}
                      style={{
                        width: "100%", padding: "10px 12px", borderRadius: 8,
                        border: `1px solid ${COLORS.border}`, backgroundColor: COLORS.surface,
                        color: COLORS.mainText, textAlign: "left", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                      }}
                    >
                      <span>
                        {selectedUnits.length === 0
                          ? "select units..."
                          : `${selectedUnits.length} unit${selectedUnits.length !== 1 ? "s" : ""} selected`}
                      </span>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: unitsDropdownOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>
                        <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {unitsDropdownOpen && (
                      <div
                        style={{
                          position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
                          border: `1px solid ${COLORS.border}`, borderRadius: 8, backgroundColor: COLORS.surface,
                          maxHeight: 220, overflowY: "auto", zIndex: 100, boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                      >
                        {units.map((u) => {
                          const isSelected = selectedUnits.includes(u);
                          return (
                            <div
                              key={u}
                              onClick={() => {
                                if (isSelected) setSelectedUnits(selectedUnits.filter((x) => x !== u));
                                else setSelectedUnits([...selectedUnits, u]);
                              }}
                              style={{
                                padding: "10px 12px", cursor: "pointer", borderBottom: `1px solid ${COLORS.border}`,
                                backgroundColor: isSelected ? COLORS.altRespBg : "transparent",
                                color: isSelected ? COLORS.altRespText : COLORS.mainText,
                                fontWeight: isSelected ? 600 : 400, display: "flex", alignItems: "center", gap: 10,
                                transition: "all 0.15s ease",
                              }}
                              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = COLORS.hoverSurface; }}
                              onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
                            >
                              <div
                                style={{
                                  width: 18, height: 18, borderRadius: 4,
                                  border: `2px solid ${isSelected ? COLORS.altRespText : COLORS.border}`,
                                  backgroundColor: isSelected ? COLORS.altRespText : "transparent",
                                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                }}
                              >
                                {isSelected && (
                                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

                  {!!selectedUnits.length && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                      {selectedUnits.map((u) => (
                        <div
                          key={u}
                          style={{
                            display: "flex", alignItems: "center",
                            background: COLORS.altRespBg, color: COLORS.altRespText,
                            borderRadius: 12, padding: "6px 10px", fontWeight: 600, fontSize: 13,
                          }}
                        >
                          {u}
                          <span
                            onClick={() => setSelectedUnits(selectedUnits.filter((x) => x !== u))}
                            style={{ marginLeft: 8, cursor: "pointer", fontWeight: 800, lineHeight: 1 }}
                          >
                            ×
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* generating status */}
              {isGenerating && (
                <div
                  style={{
                    padding: 16, borderRadius: 12,
                    background: "linear-gradient(135deg, rgba(167, 139, 250, 0.1), rgba(236, 72, 153, 0.1))",
                    border: `1px solid ${COLORS.altRespBg}`, display: "flex", alignItems: "center", gap: 12,
                  }}
                >
                  <Spinner size={24} COLORS={COLORS} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: COLORS.mainText, marginBottom: 4 }}>Generating your alignment…</div>
                    <div style={{ fontSize: 13, color: COLORS.mutedText }}>This runs locally. You can continue working.</div>
                  </div>
                </div>
              )}
            </div>

            {/* right column: results */}
            <div
              style={{
                border: `1px solid ${COLORS.border}`, borderRadius: 12, background: COLORS.surface,
                display: "flex", flexDirection: "column", minHeight: 0,
              }}
            >
              <div style={{ padding: 14, borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 800, color: COLORS.mainText }}>Alignment Result</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setShowRaw(true)}
                    disabled={!alignResult}
                    style={{
                      padding: "8px 10px", borderRadius: 10, border: `1px solid ${COLORS.border}`,
                      background: "transparent", color: COLORS.mainText, cursor: alignResult ? "pointer" : "default",
                      opacity: alignResult ? 1 : 0.5,
                    }}
                  >
                    View raw JSON
                  </button>
                </div>
              </div>

              {/* content */}
              <div style={{ padding: 14, overflow: "auto", display: "grid", gap: 12 }}>
                {!alignResult && !isGenerating && (
                  <div style={{ color: COLORS.mutedText, fontSize: 14 }}>
                    Select students, courses, and units, then click <b>Generate</b> to see results here.
                  </div>
                )}

                {alignResult && (
                  <>
                    {/* quick stats */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
                        gap: 10,
                      }}
                    >
                      {(() => {
                        const overall = computeOverallMean(alignResult);
                        const buckets = bucketCounts(alignResult);
                        const students = alignResult.matrix.students;
                        const worksheets = alignResult.matrix.worksheets;
                        const ca = alignResult.column_averages || [];
                        const ra = alignResult.row_averages || [];
                        const sbw = bestWorst(students, ca);
                        const wbw = bestWorst(worksheets, ra);

                        const Stat = ({
                          label,
                          value,
                          sub,
                        }: { label: string; value: string; sub?: string }) => (
                          <div
                            style={{
                              border: `1px solid ${COLORS.border}`,
                              borderRadius: 10,
                              padding: 12,
                              display: "grid",
                              gap: 6,
                              background: COLORS.surface,
                            }}
                          >
                            <div style={{ fontSize: 12, color: COLORS.mutedText }}>{label}</div>
                            <div style={{ fontWeight: 900, color: COLORS.mainText, fontSize: 18 }}>{value}</div>
                            {sub && <div style={{ fontSize: 12, color: COLORS.mutedText }}>{sub}</div>}
                          </div>
                        );

                        return (
                          <>
                            <Stat label="Students" value={String(students.length)} />
                            <Stat label="Worksheets" value={String(worksheets.length)} />
                            <Stat label="Overall mean" value={`${overall}%`} />
                            <Stat
                              label="Distribution"
                              value={`▲ ${buckets.good}  •  ■ ${buckets.warn}  •  ● ${buckets.bad}`}
                              sub={`${buckets.total} total`}
                            />
                            <Stat
                              label="Best student"
                              value={sbw.best ? `${sbw.best.label}` : "—"}
                              sub={sbw.best ? `${sbw.best.val}%` : undefined}
                            />
                            <Stat
                              label="Needs attention (student)"
                              value={sbw.worst ? `${sbw.worst.label}` : "—"}
                              sub={sbw.worst ? `${sbw.worst.val}%` : undefined}
                            />
                            <Stat
                              label="Best worksheet"
                              value={wbw.best ? `${wbw.best.label}` : "—"}
                              sub={wbw.best ? `${wbw.best.val}%` : undefined}
                            />
                            <Stat
                              label="Needs attention (worksheet)"
                              value={wbw.worst ? `${wbw.worst.label}` : "—"}
                              sub={wbw.worst ? `${wbw.worst.val}%` : undefined}
                            />
                          </>
                        );
                      })()}
                    </div>

                    {/* matrix preview (compact) */}
                    <div
                      style={{
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 10,
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, fontWeight: 800, color: COLORS.mainText }}>
                        Group Fit Matrix (sample)
                      </div>
                      <div style={{ overflow: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.mutedText }}>Worksheet ▸</th>
                              {alignResult.matrix.students.map((st) => (
                                <th key={st} style={{ textAlign: "right", padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.mutedText }}>
                                  {st}
                                </th>
                              ))}
                              {!!alignResult.row_averages?.length && (
                                <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.mutedText }}>avg</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {alignResult.matrix.worksheets.slice(0, 10).map((w, ri) => {
                              const row = alignResult.matrix.matrix[ri] || [];
                              const ravg = alignResult.row_averages?.[ri];
                              return (
                                <tr key={w}>
                                  <td style={{ padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.mainText, fontWeight: 600 }}>{w}</td>
                                  {row.map((v, ci) => {
                                    const bg =
                                      v >= 80 ? "rgba(34,197,94,.14)" :
                                      v >= 50 ? "rgba(245,158,11,.14)" :
                                      "rgba(239,68,68,.14)";
                                    const fg = COLORS.mainText;
                                    return (
                                      <td key={ci} style={{ textAlign: "right", padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}`, background: bg, color: fg }}>
                                        {v}
                                      </td>
                                    );
                                  })}
                                  {ravg != null && (
                                    <td style={{ textAlign: "right", padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}`, fontWeight: 800 }}>
                                      {ravg}%
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                          {!!alignResult.column_averages?.length && (
                            <tfoot>
                              <tr>
                                <td style={{ padding: "8px 10px", borderTop: `1px solid ${COLORS.border}`, fontWeight: 800 }}>avg</td>
                                {alignResult.column_averages.map((c, i) => (
                                  <td key={i} style={{ textAlign: "right", padding: "8px 10px", borderTop: `1px solid ${COLORS.border}`, fontWeight: 800 }}>
                                    {c}%
                                  </td>
                                ))}
                                <td />
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                      {alignResult.matrix.worksheets.length > 10 && (
                        <div style={{ padding: 8, fontSize: 12, color: COLORS.mutedText }}>
                          Showing first 10 worksheets. View raw JSON for full detail.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </ModalShell>

      {/* Raw JSON Viewer */}
      <ModalShell
        open={!!showRaw}
        onClose={() => setShowRaw(false)}
        COLORS={COLORS}
        width="min(100%, 900px)"
        height="80vh"
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div style={{ padding: 14, borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 900, color: COLORS.mainText }}>Raw Alignment JSON</div>
            <button
              onClick={() => setShowRaw(false)}
              style={{
                padding: "8px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`,
                background: "transparent", color: COLORS.mainText, cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
          <div style={{ flex: "1 1 auto", overflow: "auto", padding: 14 }}>
            <pre
              style={{
                margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word",
                color: COLORS.mainText,
              }}
            >
{JSON.stringify(alignResult ?? {}, null, 2)}
            </pre>
          </div>
        </div>
      </ModalShell>

      {/* Student Profile Modal */}
      <ModalShell
        open={!!(modalOpen && active)}
        onClose={() => setModalOpen(false)}
        COLORS={COLORS}
        width="min(100%, 980px)"
        height="82vh"
      >
        {/* header */}
        <div
          style={{
            padding: 18,
            borderBottom: `1px solid ${COLORS.border}`,
            flex: "0 0 auto",
            background: "transparent",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 20, color: COLORS.mainText }}>
                {active?.data?.student?.student_name || active?.id}
              </div>
              <div style={{ color: COLORS.mutedText, fontSize: 13 }}>
                {active?.data?.student?.grade ? `grade ${active.data.student.grade}` : "—"}
                {active?.data?.student?.teacher && ` • ${active.data.student.teacher}`}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setModalOpen(false)}
                style={{
                  padding: "10px 14px", borderRadius: 10, border: `1px solid ${COLORS.border}`,
                  background: "transparent", color: COLORS.mainText, cursor: "pointer",
                }}
              >
                Close
              </button>
              <button
                onClick={saveActive}
                style={{
                  padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
                  color: "#fff", fontWeight: 800,
                }}
              >
                Save
              </button>
            </div>
          </div>

          {/* tabs */}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {["profile", "goals", "accom", "notes", "people"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t as any)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: `1px solid ${tab === t ? COLORS.buttonGradientEnd : COLORS.border}`,
                  background: tab === t ? "rgba(236,72,153,.08)" : "transparent",
                  color: tab === t ? COLORS.buttonGradientEnd : COLORS.mainText,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {t === "profile"
                  ? "Profile"
                  : t === "goals"
                  ? "IEP goals"
                  : t === "accom"
                  ? "Accommodations"
                  : t === "notes"
                  ? "Notes & assessments"
                  : "Participants"}
              </button>
            ))}
          </div>
        </div>

        {/* scrollable content */}
        <div
          style={{
            padding: 18,
            overflow: "auto",
            flex: "1 1 auto",
            background: "transparent",
            color: COLORS.mainText,
          }}
        >
          {tab === "profile" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <SectionCard title="Student" COLORS={COLORS}>
                <Field
                  label="name"
                  value={active?.data?.student?.student_name || ""}
                  onChange={(v) => mutateActive(["student", "student_name"], v)}
                  COLORS={COLORS}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field
                    label="grade"
                    value={active?.data?.student?.grade || ""}
                    onChange={(v) => mutateActive(["student", "grade"], v)}
                    COLORS={COLORS}
                  />
                  <Field
                    label="date of birth (dd/mm/yyyy)"
                    value={active?.data?.student?.date_of_birth || ""}
                    onChange={(v) => mutateActive(["student", "date_of_birth"], v)}
                    COLORS={COLORS}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field
                    label="teacher"
                    value={active?.data?.student?.teacher || ""}
                    onChange={(v) => mutateActive(["student", "teacher"], v)}
                    COLORS={COLORS}
                  />
                  <Field
                    label="school"
                    value={active?.data?.student?.school || ""}
                    onChange={(v) => mutateActive(["student", "school"], v)}
                    COLORS={COLORS}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field
                    label="pen"
                    value={active?.data?.student?.pen || ""}
                    onChange={(v) => mutateActive(["student", "pen"], v)}
                    COLORS={COLORS}
                  />
                  <Field
                    label="IEP date (dd/mm/yyyy)"
                    value={active?.data?.student?.iep_date || ""}
                    onChange={(v) => mutateActive(["student", "iep_date"], v)}
                    COLORS={COLORS}
                  />
                </div>
                <Field
                  label="designation"
                  value={active?.data?.student?.designation || ""}
                  onChange={(v) => mutateActive(["student", "designation"], v)}
                  COLORS={COLORS}
                />
                <Field
                  label="alignment % (optional)"
                  value={active?.data?.alignment_pct != null ? String(active.data.alignment_pct) : ""}
                  onChange={(v) => {
                    const trimmed = v.trim();
                    const num = trimmed === "" ? null : Number(trimmed);
                    mutateActive(["alignment_pct"], Number.isNaN(num) ? null : num);
                  }}
                  COLORS={COLORS}
                />
              </SectionCard>

              <SectionCard title="Performance progress" COLORS={COLORS}>
                <Field
                  textarea
                  label="summary"
                  value={active?.data?.performance_progress || ""}
                  onChange={(v) => mutateActive(["performance_progress"], v)}
                  COLORS={COLORS}
                />
              </SectionCard>
            </div>
          )}

          {tab === "goals" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <SectionCard title="Academic" COLORS={COLORS}>
                <Field textarea label="goal" value={active?.data?.education_goals?.academic || ""} onChange={(v) => mutateActive(["education_goals", "academic"], v)} COLORS={COLORS} />
              </SectionCard>
              <SectionCard title="Social" COLORS={COLORS}>
                <Field textarea label="goal" value={active?.data?.education_goals?.social || ""} onChange={(v) => mutateActive(["education_goals", "social"], v)} COLORS={COLORS} />
              </SectionCard>
              <SectionCard title="Behavioural" COLORS={COLORS}>
                <Field textarea label="goal" value={active?.data?.education_goals?.behavioural || ""} onChange={(v) => mutateActive(["education_goals", "behavioural"], v)} COLORS={COLORS} />
              </SectionCard>
              <SectionCard title="Communicative" COLORS={COLORS}>
                <Field textarea label="goal" value={active?.data?.education_goals?.communicative || ""} onChange={(v) => mutateActive(["education_goals", "communicative"], v)} COLORS={COLORS} />
              </SectionCard>
              <SectionCard title="Physical" COLORS={COLORS}>
                <Field textarea label="needs" value={active?.data?.education_goals?.physical || ""} onChange={(v) => mutateActive(["education_goals", "physical"], v)} COLORS={COLORS} />
              </SectionCard>
            </div>
          )}

          {tab === "accom" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <SectionCard title="Instructional" COLORS={COLORS}>
                <Field textarea label="supports" value={active?.data?.accommodations?.instructional || ""} onChange={(v) => mutateActive(["accommodations", "instructional"], v)} COLORS={COLORS} />
              </SectionCard>
              <SectionCard title="Environmental" COLORS={COLORS}>
                <Field textarea label="supports" value={active?.data?.accommodations?.environmental || ""} onChange={(v) => mutateActive(["accommodations", "environmental"], v)} COLORS={COLORS} />
              </SectionCard>
              <SectionCard title="Assessment" COLORS={COLORS}>
                <Field textarea label="supports" value={active?.data?.accommodations?.assessment || ""} onChange={(v) => mutateActive(["accommodations", "assessment"], v)} COLORS={COLORS} />
              </SectionCard>
              <SectionCard title="Technology" COLORS={COLORS}>
                <Field textarea label="tools" value={active?.data?.accommodations?.technology || ""} onChange={(v) => mutateActive(["accommodations", "technology"], v)} COLORS={COLORS} />
              </SectionCard>
            </div>
          )}

          {tab === "notes" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <SectionCard title="Assessments" COLORS={COLORS}>
                <Field textarea label="notes" value={active?.data?.assessments || ""} onChange={(v) => mutateActive(["assessments"], v)} COLORS={COLORS} />
              </SectionCard>
              <SectionCard title="Transition Goals" COLORS={COLORS}>
                <Field textarea label="goals" value={active?.data?.transition_goals || ""} onChange={(v) => mutateActive(["transition_goals"], v)} COLORS={COLORS} />
              </SectionCard>
            </div>
          )}

          {tab === "people" && (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 800, color: COLORS.mainText }}>Participants</div>
                <button
                  onClick={addParticipant}
                  style={{
                    padding: "8px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`,
                    background: "transparent", color: COLORS.mainText, cursor: "pointer",
                  }}
                >
                  Add
                </button>
              </div>
              {(active?.data?.participants || []).map((p: any, i: number) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
                  <Field
                    label="name"
                    value={p.name || ""}
                    onChange={(v) => {
                      if (!active) return;
                      const arr = [...(active.data.participants || [])];
                      arr[i] = { ...arr[i], name: v };
                      setActive({ ...active, data: { ...active.data, participants: arr } });
                    }}
                    COLORS={COLORS}
                  />
                  <Field
                    label="role"
                    value={p.role || ""}
                    onChange={(v) => {
                      if (!active) return;
                      const arr = [...(active.data.participants || [])];
                      arr[i] = { ...arr[i], role: v };
                      setActive({ ...active, data: { ...active.data, participants: arr } });
                    }}
                    COLORS={COLORS}
                  />
                  <button
                    onClick={() => removeParticipant(i)}
                    style={{
                      height: 40, marginBottom: 2, borderRadius: 10, border: "none",
                      background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {!active?.data?.participants?.length && (
                <div style={{ color: COLORS.mutedText, fontSize: 13 }}>No participants yet.</div>
              )}
            </div>
          )}
        </div>
      </ModalShell>
    </div>
  );
}
