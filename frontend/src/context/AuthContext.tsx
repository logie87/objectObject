import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const TOKEN_KEY = 'authToken';

type AuthContextType = {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') ||
  'https://refused-football-telling-guarantees.trycloudflare.com';

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  // keep a single source of truth
  const isAuthenticated = useMemo(() => !!token, [token]);

  useEffect(() => {
    // Sync token state with localStorage changes across tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY) setToken(localStorage.getItem(TOKEN_KEY));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = async (email: string, password: string) => {
    const passwordHash = await sha256Hex(password);
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: passwordHash }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json() as { access_token: string; token_type: string };
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem('userEmail', email.toLowerCase());
    setToken(data.access_token);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('userEmail');
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
