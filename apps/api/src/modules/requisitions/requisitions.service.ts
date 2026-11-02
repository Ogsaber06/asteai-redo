import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { UpdateRequisitionDto } from './dto/update-requisition.dto';
import { User } from '@asteai/types';

@Injectable()
export class RequisitionsService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async findAll(user: User, filters: { status?: string; page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 20, status } = filters;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    // Employers only see their tenant's reqs; Admin sees all
    if (user.role !== 'Admin') {
      if (!user.tenantId) throw new ForbiddenException('No tenant associated');
      conditions.push(`r.tenant_id = $${idx++}`);
      values.push(user.tenantId);
    }

    if (status) {
      conditions.push(`r.status = $${idx++}`);
      values.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQ = await this.db.query(
      `SELECT COUNT(*) FROM requisitions r ${where}`,
      values,
    );
    const total = parseInt(countQ.rows[0].count, 10);

    values.push(pageSize, offset);
    const { rows } = await this.db.query(
      `SELECT r.*, u.first_name || ' ' || u.last_name AS owner_name
       FROM requisitions r
       JOIN user_accounts u ON r.owner_id = u.id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      values,
    );

    return { data: rows.map(this.mapRow), total, page, pageSize };
  }

  async findOne(id: string, user: User) {
    const { rows } = await this.db.query(
      `SELECT r.*, u.first_name || ' ' || u.last_name AS owner_name
       FROM requisitions r
       JOIN user_accounts u ON r.owner_id = u.id
       WHERE r.id = $1`,
      [id],
    );
    if (!rows.length) throw new NotFoundException(`Requisition ${id} not found`);
    const req = rows[0];
    if (user.role !== 'Admin' && req.tenant_id !== user.tenantId) {
      throw new ForbiddenException();
    }
    return this.mapRow(req);
  }

  async create(dto: CreateRequisitionDto, user: User) {
    if (!user.tenantId) throw new ForbiddenException('No tenant associated');
    const { rows } = await this.db.query(
      `INSERT INTO requisitions
         (id, tenant_id, owner_id, title, industry, func, ech_level, tier,
          weight_iq, weight_eq, weight_grit, language, location, headcount,
          min_shortlist, threshold, stack, brief)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        this.genId('REQ'), user.tenantId, user.id,
        dto.title, dto.industry, dto.func, dto.echLevel, dto.tier,
        dto.weights.iq, dto.weights.eq, dto.weights.grit,
        dto.lang, dto.location, dto.headcount,
        dto.minShortlist ?? 5, dto.threshold ?? 6.0,
        dto.stack ?? [], dto.brief ?? null,
      ],
    );
    return this.mapRow(rows[0]);
  }

  async update(id: string, dto: UpdateRequisitionDto, user: User) {
    const existing = await this.findOne(id, user);
    if (existing.ownerId !== user.id && user.role !== 'Admin') {
      throw new ForbiddenException('Only the owner can edit a requisition');
    }

    const { rows } = await this.db.query(
      `UPDATE requisitions SET
         title        = COALESCE($1, title),
         status       = COALESCE($2, status),
         headcount    = COALESCE($3, headcount),
         threshold    = COALESCE($4, threshold),
         brief        = COALESCE($5, brief),
         updated_at   = NOW()
       WHERE id = $6
       RETURNING *`,
      [dto.title, dto.status, dto.headcount, dto.threshold, dto.brief, id],
    );
    return this.mapRow(rows[0]);
  }

  async fundSla(id: string, user: User) {
    const req = await this.findOne(id, user);
    if (req.sla.funded) return req;
    const { rows } = await this.db.query(
      `UPDATE requisitions SET sla_funded = TRUE, sla_start_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id],
    );
    return this.mapRow(rows[0]);
  }

  private mapRow(row: Record<string, unknown>) {
    return {
      id:          row.id,
      tenantId:    row.tenant_id,
      ownerId:     row.owner_id,
      ownerName:   row.owner_name,
      title:       row.title,
      industry:    row.industry,
      func:        row.func,
      echLevel:    row.ech_level,
      tier:        row.tier,
      weights:     { iq: row.weight_iq, eq: row.weight_eq, grit: row.weight_grit },
      lang:        row.language,
      location:    row.location,
      headcount:   row.headcount,
      minShortlist: row.min_shortlist,
      threshold:   row.threshold,
      status:      row.status,
      sla: {
        funded:      row.sla_funded,
        start:       row.sla_start_at,
        paused:      row.sla_paused_at,
        delivered:   row.sla_delivered_at,
      },
      stack:       row.stack,
      brief:       row.brief,
      createdAt:   row.created_at,
      updatedAt:   row.updated_at,
    };
  }

  private genId(prefix: string) {
    return prefix + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  }
}
