// StudentsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPut } from "../lib/api";

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
  data: any; // full JSON as-is
};

const Badge: React.FC<{ kind: string }> = ({ kind }) => {
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

const StudentCard: React.FC<{
  s: StudentSummary;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
}> = ({ s, onView }) => {
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
      {/* Top */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Generic user icon (reverted) */}
        <div
          style={{
            width: 64, height: 64, borderRadius: "50%",
            backgroundColor: COLORS.avatarBg, display: "flex",
            alignItems: "center", justifyContent: "center"
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

        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: pct != null ? `conic-gradient(${COLORS.pieGradientStart} ${deg}deg, ${COLORS.pieEmpty} ${deg}deg)` : COLORS.pieEmpty,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%", background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: COLORS.mainText
          }}>
            {pct != null ? `${pct}%` : "—"}
          </div>
        </div>
      </div>

      {/* Badges */}
      {!!s.badges?.length && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {s.badges.map(b => <Badge key={b} kind={b} />)}
        </div>
      )}

      {/* Actions: Open + Reports (template) */}
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

        {/* Reports: now primary gradient */}
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

const Field: React.FC<{
  label: string; value: string; onChange: (v: string) => void; textarea?: boolean;
}> = ({ label, value, onChange, textarea }) => (
  <label style={{ display: "grid", gap: 6 }}>
    <span style={{ fontSize: 12, color: COLORS.mutedText }}>{label}</span>
    {textarea ? (
      <textarea value={value} onChange={e => onChange(e.target.value)}
        rows={4}
        style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`, resize: "vertical" }} />
    ) : (
      <input value={value} onChange={e => onChange(e.target.value)}
        style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}` }} />
    )}
  </label>
);

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{
    padding: 16, borderRadius: 14, border: `1px solid ${COLORS.border}`,
    background: "#fff", display: "grid", gap: 12
  }}>
    <div style={{ fontWeight: 800, color: COLORS.mainText }}>{title}</div>
    {children}
  </div>
);

