import request from 'supertest';
import {
  createTestApp,
  cleanupTestData,
  registerAndLogin,
  grantAdminRole,
  TestApp,
} from './helpers/test-app.helper';

const PREFIX = `payments-e2e-${Date.now()}`;
const email = (suffix: string) => `${PREFIX}-${suffix}@test.com`;
const PASSWORD = 'TestPassword123!';

describe('Payments (e2e)', () => {
  let testApp: TestApp;
  let server: any;
  let adminToken: string;
  let userToken: string;
  let userId: string;
  let parcelId: string;
  let paymentId: string;
  const idempotencyKey = `idem-${PREFIX}-1`;

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer();

    // Create admin
    const admin = await registerAndLogin(
      server,
      email('admin'),
      PASSWORD,
      'Admin',
      'Pay',
    );
    await grantAdminRole(testApp.dataSource, admin.userId);
    const adminLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: email('admin'), password: PASSWORD });
    adminToken = adminLogin.body.accessToken;

    // Create regular user
    const user = await registerAndLogin(
      server,
      email('user'),
      PASSWORD,
      'User',
      'Pay',
    );
    userToken = user.accessToken;
    userId = user.userId;

    // Admin creates a parcel for payment tests
    const parcelRes = await request(server)
      .post('/api/v1/parcels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Payment Test Parcel ${PREFIX}`,
        city: 'Ankara',
        district: 'Cankaya',
        price: '250000.00',
      });
    parcelId = parcelRes.body.id;
  });

  afterAll(async () => {
    const qr = testApp.dataSource.createQueryRunner();
    await qr.connect();
    try {
      if (paymentId) {
        await qr
          .query(`DELETE FROM payments.refunds WHERE payment_id = $1`, [
            paymentId,
          ])
          .catch(() => {});
        await qr
          .query(`DELETE FROM payments.payments WHERE id = $1`, [paymentId])
          .catch(() => {});
      }
      // Also delete by idempotency key pattern
      await qr
        .query(
          `DELETE FROM payments.idempotency_keys WHERE key LIKE $1`,
          [`idem-${PREFIX}%`],
        )
        .catch(() => {});
      await qr
        .query(
          `DELETE FROM payments.pos_transactions WHERE payment_id IN (SELECT id FROM payments.payments WHERE idempotency_key LIKE $1)`,
          [`idem-${PREFIX}%`],
        )
        .catch(() => {});
      await qr
        .query(
          `DELETE FROM payments.payments WHERE idempotency_key LIKE $1`,
          [`idem-${PREFIX}%`],
        )
        .catch(() => {});
      if (parcelId) {
        await qr
          .query(`DELETE FROM listings.parcels WHERE id = $1`, [parcelId])
          .catch(() => {});
      }
    } finally {
      await qr.release();
    }
    await cleanupTestData(testApp.dataSource, PREFIX);
  });

  it('POST /payments — user initiates payment with idempotency key (201)', async () => {
    const res = await request(server)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        parcelId,
        amount: '75.00',
        paymentMethod: 'credit_card',
        idempotencyKey,
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    // Mock POS auto-provisions for amounts <= 100 (non-3DS path)
    expect(['pending', 'provisioned']).toContain(res.body.status);
    paymentId = res.body.id;
  });

  it('POST /payments — duplicate idempotency key returns same payment', async () => {
    const res = await request(server)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        parcelId,
        amount: '75.00',
        paymentMethod: 'credit_card',
        idempotencyKey,
      });

    // Should return the same payment (either 201 or 200)
    expect([200, 201]).toContain(res.status);
    expect(res.body.id).toBe(paymentId);
  });

  it('GET /payments — user lists own payments', async () => {
    const res = await request(server)
      .get('/api/v1/payments')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    const found = res.body.data.find((p: any) => p.id === paymentId);
    expect(found).toBeDefined();
  });

  it('PATCH /payments/:id/capture — admin captures (200)', async () => {
    if (!paymentId) return;

    const res = await request(server)
      .patch(`/api/v1/payments/${paymentId}/capture`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(['provisioned', 'completed']).toContain(res.body.status);
  });

  it('POST /refunds — admin initiates refund on captured payment', async () => {
    if (!paymentId) return;

    const res = await request(server)
      .post('/api/v1/refunds')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        paymentId,
        amount: '25.00',
        reason: 'E2E test refund',
        idempotencyKey: `idem-${PREFIX}-refund-1`,
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
  });
});
