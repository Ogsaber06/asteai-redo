import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { User } from '@asteai/types';

@Injectable()
export class AnalyticsService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async getEmployerDashboard(tenantId: string) {
    const [reqs, apps, results] = await Promise.all([
      this.db.query(`SELECT status, COUNT(*) FROM requisitions WHERE tenant_id = $1 GROUP BY status`, [tenantId]),
      this.db.query(`SELECT stage, COUNT(*) FROM applications WHERE tenant_id = $1 GROUP BY stage`, [tenantId]),
      this.db.query(
        `SELECT AVG(fit_score) AS avg_fit, AVG(sten_iq) AS avg_iq,
                AVG(sten_eq) AS avg_eq, AVG(sten_grit) AS avg_grit,
                COUNT(*) AS total
         FROM assessment_results ar
         JOIN applications a ON ar.candidate_id = a.candidate_id AND ar.requisition_id = a.requisition_id
         WHERE a.tenant_id = $1`,
        [tenantId],
      ),
    ]);
    return {
      requisitions:    reqs.rows,
      applicationsByStage: apps.rows,
      assessmentStats: results.rows[0],
    };
  }

  async getFairnessReport(tenantId: string) {
    const { rows } = await this.db.query(
      `SELECT c.lang, COUNT(*) AS total,
              AVG(ar.fit_score) AS avg_fit,
              COUNT(CASE WHEN a.stage = 'Shortlisted' OR a.stage = 'Interview' OR a.stage = 'Offer' OR a.stage = 'Joined' THEN 1 END) AS shortlisted
       FROM applications a
       JOIN candidates c ON a.candidate_id = c.id
       JOIN assessment_results ar ON ar.candidate_id = a.candidate_id
       WHERE a.tenant_id = $1
       GROUP BY c.lang`,
      [tenantId],
    );
    return rows;
  }
}
