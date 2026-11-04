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
}
