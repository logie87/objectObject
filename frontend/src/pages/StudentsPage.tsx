// pages/StudentsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPut } from "../lib/api";
import { useJobCenter } from "../components/jobs/JobCenter";

// ==== colors & themes unchanged ====
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
    avatarBg: "#0f172a",
    border: "#334155",
    surface: "#0b1324",
    hoverSurface: "#111827",
    overlayBg: "rgba(0,0,0,.55)",
    modalShadow: "0 24px 80px rgba(0,0,0,.55)",
  },
};

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
      root.getAttribute("data-theme") === "dark" || root.classList.contains("dark");
    const obs = new MutationObserver(() => setIsDark(get()));
    obs.observe(root, { attributes: true, attributeFilter: ["data-theme", "class"] });
    const onStorage = (e: StorageEvent) => { if (e.key === "theme") setIsDark(get()); };
    window.addEventListener("storage", onStorage);
    const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onMql = () => setIsDark(get());
    mql?.addEventListener?.("change", onMql);
    setIsDark(get());
    return () => { obs.disconnect(); window.removeEventListener("storage", onStorage); mql?.removeEventListener?.("change", onMql); };
  }, []);
  return isDark;
}

// ===== types =====
type StudentSummary = {
  id: string;
  name: string;
  grade?: string | null;
  teacher?: string | null;
  alignment_pct?: number | null;
  badges: string[];
};
type StudentFull = { id: string; data: any; };
type Resource = {
  name: string; filename: string; path: string; size: number;
  uploaded_at: string; fit: { mean: number; spread: number; status: string }; issues?: string[];
};
type Curriculum = { courses: Record<string, Record<string, Resource[]>> };

// ===== UI atoms (Badge/Spinner/Field/SectionCard) from your original page unchanged =====
const Badge: React.FC<{ kind: string; COLORS: typeof THEME_COLORS.light }> = ({ kind, COLORS }) => {
  let bg = COLORS.timeBadgeBg, fg = COLORS.timeBadgeText;
  if (kind === "Reading") { bg = COLORS.readingBadgeBg; fg = COLORS.readingBadgeText; }
  if (kind === "Alternate Response") { bg = COLORS.altRespBg; fg = COLORS.altRespText; }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px",
      borderRadius: 12, fontSize: 12, fontWeight: 600, backgroundColor: bg, color: fg
    }}>
      {kind}
    </span>
  );
};
const Spinner: React.FC<{ size?: number; COLORS: typeof THEME_COLORS.light }> = ({ size = 40, COLORS }) => (
  <svg width={size} height={size} viewBox="0 0 50 50" aria-hidden role="img" style={{ display: "block" }}>
    <circle cx="25" cy="25" r="20" fill="none" stroke={COLORS.spinnerTrack} strokeWidth="6" strokeLinecap="round"/>
    <path d="M25 5 a20 20 0 0 1 0 40" fill="none" stroke={COLORS.spinnerArc} strokeWidth="6" strokeLinecap="round">
      <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.9s" repeatCount="indefinite"/>
    </path>
  </svg>
);
const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; textarea?: boolean; COLORS: typeof THEME_COLORS.light; }> =
({ label, value, onChange, textarea, COLORS }) => (
  <label style={{ display: "grid", gap: 6 }}>
    <span style={{ fontSize: 12, color: COLORS.mutedText }}>{label}</span>
    {textarea ? (
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4}
        style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`, resize: "vertical",
                 background: COLORS.surface, color: COLORS.mainText }}/>
    ) : (
      <input value={value} onChange={(e) => onChange(e.target.value)}
        style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`,
                 background: COLORS.surface, color: COLORS.mainText }}/>
    )}
  </label>
);
const SectionCard: React.FC<{ title: string; children: React.ReactNode; COLORS: typeof THEME_COLORS.light }> =
({ title, children, COLORS }) => (
  <div style={{ padding: 16, borderRadius: 14, border: `1px solid ${COLORS.border}`, background: COLORS.surface, display: "grid", gap: 12 }}>
    <div style={{ fontWeight: 800, color: COLORS.mainText }}>{title}</div>
    {children}
  </div>
);

