import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiNotFound, ApiUnavailable, clearServerGetCache, serverGet } from './serverApi';

describe('serverGet (public page reads)', () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  let mode: 'ok' | 'down' | '404' | '500' = 'ok';
  let realNow: () => number;
  let now = 1_000_000;

  beforeEach(() => {
    clearServerGetCache();
    calls = 0;
    mode = 'ok';
    realNow = Date.now;
    Date.now = () => now;
    globalThis.fetch = (async () => {
      calls++;
      if (mode === 'down') throw new TypeError('fetch failed');
      if (mode === '404') return new Response('{}', { status: 404 });
      if (mode === '500') return new Response('{}', { status: 500 });
      return new Response(JSON.stringify({ data: { plans: calls } }), { status: 200 });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    Date.now = realNow;
  });

  test('unwraps { data } and serves it from memory for `revalidate` seconds', async () => {
    assert.deepEqual(await serverGet('/plans', { revalidate: 300 }), { plans: 1 });
    now += 299_000;
    assert.deepEqual(await serverGet('/plans', { revalidate: 300 }), { plans: 1 });
    assert.equal(calls, 1);
    now += 2_000;
    assert.deepEqual(await serverGet('/plans', { revalidate: 300 }), { plans: 2 });
  });

  test('API down with nothing cached: ApiUnavailable, so the page renders its fallback', async () => {
    mode = 'down';
    await assert.rejects(serverGet('/plans'), ApiUnavailable);
    mode = '500';
    await assert.rejects(serverGet('/plans'), ApiUnavailable);
    mode = '404';
    await assert.rejects(serverGet('/jobs/x'), ApiNotFound);
  });

  test('API down after a good read: keeps serving the last answer (stale-if-error) for a day', async () => {
    await serverGet('/plans', { revalidate: 60 });
    mode = 'down';
    now += 3_600_000;
    assert.deepEqual(await serverGet('/plans', { revalidate: 60 }), { plans: 1 });
    now += 24 * 3_600_000;
    await assert.rejects(serverGet('/plans', { revalidate: 60 }), ApiUnavailable);
  });

  test('query params are part of the cache key', async () => {
    await serverGet('/plans', { params: { audience: 'individual' } });
    await serverGet('/plans', { params: { audience: 'employer' } });
    assert.equal(calls, 2);
  });
});
