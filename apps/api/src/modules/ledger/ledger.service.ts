import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';

@Injectable()
export class LedgerService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async findForTenant(tenantId: string, page = 1, pageSize = 50) {
    const offset = (page - 1) * pageSize;
    const { rows } = await this.db.query(
      `SELECT * FROM ledger_entries WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tenantId, pageSize, offset],
    );
    return rows;
  }

  async getWallet(userId: string) {
    const { rows } = await this.db.query(
      `SELECT
         SUM(CASE WHEN type = 'Escrow release' THEN amount ELSE 0 END) AS earned,
         SUM(CASE WHEN type = 'Fee' THEN ABS(amount) ELSE 0 END) AS fees,
         SUM(CASE WHEN type = 'Escrow hold' THEN ABS(amount) ELSE 0 END) AS pending
       FROM ledger_entries WHERE user_id = $1`,
      [userId],
    );
    return rows[0] ?? { earned: 0, fees: 0, pending: 0 };
  }

  async record(entry: {
    tenantId?: string; userId?: string; type: string; description: string;
    amount: number; unit?: string; payeeId?: string; fee?: number; by: string; ref?: string;
  }) {
    const id = 'TX-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const { rows } = await this.db.query(
      `INSERT INTO ledger_entries
         (id, tenant_id, user_id, type, description, amount, unit, payee_id, fee, by, ref)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        id, entry.tenantId, entry.userId, entry.type, entry.description,
        entry.amount, entry.unit, entry.payeeId, entry.fee, entry.by, entry.ref,
      ],
    );
    return rows[0];
  }
}