// ===== ModalShell: add a real Close button always enabled =====
const ModalShell: React.FC<{
  open: boolean; onClose: () => void; children: React.ReactNode;
  COLORS: typeof THEME_COLORS.light; width?: string; height?: string;
}> = ({ open, onClose, children, COLORS, width = "min(100%, 980px)", height = "82vh" }) => {
  const [shouldRender, setShouldRender] = React.useState(open);
  const [visible, setVisible] = React.useState(open);
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const dialogRef  = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (open) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        setVisible(true);
        overlayRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease-out" });
        dialogRef.current?.animate(
          [{ transform: "translateY(18px) scale(.985)", opacity: 0 }, { transform: "translateY(0) scale(1)", opacity: 1 }],
          { duration: 200, easing: "cubic-bezier(.22,.61,.36,1)" }
        );
      });
    } else {
      setVisible(false);
    }
  }, [open]);

  const handleDialogTransitionEnd = () => {
    if (!visible) setShouldRender(false);
  };
  if (!shouldRender) return null;

  return (
    <div
      ref={overlayRef}
      onClick={() => onClose()}
      style={{
        position: "fixed", inset: 0, background: COLORS.overlayBg, transition: "opacity 180ms ease",
        opacity: visible ? 1 : 0, display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1100, pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        onTransitionEnd={handleDialogTransitionEnd}
        style={{
          width, ...(height ? { height } : {}), transform: visible ? "translateY(0) scale(1)" : "translateY(12px) scale(.98)",
          opacity: visible ? 1 : 0, transition: "transform 200ms cubic-bezier(.22,.61,.36,1), opacity 200ms ease",
          background: COLORS.surface, borderRadius: 16, boxShadow: COLORS.modalShadow, border: `1px solid ${COLORS.border}`,
          display: "flex", flexDirection: "column", position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ===== AutocompleteMulti (unchanged UI) =====
const AutocompleteMulti: React.FC<{
  label: string; options: { value: string; label: string }[];
  selected: string[]; onChange: (v: string[]) => void;
  COLORS: typeof THEME_COLORS.light; onEnter?: () => void; inputRef?: React.RefObject<HTMLInputElement>;
}> = ({ label, options, selected, onChange, COLORS, onEnter, inputRef }) => {
  const [q, setQ] = useState("");
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 14, fontWeight: 600, color: COLORS.mainText }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          type="text"
          placeholder={`type to search ${label.toLowerCase()}…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            const match = options.find((o) => o.label.toLowerCase() === q.toLowerCase());
            if (e.key === "Enter") {
              if (match) {
                if (!selected.includes(match.value)) onChange([...selected, match.value]);
                setQ("");
              } else if (selected.length > 0 && onEnter) {
                onEnter();
              }
            }
          }}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`,
            background: COLORS.surface, color: COLORS.mainText,
          }}
        />
        {q && (
          <div
            style={{
              position: "absolute", top: "100%", left: 0, right: 0,
              background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8,
              boxShadow: "0 4px 10px rgba(0,0,0,0.1)", maxHeight: 160, overflowY: "auto", zIndex: 100,
            }}
          >
            {filtered.length ? (
              filtered.slice(0, 6).map((o) => (
                <div
                  key={o.value}
                  onClick={() => {
                    if (!selected.includes(o.value)) onChange([...selected, o.value]);
                    setQ("");
                  }}
                  style={{
                    padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${COLORS.border}`,
                    color: COLORS.mainText,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.hoverSurface; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  {o.label}
                </div>
              ))
            ) : (
              <div style={{ padding: "8px 12px", color: COLORS.mutedText }}>No match</div>
            )}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
        {selected.map((val) => {
          const opt = options.find((o) => o.value === val);
          return (
            <div key={val} style={{ display: "flex", alignItems: "center", background: COLORS.altRespBg, color: COLORS.altRespText, borderRadius: 12, padding: "6px 10px", fontWeight: 600 }}>
              {opt?.label || val}
              <span onClick={() => onChange(selected.filter((x) => x !== val))}
                style={{ marginLeft: 8, cursor: "pointer", fontWeight: 800, lineHeight: 1 }}>×</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ===== Student card (unchanged visually; uses COLORS prop) =====
const StudentCard: React.FC<{
  s: StudentSummary; onView: (id: string) => void; onEdit: (id: string) => void; COLORS: typeof THEME_COLORS.light;
}> = ({ s, onView, COLORS }) => {
  const pct = typeof s.alignment_pct === "number" ? Math.max(0, Math.min(100, s.alignment_pct)) : null;
  const deg = pct != null ? pct * 3.6 : 0;
  return (
    <div style={{ padding: 24, borderRadius: 16, backgroundColor: COLORS.surface, boxShadow: COLORS.cardShadow,
                  display: "flex", flexDirection: "column", gap: 18, border: `1px solid ${COLORS.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", backgroundColor: COLORS.avatarBg,
                      display: "flex", alignItems: "center", justifyContent: "center" }} aria-hidden>
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
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: pct != null ? `conic-gradient(${THEME_COLORS.light.pieGradientStart} ${deg}deg, ${THEME_COLORS.light.pieEmpty} ${deg}deg)` : THEME_COLORS.light.pieEmpty,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%", background: THEME_COLORS.light.surface,
            display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13,
            color: COLORS.mainText, border: `1px solid ${COLORS.border}`,
          }}>
            {pct != null ? `${pct}%` : "—"}
          </div>
        </div>
      </div>
      {!!s.badges?.length && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {s.badges.map((b) => (<Badge key={b} kind={b} COLORS={COLORS} />))}
        </div>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.mainText, fontWeight: 650, cursor: "pointer" }}
          onClick={() => onView(s.id)}
        >
          Open
        </button>
        <button
          style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "none",
                   background: `linear-gradient(135deg, ${THEME_COLORS.light.buttonGradientStart}, ${THEME_COLORS.light.buttonGradientEnd})`,
                   color: "white", fontWeight: 650, cursor: "pointer" }}
          onClick={() => {
            const q = `${s.name}`;
            const url = `/app/reports?q=${encodeURIComponent(q)}`;
            window.location.assign(url);
          }}
        >
          Reports
        </button>
      </div>
    </div>
  );
};


// ===== Page =====
export default function StudentsPage() {
  const isDark = useIsDark();
  const COLORS = useMemo(() => (isDark ? THEME_COLORS.dark : THEME_COLORS.light), [isDark]);

  const [all, setAll] = useState<StudentSummary[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  // detail modal
  const [modalOpen, setModalOpen] = useState(false);
  const [active, setActive] = useState<StudentFull | null>(null);
  const [tab, setTab] = useState<"profile" | "goals" | "accom" | "notes" | "people">("profile");

  // generate modal managed by JobCenter
  const { job, start, isModalOpen, close: closeJobModal, open: openJobModal } = useJobCenter();

  // curriculum for picker
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [unitsDropdownOpen, setUnitsDropdownOpen] = useState(false);

  // raw JSON local toggle
  const [showRaw, setShowRaw] = useState(false);

  // refs
  const coursesInputRef = React.useRef<HTMLInputElement>(null);
  const unitsButtonRef = React.useRef<HTMLButtonElement>(null);

  const filtered = useMemo(() => all.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())), [all, q]);
  const courses = useMemo(() => Object.keys(curriculum?.courses || {}), [curriculum]);
  const units = useMemo(() => {
    if (!curriculum || selectedCourses.length === 0) return [];
    const allUnits: string[] = [];
    selectedCourses.forEach((courseId) => {
      const courseUnits = Object.keys(curriculum.courses[courseId] || {});
      courseUnits.forEach((unit) => { if (!allUnits.includes(unit)) allUnits.push(unit); });
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

  async function openView(id: string) {
    try {
      const data = await apiGet<StudentFull>(`/students/${id}`);
      setActive(data); setTab("profile"); setModalOpen(true);
    } catch {
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

  const handleGenerate = () => {
    if (!selectedStudents.length || !selectedCourses.length || !selectedUnits.length) return;
    start({ students: selectedStudents, courses: selectedCourses, units: selectedUnits });
  };

  function truncate(s: string, n: number) {
    if (!s) return "";
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }

  function openRawInNewTab() {
    try {
      const raw = JSON.stringify(job.result, null, 2);
      const blob = new Blob([raw], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      // no-op
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 4, color: COLORS.mainText }}>Students</h1>
          <div style={{ color: COLORS.mutedText }}>Manage profiles and IEP details</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="search students…"
            style={{ padding: "8px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`, minWidth: 220, background: COLORS.surface, color: COLORS.mainText }}
          />
          <button onClick={load} disabled={busy}
            style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${COLORS.buttonGradientEnd}`,
                     background: "transparent", color: COLORS.buttonGradientEnd, cursor: "pointer", fontWeight: 600, opacity: busy ? 0.7 : 1 }}>
            {busy ? "refreshing…" : "Refresh"}
          </button>
          <button
            onClick={() => openJobModal()}
            style={{ padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                     background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
                     color: THEME_COLORS.light.surface, fontWeight: 650 }}
          >
            Generate
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {filtered.map((s) => (<StudentCard key={s.id} s={s} onView={openView} onEdit={openEdit} COLORS={COLORS} />))}
      </div>

      <ModalShell open={isModalOpen} onClose={closeJobModal} COLORS={COLORS}>
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: COLORS.mainText }}>
            {job.status === "running" ? "Generating report…" : job.status === "done" ? "Alignment result" : "Generate report"}
          </h3>

          {(job.status === "idle" || job.status === "error") && (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
                <button
                  type="button"
                  onClick={() => setSelectedStudents(all.map((s) => s.id))}
                  style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: `1px solid ${COLORS.border}`,
                           background: COLORS.surface, color: COLORS.mainText, cursor: "pointer" }}
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
                options={courses.map((c) => ({ value: c, label: c }))}
                selected={selectedCourses}
                onChange={setSelectedCourses}
                COLORS={COLORS}
              />

              {selectedCourses.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 14, fontWeight: 600, color: COLORS.mainText }}>Select units</label>
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      ref={unitsButtonRef}
                      onClick={() => setUnitsDropdownOpen(!unitsDropdownOpen)}
                      style={{
                        width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`,
                        backgroundColor: COLORS.surface, color: COLORS.mainText, textAlign: "left", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                      }}
                    >
                      <span>
                        {selectedUnits.length === 0
                          ? "select units..."
                          : `${selectedUnits.length} unit${selectedUnits.length !== 1 ? "s" : ""} selected`}
                      </span>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                           style={{ transform: unitsDropdownOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>
                        <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {unitsDropdownOpen && (
                      <div style={{
                        position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
                        border: `1px solid ${COLORS.border}`, borderRadius: 8, backgroundColor: COLORS.surface,
                        maxHeight: 200, overflowY: "auto", zIndex: 100, boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}>
                        {units.map((u) => {
                          const isSelected = selectedUnits.includes(u);
                          return (
                            <div key={u}
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
                              <div style={{
                                width: 18, height: 18, borderRadius: 4,
                                border: `2px solid ${isSelected ? COLORS.altRespText : COLORS.border}`,
                                backgroundColor: isSelected ? COLORS.altRespText : "transparent",
                                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                              }}>
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

                  {selectedUnits.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                      {selectedUnits.map((u) => (
                        <div key={u}
                          style={{ display: "flex", alignItems: "center", background: COLORS.altRespBg,
                                   color: COLORS.altRespText, borderRadius: 12, padding: "6px 10px", fontWeight: 600, fontSize: 13 }}>
                          {u}
                          <span onClick={() => setSelectedUnits(selectedUnits.filter((x) => x !== u))}
                                style={{ marginLeft: 8, cursor: "pointer", fontWeight: 800, lineHeight: 1 }}>×</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button
                  onClick={closeJobModal}
                  style={{
                    flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${COLORS.border}`,
                    background: "transparent", color: COLORS.mainText, fontWeight: 600, cursor: "pointer"
                  }}
                >
                  Close
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!selectedStudents.length || !selectedCourses.length || !selectedUnits.length}
                  style={{
                    flex: 1, padding: "12px 0", borderRadius: 12,
                    background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
                    color: "white", fontWeight: 600, border: "none",
                    cursor: (!selectedStudents.length || !selectedCourses.length || !selectedUnits.length) ? "default" : "pointer",
                    opacity: (!selectedStudents.length || !selectedCourses.length || !selectedUnits.length) ? 0.5 : 1
                  }}
                >
                  Generate
                </button>
              </div>
            </>
          )}

          {job.status === "running" && (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Spinner size={24} COLORS={COLORS} />
                <div>
                  <div style={{ fontWeight: 700, color: COLORS.mainText }}>This runs locally. You can continue working.</div>
                  <div style={{ fontSize: 13, color: COLORS.mutedText }}>Close this window anytime; reopen from the sidebar dock.</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: COLORS.mutedText, marginBottom: 6 }}>Selection</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {job.payload?.students?.map(s => <Chip key={s} text={`Student: ${s}`} COLORS={COLORS} />)}
                  {job.payload?.courses?.map(c => <Chip key={c} text={`Course: ${c}`} COLORS={COLORS} />)}
                  {job.payload?.units?.map(u => <Chip key={u} text={`Unit: ${u}`} COLORS={COLORS} />)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={closeJobModal}
                  style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${COLORS.border}`,
                           background: "transparent", color: COLORS.mainText, fontWeight: 600, cursor: "pointer" }}>
                  Close
                </button>
              </div>
            </div>
          )}

          {job.status === "done" && (
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <Stat title="Overall alignment" value={(job.meta?.summary?.overall ?? 0) + "%"} COLORS={COLORS} />
                <Stat title="Students" value={String(job.meta?.summary?.studentCount ?? 0)} COLORS={COLORS} />
                <Stat title="Worksheets" value={String(job.meta?.summary?.worksheetCount ?? 0)} COLORS={COLORS} />
              </div>

              <SectionCard title="Per student average" COLORS={COLORS}>
                <ListKV obj={job.meta?.summary?.avgPerStudent || {}} COLORS={COLORS} />
              </SectionCard>

              <SectionCard title="Per worksheet average" COLORS={COLORS}>
                <ListKV obj={job.meta?.summary?.avgPerWorksheet || {}} COLORS={COLORS} />
              </SectionCard>

              <SectionCard title="Worksheet alignment breakdown" COLORS={COLORS}>
                <div style={{ display: "grid", gap: 10 }}>
                  {(job.result?.matrix?.worksheets || []).map((w: string, idx: number) => {
                    const rowAvg = Array.isArray(job.result?.row_averages) ? job.result.row_averages[idx] : undefined;
                    const students: string[] = job.result?.matrix?.students || [];
                    return (
                      <div key={w} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                          <div style={{ fontWeight: 800, color: COLORS.mainText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w}</div>
                          <div style={{ fontWeight: 900, color: COLORS.mainText }}>{rowAvg != null ? `${Math.round(rowAvg)}%` : "—"}</div>
                        </div>
                        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                          {students.map((stu) => {
                            const detail = job.result?.details?.[w]?.[stu] || {};
                            const u = detail.understanding_fit, a = detail.accessibility_fit, ac = detail.accommodation_fit, e = detail.engagement_fit, o = detail.overall_alignment;
                            return (
                              <div key={stu} style={{ display: "grid", gap: 6 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                  <div style={{ color: COLORS.mutedText, fontSize: 12 }}>{stu}</div>
                                  <div style={{ fontWeight: 700, color: COLORS.mainText }}>{o != null ? `${o}%` : "—"}</div>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 6 }}>
                                  <MiniMetric label="Understanding" value={u} COLORS={COLORS} />
                                  <MiniMetric label="Accessibility" value={a} COLORS={COLORS} />
                                  <MiniMetric label="Accommodation" value={ac} COLORS={COLORS} />
                                  <MiniMetric label="Engagement" value={e} COLORS={COLORS} />
                                </div>
                                {!!detail.explanation && (
                                  <div style={{ fontSize: 12, color: COLORS.mutedText }}>{truncate(String(detail.explanation), 220)}</div>
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
                <button onClick={() => setShowRaw(!showRaw)}
                  style={{ flex: "0 0 auto", padding: "12px 14px", borderRadius: 12, border: `1px solid ${COLORS.border}`,
                           background: "transparent", color: COLORS.mainText, fontWeight: 600, cursor: "pointer" }}>
                  {showRaw ? "Hide raw JSON" : "View raw JSON"}
                </button>
                <button onClick={openRawInNewTab}
                  style={{ flex: "0 0 auto", padding: "12px 14px", borderRadius: 12, border: `1px solid ${COLORS.border}`,
                           background: "transparent", color: COLORS.mainText, fontWeight: 600, cursor: "pointer" }}>
                  Open raw JSON
                </button>
                <button
                  onClick={() => {
                    const raw = JSON.stringify(job.result, null, 2);
                    const blob = new Blob([raw], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = `alignment-${job.jobId}.json`; a.click();
                    setTimeout(()=>URL.revokeObjectURL(url), 0);
                  }}
                  style={{
                    flex: 1, padding: "12px 0", borderRadius: 12,
                    background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
                    color: "white", fontWeight: 700, border: "none", cursor: "pointer", minWidth: 220
                  }}
                >
                  Download raw JSON
                </button>
              </div>

              {showRaw && (
                <div style={{
                  border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden",
                  background: isDark ? "#0a0f1f" : "#0b1020"
                }}>
                  <div style={{ padding: 10, fontSize: 12, color: "#fff", background: isDark ? "#111827" : "#1f2937" }}>Raw JSON (read-only)</div>
                  <pre style={{
                    margin: 0, padding: 12, maxHeight: 280, overflow: "auto",
                    color: "#e5e7eb", fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word"
                  }}>
{JSON.stringify(job.result, null, 2)}
                  </pre>
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={closeJobModal}
                  style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${COLORS.border}`,
                           background: "transparent", color: COLORS.mainText, fontWeight: 600, cursor: "pointer" }}>
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </ModalShell>

      <ModalShell
        open={!!(modalOpen && active)}
        onClose={() => setModalOpen(false)}
        COLORS={COLORS}
        width="min(100%, 980px)"
        height="82vh"
      >
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
              </SectionCard >
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

// small helpers
function Chip({ text, COLORS }: { text: string; COLORS: typeof THEME_COLORS.light }) {
  return (
    <span style={{ background: COLORS.altRespBg, color: COLORS.altRespText, padding: "6px 10px", borderRadius: 999, fontWeight: 700, fontSize: 12 }}>
      {text}
    </span>
  );
}
function Stat({ title, value, COLORS }: { title: string; value: string; COLORS: typeof THEME_COLORS.light }) {
  return (
    <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${COLORS.border}`, background: COLORS.surface, minWidth: 180 }}>
      <div style={{ fontSize: 12, color: COLORS.mutedText, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: COLORS.mainText }}>{value}</div>
    </div>
  );
}
function ListKV({ obj, COLORS }: { obj: Record<string, number>; COLORS: typeof THEME_COLORS.light }) {
  const entries = Object.entries(obj);
  if (!entries.length) return <div style={{ color: COLORS.mutedText, fontSize: 13 }}>No data</div>;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {entries.map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: COLORS.mainText }}>{k}</span>
          <span style={{ fontWeight: 700, color: COLORS.mainText }}>{Math.round((v ?? 0) * 10) / 10}%</span>
        </div>
      ))}
    </div>
  );
}
function MiniMetric({ label, value, COLORS }: { label: string; value: number | undefined; COLORS: typeof THEME_COLORS.light }) {
  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ fontSize: 11, color: COLORS.mutedText, marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 800, color: COLORS.mainText }}>{value != null ? `${Math.round(value)}%` : "—"}</div>
    </div>
  );
}
