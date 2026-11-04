import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BadGatewayException, HttpException } from '@nestjs/common';
import type { Pool } from 'pg';
import type { User } from '@asteai/types';
import type { AiService } from '../ai/ai.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import type { ConfigService } from '@nestjs/config';
import { AssessmentsService, type ScoredSession } from './assessments.service';

const candidate = { id: 'cand-1', role: 'Candidate' } as User;
const admin = { id: 'adm-1', role: 'Admin', firstName: 'Ops', lastName: 'Lead' } as User;

/** A pool that answers queries in order from `replies` and records the SQL it saw. */
function fakePool(replies: { rows: unknown[]; rowCount?: number }[]) {
  const sql: string[] = [];
  const params: unknown[][] = [];
  const query = async (text: string, values: unknown[] = []) => {
    sql.push(text);
    params.push(values);
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return { rows: [], rowCount: 0 };
    const next = replies.shift() ?? { rows: [] };
    return { rowCount: next.rows.length, ...next };
  };
  // withTransaction() takes a client from the pool; the fake hands back itself.
  const pool = { query, connect: async () => ({ query, release: () => undefined }) } as unknown as Pool;
  return { pool, sql, params };
}

function aiError(status: number, detail: string) {
  return Object.assign(new BadGatewayException(`AI service error (${status})`), {
    aiStatus: status,
    aiBody: JSON.stringify({ detail }),
  });
}

const scored = (over: Partial<ScoredSession> = {}): ScoredSession => ({
  session_id: 'S1', candidate_id: 'cand-1', requisition_id: 'REQ-1', language: 'English',
  theta: { iq: 0, eq: 0, grit: 0 }, sten: { iq: 5.5, eq: 5.5, grit: 5.5 }, fit: 5.5, ci: 0.4,
  integrity: 'Clear', integ: { blur: 0, paste: 0, fast: 0 }, n: { iq: 9, eq: 5, grit: 4 },
  duration_sec: 900, events: [], self: 4, safety: null, ...over,
});

