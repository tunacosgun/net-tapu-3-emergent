import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

/** Env vars required by ConfigModule validation and JWT strategy */
const TEST_ENV: Record<string, string> = {
  DATABASE_URL:
    process.env.DATABASE_URL ??
    'postgresql://nettapu_app:app_secret_change_me@localhost:5432/nettapu',
  REDIS_URL:
    process.env.REDIS_URL ?? 'redis://:redis_secret_change_me@localhost:6379',
  JWT_SECRET:
    process.env.JWT_SECRET ?? 'test_secret_min_32_chars_for_e2e_test!!',
  JWT_ISSUER: process.env.JWT_ISSUER ?? 'nettapu',
  JWT_AUDIENCE: process.env.JWT_AUDIENCE ?? 'nettapu-platform',
  JWT_ACCESS_EXPIRATION: '15m',
  JWT_REFRESH_EXPIRATION_DAYS: '7',
  POS_PROVIDER: 'mock',
  NODE_ENV: 'test',
};

// Set env vars EAGERLY so that static imports of AppModule in other files
// (and ConfigModule.forRoot validate()) see them at evaluation time.
for (const [k, v] of Object.entries(TEST_ENV)) {
  if (!process.env[k]) process.env[k] = v;
}

export interface TestApp {
  app: INestApplication;
  module: TestingModule;
  dataSource: DataSource;
  cleanup: () => Promise<void>;
}

let cached: TestApp | null = null;

/**
 * Bootstrap the full NestJS application for E2E testing.
 * Re-uses the same app instance across test files when run sequentially (--runInBand).
 */
export async function createTestApp(): Promise<TestApp> {
  if (cached) return cached;

  // Dynamic import so ConfigModule.forRoot validate() sees process.env set above
  const { AppModule } = await import('../../src/app.module');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleRef.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.setGlobalPrefix('api/v1');

  await app.init();

  const dataSource = moduleRef.get(DataSource);

  const cleanup = async () => {
    await app.close();
    cached = null;
  };

  cached = { app, module: moduleRef, dataSource, cleanup };
  return cached;
}

/**
 * Truncate test-related rows. Call in afterAll to prevent cross-contamination.
 * Deletes rows whose email (or equivalent) matches the given prefix.
 */
export async function cleanupTestData(
  dataSource: DataSource,
  emailPrefix: string,
): Promise<void> {
  const qr = dataSource.createQueryRunner();
  await qr.connect();
  try {
    // Find user IDs matching the test prefix
    const users: { id: string }[] = await qr.query(
      `SELECT id FROM auth.users WHERE email LIKE $1`,
      [`${emailPrefix}%`],
    );
    const userIds = users.map((u) => u.id);

    if (userIds.length > 0) {
      const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');

      // Delete in dependency order (use snake_case DB column names)
      // Audit log is append-only (DELETE and UPDATE prohibited by trigger).
      // Disable FK checks for the session to allow user deletion.
      await qr.query(`SET session_replication_role = 'replica'`).catch(() => {});
      await qr.query(
        `DELETE FROM auth.refresh_tokens WHERE user_id IN (${placeholders})`,
        userIds,
      );
      await qr.query(
        `DELETE FROM auth.user_roles WHERE user_id IN (${placeholders})`,
        userIds,
      );
      // Payment-related cleanup: delete child tables before payments
      const paymentSubquery = `SELECT id FROM payments.payments WHERE user_id IN (${placeholders})`;
      await qr.query(
        `DELETE FROM payments.refunds WHERE payment_id IN (${paymentSubquery})`,
        userIds,
      ).catch(() => {});
      await qr.query(
        `DELETE FROM payments.pos_transactions WHERE payment_id IN (${paymentSubquery})`,
        userIds,
      ).catch(() => {});
      await qr.query(
        `DELETE FROM payments.payment_ledger WHERE payment_id IN (${paymentSubquery})`,
        userIds,
      ).catch(() => {});
      await qr.query(
        `DELETE FROM payments.installment_plans WHERE payment_id IN (${paymentSubquery})`,
        userIds,
      ).catch(() => {});
      await qr.query(
        `DELETE FROM payments.idempotency_keys WHERE key IN (SELECT idempotency_key FROM payments.payments WHERE user_id IN (${placeholders}))`,
        userIds,
      ).catch(() => {});
      await qr.query(
        `DELETE FROM payments.payments WHERE user_id IN (${placeholders})`,
        userIds,
      ).catch(() => {});
      await qr.query(
        `DELETE FROM listings.favorites WHERE user_id IN (${placeholders})`,
        userIds,
      ).catch(() => {});
      await qr.query(
        `DELETE FROM auth.users WHERE id IN (${placeholders})`,
        userIds,
      ).catch(() => {});
      // Re-enable FK checks
      await qr.query(`SET session_replication_role = 'DEFAULT'`).catch(() => {});
    }
  } finally {
    await qr.release();
  }
}

