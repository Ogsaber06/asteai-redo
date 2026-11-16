import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { StatementOfWork, User } from '@asteai/types';
import { fakeDb } from '../../test-support/fakes';
import { CONTRACT_MILESTONE_STATUSES } from '../contracts/contract.types';
import { canApply, DISPUTABLE, MILESTONE_ACTIONS } from '../contracts/contract-rules';
import { MilestoneDisputesController } from '../disputes/disputes.controller';
import type { DisputesService } from '../disputes/disputes.service';
import { ProposalsService } from './proposals.service';
import { contractDraftFromSow, sowErrors } from './sow';

const SOW: StatementOfWork = {
  scope: 'Build the payments dashboard described in the brief, end to end.',
  deliverables: ['Dashboard UI', 'Reconciliation API'],
  milestones: [
    { title: 'Design', amount: 20000, dueInDays: 7, acceptanceCriteria: ['Figma signed off'] },
    { title: 'Build', amount: 50000.5, dueInDays: 21, acceptanceCriteria: ['All screens live on staging'] },
    { title: 'Launch', amount: 29999.5, dueInDays: 30, acceptanceCriteria: ['Production deploy'] },
  ],
  assumptions: [], outOfScope: ['Mobile app'], revisionRounds: 2,
};

describe('statement of work', () => {
  it('milestones must sum exactly to the bid, fit the timeline, and be in order', () => {
    assert.deepEqual(sowErrors(SOW, 100000, 30), []);
    assert.match(sowErrors(SOW, 90000, 30)[0], /add up to 100000\.00, not the bid price 90000\.00/);
    assert.match(sowErrors(SOW, 100000, 25).join(), /due after the 25-day timeline: Launch/);
    const shuffled = { ...SOW, milestones: [SOW.milestones[1], SOW.milestones[0], SOW.milestones[2]] };
    assert.match(sowErrors(shuffled, 100000, 30).join(), /in the order they are due/);
  });

  it('an awarded SOW becomes the fixed-price contract body with dated escrow milestones', () => {
    const draft = contractDraftFromSow({ id: 'P-1', price: 100000, sow: SOW }, new Date('2026-11-15T00:00:00Z'));
    assert.deepEqual(draft.paymentTerms, { totalAmount: 100000 });
    assert.equal(draft.engagementModel, 'fixed');
    assert.deepEqual(draft.milestones.map((m) => [m.title, m.amount, m.dueDate]),
      [['Design', 20000, '2026-11-22'], ['Build', 50000.5, '2026-12-06'], ['Launch', 29999.5, '2026-12-15']]);
  });

  it('submit refuses an inconsistent SOW before writing anything', async () => {
    const db = fakeDb([[/SELECT stage FROM projects/, [{ stage: 'Open for Bids' }]]]);
    const expert = { id: 'x1', role: 'Freelancer' } as User;
    await assert.rejects(new ProposalsService(db.pool).submit({ projectId: 'PRJ-1', price: 90000, days: 30, sow: SOW }, expert), BadRequestException);
    assert.equal(db.all(/INSERT INTO proposals/).length, 0);
  });

  it('contract draft: the project buyer only, only once awarded, only with a SOW', async () => {
    const svc = (status: string, sow: StatementOfWork | null = SOW) => new ProposalsService(fakeDb([
      [/FROM proposals p JOIN projects pr/, [{ id: 'P-1', price: '100000', status, sow, buyer_id: 'b1', project_id: 'PRJ-1' }]],
    ]).pool);
    const buyer = { id: 'b1', role: 'Buyer' } as User;
    assert.equal((await svc('Awarded').contractDraft('P-1', buyer)).milestones.length, 3);
    await assert.rejects(svc('Awarded').contractDraft('P-1', { id: 'b2', role: 'Buyer' } as User), ForbiddenException);
    await assert.rejects(svc('Pending').contractDraft('P-1', buyer), ConflictException);
    await assert.rejects(svc('Awarded', null).contractDraft('P-1', buyer), ConflictException);
  });
});

describe('milestone escrow flow: fund → submit_deliverable → approve_release → dispute', () => {
  it('the happy path is a chain of legal moves, and nothing skips the deliverable', () => {
    assert.ok(canApply('submit', 'funded'));
    assert.ok(canApply('approve_release', 'submitted'));
    assert.equal(MILESTONE_ACTIONS.approve_release.to, 'released');
    assert.equal(canApply('approve_release', 'funded'), false, 'no release without a submitted deliverable');
    assert.equal(canApply('approve_release', 'pending'), false, 'no release before funding');
    assert.equal(canApply('submit', 'pending'), false, 'no deliverable before funding');
    for (const done of ['released', 'cancelled'] as const) {
      for (const a of Object.keys(MILESTONE_ACTIONS) as (keyof typeof MILESTONE_ACTIONS)[]) assert.equal(canApply(a, done), false, `${a} from ${done}`);
    }
  });

  it('exactly the milestones holding escrow can be disputed', () => {
    assert.deepEqual([...DISPUTABLE].sort(), ['accepted', 'funded', 'revision_requested', 'submitted']);
    for (const s of DISPUTABLE) assert.ok((CONTRACT_MILESTONE_STATUSES as readonly string[]).includes(s));
  });

  it('POST /contracts/:id/milestones/:mid/dispute opens a milestone dispute through DisputesService', async () => {
    let got: unknown;
    const svc = { create: async (dto: unknown) => { got = dto; return { id: 'D-1' }; } } as unknown as DisputesService;
    const user = { id: 'b1', role: 'Buyer' } as User;
    await new MilestoneDisputesController(svc).dispute('CT-1', 'mid-1', { reasonCode: 'quality', description: 'Deliverable misses half the scope' } as never, user);
    assert.deepEqual(got, { contractId: 'CT-1', milestoneId: 'mid-1', reasonCode: 'quality', description: 'Deliverable misses half the scope' });
  });
});
