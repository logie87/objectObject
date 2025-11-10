export const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, "") ||
  "https://refused-football-telling-guarantees.trycloudflare.com";

const TOKEN_KEY = "authToken";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiGet<T>(path: string, options: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    ...options,
    method: "GET",
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  return handle<T>(r);
}

export async function apiDelete(path: string, options: RequestInit = {}): Promise<void> {
  const r = await fetch(`${API_BASE}${path}`, {
    ...options,
    method: "DELETE",
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  if (!r.ok) throw new Error(await r.text());
}

export async function apiPut<T>(path: string, body: unknown, options: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    ...options,
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers || {}) },
    body: JSON.stringify(body),
  });
  return handle<T>(r);
}

export async function apiPost<T>(path: string, body?: unknown, options: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    ...options,
    method: "POST",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...authHeaders(),
      ...(options.headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return handle<T>(r);
}

export async function apiPostForm<T>(path: string, fd: FormData, options: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    ...options,
    method: "POST",
    headers: { ...authHeaders(), ...(options.headers || {}) },
    body: fd,
  });
  return handle<T>(r);
}

export async function apiGetBlobUrl(path: string, options: RequestInit = {}): Promise<string> {
  const r = await fetch(`${API_BASE}${path}`, {
    ...options,
    method: "GET",
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  if (!r.ok) throw new Error(await r.text());
  const blob = await r.blob();
  return URL.createObjectURL(blob);
}
