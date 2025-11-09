import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../lib/api";
import SetupOverlay from "../SetupOverlay";

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
    // base64url decode payload
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(b64));
    // iat is per-issue; use as per-login session id
    return typeof json.iat === "number" ? String(json.iat) : null;
  } catch {
    return null;
  }
}

export default function MainLayout() {
  const [me, setMe] = useState<Me | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  // Tie "shown" state to the token's iat so it shows once per login.
  const sessionKey = useMemo(() => {
    const token = localStorage.getItem("authToken") || null;
    const iat = decodeJwtIat(token);
    // Fall back to a short hash of the token if iat missing (shouldn’t happen)
    const suffix =
      iat ??
      (token ? token.slice(0, 16) : "anon");
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

        // mark first-login as consumed immediately so DB flips is_new -> 0
        if (m.is_new) {
          try {
            await apiPost<{ isFirstLogin: boolean }>("/is_new");
          } catch {
            // non-fatal
          }
        }

        if (shouldShow) {
          sessionStorage.setItem(sessionKey, "1");
        }
      } catch {
        // ProtectedRoute keeps unauthenticated users out; ignore here.
      }
    })();

    return () => {
      mounted = false;
    };
  }, [sessionKey]);

  const handleDone = () => setShowSetup(false);

  return (
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
  );
}
