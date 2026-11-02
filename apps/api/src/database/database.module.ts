import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export const DB_POOL = 'DB_POOL';

@Global()
@Module({
  providers: [
    {
      provide: DB_POOL,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const logger = new Logger('DatabaseModule');

        const pool = new Pool({
          host:              config.getOrThrow('DATABASE_HOST'),
          port:              config.get<number>('DATABASE_PORT', 5432),
          database:          config.getOrThrow('DATABASE_NAME'),
          user:              config.getOrThrow('DATABASE_USER'),
          password:          config.getOrThrow('DATABASE_PASSWORD'),
          max:               config.get<number>('DATABASE_MAX_POOL', 20),
          idleTimeoutMillis: config.get<number>('DATABASE_IDLE_TIMEOUT_MS', 30000),
          ssl:               config.get('DATABASE_SSL') === 'true'
                               ? { rejectUnauthorized: false }
                               : undefined,
        });

        pool.on('error', (err) => logger.error('Unexpected pool error', err.message));

        try {
          const client = await pool.connect();
          const { rows } = await client.query('SELECT version()');
          client.release();
          logger.log(`Connected: ${(rows[0].version as string).split(' ').slice(0, 2).join(' ')}`);
        } catch (err: any) {
          logger.error(`DB connection failed: ${err.message}`);
          throw err;
        }

        return pool;
      },
    },
  ],
  exports: [DB_POOL],
})
export class DatabaseModule {}
