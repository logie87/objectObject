import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import InstructiveLogo from '../assets/instructive_logo.svg'; 

// --- minimal inline auth (uses your API URL env) ---
const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, '') ||
  'https://refused-football-telling-guarantees.trycloudflare.com';

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function doLogin(email: string, password: string) {
  const passwordHash = await sha256Hex(password);
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: passwordHash }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json() as { access_token: string; token_type: string };
  localStorage.setItem('token', data.access_token);
  localStorage.setItem('userEmail', email.toLowerCase());
}

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await doLogin(email.trim(), password);
      navigate('/app/home', { replace: true });
    } catch (ex: any) {
      setErr(typeof ex?.message === 'string' ? ex.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      background: 'linear-gradient(135deg, #a78bfa 0%, #a855f7 50%, #ec4899 100%)',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'fixed',
      top: 0,
      left: 0
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '24px',
        padding: '48px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        width: '100%',
        maxWidth: '420px',
        margin: '20px'
      }}>
        


        {err && (
          <div style={{
            marginBottom: 16,
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#b91c1c',
            fontSize: 14
          }}>
            {err}
          </div>
        )}

        {/* Company Logo */}
          <img
          src={InstructiveLogo}
          alt="Instructive Logo"
          style={{
            width: '280px', 
            height: 'auto',
            margin: '0 auto 40px', 
            display: 'block',
          }}
        />

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '16px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                outline: 'none',
                backgroundColor: '#f9fafb',
                transition: 'all 0.3s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#a855f7';
                e.target.style.backgroundColor = 'white';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.backgroundColor = '#f9fafb';
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '16px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                outline: 'none',
                backgroundColor: '#f9fafb',
                transition: 'all 0.3s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#a855f7';
                e.target.style.backgroundColor = 'white';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.backgroundColor = '#f9fafb';
              }}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              fontWeight: 600,
              color: 'white',
              background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
              border: 'none',
              borderRadius: '12px',
              cursor: busy ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              boxShadow: '0 4px 6px rgba(168, 85, 247, 0.3)',
              opacity: busy ? 0.8 : 1
            }}
            onMouseEnter={(e) => {
              if (busy) return;
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 12px rgba(168, 85, 247, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(168, 85, 247, 0.3)';
            }}
          >
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
