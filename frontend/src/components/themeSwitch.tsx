// themeSwitch.tsx
// a self-contained, accessible theme switch component
// stores user preference, respects system preference, and toggles both `document.documentElement.classList` (for tailwind) and `data-theme` (for plain css)

import { useEffect, useMemo, useState } from "react";

export default function ThemeSwitch() {
  // figure out initial theme once (localstorage > system preference > light)
  const initialTheme = useMemo<"light" | "dark">(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "light" || stored === "dark") return stored;
    } catch {}
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return "light";
  }, []);

  const [theme, setTheme] = useState<"light" | "dark">(initialTheme);

  // apply theme to <html>
  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === "dark";

    // toggle tailwind's dark class (if you're using it)
    root.classList.toggle("dark", isDark);

    // set a helpful attribute for plain css
    root.setAttribute("data-theme", theme);

    // persist between visits
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }, [theme]);

  // accessible label + pressed state
  const label = theme === "dark" ? "switch to light mode" : "switch to dark mode";

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  return (
    <>
      {/* day/night mode switch */}
      <button
        className="theme-switcher-grid"
        id="theme-switcher-grid"
        aria-label="Switch theme"
        aria-pressed={theme === "dark"}
        onClick={toggleTheme}
      >
        <div className="sun" id="sun" aria-hidden="true"></div>
        <div className="moon-overlay" id="moon-overlay" aria-hidden="true"></div>
        <div className="cloud-ball cloud-ball-left" id="ball1" aria-hidden="true"></div>
        <div className="cloud-ball cloud-ball-middle" id="ball2" aria-hidden="true"></div>
        <div className="cloud-ball cloud-ball-right" id="ball3" aria-hidden="true"></div>
        <div className="cloud-ball cloud-ball-top" id="ball4" aria-hidden="true"></div>
        <div className="star" id="star1" aria-hidden="true"></div>
        <div className="star" id="star2" aria-hidden="true"></div>
        <div className="star" id="star3" aria-hidden="true"></div>
        <div className="star" id="star4" aria-hidden="true"></div>
        <span className="sr-only">{label}</span>
      </button>

      {/* component-scoped styles (works in react/vite/next via style tags) */}
      <style>{`
        :root {
          --switch-size: 32px;
          --sky: #e6f2ff; /* light sky */
          --ground: #ffffff;
          --sun: #ffcc33;
          --moon: #dfe7ff;
          --cloud: #ffffff;
          --star: #ffd266;
          --ring: rgba(255, 204, 51, 0.35);
          --shadow: 0 10px 30px rgba(40, 31, 31, 0.15);
        //   --margin:1rem;
        }
        :root[data-theme="dark"] {
          --sky: #0c2351ff; /* night sky */
          --ground: #0a0f1a;
          --sun: #e6b422;
          --moon: #c6d0ff;
          --cloud: rgba(255,255,255,.12);
          --star: #fff2a8;
          --ring: rgba(198, 208, 255, 0.25);
        }

        .theme-switcher-grid {
          position: relative;
          width: calc(var(--switch-size) * 3);
          height: var(--switch-size);
          border-radius: 9999px;
          border: 1px solid rgba(0,0,0,.08);
          background: linear-gradient(180deg, var(--sky), var(--ground));
          box-shadow: var(--shadow);
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          align-items: center;
          overflow: hidden;
          padding: 0;
          cursor: pointer;
        }
        .theme-switcher-grid:focus-visible {
            outline: 2px solid #6366f1;
            outline-offset: 2px;
        }
        .theme-switcher-grid:hover {
            background: var(--surface-900);
        }

        .sun {
          position: absolute;
          left: 8px;
          width: calc(var(--switch-size) - 16px);
          height: calc(var(--switch-size) - 16px);
          border-radius: 9999px;
          background: radial-gradient(circle at 30% 30%, #fff5d6 0%, var(--sun) 60%, #f6a700 100%);
          box-shadow: 0 0 0 0 var(--ring), 0 8px 16px rgba(0,0,0,.12);
          transform: translateX(0);
          transition: transform 420ms cubic-bezier(.2,.9,.2,1), box-shadow 420ms ease;
        }
        :root[data-theme="dark"] .sun { transform: translateX(calc(var(--switch-size) * 2)); box-shadow: 0 0 0 14px var(--ring), 0 8px 16px rgba(0,0,0,.4); }

        .moon-overlay {
          position: absolute;
          left: 8px;
          width: calc(var(--switch-size) - 16px);
          height: calc(var(--switch-size) - 16px);
          border-radius: 9999px;
          background: var(--moon);
          transform: translateX(-110%);
          mix-blend-mode: multiply;
          box-shadow: inset -6px -8px 12px rgba(0,0,0,.15);
          transition: transform 420ms cubic-bezier(.2,.9,.2,1);
        }
        :root[data-theme="dark"] .moon-overlay { transform: translateX(calc(var(--switch-size) * 2)); }

        .cloud-ball {
          position: absolute;
          bottom: 4px;
          width: 20px;
          height: 20px;
          border-radius: 9999px;
          background: var(--cloud);
          opacity: .85;
          filter: blur(.2px);
          transition: transform 600ms ease, opacity 600ms ease;
        }
        .cloud-ball-left { left: 18px; }
        .cloud-ball-middle { left: 42px; }
        .cloud-ball-right { left: 66px; }
        .cloud-ball-top { left: 40px; bottom: 14px; width: 14px; height: 14px; }
        :root[data-theme="dark"] .cloud-ball { opacity: .12; transform: translateY(10px) scale(.9); }

        .star {
          position: absolute;
          top: 10px;
          right: 14px;
          width: 3px; height: 3px;
          border-radius: 9999px;
          background: var(--star);
          opacity: 0;
          transform: translateY(-6px);
          box-shadow: 12px 8px 0 0 var(--star), 24px -4px 0 0 var(--star), 36px 6px 0 0 var(--star), 48px -2px 0 0 var(--star);
          transition: opacity 600ms ease, transform 600ms ease;
        }
        :root[data-theme="dark"] .star { opacity: 1; transform: translateY(0); }

        @media (prefers-reduced-motion: reduce) { .sun, .moon-overlay, .cloud-ball, .star { transition: none; } }

        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
      `}</style>
    </>
  );
}

/*
  usage:
  - import ThemeSwitch from "./themeSwitch";
  - drop <ThemeSwitch /> into your header/nav.
  - style your app using tailwind's `dark:` or via [data-theme="dark"].
  - no external css is required, but you can move these styles to a css/module if you prefer.
  note: comments are kept in lowercase per user preference.
*/