/**
 * Truncate admin test data by IDs.
 */
export async function cleanupAdminTestData(
  dataSource: DataSource,
  opts: {
    pageIds?: string[];
    settingKeys?: string[];
  },
): Promise<void> {
  const qr = dataSource.createQueryRunner();
  await qr.connect();
  try {
    if (opts.pageIds?.length) {
      const ph = opts.pageIds.map((_, i) => `$${i + 1}`).join(',');
      await qr.query(
        `DELETE FROM admin.pages WHERE id IN (${ph})`,
        opts.pageIds,
      );
    }
    if (opts.settingKeys?.length) {
      const ph = opts.settingKeys.map((_, i) => `$${i + 1}`).join(',');
      await qr.query(
        `DELETE FROM admin.system_settings WHERE key IN (${ph})`,
        opts.settingKeys,
      );
    }
  } finally {
    await qr.release();
  }
}

/**
 * Register a user and login, returning the access token.
 */
export async function registerAndLogin(
  server: any,
  email: string,
  password: string,
  firstName = 'Test',
  lastName = 'User',
): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
  const regRes = await request(server)
    .post('/api/v1/auth/register')
    .send({ email, password, firstName, lastName });

  const userId = regRes.body.id;

  const loginRes = await request(server)
    .post('/api/v1/auth/login')
    .send({ email, password });

  return {
    accessToken: loginRes.body.accessToken,
    refreshToken: loginRes.body.refreshToken,
    userId,
  };
}

/**
 * Create a user directly via DB insert, then login via HTTP to get tokens.
 * Bypasses the register endpoint rate limit.
 */
export async function createUserAndLogin(
  server: any,
  dataSource: DataSource,
  email: string,
  password: string,
  firstName = 'Test',
  lastName = 'User',
): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
  const qr = dataSource.createQueryRunner();
  await qr.connect();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result: { id: string }[] = await qr.query(
      `INSERT INTO auth.users (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [email, passwordHash, firstName, lastName],
    );
    const userId = result[0].id;

    // Assign default 'user' role
    const roles: { id: string }[] = await qr.query(
      `SELECT id FROM auth.roles WHERE name = 'user'`,
    );
    if (roles.length > 0) {
      await qr.query(
        `INSERT INTO auth.user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, roles[0].id],
      );
    }

    // Login via HTTP to get JWT tokens
    const loginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password });

    return {
      accessToken: loginRes.body.accessToken,
      refreshToken: loginRes.body.refreshToken,
      userId,
    };
  } finally {
    await qr.release();
  }
}

/**
 * Grant admin role to a user by inserting directly into the DB.
 */
export async function grantAdminRole(
  dataSource: DataSource,
  userId: string,
): Promise<void> {
  const qr = dataSource.createQueryRunner();
  await qr.connect();
  try {
    const roles: { id: string }[] = await qr.query(
      `SELECT id FROM auth.roles WHERE name = 'admin'`,
    );
    if (roles.length > 0) {
      await qr.query(
        `INSERT INTO auth.user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, roles[0].id],
      );
    }
  } finally {
    await qr.release();
  }
}