export default function StudentsPage() {
  const [all, setAll] = useState<StudentSummary[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [active, setActive] = useState<StudentFull | null>(null);
  const [tab, setTab] = useState<"profile"|"goals"|"accom"|"notes"|"people">("profile");

  const filtered = useMemo(
    () => all.filter(s => s.name.toLowerCase().includes(q.toLowerCase())),
    [all, q]
  );

  async function load() {
    setBusy(true);
    try {
      const list = await apiGet<StudentSummary[]>("/students");
      setAll(list);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function openView(id: string) {
    const data = await apiGet<StudentFull>(`/students/${id}`);
    setActive(data);
    setTab("profile");
    setModalOpen(true);
  }
  const openEdit = openView; // same modal, editable

  function mutateActive(path: string[], value: any) {
    if (!active) return;
    const next = JSON.parse(JSON.stringify(active));
    let node = next.data;
    for (let i = 0; i < path.length - 1; i++) {
      const k = path[i];
      if (typeof node[k] !== "object" || node[k] === null) node[k] = {};
      node = node[k];
    }
    node[path[path.length - 1]] = value;
    setActive(next);
  }

  async function saveActive() {
    if (!active) return;
    const payload: any = {};

    // Gather known sections if present
    if (active.data.student) payload.student = active.data.student;
    if (active.data.education_goals) payload.education_goals = active.data.education_goals;
    if (active.data.accommodations) payload.accommodations = active.data.accommodations;
    if (typeof active.data.performance_progress === "string") payload.performance_progress = active.data.performance_progress;
    if (typeof active.data.assessments === "string") payload.assessments = active.data.assessments;
    if (typeof active.data.transition_goals === "string") payload.transition_goals = active.data.transition_goals;
    if (Array.isArray(active.data.participants)) payload.participants = active.data.participants;
    if (typeof active.data.alignment_pct === "number") payload.alignment_pct = active.data.alignment_pct;

    const saved = await apiPut<StudentFull>(`/students/${active.id}`, payload);
    setActive(saved);
    // refresh list summaries for name/grade/badges changes
    await load();
  }

  function addParticipant() {
    if (!active) return;
    const arr = Array.isArray(active.data.participants) ? active.data.participants.slice() : [];
    arr.push({ name: "", role: "" });
    setActive({ ...active, data: { ...active.data, participants: arr } });
  }

  function removeParticipant(i: number) {
    if (!active) return;
    const arr = (active.data.participants || []).slice();
    arr.splice(i, 1);
    setActive({ ...active, data: { ...active.data, participants: arr } });
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 4 }}>Students</h1>
          <div style={{ color: COLORS.mutedText }}>Manage profiles and IEP details</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search students…"
            style={{ padding: "8px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`, minWidth: 220 }}
          />
          <button
            onClick={load}
            disabled={busy}
            style={{
              padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
              background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
              color: "#fff", fontWeight: 700
            }}
          >
            {busy ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {filtered.map(s => (
          <StudentCard key={s.id} s={s} onView={openView} onEdit={openEdit} />
        ))}
      </div>

      {!filtered.length && !busy && (
        <div style={{ marginTop: 16, color: COLORS.mutedText }}>No students found.</div>
      )}

      {/* Modal */}
      {modalOpen && active && (
      <div
        onClick={() => setModalOpen(false)}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          // Fixed, consistent height; internal scroll
          style={{
            width: "min(100%, 980px)",
            height: "82vh",
            display: "flex",
            flexDirection: "column",
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 20px 60px rgba(0,0,0,.25)"
          }}
        >
          {/* Header (fixed height) */}
          <div style={{ padding: 18, borderBottom: `1px solid ${COLORS.border}`, flex: "0 0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 20, color: COLORS.mainText }}>
                  {active.data?.student?.student_name || active.id}
                </div>
                <div style={{ color: COLORS.mutedText, fontSize: 13 }}>
                  {active.data?.student?.grade ? `Grade ${active.data.student.grade}` : "—"} {active.data?.student?.teacher ? `• ${active.data.student.teacher}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setModalOpen(false)}
                  style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${COLORS.border}`, background: "#fff", cursor: "pointer" }}
                >
                  Close
                </button>
                <button
                  onClick={saveActive}
                  style={{
                    padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                    background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
                    color: "#fff", fontWeight: 800
                  }}
                >
                  Save
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {["profile","goals","accom","notes","people"].map(t => (
                <button key={t}
                  onClick={() => setTab(t as any)}
                  style={{
                    padding: "8px 12px", borderRadius: 999, border: `1px solid ${tab===t ? COLORS.buttonGradientEnd : COLORS.border}`,
                    background: tab===t ? "rgba(236,72,153,.08)" : "#fff", color: tab===t ? COLORS.buttonGradientEnd : COLORS.mainText,
                    fontWeight: 700, cursor: "pointer"
                  }}>
                  {t === "profile" ? "Profile" :
                  t === "goals" ? "IEP Goals" :
                  t === "accom" ? "Accommodations" :
                  t === "notes" ? "Notes & Assessments" :
                  "Participants"}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable content area fills remaining height */}
          <div style={{ padding: 18, overflow: "auto", flex: "1 1 auto" }}>
            {tab === "profile" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <SectionCard title="Student">
                  <Field label="Name" value={active.data.student?.student_name || ""} onChange={v => mutateActive(["student","student_name"], v)} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Field label="Grade" value={active.data.student?.grade || ""} onChange={v => mutateActive(["student","grade"], v)} />
                    <Field label="Date of Birth (DD/MM/YYYY)" value={active.data.student?.date_of_birth || ""} onChange={v => mutateActive(["student","date_of_birth"], v)} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Field label="Teacher" value={active.data.student?.teacher || ""} onChange={v => mutateActive(["student","teacher"], v)} />
                    <Field label="School" value={active.data.student?.school || ""} onChange={v => mutateActive(["student","school"], v)} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Field label="PEN" value={active.data.student?.pen || ""} onChange={v => mutateActive(["student","pen"], v)} />
                    <Field label="IEP Date (DD/MM/YYYY)" value={active.data.student?.iep_date || ""} onChange={v => mutateActive(["student","iep_date"], v)} />
                  </div>
                  <Field label="Designation" value={active.data.student?.designation || ""} onChange={v => mutateActive(["student","designation"], v)} />
                  <Field label="Alignment % (optional)" value={String(active.data.alignment_pct ?? "")} onChange={v => mutateActive(["alignment_pct"], v.replace(/\D/g,"") ? Number(v) : null as any)} />
                </SectionCard>
                <SectionCard title="Performance Progress">
                  <Field textarea label="Summary" value={active.data.performance_progress || ""} onChange={v => mutateActive(["performance_progress"], v)} />
                </SectionCard>
              </div>
            )}

            {tab === "goals" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <SectionCard title="Academic">
                  <Field textarea label="Goal" value={active.data.education_goals?.academic || ""} onChange={v => mutateActive(["education_goals","academic"], v)} />
                </SectionCard>
                <SectionCard title="Social">
                  <Field textarea label="Goal" value={active.data.education_goals?.social || ""} onChange={v => mutateActive(["education_goals","social"], v)} />
                </SectionCard>
                <SectionCard title="Behavioural">
                  <Field textarea label="Goal" value={active.data.education_goals?.behavioural || ""} onChange={v => mutateActive(["education_goals","behavioural"], v)} />
                </SectionCard>
                <SectionCard title="Communicative">
                  <Field textarea label="Goal" value={active.data.education_goals?.communicative || ""} onChange={v => mutateActive(["education_goals","communicative"], v)} />
                </SectionCard>
                <SectionCard title="Physical">
                  <Field textarea label="Needs" value={active.data.education_goals?.physical || ""} onChange={v => mutateActive(["education_goals","physical"], v)} />
                </SectionCard>
              </div>
            )}

            {tab === "accom" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <SectionCard title="Instructional">
                  <Field textarea label="Supports" value={active.data.accommodations?.instructional || ""} onChange={v => mutateActive(["accommodations","instructional"], v)} />
                </SectionCard>
                <SectionCard title="Environmental">
                  <Field textarea label="Supports" value={active.data.accommodations?.environmental || ""} onChange={v => mutateActive(["accommodations","environmental"], v)} />
                </SectionCard>
                <SectionCard title="Assessment">
                  <Field textarea label="Supports" value={active.data.accommodations?.assessment || ""} onChange={v => mutateActive(["accommodations","assessment"], v)} />
                </SectionCard>
                <SectionCard title="Technology">
                  <Field textarea label="Tools" value={active.data.accommodations?.technology || ""} onChange={v => mutateActive(["accommodations","technology"], v)} />
                </SectionCard>
              </div>
            )}

            {tab === "notes" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <SectionCard title="Assessments">
                  <Field textarea label="Notes" value={active.data.assessments || ""} onChange={v => mutateActive(["assessments"], v)} />
                </SectionCard>
                <SectionCard title="Transition Goals">
                  <Field textarea label="Goals" value={active.data.transition_goals || ""} onChange={v => mutateActive(["transition_goals"], v)} />
                </SectionCard>
              </div>
            )}

            {tab === "people" && (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 800, color: COLORS.mainText }}>Participants</div>
                  <button onClick={addParticipant} style={{ padding: "8px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`, background: "#fff", cursor: "pointer" }}>
                    Add
                  </button>
                </div>
                {(active.data.participants || []).map((p: any, i: number) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
                    <Field label="Name" value={p.name || ""} onChange={v => {
                      const arr = active.data.participants.slice();
                      arr[i] = { ...arr[i], name: v };
                      setActive({ ...active, data: { ...active.data, participants: arr } });
                    }} />
                    <Field label="Role" value={p.role || ""} onChange={v => {
                      const arr = active.data.participants.slice();
                      arr[i] = { ...arr[i], role: v };
                      setActive({ ...active, data: { ...active.data, participants: arr } });
                    }} />
                    <button onClick={() => removeParticipant(i)}
                      style={{ height: 40, marginBottom: 2, borderRadius: 10, border: "none", background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", cursor: "pointer" }}>
                      Remove
                    </button>
                  </div>
                ))}
                {!active.data.participants?.length && (
                  <div style={{ color: COLORS.mutedText, fontSize: 13 }}>No participants yet.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
