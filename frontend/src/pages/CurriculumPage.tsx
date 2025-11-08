// src/pages/CurriculumPage.tsx

import { useEffect, useMemo, useState } from "react";

/** ---------- Mocked template data (editable) ---------- */
type FitStatus = "good" | "warn" | "bad";
type IssueChip = "Reading" | "Modality" | "Time" | "Assessment" | "Exec-Fx" | "AT/Tech";

type OutcomeRow = {
  code: string;
  activities: string[];
  fit: { mean: number; spread: number; status: FitStatus };
  issues: IssueChip[];
  affected: string[]; // student ids/labels
  consensus: string[]; // bullets
  evidence: string; // short line
};

type Unit = {
  id: string;
  name: string;
  outcomes: OutcomeRow[];
};

const sampleUnits: Unit[] = [
  {
    id: "u1",
    name: "Unit 1: Fractions",
    outcomes: [
      {
        code: "MA.1.A",
        activities: ["Worksheet A1", "Station A - Fraction Strips", "Exit Ticket A"],
        fit: { mean: 86, spread: 18, status: "good" },
        issues: ["Modality"],
        affected: ["S2", "S5", "S7", "S9"],
        consensus: [
          "Provide TTS & chunking (3–5 steps).",
          "Offer oral check-in in place of written exit ticket.",
          "Time extension 1.5×."
        ],
        evidence: "IEP reading accommodation; activity reading load."
      },
      {
        code: "MA.1.B",
        activities: ["Worksheet B1", "Hands-on Lab (Cuisenaire Rods)"],
        fit: { mean: 71, spread: 26, status: "warn" },
        issues: ["Time", "Assessment"],
        affected: ["S1", "S3", "S8"],
        consensus: [
          "Allow extra time window and reduce item count.",
          "Use quick oral probe for mastery instead of full quiz."
        ],
        evidence: "Time-on-task; prior assessment history."
      },
      {
        code: "MA.1.C",
        activities: ["Video Mini-lesson", "Practice Set C"],
        fit: { mean: 48, spread: 34, status: "bad" },
        issues: ["Reading", "Modality"],
        affected: ["S4", "S6", "S10", "S12"],
        consensus: [
          "Provide guided notes with visuals.",
          "Enable captions + transcript with highlighted key terms."
        ],
        evidence: "High lexical density; modality mismatch for S4/S6."
      }
    ]
  },
  {
    id: "u2",
    name: "Unit 2: Geometry",
    outcomes: [
      {
        code: "MA.2.A",
        activities: ["Worksheet G1", "Stations: Angles", "Exit Ticket G"],
        fit: { mean: 78, spread: 22, status: "warn" },
        issues: ["Assessment"],
        affected: ["S2", "S7"],
        consensus: ["Swap written exit ticket for 1:1 oral check-in."],
        evidence: "Assessment format vs accommodations."
      },
      {
        code: "MA.2.B",
        activities: ["Investigation: Triangles", "Sketch & Label Task"],
        fit: { mean: 90, spread: 12, status: "good" },
        issues: [],
        affected: [],
        consensus: ["No change needed; keep visual supports available."],
        evidence: "High engagement, low spread."
      }
    ]
  },
  {
    id: "u3",
    name: "Unit 3: Measurement",
    outcomes: [
      {
        code: "MA.3.A",
        activities: ["Lab: Measuring Length", "Reflection Prompt"],
        fit: { mean: 62, spread: 28, status: "warn" },
        issues: ["Exec-Fx", "Time"],
        affected: ["S3", "S5", "S9"],
        consensus: [
          "Provide checklist + model response.",
          "Offer time extension and reduced reflection length."
        ],
        evidence: "Executive function supports noted in IEPs."
      }
    ]
  }
];

/** ---------- Small utility ---------- */
function statusBadge({ mean, spread, status }: OutcomeRow["fit"]) {
  const text =
    status === "good" ? `▲ ${mean}%` : status === "warn" ? `■ ${mean}%` : `● ${mean}%`;
  const cls = status === "good" ? "good" : status === "warn" ? "warn" : "bad";
  return (
    <span className={`badge ${cls}`} title={`Mean ${mean} • Spread ${spread}`}>
      {text}
    </span>
  );
}

