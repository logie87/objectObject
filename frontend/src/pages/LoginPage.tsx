import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import InstructiveLogo from '../assets/instructive_logo.svg';

const BG_GRADIENT = 'linear-gradient(149deg,  #04e2bb 0%, #3dafbcff 30%, #353482 100%)';
const CARD_BG = 'white';
const CARD_SHADOW = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
const ERROR_BORDER = '#fecaca';
const ERROR_BG = '#fef2f2';
const ERROR_TEXT = '#b91c1c';
const LABEL_COLOR = '#374151';
const INPUT_BORDER = '#e5e7eb';
const INPUT_BG = '#f9fafb';
const INPUT_FOCUS_BORDER = '#3d5881';
const INPUT_FOCUS_BG = 'white';
const BUTTON_TEXT = 'white';
const BUTTON_GRADIENT = '#3d5881';
const BUTTON_SHADOW = '0 4px 6px rgba(13, 70, 91, 0.3)';

const LoginPage: React.FC = () => {
  const { isAuthenticated, login } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation() as any;
  const redirectTo = location.state?.from?.pathname || '/app/home';

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
      background: BG_GRADIENT,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'fixed',
      top: 0,
      left: 0
    }}>
      <div style={{
        backgroundColor: CARD_BG,
        borderRadius: '24px',
        padding: '48px',
        boxShadow: CARD_SHADOW,
        width: '100%',
        maxWidth: '420px',
        margin: '20px'
      }}>
        {err && (
          <div style={{
            marginBottom: 16,
            padding: '10px 12px',
            borderRadius: 12,
            border: `1px solid ${ERROR_BORDER}`,
            background: ERROR_BG,
            color: ERROR_TEXT,
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
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: LABEL_COLOR, marginBottom: 8 }}>
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
                border: `2px solid ${INPUT_BORDER}`,
                borderRadius: 12,
                outline: 'none',
                backgroundColor: INPUT_BG,
                transition: 'all 0.3s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = INPUT_FOCUS_BORDER;
                e.target.style.backgroundColor = INPUT_FOCUS_BG;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = INPUT_BORDER;
                e.target.style.backgroundColor = INPUT_BG;
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: LABEL_COLOR, marginBottom: 8 }}>
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
                border: `2px solid ${INPUT_BORDER}`,
                borderRadius: 12,
                outline: 'none',
                backgroundColor: INPUT_BG,
                transition: 'all 0.3s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = INPUT_FOCUS_BORDER;
                e.target.style.backgroundColor = INPUT_FOCUS_BG;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = INPUT_BORDER;
                e.target.style.backgroundColor = INPUT_BG;
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
              color: BUTTON_TEXT,
              background: BUTTON_GRADIENT,
              border: 'none',
              borderRadius: 12,
              cursor: busy ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              boxShadow: BUTTON_SHADOW,
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
