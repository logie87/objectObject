import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import InstructiveLogo from '../assets/instructive_logo.svg';

const BG_GRADIENT = ['#04e2bb', '#3dafbc', '#353482'] as const;
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

// --- Techy triangular mesh background ---
function TriMeshBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    let width = 0, height = 0, dpr = Math.max(1, window.devicePixelRatio || 1);

    type Pt = { x: number; y: number; bx: number; by: number; px: number; py: number; phase: number; amp: number };
    let cols = 0, rows = 0;
    let grid: Pt[] = [];
    const spacingBase = 120; // px target spacing between points
    const mouse = { x: Infinity, y: Infinity, vx: 0, vy: 0 };
    let lastMouseX = Infinity, lastMouseY = Infinity;

    // Build a regular grid of points
    function buildGrid() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const spacing = Math.max(80, Math.min(spacingBase, Math.min(width, height) / 8));
      cols = Math.ceil(width / spacing) + 2;
      rows = Math.ceil(height / spacing) + 2;

      grid = [];
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const jitter = (Math.random() - 0.5) * spacing * 0.25;
          const x = i * spacing - spacing + jitter;
          const y = j * spacing - spacing + jitter;
          grid.push({
            x, y,
            bx: x, by: y, // base/origin
            px: x, py: y, // previous (for velocity estimate if needed)
            phase: Math.random() * Math.PI * 2,
            amp: spacing * (0.10 + Math.random() * 0.15)
          });
        }
      }
    }

    // Triangles are implicit from the grid indices
    const idx = (i: number, j: number) => j * cols + i;

    // Render loop
    let t0 = performance.now();
    function frame(now: number) {
      const dt = Math.min(1 / 30, (now - t0) / 1000); // cap delta to keep stable
      t0 = now;

      // Background gradient fill
      const g = ctx.createLinearGradient(0, 0, width, height);
      g.addColorStop(0, BG_GRADIENT[0]);
      g.addColorStop(0.3, BG_GRADIENT[1]);
      g.addColorStop(1, BG_GRADIENT[2]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      // Soft mouse decay (so influence fades if mouse idle/leaves)
      if (!Number.isFinite(mouse.x) || !Number.isFinite(mouse.y)) {
        mouse.vx *= 0.9;
        mouse.vy *= 0.9;
      }

      // Update points: smooth orbital jitter around base plus tiny mouse push
      const time = now * 0.0015;
      const sigma = Math.min(width, height) * 0.25; // mouse influence radius
      const inv2sigma2 = 1 / (2 * sigma * sigma);

      for (let p of grid) {
        // Base sinusoidal motion (elliptical wobble)
        const sx = Math.sin(time + p.phase) * p.amp;
        const cy = Math.cos(time * 1.1 + p.phase * 1.3) * p.amp * 0.8;

        // Mouse repulsion (Gaussian)
        let mx = 0, my = 0;
        if (Number.isFinite(mouse.x) && Number.isFinite(mouse.y)) {
          const dx = p.bx - mouse.x;
          const dy = p.by - mouse.y;
          const d2 = dx * dx + dy * dy;
          const w = Math.exp(-d2 * inv2sigma2);
          const strength = 18; // small nudge
          mx = (dx / Math.sqrt(d2 + 1e-6)) * strength * w;
          my = (dy / Math.sqrt(d2 + 1e-6)) * strength * w;
        }

        // Spring back towards base to avoid drift
        const k = 0.08;
        const springX = (p.bx - p.x) * k;
        const springY = (p.by - p.y) * k;

        // Integrate (critically damped-ish)
        const nx = p.x + (sx + mx + springX) * dt;
        const ny = p.y + (cy + my + springY) * dt;

        p.px = p.x; p.py = p.y;
        p.x = nx; p.y = ny;
      }

      // Draw triangles with subtle strokes + fills
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;

      for (let j = 0; j < rows - 1; j++) {
        for (let i = 0; i < cols - 1; i++) {
          const p00 = grid[idx(i, j)];
          const p10 = grid[idx(i + 1, j)];
          const p01 = grid[idx(i, j + 1)];
          const p11 = grid[idx(i + 1, j + 1)];

          // Alternate diagonal for a more irregular look
          const diagFlip = ((i + j) & 1) === 0;

          // Triangle A
          {
            const a = p00, b = p10, c = diagFlip ? p11 : p01;
            // Fill color based on average y (gives soft banding) + time
            const ay = (a.y + b.y + c.y) / 3 / height;
            const alpha = 0.07 + 0.06 * Math.sin(6 * ay + time * 0.7 + (i + j) * 0.15);
            ctx.fillStyle = `rgba(18, 29, 61, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.lineTo(c.x, c.y);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = 'rgba(61, 88, 129, 0.28)';
            ctx.stroke();
          }

          // Triangle B
          {
            const a = diagFlip ? p11 : p01, b = p01, c = p10;
            const ay = (a.y + b.y + c.y) / 3 / height;
            const alpha = 0.07 + 0.06 * Math.sin(6 * ay + time * 0.7 + (i + j + 1) * 0.15);
            ctx.fillStyle = `rgba(18, 29, 61, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.lineTo(c.x, c.y);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = 'rgba(61, 88, 129, 0.28)';
            ctx.stroke();
          }
        }
      }

      // Optional: faint nodes for extra "tech"
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      for (let p of grid) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(frame);
    }

    function onMouseMove(e: MouseEvent) {
      const x = e.clientX;
      const y = e.clientY;
      mouse.vx = Number.isFinite(lastMouseX) ? x - lastMouseX : 0;
      mouse.vy = Number.isFinite(lastMouseY) ? y - lastMouseY : 0;
      mouse.x = x;
      mouse.y = y;
      lastMouseX = x;
      lastMouseY = y;
    }
    function onMouseLeave() {
      mouse.x = Infinity;
      mouse.y = Infinity;
    }
    function onResize() {
      buildGrid();
    }

    buildGrid();
    animRef.current = requestAnimationFrame(frame);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseleave', onMouseLeave, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        display: 'block',
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none', // mesh reacts, but canvas doesn’t block UI
        userSelect: 'none'
      }}
    />
  );
}

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
      alignItems: 'center',
      justifyContent: 'center',
      position: 'fixed',
      top: 0,
      left: 0
    }}>
      {/* Techy animated triangular mesh background */}
      <TriMeshBackground />

      {/* Foreground content */}
      <div style={{
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{
          backgroundColor: CARD_BG,
          borderRadius: '24px',
          padding: '48px',
          boxShadow: CARD_SHADOW,
          width: '100%',
          maxWidth: '420px',
          margin: '20px',
          backdropFilter: 'saturate(120%) blur(4px)',
          border: '1px solid rgba(255,255,255,0.2)'
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
                  e.currentTarget.style.borderColor = INPUT_FOCUS_BORDER;
                  e.currentTarget.style.backgroundColor = INPUT_FOCUS_BG;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = INPUT_BORDER;
                  e.currentTarget.style.backgroundColor = INPUT_BG;
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
                  e.currentTarget.style.borderColor = INPUT_FOCUS_BORDER;
                  e.currentTarget.style.backgroundColor = INPUT_FOCUS_BG;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = INPUT_BORDER;
                  e.currentTarget.style.backgroundColor = INPUT_BG;
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
    </div>
  );
};

export default LoginPage;
