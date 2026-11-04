import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';

const API_PREFIX = 'api/v1';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug'],
  });

  const config = app.get(ConfigService);
  const port = Number(config.get('PORT', 3001));
  const isProduction = config.get('NODE_ENV') === 'production';
  const origins = config
    .get<string>('CORS_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // ── Security middleware ──────────────────────────────────────────────────
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // ── Global pipes / filters / interceptors ────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseTransformInterceptor());
  // Health probes stay at the root so the load balancer config doesn't depend on the API version.
  app.setGlobalPrefix(API_PREFIX, { exclude: ['livez', 'readyz'] });

  // Close the DB pool and in-flight requests cleanly on SIGTERM (ECS / Docker stop).
  app.enableShutdownHooks();

  // ── Swagger (skipped under Bun: its decorator metadata breaks @nestjs/swagger) ──
  if (!isProduction && typeof process.versions.bun === 'undefined') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('AsteAI Platform API')
      .setDescription('REST API for the AsteAI hiring & talent marketplace platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  // ── Root & status endpoints ─────────────────────────────────────────────
  const apiStatusHandler = (_req: unknown, res: { status: (code: number) => { json: (data: unknown) => void } }) => {
    res.status(200).json({
      status: 'online',
      name: 'AsteAI Platform API',
      version: '1.0.0',
      message: 'AsteAI REST API is operational. Open the Web Application at http://localhost:3000',
      links: {
        webApp: 'http://localhost:3000',
        swaggerDocs: '/api/docs',
        healthLive: '/livez',
        healthReady: '/readyz',
        auth: `/${API_PREFIX}/auth`,
      },
    });
  };

  const adapter = app.getHttpAdapter();
  adapter.get('/', (_req: unknown, res: { redirect: (url: string) => void }) => {
    res.redirect('/api/docs');
  });
  adapter.get('/api', apiStatusHandler);
  adapter.get('/api/', apiStatusHandler);
  adapter.get('/api/v1', apiStatusHandler);
  adapter.get('/api/v1/', apiStatusHandler);

  await app.listen(port);
  logger.log('───────────────────────────────────────────────────────');
  logger.log(`💻 Web Application:    http://localhost:3000`);
  logger.log(`📡 Swagger API Docs:   http://localhost:${port}/api/docs`);
  logger.log(`⚙️  API Base URL:       http://localhost:${port}/${API_PREFIX}`);
  logger.log('───────────────────────────────────────────────────────');
}

bootstrap().catch((err: unknown) => {
  new Logger('Bootstrap').error('API failed to start', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
