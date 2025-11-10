import React, { useEffect, useMemo, useState } from "react";
import { apiGet } from "../lib/api";

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
  spinnerTrack: "#e5e7eb",
  spinnerArc: "#ec4899",
  cardShadow: "0 6px 18px rgba(0,0,0,0.08)",
  mutedText: "#6b7280",
  mainText: "#374151",
  avatarBg: "#eef2ff",
  border: "#e5e7eb",
  surface: "#ffffff",
  modalShadow: "0 20px 60px rgba(0,0,0,.25)",
  overlayBg: "rgba(0,0,0,.45)",
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

const AutocompleteMulti: React.FC<{
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  COLORS: typeof COLORS;
}> = ({ label, options, selected, onChange, COLORS }) => {
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
          type="text"
          placeholder={`Type to search ${label.toLowerCase()}…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            const match = options.find(
              (o) => o.label.toLowerCase() === q.toLowerCase()
            );
            if (e.key === "Enter" && match) {
              if (!selected.includes(match.value)) {
                onChange([...selected, match.value]);
              }
              setQ("");
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

const Badge: React.FC<{ kind: string }> = ({ kind }) => {
  let bg = COLORS.timeBadgeBg;
  let fg = COLORS.timeBadgeText;
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
            {s.grade ? `Grade ${s.grade}` : "—"}{" "}
            {s.teacher ? `• ${s.teacher}` : ""}
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
              background: COLORS.surface,
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
            border: `1px solid ${COLORS.border}`,
            background: COLORS.surface,
            color: COLORS.mainText,
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
            background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
            color: COLORS.surface,
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

export default function StudentsPage() {
  const [all, setAll] = useState<StudentSummary[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const filtered = useMemo(
    () => all.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())),
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

  useEffect(() => {
    load();
  }, []);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setShowModal(false);
      alert("Report generation complete! Your report is ready.");
    }, 3000);
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
              color: COLORS.surface,
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
              color: COLORS.surface,
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
              label="Select Units"
              options={[
                { value: "Reading", label: "Reading" },
                { value: "Math", label: "Math" },
                { value: "Science", label: "Science" },
                { value: "Social Studies", label: "Social Studies" },
              ]}
              selected={selectedUnits}
              onChange={setSelectedUnits}
              COLORS={COLORS}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setShowModal(false)}
                disabled={isGenerating}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.surface,
                  color: COLORS.mainText,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={
                  isGenerating ||
                  !selectedStudents.length ||
                  !selectedUnits.length
                }
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${COLORS.buttonGradientStart}, ${COLORS.buttonGradientEnd})`,
                  color: COLORS.surface,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
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
