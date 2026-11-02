import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';

@Injectable()
export class NotificationsService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async findForUser(userId: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId],
    );
    return rows;
  }

  async send(userId: string, text: string, link = '#') {
    const { rows } = await this.db.query(
      `INSERT INTO notifications (user_id, text, link) VALUES ($1,$2,$3) RETURNING *`,
      [userId, text, link],
    );
    return rows[0];
  }

  async markRead(id: string, userId: string) {
    await this.db.query(
      `UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
  }

  async markAllRead(userId: string) {
    await this.db.query(`UPDATE notifications SET read = TRUE WHERE user_id = $1`, [userId]);
  }
}
