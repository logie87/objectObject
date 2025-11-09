import { useEffect, useMemo, useState } from "react";
import { apiGet, apiGetBlobUrl } from "../lib/api";

type ReportCategory =
  | "Class Alignment Snapshot — Today’s Fire Map"
  | "Activity Fit Rollup — Worksheets Hurting the Group"
  | "Accommodation Compliance Summary — Check against core competencies and other requirements";

type ReportMeta = {
  id: string;
  title: string;
  filename: string;
  size: number;
  uploaded_at: string; // ISO
  category: ReportCategory;
  course?: string | null;
  unit?: string | null;
};

type DocMeta = { id: string; size: number; uploaded_at: string; title: string };

// Minimal curriculum DTO for the snapshot pills
type CurriculumResourceFit = { status: "good" | "warn" | "bad" };
type CurriculumResource = { fit: CurriculumResourceFit };
type CurriculumDTO = { courses: Record<string, Record<string, CurriculumResource[]>> };

type Student = { id: string; name: string };

function pct(n: number) {
  return Math.round(n);
}

function StatusBadge({
  label,
  value,
  kind,
}: {
  label: string;
  value: number;
  kind: "good" | "warn" | "bad";
}) {
  const symbol = kind === "good" ? "▲" : kind === "warn" ? "■" : "●";
  return (
    <span className={`badge ${kind}`} title={label} style={{ fontWeight: 700 }}>
      {symbol} {label} • {pct(value)}%
    </span>
  );
}

const go = (path: string) => {
  // simplest, robust redirect that works regardless of router issues
  window.location.assign(path);
};

