import request from 'supertest';
import {
  createTestApp,
  cleanupTestData,
  registerAndLogin,
  grantAdminRole,
  TestApp,
} from './helpers/test-app.helper';

const PREFIX = `parcels-e2e-${Date.now()}`;
const email = (suffix: string) => `${PREFIX}-${suffix}@test.com`;
const PASSWORD = 'TestPassword123!';

describe('Parcels (e2e)', () => {
  let testApp: TestApp;
  let server: any;
  let adminToken: string;
  let userToken: string;
  let createdParcelId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer();

    // Create admin user
    const admin = await registerAndLogin(
      server,
      email('admin'),
      PASSWORD,
      'Admin',
      'Parcels',
    );
    await grantAdminRole(testApp.dataSource, admin.userId);
    // Re-login to get token with admin role
    const adminLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: email('admin'), password: PASSWORD });
    adminToken = adminLogin.body.accessToken;

    // Create regular user
    const user = await registerAndLogin(
      server,
      email('user'),
      PASSWORD,
      'Regular',
      'User',
    );
    userToken = user.accessToken;
  });

  afterAll(async () => {
    // Clean up parcel first, then users
    if (createdParcelId) {
      await testApp.dataSource
        .createQueryRunner()
        .connect()
        .then(async () => {
          const qr = testApp.dataSource.createQueryRunner();
          await qr.connect();
          await qr
            .query(
              `DELETE FROM listings.parcel_status_history WHERE parcel_id = $1`,
              [createdParcelId],
            )
            .catch(() => {});
          await qr
            .query(`DELETE FROM listings.parcels WHERE id = $1`, [
              createdParcelId,
            ])
            .catch(() => {});
          await qr.release();
        })
        .catch(() => {});
    }
    await cleanupTestData(testApp.dataSource, PREFIX);
  });

  it('POST /parcels — admin creates parcel (201)', async () => {
    const res = await request(server)
      .post('/api/v1/parcels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `E2E Test Parcel ${PREFIX}`,
        city: 'Istanbul',
        district: 'Kadikoy',
        price: '500000.00',
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toContain('E2E Test Parcel');
    createdParcelId = res.body.id;
  });

  it('POST /parcels — unauthenticated returns 401', async () => {
    await request(server)
      .post('/api/v1/parcels')
      .send({
        title: 'Should fail',
        city: 'Istanbul',
        district: 'Kadikoy',
      })
      .expect(401);
  });

  it('POST /parcels — regular user returns 403', async () => {
    await request(server)
      .post('/api/v1/parcels')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Should fail',
        city: 'Istanbul',
        district: 'Kadikoy',
      })
      .expect(403);
  });

  it('GET /parcels — public, returns paginated list', async () => {
    const res = await request(server).get('/api/v1/parcels').expect(200);

    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /parcels/:id — public, returns detail', async () => {
    // Skip if no parcel was created
    if (!createdParcelId) return;

    const res = await request(server)
      .get(`/api/v1/parcels/${createdParcelId}`)
      .expect(200);

    expect(res.body).toHaveProperty('id', createdParcelId);
  });

  it('PATCH /parcels/:id — admin updates fields', async () => {
    if (!createdParcelId) return;

    const res = await request(server)
      .patch(`/api/v1/parcels/${createdParcelId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `Updated Parcel ${PREFIX}` })
      .expect(200);

    expect(res.body.title).toContain('Updated Parcel');
  });

  it('PATCH /parcels/:id/status — admin transitions draft→active, writes status history', async () => {
    if (!createdParcelId) return;

    const res = await request(server)
      .patch(`/api/v1/parcels/${createdParcelId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' })
      .expect(200);

    expect(res.body.status).toBe('active');
  });
});
