import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import type { Milestone, MilestoneStatus, ProjectStage, User } from '@asteai/types';
import { DB_POOL, withTransaction } from '../../database/database.module';
import { generateId } from '../../common/utils/ids';
import { Pagination } from '../../common/utils/pagination';
import { CreateProjectDto } from './dto/project.dto';
import { mapProjectRow, ProjectRow } from './project.mapper';

const WITH_BUYER = `SELECT p.*, CONCAT_WS(' ', u.first_name, u.last_name) AS buyer_name
  FROM projects p JOIN user_accounts u ON p.buyer_id = u.id`;

@Injectable()
export class ProjectsService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async findOpen({ pageSize, offset }: Pagination) {
    const { rows } = await this.db.query<ProjectRow>(
      `${WITH_BUYER} WHERE p.stage = 'Open for Bids' ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`,
      [pageSize, offset],
    );
    return rows.map(mapProjectRow);
  }

  async findForUser(userId: string, role: 'buyer' | 'freelancer') {
    const field = role === 'buyer' ? 'buyer_id' : 'awarded_to';
    const { rows } = await this.db.query<ProjectRow>(
      `SELECT * FROM projects WHERE ${field} = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return rows.map(mapProjectRow);
  }

  private async load(id: string): Promise<ProjectRow> {
    const { rows } = await this.db.query<ProjectRow>(`${WITH_BUYER} WHERE p.id = $1`, [id]);
    if (!rows.length) throw new NotFoundException(`Project ${id} not found`);
    return rows[0];
  }

  async findOne(id: string) {
    return mapProjectRow(await this.load(id));
  }

  async create(dto: CreateProjectDto, user: User) {
    const milestones: Milestone[] = (dto.milestones ?? []).map((m) => ({
      id: randomUUID(),
      name: m.name,
      amount: m.amount,
      status: 'Pending',
      dueDate: m.dueDate ?? 0,
    }));
    const { rows } = await this.db.query<ProjectRow>(
      `INSERT INTO projects (id, buyer_id, tenant_id, title, domain, budget, description, milestones, nda_required)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
       RETURNING *`,
      [
        generateId('PRJ'), user.id, user.tenantId,
        dto.title, dto.domain, dto.budget, dto.description,
        JSON.stringify(milestones), dto.ndaRequired ?? false,
      ],
    );
    return mapProjectRow(rows[0]);
  }

  async updateStage(id: string, stage: ProjectStage, user: User) {
    const project = await this.load(id);
    if (project.buyer_id !== user.id && user.role !== 'Admin') throw new ForbiddenException();
    const { rows } = await this.db.query<ProjectRow>(
      `UPDATE projects SET stage = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [stage, id],
    );
    return mapProjectRow(rows[0]);
  }

  /** The project's buyer, the freelancer it was awarded to, or an admin. Row-locked read-modify-write. */
  async updateMilestone(projectId: string, milestoneId: string, status: MilestoneStatus, user: User) {
    return withTransaction(this.db, async (client) => {
      const { rows } = await client.query<ProjectRow>(
        `SELECT * FROM projects WHERE id = $1 FOR UPDATE`,
        [projectId],
      );
      const project = rows[0];
      if (!project) throw new NotFoundException(`Project ${projectId} not found`);
      const isParty = project.buyer_id === user.id || project.awarded_to === user.id;
      if (!isParty && user.role !== 'Admin') throw new ForbiddenException();

      const milestones = project.milestones ?? [];
      if (!milestones.some((m) => m.id === milestoneId)) throw new NotFoundException('Milestone not found');
      const next = milestones.map((m) => (m.id === milestoneId ? { ...m, status } : m));

      const { rows: updated } = await client.query<ProjectRow>(
        `UPDATE projects SET milestones = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [JSON.stringify(next), projectId],
      );
      return mapProjectRow(updated[0]);
    });
  }
}