export default function HomePage() {
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [curriculum, setCurriculum] = useState<CurriculumDTO | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setBusy(true);
        const [rep, lib, stu, cur] = await Promise.allSettled([
          apiGet<ReportMeta[]>("/reports?sort=recent"),
          apiGet<DocMeta[]>("/library"),
          apiGet<Student[]>("/students"),
          apiGet<CurriculumDTO>("/curriculum"),
        ]);

        if (!alive) return;

        if (rep.status === "fulfilled") setReports(rep.value.slice(0, 5));
        if (lib.status === "fulfilled") setDocs(rep.status === "fulfilled" ? lib.value : []);
        if (stu.status === "fulfilled") setStudents(stu.value);
        if (cur.status === "fulfilled") setCurriculum(cur.value);
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Compute snapshot from curriculum fits (if any)
  const snapshot = useMemo(() => {
    const counts = { good: 0, warn: 0, bad: 0, total: 0 };
    if (!curriculum) return counts;
    for (const course of Object.keys(curriculum.courses || {})) {
      const units = curriculum.courses[course] || {};
      for (const unit of Object.keys(units)) {
        for (const r of units[unit] || []) {
          counts.total += 1;
          counts[r.fit.status] += 1;
        }
      }
    }
    return counts;
  }, [curriculum]);

  const snapPct = useMemo(() => {
    const t = snapshot.total || 1;
    return {
      good: (snapshot.good / t) * 100,
      warn: (snapshot.warn / t) * 100,
      bad: (snapshot.bad / t) * 100,
    };
  }, [snapshot]);

  async function openReport(r: ReportMeta) {
    try {
      const url = await apiGetBlobUrl(`/reports/${r.id}/file`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // Fallback: take user to Reports page
      go("/app/reports");
    }
  }

  const latestReport = reports[0];

  return (
    <div>
      <div className="header">
        <h1>Welcome</h1>
      </div>


      {/* Main split: snapshot + right quick open */}
      <div className="panel" style={{ padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #e5e7eb" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
          <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 16 }}>
            {/* Alignment snapshot */}
            <div className="card" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #e5e7eb" }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Alignment Snapshot</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <StatusBadge label="Good" value={snapPct.good} kind="good" />
                <StatusBadge label="At-risk" value={snapPct.warn} kind="warn" />
                <StatusBadge label="Gap" value={snapPct.bad} kind="bad" />
                <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>
                  {busy ? "Refreshing…" : `Total resources: ${snapshot.total}`}
                </span>
              </div>
            </div>

            {/* Recent Reports */}
            <div className="card" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontWeight: 700 }}>Recent Reports</div>
                <button className="btn ghost" onClick={() => go("/app/reports")}>
                  View All
                </button>
              </div>

              {!reports.length && (
                <div style={{ color: "var(--muted)" }}>
                  No reports yet. Go to <button className="btn flat" onClick={() => go("/app/reports")}>Reports</button>.
                </div>
              )}

              {reports.map((r, i) => (
                <div
                  key={r.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    gap: 12,
                    alignItems: "center",
                    padding: "10px 0",
                    borderTop: i === 0 ? "none" : "1px solid #e5e7eb",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontWeight: 600,
                      }}
                      title={r.title}
                    >
                      {r.title}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {r.category} {r.course ? `• ${r.course}` : ""} {r.unit ? `• ${r.unit}` : ""} •{" "}
                      {new Date(r.uploaded_at).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="badge warn">{(r.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <button className="btn ghost" onClick={() => openReport(r)}>
                    Open
                  </button>
                </div>
              ))}
            </div>

            {/* Shortcuts */}
            <div className="card" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #e5e7eb" }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Shortcuts</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="btn flat" onClick={() => go("/app/library")}>Open Library</button>
                <button className="btn flat" onClick={() => go("/app/reports")}>View Reports</button>
                <button className="btn flat" onClick={() => go("/app/students")}>Manage Students</button>
                <button className="btn flat" onClick={() => go("/app/curriculum")}>Curriculum</button>
              </div>
            </div>
          </div>

          {/* Right panel: Most recent report quick-open */}
          <aside
            className="card"
            style={{ position: "sticky", top: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #e5e7eb" }}
          >
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
              {latestReport ? "Latest Report" : "Getting Started"}
            </div>
            <div style={{ color: "var(--muted)", marginBottom: 12 }}>
              {latestReport
                ? "Quick access to your most recent alignment output."
                : "Open Curriculum to browse resources, or Reports to see generated PDFs."}
            </div>

            {latestReport ? (
              <div
                className="card"
                style={{ background: "#f8fafc", boxShadow: "0 1px 2px rgba(0,0,0,0.05)", border: "1px solid #e5e7eb" }}
              >
                <div style={{ fontWeight: 700 }}>{latestReport.title}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  {latestReport.category} {latestReport.course ? `• ${latestReport.course}` : ""}{" "}
                  {latestReport.unit ? `• ${latestReport.unit}` : ""} •{" "}
                  {new Date(latestReport.uploaded_at).toLocaleString()}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button className="btn primary" onClick={() => openReport(latestReport)}>
                    Open PDF
                  </button>
                  <button className="btn ghost" onClick={() => go("/app/reports")}>
                    Reports
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="card"
                style={{ background: "#f8fafc", boxShadow: "0 1px 2px rgba(0,0,0,0.05)", border: "1px solid #e5e7eb" }}
              >
                <div style={{ marginBottom: 8, fontWeight: 700 }}>No recent reports</div>
                <div style={{ fontSize: 14, color: "var(--muted)" }}>
                  Go to Reports or Curriculum to get started.
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button className="btn primary" onClick={() => go("/app/reports")}>
                    Reports
                  </button>
                  <button className="btn ghost" onClick={() => go("/app/curriculum")}>
                    Curriculum
                  </button>
                </div>
              </div>
            )}

            <div className="card" style={{ marginTop: 12, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", border: "1px solid #e5e7eb" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Library Status</div>
              <div style={{ fontSize: 14, color: "var(--muted)" }}>
                {docs.length} PDFs in Library • {docs.length ? new Date(docs[0].uploaded_at).toLocaleDateString() : "—"}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
