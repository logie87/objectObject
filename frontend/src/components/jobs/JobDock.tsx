import { useEffect, useState } from "react";
import { useJobCenter } from "./JobCenter";

function useIsDark(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const root = document.documentElement;
    const attr = root.getAttribute("data-theme");
    if (attr === "dark") return true;
    if (attr === "light") return false;
    return root.classList.contains("dark");
  });
  useEffect(() => {
    const root = document.documentElement;
    const get = () =>
      root.getAttribute("data-theme") === "dark" || root.classList.contains("dark");
    const obs = new MutationObserver(() => setIsDark(get()));
    obs.observe(root, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

export default function JobDock(){
  const { job, reopenFromSidebar, clear } = useJobCenter();
  const { status, meta } = job;
  const isDark = useIsDark();

  if (status === "idle") return null;

  const BG   = isDark ? "#0b1324" : "#ffffff";
  const TXT  = isDark ? "#e5e7eb" : "#111827";
  const SUB  = isDark ? "#9ca3af" : "#6b7280";
  const BRD  = isDark ? "#334155" : "#e5e7eb";

  return (
    <div style={{
      marginTop: "auto",
      padding: 10,
      borderTop: `1px solid ${BRD}`,
      background: BG,
      borderRadius: 12
    }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span
            style={{
              width: 10, height: 10, borderRadius: "50%",
              background:
                status === "running" ? "#10b981"
                : status === "done"    ? "#2563eb"
                : "#ef4444"
            }}
          />
          <div style={{ color: TXT, fontWeight: 700, fontSize: 13 }}>
            {status === "running" ? "Alignment running…" :
             status === "done"    ? "Alignment ready"  :
             "Alignment error"}
          </div>
        </div>
        <div style={{ display: "flex", gap:6 }}>
          <button
            onClick={reopenFromSidebar}
            className="nav-btn"
            style={{ padding: "6px 10px", borderRadius: 8, cursor: "pointer", color: TXT, border: `1px solid ${BRD}`, background: "transparent" }}
          >
            View
          </button>
          {status !== "running" && (
            <button
              onClick={clear}
              className="nav-btn"
              style={{ padding: "6px 10px", borderRadius: 8, cursor: "pointer", color: TXT, border: `1px solid ${BRD}`, background: "transparent" }}
            >
              Clear
            </button>
          )}
        </div>
      </div>
      {status === "done" && meta?.summary?.overall != null && (
        <div style={{ marginTop: 6, fontSize: 12, color: SUB }}>
          Overall: {meta.summary.overall}% • Students: {meta.summary.studentCount} • Worksheets: {meta.summary.worksheetCount}
        </div>
      )}
    </div>
  );
}
