/**
 * Server-side reads for public pages (RSC). The browser `/api/v1` rewrite is not available
 * here, so this calls the API origin directly and unwraps the `{ data }` envelope.
 *
 * Caching is done here, not by Next's fetch cache: with `next.revalidate`, a cached entry
 * that goes stale while the API is down makes Next's background revalidation fail inside
 * the render, and the page's response never finishes (found by the a11y e2e suite on
 * /pricing). Instead, a small in-process cache keeps each successful read for `revalidate`
 * seconds and, if the API then fails, keeps serving it for up to a day (stale-if-error);
 * with nothing cached, the page's own fallback renders. Requests time out after 8 s so a
 * slow API can't stall a page either.
 */
const ORIGIN = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

const TIMEOUT_MS = 8_000;
const STALE_IF_ERROR_MS = 24 * 3_600_000;
const MAX_ENTRIES = 500;

/** The API could not be reached or answered with a server error / unknown route. */
export class ApiUnavailable extends Error {}

/** The API answered 404 for this resource. */
export class ApiNotFound extends Error {}

const cache = new Map<string, { at: number; value: unknown }>();

/** Test hook. */
export function clearServerGetCache() {
  cache.clear();
}

function remember(key: string, value: unknown) {
  cache.delete(key);
  cache.set(key, { at: Date.now(), value });
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
}

export async function serverGet<T>(
  path: string,
  { revalidate = 60, params }: { revalidate?: number; params?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const url = new URL(`${ORIGIN}/api/v1${path}`);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }
  const key = url.toString();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < revalidate * 1000) return hit.value as T;

  try {
    let res: Response;
    try {
      res = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new ApiUnavailable('The service is temporarily unavailable.');
    }
    if (res.status === 404) throw new ApiNotFound('Not found');
    if (!res.ok) throw new ApiUnavailable('The service is temporarily unavailable.');
    const json = (await res.json().catch(() => {
      throw new ApiUnavailable('The service returned an unreadable answer.');
    })) as { data?: T } | T;
    const value = (json && typeof json === 'object' && 'data' in json ? json.data : json) as T;
    remember(key, value);
    return value;
  } catch (err) {
    // Stale-if-error: during an outage keep showing the last good answer for a while.
    if (err instanceof ApiUnavailable && hit && Date.now() - hit.at < STALE_IF_ERROR_MS) return hit.value as T;
    throw err;
  }
}
