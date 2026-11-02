/**
 * api.ts – typed fetch wrapper for the AsteAI NestJS backend.
 *
 * All requests automatically attach the JWT from localStorage.
 * On 401, it attempts a token refresh before retrying once.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1`
  : '/api/v1';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const url = new URL(`${BASE}${path}`, 'http://placeholder');
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v));
    });
  }
  return url.pathname + url.search;
}

async function refreshTokens(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const userId = localStorage.getItem('userId');
  const refreshToken = localStorage.getItem('refreshToken');
  if (!userId || !refreshToken) return false;

  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, refreshToken }),
  });
  if (!res.ok) return false;

  const { data } = await res.json();
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  return true;
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
  _retry = true,
): Promise<T> {
  const { body, params, ...init } = options;
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(buildUrl(path, params), {
    ...init,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && _retry) {
    const refreshed = await refreshTokens();
    if (refreshed) return apiFetch<T>(path, options, false);
    // Clear auth and redirect
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');
      window.location.href = '/auth/login';
    }
    throw new Error('Unauthorised');
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Request failed' }));
    throw Object.assign(new Error(err.message ?? 'Request failed'), { status: response.status, body: err });
  }

  if (response.status === 204) return undefined as T;
  const json = await response.json();
  return (json.data !== undefined ? json.data : json) as T;
}

// ── Convenience wrappers ─────────────────────────────────────────────────────

export const api = {
  get:    <T>(path: string, params?: RequestOptions['params']) =>
    apiFetch<T>(path, { method: 'GET', params }),

  post:   <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body }),

  put:    <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body }),

  patch:  <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body }),

  delete: <T>(path: string) =>
    apiFetch<T>(path, { method: 'DELETE' }),
};
