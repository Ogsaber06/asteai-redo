import { Module, Global, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { execSync } from 'child_process';

export const DB_POOL = 'DB_POOL';

/**
 * RDS IAM auth wrapper.
 *
 * When DATABASE_IAM_AUTH=true (no static password), we generate a fresh
 * IAM auth token every 14 minutes using the AWS CLI and recreate the pg Pool.
 * The pool reference exported via DB_POOL stays the same object — we swap
 * its internal `options.password` and drain/recreate connections lazily.
 */
@Global()
@Module({
  providers: [
    {
      provide: DB_POOL,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const iamAuth = config.get('DATABASE_IAM_AUTH') === 'true';
        const host    = config.getOrThrow('DATABASE_HOST');
        const port    = config.get<number>('DATABASE_PORT', 5432);
        const database = config.getOrThrow('DATABASE_NAME');
        const user    = config.getOrThrow('DATABASE_USER');
        const maxPool = config.get<number>('DATABASE_MAX_POOL', 20);
        const idleTimeout = config.get<number>('DATABASE_IDLE_TIMEOUT_MS', 30000);
        const sslCert = config.get('DATABASE_SSL_CERT');  // path to rds-ca-bundle.pem

        const logger = new Logger('DatabaseModule');

        const sslConfig = {
          rejectUnauthorized: !!sslCert,
          ...(sslCert ? { ca: require('fs').readFileSync(sslCert).toString() } : {}),
        };

        const getIamToken = (): string => {
          const region = config.get('AWS_REGION', 'ap-south-1');
          const cmd = `aws rds generate-db-auth-token --hostname ${host} --port ${port} --username ${user} --region ${region}`;
          const token = execSync(cmd, { encoding: 'utf8' }).trim();
          logger.log(`IAM token refreshed (expires in ~15 min)`);
          return token;
        };

        const password = iamAuth ? getIamToken() : config.getOrThrow('DATABASE_PASSWORD');

        const pool = new Pool({
          host,
          port,
          database,
          user,
          password,
          max:              maxPool,
          idleTimeoutMillis: idleTimeout,
          ssl: sslConfig,
        });

        pool.on('error', (err) => {
          logger.error('[DB] Unexpected pool error:', err.message);
        });

        // Test the connection on startup
        try {
          const client = await pool.connect();
          const { rows } = await client.query('SELECT version()');
          logger.log(`Connected: ${rows[0].version.split(' ').slice(0, 2).join(' ')}`);
          client.release();
        } catch (err: any) {
          logger.error(`DB connection failed: ${err.message}`);
          throw err;
        }

        if (iamAuth) {
          // Refresh token every 14 minutes (tokens last 15 min)
          setInterval(async () => {
            try {
              const newToken = getIamToken();
              // Update pool password — new connections will use the new token.
              // Existing idle connections will be evicted by the pool naturally.
              (pool as any).options.password = newToken;
              // Force-end all idle connections so they reconnect with the new token
              await pool.query('SELECT 1').catch(() => {});
            } catch (e: any) {
              logger.error(`Failed to refresh IAM token: ${e.message}`);
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