describe('AssessmentsService', () => {
  it('refuses to start without an application', async () => {
    const { pool } = fakePool([{ rows: [] }]);
    const svc = new AssessmentsService(pool, {} as AiService, {} as NotificationsService, {} as EmailService);
    await assert.rejects(svc.start(candidate, 'REQ-1'), (e: HttpException) => e.getStatus() === 404);
  });

  it('refuses a retake once a result exists', async () => {
    const { pool } = fakePool([{ rows: [{ result_id: 'R-1', req_status: 'Open' }] }]);
    const svc = new AssessmentsService(pool, {} as AiService, {} as NotificationsService, {} as EmailService);
    await assert.rejects(svc.start(candidate, 'REQ-1'), (e: HttpException) => e.getStatus() === 409);
  });

  it('sends the requisition settings from the database, not the browser', async () => {
    const { pool } = fakePool([
      { rows: [{ tier: 'Frontline', industry: 'Retail', weight_iq: 30, weight_eq: 40, weight_grit: 30,
                 stack: ['Safety'], language: 'Hindi', req_status: 'Open', result_id: null }] },
      { rows: [] }, // no existing session
      { rows: [{}], rowCount: 1 }, // session row inserted
    ]);
    let sent: Record<string, unknown> = {};
    const ai = { post: async (_path: string, body: Record<string, unknown>) => {
      sent = body;
      return { session_id: 'S1', done: false, item: { id: '0', type: 'consent', progress: { index: 0, total: 20 } } };
    } } as unknown as AiService;
    const step = await new AssessmentsService(pool, ai, {} as NotificationsService, {} as EmailService).start(candidate, 'REQ-1');
    assert.deepEqual(sent, {
      candidate_id: 'cand-1', requisition_id: 'REQ-1', tier: 'Frontline', industry: 'Retail',
      weights: { iq: 30, eq: 40, grit: 30 }, stack: ['Safety'], language: 'Hindi',
    });
    assert.deepEqual([step.sessionId, step.done, step.item?.type], ['S1', false, 'consent']);
  });

  it("passes deeptech_ai's 422 through with its message", async () => {
    const { pool } = fakePool([{ rows: [{ id: 'S1', status: 'active', requisition_id: 'REQ-1' }] }]);
    const ai = { post: async () => { throw aiError(422, 'choice must be an integer from 0 to 3'); } } as unknown as AiService;
    await assert.rejects(
      new AssessmentsService(pool, ai, {} as NotificationsService, {} as EmailService).answer(candidate, 'S1', { itemId: '3', response: { choice: 9 } }),
      (e: HttpException) => e.getStatus() === 422 && e.message === 'choice must be an integer from 0 to 3',
    );
  });

  it('marks a session deeptech_ai no longer has as expired', async () => {
    const { pool, sql } = fakePool([{ rows: [{ id: 'S1', status: 'active', requisition_id: 'REQ-1' }] }, { rows: [] }]);
    const ai = { post: async () => { throw aiError(404, 'Assessment session not found'); } } as unknown as AiService;
    await assert.rejects(
      new AssessmentsService(pool, ai, {} as NotificationsService, {} as EmailService).answer(candidate, 'S1', { itemId: '3', response: {} }),
      (e: HttpException) => e.getStatus() === 409 && /expired/.test(e.message),
    );
    assert.match(sql[1], /SET status = 'expired'/);
  });

  it('does not call deeptech_ai again for a completed session', async () => {
    const { pool } = fakePool([{ rows: [{ id: 'S1', status: 'completed', result_id: 'R-9' }] }]);
    const ai = { post: async () => assert.fail('should not be called') } as unknown as AiService;
    const step = await new AssessmentsService(pool, ai, {} as NotificationsService, {} as EmailService).answer(candidate, 'S1', { itemId: '0', response: {} });
    assert.deepEqual(step, { sessionId: 'S1', done: true, resultId: 'R-9' });
  });

  it("refuses to store a result for someone else's session", async () => {
    const svc = new AssessmentsService(fakePool([]).pool, {} as AiService, {} as NotificationsService, {} as EmailService);
    await assert.rejects(svc.storeResult('cand-1', 'REQ-1', scored({ candidate_id: 'cand-2' })),
      (e: HttpException) => e.getStatus() === 403);
    await assert.rejects(svc.storeResult('cand-1', 'REQ-1', scored({ requisition_id: 'REQ-2' })),
      (e: HttpException) => e.getStatus() === 403);
  });

  it('tells a candidate whose session was reset to start again', async () => {
    const { pool } = fakePool([{ rows: [{ id: 'S1', status: 'reset', requisition_id: 'REQ-1' }] }]);
    const ai = { post: async () => assert.fail('should not be called') } as unknown as AiService;
    await assert.rejects(
      new AssessmentsService(pool, ai, {} as NotificationsService, {} as EmailService).answer(candidate, 'S1', { itemId: '0', response: {} }),
      (e: HttpException) => e.getStatus() === 409 && /reset/.test(e.message),
    );
  });

  describe('resetSession', () => {
    it('refuses unknown, completed and already reset sessions', async () => {
      const svc = (rows: unknown[]) => new AssessmentsService(fakePool([{ rows }]).pool, {} as AiService, {} as NotificationsService, {} as EmailService);
      await assert.rejects(svc([]).resetSession(admin, 'S1', 'reason long enough'),
        (e: HttpException) => e.getStatus() === 404);
      await assert.rejects(svc([{ status: 'completed' }]).resetSession(admin, 'S1', 'reason long enough'),
        (e: HttpException) => e.getStatus() === 409 && /integrity review/.test(e.message));
      await assert.rejects(svc([{ status: 'reset' }]).resetSession(admin, 'S1', 'reason long enough'),
        (e: HttpException) => e.getStatus() === 409);
    });

    it('marks the session reset and writes the audit log in one transaction', async () => {
      const { pool, sql, params } = fakePool([
        { rows: [{ status: 'expired', candidate_id: 'cand-1', requisition_id: 'REQ-1', requisition_title: 'Analyst',
                   candidate_email: 'cand@example.test', candidate_first_name: 'Asha' }] },
        { rows: [{}] }, // update
        { rows: [{}] }, // audit
        { rows: [{ id: 'N1', user_id: 'cand-1', text: 't', link: '/x', read: false, created_at: '2026-11-04T09:00:00Z' }] },
        { rows: [{ id: 'E1' }] }, // email outbox
        { rows: [{ id: 'S1', status: 'reset', candidate_id: 'cand-1', requisition_id: 'REQ-1', started_at: '2026-11-03T10:00:00Z',
                   reset_at: '2026-11-04T09:00:00Z', reset_reason: 'Power cut mid-test', reset_by_name: 'Ops Lead',
                   candidate_email: 'c@example.test', candidate_name: 'Cand', requisition_title: 'Analyst', tenant_id: 't1' }] },
      ]);
      const config = { get: (k: string) => (k === 'PUBLIC_WEB_URL' ? 'https://app.asteai.test' : undefined) } as ConfigService;
      const out = await new AssessmentsService(pool, {} as AiService, new NotificationsService(pool), new EmailService(pool, config))
        .resetSession(admin, 'S1', 'Power cut mid-test');

      assert.deepEqual(sql.slice(0, 1), ['BEGIN']);
      assert.match(sql[1], /FOR UPDATE/);
      assert.match(sql[2], /SET status = 'reset'/);
      assert.deepEqual(params[2], ['S1', 'adm-1', 'Power cut mid-test']);
      assert.match(sql[3], /INSERT INTO audit_log/);
      assert.equal(params[3][1], 'Ops Lead');
      assert.deepEqual(JSON.parse(params[3][4] as string),
        { previousStatus: 'expired', candidateId: 'cand-1', requisitionId: 'REQ-1', reason: 'Power cut mid-test' });
      assert.match(sql[4], /INSERT INTO notifications/);
      assert.equal(params[4][0], 'cand-1');
      assert.equal(params[4][1], 'Support has reset your assessment for Analyst. You can start it again now.');
      assert.equal(params[4][2], '/platform/assess?req=REQ-1');
      assert.ok(!String(params[4][1]).includes('Power cut'), 'the admin reason is not shown to the candidate');
      assert.match(sql[5], /INSERT INTO email_outbox/);
      const [userId, to, template, subject, html, text, dedupe] = params[5] as string[];
      assert.deepEqual([userId, to, template, dedupe], ['cand-1', 'cand@example.test', 'assessment-reset', 'assessment-reset:S1']);
      assert.equal(subject, 'Your assessment for Analyst has been reset');
      assert.match(text, /^Hi Asha,/);
      assert.match(html, /https:\/\/app\.asteai\.test\/platform\/assess\?req=REQ-1/);
      assert.ok(!html.includes('Power cut') && !text.includes('Power cut'), 'the admin reason is not emailed');
      assert.equal(sql[6], 'COMMIT');
      assert.deepEqual([out.status, out.resetByName, out.resetReason], ['reset', 'Ops Lead', 'Power cut mid-test']);
    });
  });
});
