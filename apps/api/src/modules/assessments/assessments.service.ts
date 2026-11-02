import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { User } from '@asteai/types';

@Injectable()
export class AssessmentsService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  /** Called when a candidate finishes an assessment session. */
  async submitResult(data: {
    candidateId: string;
    requisitionId: string;
    thetaIq: number; thetaEq: number; thetaGrit: number;
    stenIq: number; stenEq: number; stenGrit: number;
    fitScore: number; ci: number; integrity: string;
    integBlur: number; integPaste: number; integFast: number;
    nIq: number; nEq: number; nGrit: number;
    durationSec: number; evData?: object; selfData?: object; safetyData?: object;
  }) {
    const id = 'R-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const hash = this.phash(JSON.stringify({ id, fitScore: data.fitScore }));

    const { rows } = await this.db.query(
      `INSERT INTO assessment_results
         (id, candidate_id, requisition_id,
          theta_iq, theta_eq, theta_grit,
          sten_iq, sten_eq, sten_grit,
          fit_score, ci_score, integrity,
          integ_blur, integ_paste, integ_fast,
          n_iq, n_eq, n_grit, duration_sec,
          ev_data, self_data, safety_data, hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
               $20::jsonb,$21::jsonb,$22::jsonb,$23)
       RETURNING *`,
      [
        id, data.candidateId, data.requisitionId,
        data.thetaIq, data.thetaEq, data.thetaGrit,
        data.stenIq, data.stenEq, data.stenGrit,
        data.fitScore, data.ci, data.integrity,
        data.integBlur, data.integPaste, data.integFast,
        data.nIq, data.nEq, data.nGrit, data.durationSec,
        JSON.stringify(data.evData ?? null),
        JSON.stringify(data.selfData ?? null),
        JSON.stringify(data.safetyData ?? null),
        hash,
      ],
    );

    // Update the application to link this result
    await this.db.query(
      `UPDATE applications SET result_id = $1, stage = 'Assessment Review', updated_at = NOW()
       WHERE candidate_id = $2 AND requisition_id = $3 AND result_id IS NULL`,
      [id, data.candidateId, data.requisitionId],
    );

    // Flag for integrity review if needed
    if (data.integrity === 'Review') {
      const qid = 'IQ-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      await this.db.query(
        `INSERT INTO integrity_queue (id, result_id, reason) VALUES ($1,$2,'Flagged by integrity engine')`,
        [qid, id],
      );
    }

    return rows[0];
  }

  async findResult(id: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM assessment_results WHERE id = $1`,
      [id],
    );
    if (!rows.length) throw new NotFoundException(`Result ${id} not found`);
    return rows[0];
  }

  async getIntegrityQueue(user: User) {
    const { rows } = await this.db.query(
      `SELECT iq.*, ar.candidate_id, ar.fit_score, ar.integrity
       FROM integrity_queue iq
       JOIN assessment_results ar ON iq.result_id = ar.id
       WHERE iq.status = 'Open'
       ORDER BY iq.created_at ASC`,
    );
    return rows;
  }

  async resolveIntegrity(id: string, resolution: string, userId: string) {
    const { rows } = await this.db.query(
      `UPDATE integrity_queue SET status = 'Resolved', resolution = $1, reviewed_by = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [resolution, userId, id],
    );
    if (!rows.length) throw new NotFoundException();
    return rows[0];
  }

  private phash(str: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }
}
