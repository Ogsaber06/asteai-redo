import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import type { User } from '@asteai/types';
import { DB_POOL } from '../../database/database.module';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { mapUserRow, USER_COLUMNS, UserRow } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async findById(id: string): Promise<User> {
    const { rows } = await this.db.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM user_accounts WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!rows.length) throw new NotFoundException(`User ${id} not found`);
    return mapUserRow(rows[0]);
  }

  async updateProfile(id: string, data: UpdateProfileDto): Promise<User> {
    const { rows } = await this.db.query<UserRow>(
      `UPDATE user_accounts SET
         first_name         = COALESCE($1, first_name),
         last_name          = COALESCE($2, last_name),
         title              = COALESCE($3, title),
         avatar_url         = COALESCE($4, avatar_url),
         preferred_language = COALESCE($5, preferred_language),
         updated_at         = NOW()
       WHERE id = $6 AND deleted_at IS NULL
       RETURNING ${USER_COLUMNS}`,
      [data.firstName, data.lastName, data.title, data.avatarUrl, data.lang, id],
    );
    if (!rows.length) throw new NotFoundException(`User ${id} not found`);
    return mapUserRow(rows[0]);
  }

  async getConsents(userId: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM consents WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId],
    );
    return rows;
  }

  async toggleConsent(userId: string, purpose: string, active: boolean) {
    const status = active ? 'Active' : 'Revoked';
    const revokedAt = active ? null : new Date().toISOString();
    const { rows } = await this.db.query(
      `INSERT INTO consents (user_id, purpose, status, revoked_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, purpose, status, revokedAt],
    );
    return rows[0];
  }

  async exportData(userId: string) {
    const [user, consents, apps, passports] = await Promise.all([
      this.findById(userId),
      this.getConsents(userId),
      this.db.query(`SELECT * FROM applications WHERE candidate_id = $1`, [userId]),
      this.db.query(`SELECT * FROM passports WHERE user_id = $1`, [userId]),
    ]);
    return {
      user,
      consents,
      applications: apps.rows,
      passports: passports.rows,
      exportedAt: new Date().toISOString(),
    };
  }
}
