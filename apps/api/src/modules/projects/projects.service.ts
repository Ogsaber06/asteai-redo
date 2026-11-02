import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { User } from '@asteai/types';

@Injectable()
export class ProjectsService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async findOpen(page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    const { rows } = await this.db.query(
      `SELECT p.*, u.first_name || ' ' || u.last_name AS buyer_name
       FROM projects p
       JOIN user_accounts u ON p.buyer_id = u.id
       WHERE p.stage = 'Open for Bids'
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset],
    );
    return rows;
  }

  async findForUser(userId: string, role: 'buyer' | 'freelancer') {
    const field = role === 'buyer' ? 'buyer_id' : 'awarded_to';
    const { rows } = await this.db.query(
      `SELECT * FROM projects WHERE ${field} = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return rows;
  }

  async findOne(id: string) {
    const { rows } = await this.db.query(
      `SELECT p.*, u.first_name || ' ' || u.last_name AS buyer_name
       FROM projects p
       JOIN user_accounts u ON p.buyer_id = u.id
       WHERE p.id = $1`,
      [id],
    );
    if (!rows.length) throw new NotFoundException(`Project ${id} not found`);
    return rows[0];
  }

  async create(dto: any, user: User) {
    const id = 'PRJ-' + Math.floor(1000 + Math.random() * 9000);
    const { rows } = await this.db.query(
      `INSERT INTO projects (id, buyer_id, tenant_id, title, domain, budget, description, milestones, nda_required)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
       RETURNING *`,
      [
        id, user.id, user.tenantId,
        dto.title, dto.domain, dto.budget,
        dto.description, JSON.stringify(dto.milestones ?? []),
        dto.ndaRequired ?? false,
      ],
    );
    return rows[0];
  }

  async updateStage(id: string, stage: string, user: User) {
    const project = await this.findOne(id);
    if (project.buyer_id !== user.id && user.role !== 'Admin') throw new ForbiddenException();
    const { rows } = await this.db.query(
      `UPDATE projects SET stage = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [stage, id],
    );
    return rows[0];
  }

  async updateMilestone(projectId: string, milestoneId: string, status: string, user: User) {
    const project = await this.findOne(projectId);
    const milestones = (project.milestones ?? []).map((m: any) =>
      m.id === milestoneId ? { ...m, status } : m,
    );
    const { rows } = await this.db.query(
      `UPDATE projects SET milestones = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [JSON.stringify(milestones), projectId],
    );
    return rows[0];
  }
}
