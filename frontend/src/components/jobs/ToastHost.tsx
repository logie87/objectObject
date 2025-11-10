import { useEffect, useState } from "react";
import { subscribeToast } from "./JobCenter";

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

export default function ToastHost() {
  const [msg, setMsg] = useState<{ title: string; action?: () => void } | null>(null);
  const isDark = useIsDark();

  useEffect(() => {
    const unsub = subscribeToast((m) => {
      setMsg(m);
      const t = setTimeout(() => setMsg(null), 5000);
      return () => clearTimeout(t);
    });
    return () => { unsub(); };
  }, []);

  if (!msg) return null;

  // Theme-aware palette with solid contrast
  const BG   = isDark ? "#111827" : "#ffffff";
  const TXT  = isDark ? "#f9fafb" : "#111827";
  const SUB  = isDark ? "#cbd5e1" : "#374151";
  const BRD  = isDark ? "#374151" : "#e5e7eb";
  const SHDW = isDark ? "0 14px 40px rgba(0,0,0,.55)" : "0 14px 40px rgba(0,0,0,.18)";

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 2000,
        background: BG,
        color: TXT,
        border: `1px solid ${BRD}`,
        borderRadius: 12,
        boxShadow: SHDW,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        maxWidth: 560,
      }}
    >
      <div style={{ display: "grid" }}>
        <div style={{ fontWeight: 900, letterSpacing: 0.2, lineHeight: 1.2 }}>{msg.title}</div>
        <div style={{ fontSize: 12, color: SUB, marginTop: 2 }}>
          Notification
        </div>
      </div>

      {msg.action && (
        <button
          // intentionally no className to avoid global dark styles bleeding in
          onClick={() => { msg.action?.(); setMsg(null); }}
          style={{
            marginLeft: "auto",
            appearance: "none",
            border: `1px solid ${BRD}`,
            background: "transparent",
            color: TXT,
            padding: "8px 12px",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          Open
        </button>
      )}
    </div>
  );
}
