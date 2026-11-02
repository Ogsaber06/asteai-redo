import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { User, ApplicationStage } from '@asteai/types';

@Injectable()
export class ApplicationsService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async findForRequisition(reqId: string, user: User) {
    const { rows } = await this.db.query(
      `SELECT a.*, u.first_name || ' ' || u.last_name AS candidate_name,
              u.email AS candidate_email
       FROM applications a
       JOIN user_accounts u ON a.candidate_id = u.id
       WHERE a.requisition_id = $1
       ORDER BY a.created_at DESC`,
      [reqId],
    );
    return rows;
  }

  async findForCandidate(candidateId: string, user: User) {
    if (user.role === 'Candidate' && user.id !== candidateId) throw new ForbiddenException();
    const { rows } = await this.db.query(
      `SELECT a.*, r.title AS req_title, r.industry, r.tier
       FROM applications a
       JOIN requisitions r ON a.requisition_id = r.id
       WHERE a.candidate_id = $1
       ORDER BY a.created_at DESC`,
      [candidateId],
    );
    return rows;
  }

  async apply(reqId: string, candidateId: string) {
    // Prevent duplicate applications
    const existing = await this.db.query(
      `SELECT id FROM applications WHERE requisition_id = $1 AND candidate_id = $2`,
      [reqId, candidateId],
    );
    if (existing.rows.length) return existing.rows[0];

    const { rows: reqRows } = await this.db.query(
      `SELECT id, tenant_id FROM requisitions WHERE id = $1`,
      [reqId],
    );
    if (!reqRows.length) throw new NotFoundException(`Requisition not found`);

    const id = 'A-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const history = JSON.stringify([{ t: Date.now(), stage: 'Applied', by: 'system' }]);

    const { rows } = await this.db.query(
      `INSERT INTO applications (id, candidate_id, requisition_id, tenant_id, stage, history)
       VALUES ($1, $2, $3, $4, 'Applied', $5::jsonb)
       RETURNING *`,
      [id, candidateId, reqId, reqRows[0].tenant_id, history],
    );
    return rows[0];
  }

  async advanceStage(appId: string, stage: ApplicationStage, byName: string, user: User) {
    const { rows } = await this.db.query(`SELECT * FROM applications WHERE id = $1`, [appId]);
    if (!rows.length) throw new NotFoundException();

    const app = rows[0];
    const history = [...(app.history ?? []), { t: Date.now(), stage, by: byName }];

    const { rows: updated } = await this.db.query(
      `UPDATE applications SET stage = $1, history = $2::jsonb, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [stage, JSON.stringify(history), appId],
    );
    return updated[0];
  }

  async addScorecard(appId: string, data: { score: number; note: string }, user: User) {
    const id = randomUUID();
    await this.db.query(
      `INSERT INTO scorecards (id, application_id, scored_by, score, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, appId, user.id, data.score, data.note],
    );
    const { rows } = await this.db.query(
      `SELECT * FROM scorecards WHERE application_id = $1 ORDER BY created_at DESC`,
      [appId],
    );
    return rows;
  }
}
