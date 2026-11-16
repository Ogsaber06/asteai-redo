import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import type { User } from '@asteai/types';
import { fakeDb } from '../../test-support/fakes';
import { checkDeliverable, DeliverablesService, safeFileName } from './deliverables.module';

const storage = { bucket: 'files', region: 'ap-south-1', credentials: async () => ({ accessKeyId: 'AKID', secretAccessKey: 'secret' }) };
const expert = { id: 'exp-1', role: 'Freelancer' } as User;
const buyer = { id: 'buy-1', role: 'Buyer' } as User;
const stranger = { id: 'x', role: 'Buyer' } as User;

describe('deliverable file rules', () => {
  it('accepts known types by extension and refuses executables and mismatches', () => {
    assert.deepEqual(checkDeliverable('final.zip', 'application/x-zip-compressed', 10), { contentType: 'application/zip' });
    assert.ok('contentType' in checkDeliverable('deck.pptx', 'application/octet-stream', 10));
    for (const [name, type] of [['run.exe', 'application/x-msdownload'], ['x.sh', 'text/x-sh'], ['report.pdf', 'text/html'], ['pdf', '']]) {
      assert.ok('error' in checkDeliverable(name, type, 10), name);
    }
    assert.ok('error' in checkDeliverable('big.mp4', 'video/mp4', 60 * 1024 * 1024));
    assert.equal(safeFileName('../../etc/pass wd (1).pdf'), '.._.._etc_pass_wd_1_.pdf');
  });
});

function setup(withStorage = true) {
  const db = fakeDb([
    [/FROM gig_orders o WHERE o.id = \$1/, [{ contract_id: 'CT-1', buyer_id: 'buy-1', expert_id: 'exp-1', milestone_id: 'm-1' }]],
    [/SELECT buyer_id, expert_id FROM contracts WHERE id = \$1/, [{ buyer_id: 'buy-1', expert_id: 'exp-1' }]],
    [/INSERT INTO deliverable_files/, (p) => [{
      id: p[0], uploaded_by: p[1], order_id: p[2], contract_id: p[3], milestone_id: p[4], object_key: p[5], file_name: p[6],
      content_type: p[7], size_bytes: p[8], created_at: new Date('2026-11-15T00:00:00Z'),
    }]],
    [/FROM deliverable_files f JOIN contracts c/, [{ id: 'f1', object_key: 'deliverables/CT-1/f1/logo.zip', file_name: 'logo.zip', buyer_id: 'buy-1', expert_id: 'exp-1' }]],
  ]);
  return { db, svc: new DeliverablesService(db.pool, withStorage ? storage : null) };
}

describe('DeliverablesService', () => {
  it('only the expert on the order uploads; the PUT is signed for the exact type and size', async () => {
    const { svc, db } = setup();
    const t = await svc.createUpload(expert, { orderId: 'ORD-1', fileName: 'logo.zip', contentType: 'application/zip', sizeBytes: 2048 });
    const url = new URL(t.url);
    assert.match(url.pathname, /^\/deliverables\/CT-1\/[0-9a-f-]{36}\/logo\.zip$/);
    assert.equal(url.searchParams.get('X-Amz-SignedHeaders'), 'content-length;content-type;host');
    assert.equal(t.file.downloadPath, `/api/v1/deliverables/${t.file.id}/download`);
    assert.deepEqual(db.all(/INSERT INTO deliverable_files/)[0].params.slice(2, 5), ['ORD-1', 'CT-1', 'm-1']);
    await assert.rejects(svc.createUpload(buyer, { orderId: 'ORD-1', fileName: 'x.pdf', contentType: 'application/pdf', sizeBytes: 1 }), ForbiddenException);
    await assert.rejects(svc.createUpload(expert, { orderId: 'ORD-1', fileName: 'x.exe', contentType: 'application/x-msdownload', sizeBytes: 1 }), BadRequestException);
  });

  it('downloads only for the parties, as a short signed attachment link', async () => {
    const { svc } = setup();
    const link = new URL(await svc.downloadUrl(buyer, 'f1'));
    assert.equal(link.searchParams.get('X-Amz-Expires'), '60');
    assert.equal(link.searchParams.get('response-content-disposition'), 'attachment; filename="logo.zip"');
    await assert.rejects(svc.downloadUrl(stranger, 'f1'), ForbiddenException);
  });

  it('503 when storage is not configured', async () => {
    await assert.rejects(setup(false).svc.createUpload(expert, { orderId: 'ORD-1', fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes: 1 }), ServiceUnavailableException);
  });
});
