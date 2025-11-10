import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../lib/api";
import SetupOverlay from "../SetupOverlay";

import { JobCenterProvider } from "../jobs/JobCenter";
import ToastHost from "../jobs/ToastHost";

type Me = {
  id: number;
  name: string;
  email: string;
  is_new: boolean;
  show_setup_on_login: boolean;
};

function decodeJwtIat(token: string | null): string | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(b64));
    return typeof json.iat === "number" ? String(json.iat) : null;
  } catch {
    return null;
  }
}

export default function MainLayout() {
  const [me, setMe] = useState<Me | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  const sessionKey = useMemo(() => {
    const token = localStorage.getItem("authToken") || null;
    const iat = decodeJwtIat(token);
    const suffix = iat ?? (token ? token.slice(0, 16) : "anon");
    return `onboardingShown:${suffix}`;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const m = await apiGet<Me>("/me");
        if (!mounted) return;
        setMe(m);

        const already = sessionStorage.getItem(sessionKey) === "1";
        const shouldShow = (m.is_new || m.show_setup_on_login) && !already;
        setShowSetup(shouldShow);

        if (m.is_new) {
          try { await apiPost<{ isFirstLogin: boolean }>("/is_new"); } catch {}
        }
        if (shouldShow) sessionStorage.setItem(sessionKey, "1");
      } catch {}
    })();
    return () => { mounted = false; };
  }, [sessionKey]);

  const handleDone = () => setShowSetup(false);

  return (
    <JobCenterProvider>
      <div className="app-shell">
        <Topbar />
        <Sidebar />
        <main className="content">
          {showSetup && (
            <SetupOverlay
              userName={me?.name || me?.email || "Teacher"}
              onDone={handleDone}
            />
          )}
          <Outlet />
        </main>
      </div>
      <ToastHost />
    </JobCenterProvider>
  );
}
