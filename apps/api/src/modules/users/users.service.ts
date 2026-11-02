import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { User } from '@asteai/types';

@Injectable()
export class UsersService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async findById(id: string): Promise<User> {
    const { rows } = await this.db.query(
      `SELECT id, email, first_name, last_name, role, tenant_id, title,
              avatar_url, account_status, email_verified, preferred_language,
              created_at, updated_at
       FROM user_accounts WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!rows.length) throw new NotFoundException(`User ${id} not found`);
    return this.mapRow(rows[0]);
  }

  async updateProfile(id: string, data: Partial<{ firstName: string; lastName: string; title: string; avatarUrl: string; lang: string }>) {
    const { rows } = await this.db.query(
      `UPDATE user_accounts SET
         first_name  = COALESCE($1, first_name),
         last_name   = COALESCE($2, last_name),
         title       = COALESCE($3, title),
         avatar_url  = COALESCE($4, avatar_url),
         preferred_language = COALESCE($5, preferred_language),
         updated_at  = NOW()
       WHERE id = $6 RETURNING *`,
      [data.firstName, data.lastName, data.title, data.avatarUrl, data.lang, id],
    );
    return this.mapRow(rows[0]);
  }

  private mapRow(row: Record<string, unknown>): User {
    return {
      id:            row.id as string,
      email:         row.email as string,
      firstName:     row.first_name as string,
      lastName:      row.last_name as string,
      role:          row.role as User['role'],
      tenantId:      row.tenant_id as string | null,
      title:         row.title as string | undefined,
      avatarUrl:     row.avatar_url as string | undefined,
      accountStatus: row.account_status as 'active',
      emailVerified: Boolean(row.email_verified),
      createdAt:     String(row.created_at),
      updatedAt:     String(row.updated_at),
    };
  }
}
