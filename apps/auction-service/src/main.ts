import 'reflect-metadata';
import cluster from 'node:cluster';
import { NestFactory } from '@nestjs/core';
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { JsonLoggerService, clusterize } from '@nettapu/shared';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './adapters/redis-io.adapter';

async function bootstrap() {
  // In cluster mode, only worker #1 runs background workers (settlement, auction-ending).
  // All workers handle HTTP + WebSocket traffic.
  // Non-clustered mode (CLUSTER_WORKERS=0 or 1): everything runs in one process.
  const workerId = cluster.worker?.id ?? 0;
  process.env.CLUSTER_WORKER_ID = String(workerId);
  if (workerId > 1) {
    process.env.DISABLE_WORKERS = 'true';
  }
  const jsonLogger = new JsonLoggerService('auction-service');
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

  app.setGlobalPrefix('api/v1/auctions', {
    exclude: [{ path: 'metrics', method: RequestMethod.GET }],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({ origin: corsOrigin || '*' });
  app.enableShutdownHooks();

  // Redis-backed Socket.IO adapter for multi-instance pub/sub
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redisIoAdapter = new RedisIoAdapter(app, redisUrl);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`Auction service running on port ${port}`);
}

clusterize(bootstrap, { name: 'auction-service' });
