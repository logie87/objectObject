export const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, "") ||
  "https://refused-football-telling-guarantees.trycloudflare.com";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { headers: { ...authHeaders() } });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiDelete(path: string): Promise<void> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!r.ok) throw new Error(await r.text());
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiPostForm<T>(path: string, fd: FormData): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: fd,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// File download with auth, returns a blob URL you can open
export async function apiGetBlobUrl(path: string): Promise<string> {
  const r = await fetch(`${API_BASE}${path}`, { headers: { ...authHeaders() } });
  if (!r.ok) throw new Error(await r.text());
  const blob = await r.blob();
  return URL.createObjectURL(blob);
}
