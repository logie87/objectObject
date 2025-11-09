import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import InstructiveLogo from '../assets/instructive_logo.svg';

const LoginPage: React.FC = () => {
  const { isAuthenticated, login } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation() as any;
  const redirectTo = location.state?.from?.pathname || '/app/home';

  // IMPORTANT: never navigate during render; do it in an effect
  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      // Redirect happens via the effect once isAuthenticated flips to true
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

        <img
          src={InstructiveLogo}
          alt="Instructive Logo"
          style={{ width: 280, height: 'auto', margin: '0 auto 40px', display: 'block' }}
        />

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 8 }}>
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
                fontSize: 16,
                border: '2px solid #e5e7eb',
                borderRadius: 12,
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

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 8 }}>
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
                fontSize: 16,
                border: '2px solid #e5e7eb',
                borderRadius: 12,
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
              padding: 14,
              fontSize: 16,
              fontWeight: 600,
              color: 'white',
              background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
              border: 'none',
              borderRadius: 12,
              cursor: busy ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              boxShadow: '0 4px 6px rgba(168, 85, 247, 0.3)',
              opacity: busy ? 0.8 : 1
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
