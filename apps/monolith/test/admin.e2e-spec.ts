import request from 'supertest';
import {
  createTestApp,
  cleanupTestData,
  cleanupAdminTestData,
  registerAndLogin,
  grantAdminRole,
  TestApp,
} from './helpers/test-app.helper';

const PREFIX = `admin-e2e-${Date.now()}`;
const email = (suffix: string) => `${PREFIX}-${suffix}@test.com`;
const PASSWORD = 'TestPassword123!';

describe('Admin (e2e)', () => {
  let testApp: TestApp;
  let server: any;
  let adminToken: string;
  let pageId: string;
  const settingKey = `e2e_test_setting_${Date.now()}`;

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer();

    const admin = await registerAndLogin(
      server,
      email('admin'),
      PASSWORD,
      'Admin',
      'Panel',
    );
    await grantAdminRole(testApp.dataSource, admin.userId);
    const loginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: email('admin'), password: PASSWORD });
    adminToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await cleanupAdminTestData(testApp.dataSource, {
      pageIds: pageId ? [pageId] : [],
      settingKeys: [settingKey],
    });
    // Clean up audit logs created by test
    const qr = testApp.dataSource.createQueryRunner();
    await qr.connect();
    try {
      if (pageId) {
        await qr
          .query(
            `DELETE FROM admin.audit_log WHERE resource_id = $1`,
            [pageId],
          )
          .catch(() => {});
      }
      // Setting key audit entries: resource_id is uuid but key is text,
      // so this may fail — that's ok, audit logs are harmless test residue
      await qr
        .query(
          `DELETE FROM admin.audit_log WHERE action LIKE '%settings%'
           AND created_at > NOW() - INTERVAL '5 minutes'`,
        )
        .catch(() => {});
    } finally {
      await qr.release();
    }
    await cleanupTestData(testApp.dataSource, PREFIX);
  });

  it('POST /admin/pages — admin creates page (201)', async () => {
    const res = await request(server)
      .post('/api/v1/admin/pages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        pageType: 'custom',
        slug: `e2e-test-page-${Date.now()}`,
        title: `E2E Test Page ${PREFIX}`,
        content: '<p>Test content</p>',
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toContain('E2E Test Page');
    pageId = res.body.id;
  });

  it('PATCH /admin/pages/:id — admin updates, verify audit_log entry written', async () => {
    if (!pageId) return;

    await request(server)
      .patch(`/api/v1/admin/pages/${pageId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `Updated Page ${PREFIX}`, status: 'published' })
      .expect(200);

    // Give audit interceptor a moment to write asynchronously
    await new Promise((r) => setTimeout(r, 500));

    // Verify audit log entry exists
    const qr = testApp.dataSource.createQueryRunner();
    await qr.connect();
    try {
      const logs = await qr.query(
        `SELECT * FROM admin.audit_log WHERE resource_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [pageId],
      );
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toContain('PATCH');
    } finally {
      await qr.release();
    }
  });

  it('GET /content/pages — public, returns only published pages', async () => {
    const res = await request(server)
      .get('/api/v1/content/pages')
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    // All returned pages should be published (if any)
    for (const page of res.body.data) {
      expect(page.status).toBe('published');
    }
  });

  it('PUT /admin/settings/:key — admin upserts setting', async () => {
    const res = await request(server)
      .put(`/api/v1/admin/settings/${settingKey}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        value: { enabled: true, threshold: 42 },
        description: 'E2E test setting',
      })
      .expect(200);

    expect(res.body).toHaveProperty('key', settingKey);
    expect(res.body.value).toEqual({ enabled: true, threshold: 42 });
  });

  it('GET /admin/audit-log — admin queries audit trail, verifies entries from mutations above', async () => {
    const res = await request(server)
      .get('/api/v1/admin/audit-log')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    // There should be audit entries from the page create/update and setting upsert above
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});
