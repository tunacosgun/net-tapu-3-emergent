import request from 'supertest';
import {
  createTestApp,
  cleanupTestData,
  registerAndLogin,
  grantAdminRole,
  TestApp,
} from './helpers/test-app.helper';

const PREFIX = `role-e2e-${Date.now()}`;
const email = (suffix: string) => `${PREFIX}-${suffix}@test.com`;
const PASSWORD = 'TestPassword123!';

describe('Role Access Matrix (e2e)', () => {
  let testApp: TestApp;
  let server: any;
  let userToken: string;
  let adminToken: string;
  let parcelId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer();

    // Create regular user
    const user = await registerAndLogin(
      server,
      email('user'),
      PASSWORD,
      'Regular',
      'Role',
    );
    userToken = user.accessToken;

    // Create admin
    const admin = await registerAndLogin(
      server,
      email('admin'),
      PASSWORD,
      'Admin',
      'Role',
    );
    await grantAdminRole(testApp.dataSource, admin.userId);
    const adminLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: email('admin'), password: PASSWORD });
    adminToken = adminLogin.body.accessToken;

    // Admin creates a parcel for favorites test
    const parcelRes = await request(server)
      .post('/api/v1/parcels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Role Test Parcel ${PREFIX}`,
        city: 'Izmir',
        district: 'Bornova',
      });
    parcelId = parcelRes.body.id;
  });

  afterAll(async () => {
    const qr = testApp.dataSource.createQueryRunner();
    await qr.connect();
    try {
      if (parcelId) {
        await qr
          .query(
            `DELETE FROM listings.favorites WHERE parcel_id = $1`,
            [parcelId],
          )
          .catch(() => {});
        await qr
          .query(`DELETE FROM listings.parcels WHERE id = $1`, [parcelId])
          .catch(() => {});
      }
      // Clean up any pages created in tests
      await qr
        .query(
          `DELETE FROM admin.pages WHERE slug LIKE $1`,
          [`role-test-%`],
        )
        .catch(() => {});
      await qr
        .query(
          `DELETE FROM admin.audit_log WHERE action LIKE $1`,
          [`%admin/pages%`],
        )
        .catch(() => {});
    } finally {
      await qr.release();
    }
    await cleanupTestData(testApp.dataSource, PREFIX);
  });

  // ── Unauthenticated ──────────────────────────────────────────

  it('Unauthenticated → POST /admin/pages → 401', async () => {
    await request(server)
      .post('/api/v1/admin/pages')
      .send({
        pageType: 'custom',
        slug: 'role-test-unauth',
        title: 'Should fail',
      })
      .expect(401);
  });

  it('Unauthenticated → GET /parcels → 200 (public)', async () => {
    await request(server).get('/api/v1/parcels').expect(200);
  });

  // ── Regular User ─────────────────────────────────────────────

  it('Regular user → POST /admin/pages → 403', async () => {
    await request(server)
      .post('/api/v1/admin/pages')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        pageType: 'custom',
        slug: 'role-test-user',
        title: 'Should fail',
      })
      .expect(403);
  });

  it('Regular user → POST /favorites → 201', async () => {
    if (!parcelId) return;

    const res = await request(server)
      .post('/api/v1/favorites')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ parcelId })
      .expect(201);

    expect(res.body).toHaveProperty('id');
  });

  // ── Admin ────────────────────────────────────────────────────

  it('Admin → POST /admin/pages → 201', async () => {
    const res = await request(server)
      .post('/api/v1/admin/pages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        pageType: 'custom',
        slug: `role-test-admin-${Date.now()}`,
        title: 'Admin Page Test',
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
  });

  it('Admin → GET /admin/audit-log → 200', async () => {
    const res = await request(server)
      .get('/api/v1/admin/audit-log')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
  });
});
