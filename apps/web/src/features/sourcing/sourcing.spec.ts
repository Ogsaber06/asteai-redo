import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { ContractMilestone, GigOrder } from '@asteai/types';
import {
  canDisputeMilestone, checkDeliverableFile, escrowSummary, milestoneStep, milestoneTag, nextTrigger, orderWorkLog,
  searchAffordability,
} from './format';

describe('AI search credit check', () => {
  test('shows cost and balance, and blocks when the wallet is short', () => {
    assert.deepEqual(searchAffordability(40, 15), { ok: true, message: '15 credits per search · balance 40' });
    assert.deepEqual(searchAffordability(15, 15).ok, true);
    assert.deepEqual(searchAffordability(10, 15), { ok: false, message: 'Needs 15 credits; you have 10.' });
    assert.equal(searchAffordability(undefined, 15).ok, true, 'balance still loading: let the API decide');
  });
});

describe('deliverable files', () => {
  test('allowed types up to 50 MB; executables and extension-less names refused', () => {
    assert.deepEqual(checkDeliverableFile({ name: 'design.ZIP', type: 'application/x-zip-compressed', size: 1000 }), { contentType: 'application/zip' });
    assert.deepEqual(checkDeliverableFile({ name: 'report.pdf', type: '', size: 10 }), { contentType: 'application/pdf' });
    assert.ok('error' in checkDeliverableFile({ name: 'setup.exe', type: 'application/x-msdownload', size: 10 }));
    assert.ok('error' in checkDeliverableFile({ name: 'pdf', type: '', size: 10 }));
    assert.match((checkDeliverableFile({ name: 'v.mp4', type: 'video/mp4', size: 51 * 1024 * 1024 }) as { error: string }).error, /51\.0 MB/);
  });
});

describe('order work log', () => {
  const order = {
    createdAt: '2026-11-01T10:00:00Z', packageName: 'Standard', requirements: 'Logo + brand kit', revisions: 2, revisionsUsed: 1,
    deliveredAt: '2026-11-05T10:00:00Z', status: 'completed',
    deliveries: [{ id: 'd1', note: 'v1', links: ['https://figma.com/x'], createdAt: '2026-11-04T10:00:00Z' }],
  } as unknown as GigOrder;

  test('order, deliveries, files, revisions and acceptance, oldest first', () => {
    const log = orderWorkLog(order, [{ id: 'f1', fileName: 'logo.zip', sizeBytes: 2048, createdAt: '2026-11-03T09:00:00Z' } as never]);
    assert.deepEqual(log.map((e) => e.label), [
      'Ordered Standard', 'Uploaded logo.zip', 'Delivered', '1 of 2 revisions requested', 'Accepted, escrow released',
    ]);
    assert.equal(log[1].detail, '2 KB');
    assert.match(log[2].detail ?? '', /v1\nhttps:\/\/figma\.com\/x/);
  });
});

describe('escrow tracker', () => {
  const ms = (status: ContractMilestone['status'], paymentPending = false) => ({ status, paymentPending }) as ContractMilestone;

  test('funded, held, released and unfunded amounts', () => {
    assert.deepEqual(escrowSummary({ totalAmount: 1000, escrowFunded: 600, released: 250.5 }),
      { total: 1000, funded: 600, released: 250.5, held: 349.5, unfunded: 400 });
  });

  test('fund → submit deliverable → approve & release, per side', () => {
    assert.equal(nextTrigger(ms('pending'), 'buyer', true), 'fund');
    assert.equal(nextTrigger(ms('pending', true), 'buyer', true), null, 'no second payment while one confirms');
    assert.equal(nextTrigger(ms('funded'), 'expert', true), 'submit');
    assert.equal(nextTrigger(ms('funded'), 'buyer', true), null);
    assert.equal(nextTrigger(ms('submitted'), 'buyer', true), 'approve_release');
    assert.equal(nextTrigger(ms('revision_requested'), 'expert', true), 'submit');
    assert.equal(nextTrigger(ms('accepted'), 'buyer', true), 'release');
    assert.equal(nextTrigger(ms('submitted'), 'buyer', false), null, 'disputed / inactive contract: frozen');
    assert.equal(nextTrigger(ms('released'), 'buyer', true), null);
  });

  test('progress steps, tags and which milestones can be disputed', () => {
    assert.deepEqual(['pending', 'funded', 'submitted', 'released'].map((s) => milestoneStep(ms(s as never))), [0, 1, 2, 3]);
    assert.equal(milestoneTag(ms('pending', true)).label, 'Payment confirming');
    assert.equal(milestoneTag(ms('submitted')).label, 'Deliverable submitted');
    assert.deepEqual(['pending', 'funded', 'submitted', 'released'].map((s) => canDisputeMilestone(ms(s as never))), [false, true, true, false]);
  });
});
