import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { JsonLoggerService, clusterize } from '@nettapu/shared';
import { AppModule } from './app.module';

async function bootstrap() {
  const cluster = await import('node:cluster');
  const workerId = cluster.default.worker?.id ?? 0;
  process.env.CLUSTER_WORKER_ID = String(workerId);

  const jsonLogger = new JsonLoggerService('monolith');
  const logger = new Logger('Bootstrap');

  // ── Startup sanity checks ────────────────────────────────────
  const nodeEnv = process.env.NODE_ENV;
  const jwtSecret = process.env.JWT_SECRET;
  const corsOrigin = process.env.CORS_ORIGIN;

  if (
    nodeEnv === 'production' &&
    jwtSecret === 'change_me_in_production_min_32_chars!!'
  ) {
    jsonLogger.fatal(
      'FATAL: JWT_SECRET is set to the default value in production. Refusing to start.',
      'Bootstrap',
    );
    process.exit(1);
  }

  if (
    nodeEnv === 'production' &&
    (!corsOrigin || corsOrigin === '*')
  ) {
    jsonLogger.fatal(
      'FATAL: CORS_ORIGIN must be set to a specific origin in production (not wildcard). Refusing to start.',
      'Bootstrap',
    );
    process.exit(1);
  }

  const posProvider = process.env.POS_PROVIDER;
  if (
    nodeEnv === 'production' &&
    (!posProvider || posProvider === 'mock')
  ) {
    jsonLogger.fatal(
      'FATAL: POS_PROVIDER must be set to a real provider in production (not mock). Refusing to start.',
      'Bootstrap',
    );
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule, { logger: jsonLogger });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'metrics', method: RequestMethod.GET }],
  });

  // ── Swagger / OpenAPI ───────────────────────────────────────
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('NetTapu Platform API')
      .setDescription('Real Estate & Land Sales Platform with Live Online Auction System')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
    logger.log('Swagger UI available at /docs');
  }

  app.enableCors({ origin: corsOrigin || '*' });
  app.enableShutdownHooks();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Monolith running on port ${port}`);
}

clusterize(bootstrap, { name: 'monolith' });
