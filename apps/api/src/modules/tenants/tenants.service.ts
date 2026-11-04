import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';

@Injectable()
export class TenantsService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async findAll() {
    const { rows } = await this.db.query(`SELECT * FROM tenants ORDER BY name`);
    return rows;
  }

  async findOne(id: string) {
    const { rows } = await this.db.query(`SELECT * FROM tenants WHERE id = $1`, [id]);
    if (!rows.length) throw new NotFoundException(`Tenant ${id} not found`);
    return rows[0];
  }

  async updateCredits(id: string, delta: number) {
    const { rows } = await this.db.query(
      `UPDATE tenants SET credits = GREATEST(0, credits + $1), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [delta, id],
    );
    if (!rows.length) throw new NotFoundException();
    return rows[0];
  }

  async getTeam(tenantId: string) {
    const { rows } = await this.db.query(
      `SELECT id, email, first_name, last_name, role, title, account_status, created_at
       FROM user_accounts
       WHERE tenant_id = $1
       ORDER BY created_at ASC`,
      [tenantId],
    );
    return rows;
  }

  async addTeamMember(tenantId: string, member: { email: string; firstName: string; lastName: string; role: string; title?: string }) {
    const { rows } = await this.db.query(
      `INSERT INTO user_accounts (email, email_canonical, first_name, last_name, role, title, tenant_id, auth_provider, account_status, email_verified)
       VALUES ($1, LOWER($1), $2, $3, $4, $5, $6, 'local', 'active', true)
       ON CONFLICT (email) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, role = EXCLUDED.role, title = EXCLUDED.title
       RETURNING id, email, first_name, last_name, role, title, account_status, created_at`,
      [member.email, member.firstName, member.lastName, member.role, member.title ?? '', tenantId],
    );
    return rows[0];
  }

  async getPools(tenantId: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM talent_pools WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return rows;
  }

  async createPool(tenantId: string, pool: { name: string; count?: number; tags?: string[] }) {
    const id = `POOL-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const { rows } = await this.db.query(
      `INSERT INTO talent_pools (id, tenant_id, name, count, tags)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, tenantId, pool.name, pool.count ?? 0, pool.tags ?? []],
    );
    return rows[0];
  }

  async getOutreach(tenantId: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM outreach_campaigns WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return rows;
  }

  async createOutreach(tenantId: string, campaign: { name: string; channel: string; sent?: number }) {
    const id = `OUT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const { rows } = await this.db.query(
      `INSERT INTO outreach_campaigns (id, tenant_id, name, channel, sent, status)
       VALUES ($1, $2, $3, $4, $5, 'Active')
       RETURNING *`,
      [id, tenantId, campaign.name, campaign.channel, campaign.sent ?? 50],
    );
    return rows[0];
  }
}
