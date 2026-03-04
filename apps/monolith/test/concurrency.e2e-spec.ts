import request from 'supertest';
import {
  createTestApp,
  cleanupTestData,
  createUserAndLogin,
  grantAdminRole,
  TestApp,
} from './helpers/test-app.helper';

const PREFIX = `concurrency-e2e-${Date.now()}`;
const email = (suffix: string) => `${PREFIX}-${suffix}@test.com`;
const PASSWORD = 'TestPassword123!';

describe('Concurrency — idempotency key (e2e)', () => {
  let testApp: TestApp;
  let server: any;
  let userToken: string;
  let adminToken: string;
  let parcelId: string;
  const idempotencyKey5 = `idem-${PREFIX}-5x`;
  const idempotencyKey10 = `idem-${PREFIX}-10x`;

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer();

    // Create admin via DB to bypass rate limit
    const admin = await createUserAndLogin(
      server,
      testApp.dataSource,
      email('admin'),
      PASSWORD,
      'Admin',
      'Concur',
    );
    await grantAdminRole(testApp.dataSource, admin.userId);
    const adminLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: email('admin'), password: PASSWORD });
    adminToken = adminLogin.body.accessToken;

    // Create regular user
    const user = await createUserAndLogin(
      server,
      testApp.dataSource,
      email('user'),
      PASSWORD,
      'User',
      'Concur',
    );
    userToken = user.accessToken;

    // Create a parcel
    const parcelRes = await request(server)
      .post('/api/v1/parcels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Concurrency Test Parcel ${PREFIX}`,
        city: 'Istanbul',
        district: 'Besiktas',
        price: '100000.00',
      });
    parcelId = parcelRes.body.id;
  });

  afterAll(async () => {
    const qr = testApp.dataSource.createQueryRunner();
    await qr.connect();
    try {
      for (const key of [idempotencyKey5, idempotencyKey10]) {
        await qr
          .query(
            `DELETE FROM payments.pos_transactions WHERE payment_id IN (SELECT id FROM payments.payments WHERE idempotency_key = $1)`,
            [key],
          )
          .catch(() => {});
        await qr
          .query(
            `DELETE FROM payments.payment_ledger WHERE payment_id IN (SELECT id FROM payments.payments WHERE idempotency_key = $1)`,
            [key],
          )
          .catch(() => {});
        await qr
          .query(
            `DELETE FROM payments.payments WHERE idempotency_key = $1`,
            [key],
          )
          .catch(() => {});
        await qr
          .query(
            `DELETE FROM payments.idempotency_keys WHERE key = $1`,
            [key],
          )
          .catch(() => {});
      }
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

  it('5 parallel payments with same idempotency key → all succeed, exactly 1 DB row', async () => {
    const promises = Array.from({ length: 5 }, () =>
      request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          parcelId,
          amount: '75.00',
          paymentMethod: 'credit_card',
          idempotencyKey: idempotencyKey5,
        }),
    );

    const results = await Promise.all(promises);

    const statuses = results.map((r) => r.status);
    for (const status of statuses) {
      expect([200, 201]).toContain(status);
    }

    const ids = results.map((r) => r.body.id).filter(Boolean);
    expect(ids).toHaveLength(5);
    const uniqueIds = [...new Set(ids)];
    expect(uniqueIds).toHaveLength(1);

    const qr = testApp.dataSource.createQueryRunner();
    await qr.connect();
    try {
      const rows = await qr.query(
        `SELECT COUNT(*)::int AS count FROM payments.payments WHERE idempotency_key = $1`,
        [idempotencyKey5],
      );
      expect(rows[0].count).toBe(1);
      console.log(
        `5x concurrency: 5/5 succeeded, DB rows: ${rows[0].count}, payment ID: ${uniqueIds[0]}`,
      );
    } finally {
      await qr.release();
    }
  });

  it('10 parallel payments → all succeed, exactly 1 payment, 1 POS tx, 1 ledger set', async () => {
    const promises = Array.from({ length: 10 }, () =>
      request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          parcelId,
          amount: '75.00',
          paymentMethod: 'credit_card',
          idempotencyKey: idempotencyKey10,
        }),
    );

    const results = await Promise.all(promises);

    // All 10 must succeed (200 or 201)
    const statuses = results.map((r) => r.status);
    for (const status of statuses) {
      expect([200, 201]).toContain(status);
    }

    // All 10 must return the same payment ID
    const ids = results.map((r) => r.body.id).filter(Boolean);
    expect(ids).toHaveLength(10);
    const uniqueIds = [...new Set(ids)];
    expect(uniqueIds).toHaveLength(1);
    const paymentId = uniqueIds[0];

    // Deep DB assertions — verify no duplication at any level
    const qr = testApp.dataSource.createQueryRunner();
    await qr.connect();
    try {
      // Exactly 1 payment row
      const payments = await qr.query(
        `SELECT COUNT(*)::int AS count FROM payments.payments WHERE idempotency_key = $1`,
        [idempotencyKey10],
      );
      expect(payments[0].count).toBe(1);

      // Exactly 1 idempotency key row
      const idemKeys = await qr.query(
        `SELECT COUNT(*)::int AS count FROM payments.idempotency_keys WHERE key = $1`,
        [idempotencyKey10],
      );
      expect(idemKeys[0].count).toBe(1);

      // Exactly 1 POS transaction row (provision — no duplicates)
      const posTxs = await qr.query(
        `SELECT COUNT(*)::int AS count FROM payments.pos_transactions WHERE payment_id = $1`,
        [paymentId],
      );
      expect(posTxs[0].count).toBe(1);

      // Exactly 2 ledger entries: PAYMENT_INITIATED + PAYMENT_PROVISIONED
      // (no duplicates from race losers)
      const ledger = await qr.query(
        `SELECT event, COUNT(*)::int AS count FROM payments.payment_ledger WHERE payment_id = $1 GROUP BY event ORDER BY event`,
        [paymentId],
      );
      const ledgerMap = Object.fromEntries(
        ledger.map((r: { event: string; count: number }) => [r.event, r.count]),
      );
      expect(ledgerMap['payment_initiated']).toBe(1);
      expect(ledgerMap['payment_provisioned']).toBe(1);
      expect(ledger.length).toBe(2); // no other event types

      console.log(
        `10x concurrency: 10/10 succeeded, payments: ${payments[0].count}, ` +
          `POS txs: ${posTxs[0].count}, ledger entries: ${ledger.map((r: { event: string; count: number }) => `${r.event}=${r.count}`).join(', ')}, ` +
          `payment ID: ${paymentId}`,
      );
    } finally {
      await qr.release();
    }
  });
});
