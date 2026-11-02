import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';

@Injectable()
export class PassportsService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async findForUser(userId: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM passports WHERE user_id = $1 ORDER BY issued_at DESC`,
      [userId],
    );
    return rows;
  }

  async findById(id: string) {
    const { rows } = await this.db.query(`SELECT * FROM passports WHERE id = $1`, [id]);
    if (!rows.length) throw new NotFoundException(`Passport ${id} not found`);
    return rows[0];
  }

  /** Issue / reissue a passport after an assessment result is sealed */
  async issue(userId: string, data: {
    name: string; tier: string; scores: [string, number][];
    stenIq: number; stenEq: number; stenGrit: number; percentile: number;
  }) {
    const id = 'PASS-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const validUntil = new Date(Date.now() + 730 * 86400000); // 2 years
    const hash = createHash('sha256')
      .update(JSON.stringify({ id, ...data })).digest('hex').slice(0, 16);

    // Revoke any existing valid passports for this user+tier
    await this.db.query(
      `UPDATE passports SET status = 'Revoked' WHERE user_id = $1 AND tier = $2 AND status = 'Valid'`,
      [userId, data.tier],
    );

    const { rows } = await this.db.query(
      `INSERT INTO passports
         (id, user_id, name, tier, scores, sten_iq, sten_eq, sten_grit,
          percentile, hash, valid_until, status)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,'Valid')
       RETURNING *`,
      [
        id, userId, data.name, data.tier,
        JSON.stringify(data.scores),
        data.stenIq, data.stenEq, data.stenGrit,
        data.percentile, hash, validUntil,
      ],
    );
    return rows[0];
  }

  async verify(hash: string) {
    const { rows } = await this.db.query(
      `SELECT p.*, u.first_name || ' ' || u.last_name AS holder_name
       FROM passports p
       JOIN user_accounts u ON p.user_id = u.id
       WHERE p.hash = $1`,
      [hash],
    );
    if (!rows.length) return { valid: false, message: 'Passport not found' };
    const p = rows[0];
    if (p.status !== 'Valid') return { valid: false, message: `Passport is ${p.status}` };
    if (new Date(p.valid_until) < new Date()) return { valid: false, message: 'Passport expired' };
    return { valid: true, passport: p };
  }

  async updateShare(id: string, share: { discoverable: boolean; showIdentity: boolean }) {
    const { rows } = await this.db.query(
      `UPDATE passports SET discoverable = $1, show_identity = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [share.discoverable, share.showIdentity, id],
    );
    if (!rows.length) throw new NotFoundException();
    return rows[0];
  }

  async addVerification(id: string, verifiedBy: string) {
    const passport = await this.findById(id);
    const vList = [...(passport.verifications ?? []), { t: Date.now(), by: verifiedBy }];
    const { rows } = await this.db.query(
      `UPDATE passports SET verifications = $1::jsonb WHERE id = $2 RETURNING *`,
      [JSON.stringify(vList), id],
    );
    return rows[0];
  }
}
