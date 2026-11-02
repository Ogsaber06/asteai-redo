import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { User } from '@asteai/types';

@Injectable()
export class ProposalsService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async findForProject(projectId: string) {
    const { rows } = await this.db.query(
      `SELECT p.*, u.first_name || ' ' || u.last_name AS expert_name
       FROM proposals p JOIN user_accounts u ON p.expert_id = u.id
       WHERE p.project_id = $1 ORDER BY p.created_at ASC`,
      [projectId],
    );
    return rows;
  }

  async findMine(userId: string) {
    const { rows } = await this.db.query(
      `SELECT p.*, pr.title AS project_title, pr.stage AS project_stage
       FROM proposals p JOIN projects pr ON p.project_id = pr.id
       WHERE p.expert_id = $1 ORDER BY p.created_at DESC`,
      [userId],
    );
    return rows;
  }

  async submit(dto: { projectId: string; price: number; days: number; note?: string }, user: User) {
    const existing = await this.db.query(
      `SELECT id FROM proposals WHERE project_id = $1 AND expert_id = $2`,
      [dto.projectId, user.id],
    );
    if (existing.rows.length) return existing.rows[0];

    const id = 'P-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const { rows } = await this.db.query(
      `INSERT INTO proposals (id, project_id, expert_id, price, days, note)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, dto.projectId, user.id, dto.price, dto.days, dto.note ?? ''],
    );
    return rows[0];
  }

  async award(proposalId: string, user: User) {
    const { rows: pRows } = await this.db.query(`SELECT * FROM proposals WHERE id = $1`, [proposalId]);
    if (!pRows.length) throw new NotFoundException();
    const proposal = pRows[0];

    const { rows: prRows } = await this.db.query(`SELECT * FROM projects WHERE id = $1`, [proposal.project_id]);
    if (!prRows.length) throw new NotFoundException();
    if (prRows[0].buyer_id !== user.id) throw new ForbiddenException();

    await this.db.query(
      `UPDATE proposals SET status = 'Rejected' WHERE project_id = $1 AND id != $2`,
      [proposal.project_id, proposalId],
    );
    await this.db.query(
      `UPDATE proposals SET status = 'Awarded' WHERE id = $1`,
      [proposalId],
    );
    await this.db.query(
      `UPDATE projects SET stage = 'Contracted', awarded_to = $1 WHERE id = $2`,
      [proposal.expert_id, proposal.project_id],
    );
    return { awarded: true, projectId: proposal.project_id, expertId: proposal.expert_id };
  }
}
