import React, { createContext, useContext, useState, useEffect, type JSX } from 'react';
import { Navigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || 'https://refused-football-telling-guarantees.trycloudflare.com';

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

interface AuthContextType {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => JSX.Element;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem('userToken'));

  useEffect(() => {
    // Check for a token or other authentication indicator on mount
    const token = localStorage.getItem('authToken');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const passwordHash = await sha256Hex(password);
    const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: passwordHash }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json() as { access_token: string; user_name: string; token_type: string };
    localStorage.setItem('authToken', data.access_token);
    localStorage.setItem('userName', data.user_name)
    localStorage.setItem('userEmail', email.toLowerCase());
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    setIsAuthenticated(false);

    return <Navigate to="/" replace />;
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};