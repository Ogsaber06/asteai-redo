#!/usr/bin/env node
/**
 * Applies packages/db/migrations/*.sql in filename order, once each, recording them in
 * schema_migrations. Each file runs in its own transaction.
 *
 *   bun run --filter @asteai/db migrate              # apply pending files
 *   bun run --filter @asteai/db migrate:status       # list applied / pending
 *
 * Connection, first match wins:
 *   1. DATABASE_URL=postgres://...
 *   2. The API's own variables: DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USER,
 *      DATABASE_PASSWORD (or DATABASE_IAM_AUTH=true + AWS_REGION for an RDS IAM token),
 *      DATABASE_SSL, DATABASE_SSL_REJECT_UNAUTHORIZED.
 *      DATABASE_MIGRATION_USER / DATABASE_MIGRATION_PASSWORD override the user and password,
 *      so a container can migrate as the master user while the app connects as a DML-only user.
 *
 * Concurrent runs are safe: a session advisory lock serialises them, and a runner that waited
 * re-reads schema_migrations after it gets the lock, so it skips what the first one applied.
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
const statusOnly = process.argv.includes('--status');
/** Arbitrary, fixed key for pg_advisory_lock; only this runner uses it. */
const LOCK_KEY = 7_426_101;

/** @returns {Promise<import('pg').ClientConfig>} */
async function connectionConfig(env = process.env) {
  if (env.DATABASE_URL) return { connectionString: env.DATABASE_URL };

  const missing = ['DATABASE_HOST', 'DATABASE_NAME'].filter((k) => !env[k]);
  const user = env.DATABASE_MIGRATION_USER || env.DATABASE_USER;
  if (!user) missing.push('DATABASE_USER');
  if (missing.length) {
    throw new Error(`Set DATABASE_URL, or ${missing.join(', ')} (see packages/db/migrate.mjs)`);
  }
  const host = env.DATABASE_HOST;
  const port = Number(env.DATABASE_PORT || 5432);

  let password = env.DATABASE_MIGRATION_PASSWORD || (env.DATABASE_MIGRATION_USER ? undefined : env.DATABASE_PASSWORD);
  if (!password && env.DATABASE_IAM_AUTH === 'true') {
    if (!env.AWS_REGION) throw new Error('DATABASE_IAM_AUTH=true needs AWS_REGION');
    const { Signer } = await import('@aws-sdk/rds-signer');
    const signer = new Signer({ hostname: host, port, username: user, region: env.AWS_REGION });
    password = () => signer.getAuthToken();
  }

  return {
    host, port, user, password,
    database: env.DATABASE_NAME,
    connectionTimeoutMillis: Number(env.DATABASE_CONNECT_TIMEOUT_MS || 10_000),
    // Same rules as the API (apps/api/src/database/database.module.ts). For full
    // verification, install the RDS CA with NODE_EXTRA_CA_CERTS and set
    // DATABASE_SSL_REJECT_UNAUTHORIZED=true.
    ssl: env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true' }
      : undefined,
  };
}

let client;
try {
  client = new pg.Client(await connectionConfig());
  await client.connect();
} catch (err) {
  console.error(`migrate: cannot connect: ${err.message}`);
  process.exit(1);
}

try {
  if (!statusOnly) {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [LOCK_KEY]);
    if (!rows[0].ok) {
      console.log('migrate: another runner holds the lock, waiting…');
      await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    }
  }

  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  const { rows } = await client.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) {
      if (statusOnly) console.log(`applied  ${file}`);
      continue;
    }
    if (statusOnly) {
      console.log(`pending  ${file}`);
      continue;
    }
    const sql = await readFile(join(dir, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`applied  ${file}`);
      count++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`failed   ${file}: ${err.message}`);
      process.exitCode = 1;
      break;
    }
  }
  if (!statusOnly && !process.exitCode) console.log(count ? `migrate: ${count} applied` : 'migrate: up to date');
} finally {
  // Ending the session also releases the advisory lock.
  await client.end();
}
