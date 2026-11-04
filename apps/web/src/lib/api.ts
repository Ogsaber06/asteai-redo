/**
 * Typed fetch wrapper for the AsteAI NestJS backend.
 *
 * - Attaches the bearer access token.
 * - On a 401 it refreshes the tokens once (shared by all concurrent requests, because
 *   refresh tokens are single-use) and retries the request.
 * - Unwraps the API's `{ data }` envelope and throws `ApiError` for non-2xx responses.
 */
import { tokenStorage } from './tokens';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/api/v1`
  : '/api/v1';

type QueryParams = Record<string, string | number | boolean | undefined>;

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: QueryParams;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Called when the session can no longer be refreshed (set by the auth store). */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

function buildUrl(path: string, params?: QueryParams): string {
  const query = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v !== undefined) query.set(k, String(v));
  });
  const qs = query.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
}

let refreshInFlight: Promise<boolean> | null = null;

/** Exchanges the refresh token for new tokens. Concurrent callers share one request. */
function refreshTokens(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const { userId, refreshToken } = tokenStorage.get();
    if (!userId || !refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, refreshToken }),
      });
      if (!res.ok) return false;
      const { data } = (await res.json()) as { data: { accessToken: string; refreshToken: string } };
      tokenStorage.set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

async function errorFrom(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
  const raw = body?.message;
  const message = Array.isArray(raw) ? raw.join(', ') : raw || `Request failed (${response.status})`;
  return new ApiError(message, response.status, body);
}

/**
 * Sends an authenticated request and returns the raw Response (for downloads etc.).
 * Auth endpoints never trigger a refresh: a 401 from /auth/login is a wrong password.
 */
export async function apiRequest(path: string, options: RequestOptions = {}, retry = true): Promise<Response> {
  const { body, params, headers: extraHeaders, ...init } = options;
  const headers = new Headers(extraHeaders);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  const token = tokenStorage.getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(buildUrl(path, params), {
    ...init,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refreshTokens()) return apiRequest(path, options, false);
    tokenStorage.clear();
    onSessionExpired?.();
    throw new ApiError('Your session has expired. Please sign in again.', 401);
  }

  if (!response.ok) throw await errorFrom(response);
  return response;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await apiRequest(path, options);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  const json = JSON.parse(text) as { data?: T } | T;
  return (json && typeof json === 'object' && 'data' in json ? json.data : json) as T;
}

export const api = {
  get: <T>(path: string, params?: QueryParams) => apiFetch<T>(path, { method: 'GET', params }),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};

/** SWR fetcher: `useSWR<T>(path, fetcher)`. */
export const fetcher = <T>(path: string) => api.get<T>(path);

/** A readable message for anything a request might throw. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
