import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import type { AdminStats } from '@asteai/types';
import { DB_POOL } from '../../database/database.module';

@Injectable()
export class AdminService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async getMasterStats(): Promise<AdminStats> {
    const [tenants, users, reqs, apps, passports] = await Promise.all([
      this.db.query(`SELECT COUNT(*) FROM tenants`),
      this.db.query(`SELECT role, COUNT(*) FROM user_accounts WHERE account_status = 'active' GROUP BY role`),
      this.db.query(`SELECT status, COUNT(*) FROM requisitions GROUP BY status`),
      this.db.query(`SELECT stage, COUNT(*) FROM applications GROUP BY stage`),
      this.db.query(`SELECT status, COUNT(*) FROM passports GROUP BY status`),
    ]);
    return {
      totalTenants: parseInt(tenants.rows[0].count, 10),
      usersByRole:  users.rows,
      reqs:         reqs.rows,
      applications: apps.rows,
      passports:    passports.rows,
    };
  }

  async getAuditLog(pageSize: number, offset: number) {
    const { rows } = await this.db.query(
      `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [pageSize, offset],
    );
    return rows;
  }

  async setFeatureFlag(name: string, value: boolean, actorId: string) {
    // TODO: persist flags in a settings table; for now the change is only audited.
    await this.db.query(
      `INSERT INTO audit_log (actor_id, action, entity, meta)
       VALUES ($1, 'set_feature_flag', $2, $3)`,
      [actorId, name, String(value)],
    );
    return { flag: name, value };
  }
}
