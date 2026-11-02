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
}
