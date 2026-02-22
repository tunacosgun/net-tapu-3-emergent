import request from 'supertest';
import {
  createTestApp,
  cleanupTestData,
  createUserAndLogin,
  TestApp,
} from './helpers/test-app.helper';

const PREFIX = `auth-e2e-${Date.now()}`;
const email = (suffix: string) => `${PREFIX}-${suffix}@test.com`;
const PASSWORD = 'TestPassword123!';

describe('Auth (e2e)', () => {
  let testApp: TestApp;
  let server: any;

  // Pre-created users for refresh/logout/logout-all tests
  // (avoids hitting register rate limit — 5 req/60s)
  let refreshUser: { accessToken: string; refreshToken: string };
  let logoutUser: { accessToken: string; refreshToken: string };
  let logoutAllUser: { accessToken: string; refreshToken: string };

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer();

    // Pre-create users via DB insert to bypass register rate limit (5 req/60s)
    refreshUser = await createUserAndLogin(
      server,
      testApp.dataSource,
      email('refresh1'),
      PASSWORD,
      'T',
      'R',
    );
    logoutUser = await createUserAndLogin(
      server,
      testApp.dataSource,
      email('logout1'),
      PASSWORD,
      'T',
      'O',
    );
    logoutAllUser = await createUserAndLogin(
      server,
      testApp.dataSource,
      email('logoutall'),
      PASSWORD,
      'T',
      'A',
    );
  });

  afterAll(async () => {
    await cleanupTestData(testApp.dataSource, PREFIX);
  });

  // ── Registration ─────────────────────────────────────────────

  it('POST /auth/register — creates user, returns { id, email }', async () => {
    const res = await request(server)
      .post('/api/v1/auth/register')
      .send({
        email: email('reg1'),
        password: PASSWORD,
        firstName: 'Test',
        lastName: 'User',
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('email', email('reg1'));
  });

  it('POST /auth/register — duplicate email returns 409', async () => {
    // First registration
    await request(server)
      .post('/api/v1/auth/register')
      .send({
        email: email('dup'),
        password: PASSWORD,
        firstName: 'Test',
        lastName: 'Dup',
      })
      .expect(201);

    // Duplicate
    await request(server)
      .post('/api/v1/auth/register')
      .send({
        email: email('dup'),
        password: PASSWORD,
        firstName: 'Test',
        lastName: 'Dup',
      })
      .expect(409);
  });

  it('POST /auth/register — invalid body returns 400', async () => {
    await request(server)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email' })
      .expect(400);
  });

  // ── Login ────────────────────────────────────────────────────

  it('POST /auth/login — valid credentials returns tokens', async () => {
    const em = email('login1');
    await request(server)
      .post('/api/v1/auth/register')
      .send({ email: em, password: PASSWORD, firstName: 'T', lastName: 'L' });

    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: em, password: PASSWORD })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body).toHaveProperty('expiresIn');
  });

  it('POST /auth/login — wrong password returns 401', async () => {
    // Use the pre-created refresh user (already registered)
    await request(server)
      .post('/api/v1/auth/login')
      .send({ email: email('refresh1'), password: 'WrongPassword123!' })
      .expect(401);
  });

  // ── Refresh ──────────────────────────────────────────────────

  it('POST /auth/refresh — valid refresh token rotates', async () => {
    // Re-login to get a fresh refresh token
    const loginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: email('refresh1'), password: PASSWORD });

    const res = await request(server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    // New token should differ from old
    expect(res.body.refreshToken).not.toBe(loginRes.body.refreshToken);
  });

  // ── Logout ───────────────────────────────────────────────────

  it('POST /auth/logout — invalidates refresh token', async () => {
    // Re-login to get a fresh refresh token
    const loginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: email('logout1'), password: PASSWORD });

    // Logout
    await request(server)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: loginRes.body.refreshToken })
      .expect(204);

    // Using the old refresh token should fail
    await request(server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken })
      .expect(401);
  });

  it('POST /auth/logout-all — requires JWT, revokes all sessions', async () => {
    // Re-login to get fresh tokens
    const loginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: email('logoutall'), password: PASSWORD });

    // Without JWT → 401
    await request(server)
      .post('/api/v1/auth/logout-all')
      .expect(401);

    // With JWT → 204
    await request(server)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .expect(204);

    // Refresh token should be revoked
    await request(server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken })
      .expect(401);
  });
});
