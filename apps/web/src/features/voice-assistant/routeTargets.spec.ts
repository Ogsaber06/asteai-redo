import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NAV } from '@/lib/routes';
import { routeHref, routeTargets } from './routeTargets';

describe('routeTargets', () => {
  it('offers only built pages for the role', () => {
    const ids = routeTargets('Candidate').map((t) => t.id);
    const ready = NAV.Candidate.flatMap(([, items]) => items.filter((i) => i.ready).map((i) => `route:${i.slug}`));
    assert.deepEqual(ids, ready);
    assert.ok(!ids.includes('route:privacy'), 'unbuilt pages are not offered');
  });

  it('maps a route target to its platform path', () => {
    assert.equal(routeHref('route:mkt/studio'), '/platform/mkt/studio');
  });
});
