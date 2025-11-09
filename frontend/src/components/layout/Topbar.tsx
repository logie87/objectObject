import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPut, apiGetBlobUrl } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

type Me = {
  id: number;
  name: string;
  email: string;
  is_new: boolean;
  show_setup_on_login: boolean;
  avatar_url: string;
};

export default function Topbar(){
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [me, setMe] = useState<Me | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string>(''); // blob URL
  const [menuOpen, setMenuOpen] = useState(false);

  // Search state
  const [q, setQ] = useState('');
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number>(-1);

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const suggestions = [
    'Find outcomes about fractions',
    'IEP accommodations: extended time',
    'Recent reports',
    'Upload worksheet to Library',
    'Students: Alex Student',
    'BC Guidelines: assessment accommodations',
  ];

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

  function onSearchSubmit() {
    // Placeholder for now
    alert(q ? `Search: ${q}` : 'Search clicked (no query)');
    setSuggestOpen(false);
    setActiveIdx(-1);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setSuggestOpen(true);
      return;
    }
    if (!suggestOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = activeIdx >= 0 ? suggestions[activeIdx] : q;
      setQ(pick);
      onSearchSubmit();
    } else if (e.key === 'Escape') {
      setSuggestOpen(false);
      setActiveIdx(-1);
    }
  }

  function pickSuggestion(s: string) {
    setQ(s);
    onSearchSubmit();
  }

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
      {/* Left: logo above the sidebar column */}
      <div className="logo" style={{ minWidth: 180 }}>
        <img src="/icon.png" alt="instructive logo" className="logo-img" />
        <div>Instructive</div>
      </div>

      {/* Right: search + user menu */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Search: revert proportions, keep circle icon at right */}
        <div
          ref={searchWrapRef}
          className="search"
          style={{
            margin: 0,
            flex: 1,
            position: 'relative',
            paddingRight: 44, // reserve room for the circular icon button
          }}
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
            placeholder="Search outcomes, activities, IEPs, reports"
            aria-autocomplete="list"
            aria-expanded={suggestOpen}
            aria-controls="search-suggest"
          />
          {/* Small circular icon button (no text) */}
          <button
            aria-label="Search"
            onMouseDown={(e) => e.preventDefault()} // keep focus on input
            onClick={(e) => { e.stopPropagation(); onSearchSubmit(); }}
            style={{
              position: 'absolute',
              top: '50%',
              right: 6,
              transform: 'translateY(-50%)',
              width: 32,
              height: 32,
              borderRadius: '50%',
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
                    key={s}
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
                      borderBottom: i === suggestions.length - 1 ? 'none' : '1px solid #f1f5f9'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg
                        className="icon-24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                      <span>{s}</span>
                    </div>
                  </div>
                );
              })}
              <div style={{ padding: '8px 12px', fontSize: 12, color: '#6b7280', background: '#fafafa' }}>
                Press ↑/↓ to navigate • Enter to search • Esc to close
              </div>
            </div>
          )}
        </div>

        {/* User button in top-right */}
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
              borderRadius: 999,
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
              // Generic user icon (white on dark circle)
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
                background: '#fff',
                border: '1px solid #e5e7eb',
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

              <button
                className="btn flat"
                style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 8 }}
                onClick={() => { setMenuOpen(false); alert('Settings panel not implemented yet.'); }}
              >
                Settings
              </button>

              {/* Toggle: Show setup on login */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid #e5e7eb',
                  background: '#fff',
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

              {/* Logout (red) */}
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
