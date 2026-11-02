import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export const DB_POOL = 'DB_POOL';

/**
 * DatabaseModule
 *
 * Supports two auth modes controlled by DATABASE_IAM_AUTH:
 *
 *   false (default) — plain password from DATABASE_PASSWORD env var.
 *                     Use this for local dev with a non-RDS Postgres.
 *
 *   true            — RDS IAM auth. No static password needed.
 *                     Uses @aws-sdk/rds-signer to generate a short-lived
 *                     token (valid 15 min). Token is refreshed every 14 min
 *                     so the pool never uses an expired credential.
 *                     The IAM role/user running the app must have the
 *                     rds-db:connect permission (provisioned by Tofu).
 */
@Global()
@Module({
  providers: [
    {
      provide: DB_POOL,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const logger = new Logger('DatabaseModule');

        const iamAuth  = config.get('DATABASE_IAM_AUTH') === 'true';
        const host     = config.getOrThrow('DATABASE_HOST');
        const port     = config.get<number>('DATABASE_PORT', 5432);
        const database = config.getOrThrow('DATABASE_NAME');
        const user     = config.getOrThrow('DATABASE_USER');
        const region   = config.get('AWS_REGION', 'ap-south-1');
        const maxPool  = config.get<number>('DATABASE_MAX_POOL', 20);
        const idleMs   = config.get<number>('DATABASE_IDLE_TIMEOUT_MS', 30000);

        // SSL config — RDS requires SSL. Node's built-in CA bundle already
        // includes the Amazon root CA so no PEM file download is needed.
        const ssl = config.get('DATABASE_SSL') === 'true'
          ? { rejectUnauthorized: true }
          : undefined;

        // ── Token generator (IAM auth only) ───────────────────────────────
        const makeToken = iamAuth
          ? async (): Promise<string> => {
              // Lazy-import so non-IAM deployments don't need the SDK package
              const { Signer } = await import('@aws-sdk/rds-signer');
              const signer = new Signer({ hostname: host, port, region, username: user });
              const token = await signer.getAuthToken();
              logger.log('RDS IAM token refreshed');
              return token;
            }
          : null;

        const password = iamAuth
          ? await makeToken!()
          : config.getOrThrow('DATABASE_PASSWORD');

        // ── Create pool ───────────────────────────────────────────────────
        const pool = new Pool({ host, port, database, user, password, max: maxPool, idleTimeoutMillis: idleMs, ssl });

        pool.on('error', (err) => logger.error('Unexpected pool error', err.message));

        // Verify connection on startup
        try {
          const client = await pool.connect();
          const { rows } = await client.query('SELECT version()');
          client.release();
          logger.log(`Connected: ${(rows[0].version as string).split(' ').slice(0, 2).join(' ')}`);
        } catch (err: any) {
          logger.error(`DB connection failed: ${err.message}`);
          throw err;
        }

        // ── Refresh IAM token every 14 min ────────────────────────────────
        if (iamAuth && makeToken) {
          setInterval(async () => {
            try {
              const token = await makeToken();
              // Swap password on the pool — new connections pick it up automatically
              (pool as any).options.password = token;
            } catch (err: any) {
              logger.error(`Failed to refresh IAM token: ${err.message}`);
            }
          }, 14 * 60 * 1000);
        }

        return pool;
      },
    },
  ],
  exports: [DB_POOL],
})
export class DatabaseModule {}
