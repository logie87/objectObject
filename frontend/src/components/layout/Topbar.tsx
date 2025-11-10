import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPut, apiGetBlobUrl } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import ThemeSwitch from "../themeSwitch";

type Me = {
  id: number;
  name: string;
  email: string;
  is_new: boolean;
  show_setup_on_login: boolean;
  avatar_url: string;
};

type SearchItem = {
  kind: 'report' | 'library' | 'student' | 'course' | 'unit' | 'resource' | 'function';
  id: string;
  title: string;
  subtitle?: string | null;
  route?: string | null;
  api_file?: string | null; // when present, open via blob
};

export default function Topbar(){
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [me, setMe] = useState<Me | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string>('');
  const [menuOpen, setMenuOpen] = useState(false);

  // Search state
  const [q, setQ] = useState('');
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [suggestions, setSuggestions] = useState<SearchItem[]>([]);

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // --- bootstrap me + avatar
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const m = await apiGet<Me>('/me');
        if (!mounted) return;
        setMe(m);
        try {
          const blobUrl = await apiGetBlobUrl('/me/avatar');
          if (!mounted) return;
          setAvatarSrc(blobUrl);
        } catch {
          if (mounted) setAvatarSrc('');
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  // --- click outside menus/suggest
  useEffect(() => {
    function onDocClick(e: MouseEvent){
      const t = e.target as Node;
      if (btnRef.current && menuRef.current &&
          !btnRef.current.contains(t) && !menuRef.current.contains(t)) {
        setMenuOpen(false);
      }
      if (searchWrapRef.current && !searchWrapRef.current.contains(t)) {
        setSuggestOpen(false);
        setActiveIdx(-1);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  async function toggleSetupFlag(){
    if (!me) return;
    const next = !me.show_setup_on_login;
    const saved = await apiPut<{ show_setup_on_login: boolean }>('/me/settings', { show_setup_on_login: next });
    setMe({ ...(me as Me), show_setup_on_login: saved.show_setup_on_login });
  }

  function onLogout(){
    logout();
    navigate('/', { replace: true });
  }

  // --- search helpers
  async function runSearch(query: string): Promise<SearchItem[] | null> {
    const s = query.trim();
    if (!s) return null;
    try {
      const res = await apiGet<SearchItem[]>(`/search?s=${encodeURIComponent(s)}&limit=10`);
      return res;
    } catch {
      return null;
    }
  }

  async function openItem(item: SearchItem) {
    setSuggestOpen(false);
    setActiveIdx(-1);
    // If we have a direct file endpoint -> open blob in new tab
    if (item.api_file) {
      try {
        const url = await apiGetBlobUrl(item.api_file);
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      } catch {
        // fall back to route if possible
      }
    }
    // Navigate to route if present; else best-effort page by kind
    const route = item.route || routeByKind(item);
    if (route) {
      window.location.assign(route);
    }
  }

  function routeByKind(it: SearchItem): string | null {
    switch (it.kind) {
      case 'student': return '/app/students';
      case 'report':  return '/app/reports';
      case 'library': return '/app/library';
      case 'course':
      case 'unit':
      case 'resource': return it.route || '/app/curriculum';
      case 'function': return it.route || '/app';
      default: return '/app';
    }
  }

  async function onSearchSubmit() {
    const s = q.trim();
    if (!s) {
      setSuggestOpen(false);
      setActiveIdx(-1);
      return;
    }
    const results = await runSearch(s);
    if (results && results.length) {
      await openItem(results[0]);
    } else {
      // default: send to curriculum with q as hint
      window.location.assign(`/app/curriculum?q=${encodeURIComponent(s)}`);
    }
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setSuggestOpen(true);
      return;
    }
    if (!suggestOpen) {
      if (e.key === 'Enter') onSearchSubmit();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % Math.max(1, suggestions.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + Math.max(1, suggestions.length)) % Math.max(1, suggestions.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = activeIdx >= 0 && suggestions[activeIdx] ? suggestions[activeIdx] : null;
      if (pick) {
        openItem(pick);
      } else {
        onSearchSubmit();
      }
    } else if (e.key === 'Escape') {
      setSuggestOpen(false);
      setActiveIdx(-1);
    }
  }

  // --- live suggestions (debounced)
  useEffect(() => {
    let gone = false;
    const t = setTimeout(async () => {
      try {
        const res = await apiGet<SearchItem[]>(`/search/suggest?s=${encodeURIComponent(q)}&limit=6`);
        if (!gone) setSuggestions(res || []);
      } catch {
        if (!gone) setSuggestions([]);
      }
    }, 150);
    return () => { gone = true; clearTimeout(t); };
  }, [q]);

  function pickSuggestion(item: SearchItem) {
    setQ(item.title);
    openItem(item);
  }

  const KindGlyph = ({ kind }: { kind: SearchItem['kind'] }) => {
    const color = '#6b7280';
    switch (kind) {
      case 'report':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" stroke={color} fill="none" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        );
      case 'library':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" stroke={color} fill="none" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20" />
            <path d="M4 19.5V4.5A2.5 2.5 0 0 1 6.5 2H18" />
          </svg>
        );
      case 'student':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" stroke={color} fill="none" strokeWidth="2">
            <circle cx="12" cy="7" r="4" />
            <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
          </svg>
        );
      case 'course':
      case 'unit':
      case 'resource':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" stroke={color} fill="none" strokeWidth="2">
            <path d="M3 6h18" />
            <path d="M3 12h18" />
            <path d="M3 18h18" />
          </svg>
        );
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" stroke={color} fill="none" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        );
    }
  };

  return (
    <header
      className="topbar"
      style={{
        display: "grid",
        gridTemplateColumns: "235px 1fr",
        alignItems: "center",
        gap: 12,
      }}
    >
      <style>{`
        /* show the correct logo based on the theme set by ThemeSwitch */
        .logo-img { display: inline-block; height: auto; border-radius: 10px; }
        .logo-img--dark { display: none; border-radius: 10px ; }
        :root[data-theme="dark"] .logo-img--light { display: none; }
        :root[data-theme="dark"] .logo-img--dark { display: inline-block; }
      `}</style>

      {/* Left: logo */}
      <div className="logo" style={{ minWidth: 180, cursor: 'pointer' }} onClick={() => window.location.assign('/app')}>
        <img src="/icon.png" alt="instructive logo" className="logo-img logo-img--light" />
        <img src="/iconNight.png" alt="instructive logo (dark)" className="logo-img logo-img--dark" />
        <div>Instructive</div>
      </div>

      


      {/* Right: search + user menu */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Search */}
        <div
          ref={searchWrapRef}
          className="search"
          style={{ margin: 0, flex: 1, position: 'relative', paddingRight: 44 }}
          onClick={() => {
            setSuggestOpen(true);
            inputRef.current?.focus();
          }}
        >
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setSuggestOpen(true)}
            onKeyDown={onInputKeyDown}
            placeholder="Search students, resources, reports, library…"
            aria-autocomplete="list"
            aria-expanded={suggestOpen}
            aria-controls="search-suggest"
          />
          {/* Circular icon button */}
          <button
            aria-label="Search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.stopPropagation(); onSearchSubmit(); }}
            style={{
              position: 'absolute',
              top: '50%',
              right: 6,
              transform: 'translateY(-50%)',
              width: 32,
              height: 32,
              borderRadius: '15px',
              border: '1px solid #e5e7eb',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>

          {/* Suggestions dropdown */}
          {suggestOpen && (
            <div
              id="search-suggest"
              role="listbox"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 8,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                boxShadow: '0 18px 40px rgba(0,0,0,.12)',
                zIndex: 40,
                overflow: 'hidden'
              }}
            >
              {suggestions.map((s, i) => {
                const active = i === activeIdx;
                return (
                  <div
                    key={`${s.kind}:${s.id}`}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setActiveIdx(i)}
                    onMouseLeave={() => setActiveIdx(-1)}
                    onClick={(e) => {
                      e.stopPropagation();
                      pickSuggestion(s);
                    }}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      background: active ? '#eef2ff' : '#fff',
                      borderBottom: i === suggestions.length - 1 ? 'none' : '1px solid #f1f5f9',
                      display: 'grid',
                      gridTemplateColumns: '20px 1fr auto',
                      alignItems: 'center',
                      gap: 10
                    }}
                  >
                    <KindGlyph kind={s.kind} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.title}
                      </div>
                      {!!s.subtitle && (
                        <div style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.subtitle}
                        </div>
                      )}
                    </div>
                    <span className="badge flat" style={{ color: '#6b7280' }}>
                      {s.kind}
                    </span>
                  </div>
                );
              })}
              <div style={{ padding: '8px 12px', fontSize: 12, color: '#6b7280', background: '#fafafa' }}>
                Press ↑/↓ to navigate • Enter to open • Esc to close
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div style={{ position: 'relative' }}>
          <button
            ref={btnRef}
            aria-label="User menu"
            className="btn flat"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 10px',
              borderRadius: "16px",
            }}
            onClick={() => setMenuOpen(v => !v)}
          >
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt="avatar"
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div
                aria-hidden
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: '#111827',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
                  <path d="M6 21v-1a6 6 0 0 1 12 0v1" />
                </svg>
              </div>
            )}
            <span style={{ fontWeight: 700 }}>{me?.name || 'User'}</span>
          </button>

          {menuOpen && (
            <div
              id="user-menu"
              role="menu"
              ref={menuRef}
              style={{
                position: 'absolute',
                right: 0,
                marginTop: 8,
                width: 260,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)', // safari
                border: '1px solid #dacfbe',
                borderRadius: 16,
                boxShadow: '0 18px 40px rgba(0,0,0,.12)',
                padding: 12,
                zIndex: 50,
              }}
            >

              
              <div style={{ padding: 8, borderBottom: '1px solid #f1f5f9', marginBottom: 8 }}>
                <div style={{ fontWeight: 800 }}>{me?.name || 'User'}</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>{me?.email}</div>
              </div>
              
              {/* theme switch */}
              <div style={{
                margin: 10, 
                display: 'grid',
                gridTemplateColumns: '1fr 1fr', // Defines 3 equal-width columns
              }}>
                Night Mode
                <ThemeSwitch />
              </div>
              

              <button
                className="btn flat"
                style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 8 }}
                onClick={() => { setMenuOpen(false); alert('Settings panel not implemented yet.'); }}
              >
                Settings
              </button>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid #e5e7eb',
                  // background: '#fff',
                  marginBottom: 8
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Show setup on login</div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>Ask initial questions each time</div>
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!me?.show_setup_on_login}
                    onChange={toggleSetupFlag}
                    style={{ display: 'none' }}
                  />
                  <div
                    aria-hidden
                    style={{
                      width: 42, height: 24, borderRadius: 999,
                      background: me?.show_setup_on_login ? '#22c55e' : '#e5e7eb',
                      position: 'relative', transition: 'all .15s'
                    }}
                    onClick={toggleSetupFlag}
                  >
                    <div style={{
                      position: 'absolute', top: 2, left: me?.show_setup_on_login ? 22 : 2,
                      width: 20, height: 20, borderRadius: '50%', background: '#fff',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transition: 'left .15s'
                    }} />
                  </div>
                </label>
              </div>

              <button
                className="btn flat"
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  background: '#fee2e2',
                  border: '1px solid #fecaca',
                  color: '#991b1b'
                }}
                onClick={onLogout}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
