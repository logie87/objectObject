// src/lib/auth.ts
import { API_BASE } from "./api";

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", enc);
  const bytes = new Uint8Array(hashBuf);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

type LoginResponse = { access_token: string; token_type: string };

export async function login(email: string, password: string): Promise<void> {
  const pwdHash = await sha256Hex(password);
  const r = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pwdHash }),
  });
  if (!r.ok) throw new Error(await r.text());
  const data = (await r.json()) as LoginResponse;
  localStorage.setItem("token", data.access_token);
  localStorage.setItem("userEmail", email.toLowerCase());
}

export function logout(): void {
  localStorage.removeItem("token");
  localStorage.removeItem("userEmail");
}

export function isAuthed(): boolean {
  return !!localStorage.getItem("token");
}