/** ---------- Page Component ---------- */
export default function CurriculumPage() {
  const [activeUnitId, setActiveUnitId] = useState<Unit["id"]>("u1");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [notice, setNotice] = useState<string>("");

  const activeUnit = useMemo(
    () => sampleUnits.find((u) => u.id === activeUnitId) ?? sampleUnits[0],
    [activeUnitId]
  );

  const rows = activeUnit.outcomes;
  const focused = rows[focusedIndex] ?? rows[0];

  // auto-hide notices after a beat
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const tell = (msg: string) => {
    setNotice(msg);
  };

  const handleSelectUnit = (id: string, name: string) => {
    setActiveUnitId(id);
    setFocusedIndex(0);
    tell(
      `Switched to ${name}. Outcomes and activities below now reflect this unit. Re-run to refresh fit badges if filters changed.`
    );
  };

  const handleGenerate = (row: OutcomeRow) => {
    tell(
      `Would generate a consensus adaptation for ${row.code}: run local RAG over this unit’s materials + IEPs, then propose changes (with rationale & evidence) for the selected activities.`
    );
  };

  const handleRerun = () => {
    tell(
      "Would re-run alignment locally using current filters and the active unit. Fit %, spread, and issue badges would refresh."
    );
  };

  return (
    <div>
      <div className="header">
        <h1>Curriculum</h1>
        <div className="sub">Units • Outcomes • Activity fit & issues</div>
      </div>

      {/* Inline “what would happen” notice */}
      {notice && (
        <div
          className="card"
          role="status"
          aria-live="polite"
          style={{
            marginBottom: 12,
            borderLeft: "6px solid #a78bfa",
            background: "#fafaff"
          }}
        >
          {notice}
        </div>
      )}

      <div className="panel" style={{ padding: 20 }}>
        {/* Filter bar */}
        <div
          className="card"
          style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}
        >
          <select
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb" }}
            onChange={(e) => tell(`Would filter by unit = ${e.target.value}.`)}
          >
            <option>All Units</option>
            {sampleUnits.map((u) => (
              <option key={u.id}>{u.name}</option>
            ))}
          </select>

          <select
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb" }}
            onChange={(e) => tell(`Would filter by issue = ${e.target.value}.`)}
          >
            <option>All Issues</option>
            <option>Reading</option>
            <option>Modality</option>
            <option>Time</option>
            <option>Assessment</option>
            <option>Exec-Fx</option>
            <option>AT/Tech</option>
          </select>

          <button className="btn ghost" onClick={handleRerun}>
            Re-run (filters changed)
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 360px", gap: 20 }}>
          {/* Units tree */}
        <aside className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Units</div>
            <div style={{ display: "grid", gap: 8 }}>
                {sampleUnits.map((u) => {
                const active = u.id === activeUnitId;
                return (
                    <button
                    key={u.id}
                    className={`unit-btn ${active ? "active" : ""}`}
                    onClick={() => handleSelectUnit(u.id, u.name)}
                    aria-current={active ? "page" : undefined}
                    >
                    <span aria-hidden className="unit-dot" />
                    <span className="nav-label" style={{ color: "inherit" }}>{u.name}</span>
                    </button>
                );
                })}
            </div>
        </aside>


          {/* Outcome table (driven by active unit) */}
          <section className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "160px 1fr 140px 180px 120px",
                background: "#f8fafc",
                padding: "12px 16px",
                fontWeight: 700
              }}
            >
              <div>Outcome</div>
              <div>Activities</div>
              <div>Group Fit</div>
              <div>Issues</div>
              <div>Action</div>
            </div>

            {rows.map((row, i) => (
              <div
                key={row.code}
                style={{
                  display: "grid",
                  gridTemplateColumns: "160px 1fr 140px 180px 120px",
                  padding: "14px 16px",
                  borderTop: "1px solid #eef2f7",
                  alignItems: "center",
                  background: i === focusedIndex ? "#fafafa" : "transparent",
                  cursor: "pointer"
                }}
                onClick={() => {
                  setFocusedIndex(i);
                  tell(
                    `Selected ${row.code}. The right panel shows affected students and a ready-to-insert consensus adaptation.`
                  );
                }}
              >
                <div>{row.code}</div>
                <div>{row.activities.join(", ")}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {statusBadge(row.fit)}
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    spread {row.fit.spread}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {row.issues.map((iss) => {
                    const cls =
                      iss === "Reading"
                        ? "bad"
                        : iss === "Modality" || iss === "Time" || iss === "Assessment"
                        ? "warn"
                        : "warn";
                    // use ● for bad, ■ for warn
                    const glyph = cls === "bad" ? "●" : "■";
                    return (
                      <span key={iss} className={`badge ${cls}`}>
                        {glyph} {iss}
                      </span>
                    );
                  })}
                </div>
                <div>
                  <button className="btn ghost" onClick={() => handleGenerate(row)}>
                    Generate
                  </button>
                </div>
              </div>
            ))}
          </section>

          {/* Right context (focused outcome from active unit) */}
          <aside className="card" style={{ position: "sticky", top: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
              Activity Group Fit
            </div>
            <div style={{ color: "var(--muted)", marginBottom: 12 }}>
              Who’s affected + consensus suggestion
            </div>

            <div className="card" style={{ background: "#f8fafc" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                {focused?.code} • Affected students ({focused?.affected.length ?? 0})
              </div>
              <div style={{ color: "var(--muted)", marginBottom: 10 }}>
                {focused?.affected.join(", ") || "None"} • issues:{" "}
                {focused?.issues.join(", ") || "—"}
              </div>

              <div style={{ fontWeight: 700, marginBottom: 6 }}>Consensus adaptation</div>
              <ul style={{ margin: "0 0 10px 18px", padding: 0 }}>
                {focused?.consensus.map((line, j) => (
                  <li key={j}>{line}</li>
                ))}
              </ul>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Evidence: {focused?.evidence}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                className="btn primary"
                onClick={() =>
                  tell(
                    "Would insert the adaptation into the lesson plan document and save an audit note to the student IEP log."
                  )
                }
              >
                Insert
              </button>
              <button
                className="btn ghost"
                onClick={() =>
                  tell("Would save this adaptation to your Library → Templates for reuse.")
                }
              >
                Save
              </button>
              <button
                className="btn ghost"
                onClick={() => tell("Copied adaptation text + rationale to clipboard.")}
              >
                Copy
              </button>
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
              Hint: Badges stale after filters. Re-run to refresh metrics.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
