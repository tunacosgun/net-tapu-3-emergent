import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { createTestApp, TestApp } from './helpers/test-app.helper';

/**
 * Ground-truth auth/role mapping derived from controller source code.
 * Key format: "METHOD /path" (with :param style).
 */
const AUTH_MAP: Record<string, { auth: string; roles: string }> = {
  // ── Auth ────────────────────────────────────────────
  'POST /auth/register': { auth: 'Public', roles: '-' },
  'POST /auth/login': { auth: 'Public', roles: '-' },
  'POST /auth/refresh': { auth: 'Public', roles: '-' },
  'POST /auth/logout': { auth: 'Public', roles: '-' },
  'POST /auth/logout-all': { auth: 'Bearer', roles: 'user' },

  // ── Parcels ─────────────────────────────────────────
  'GET /parcels': { auth: 'Public', roles: '-' },
  'POST /parcels': { auth: 'Bearer', roles: 'admin, consultant' },
  'GET /parcels/:id': { auth: 'Public', roles: '-' },
  'PATCH /parcels/:id': { auth: 'Bearer', roles: 'admin, consultant' },
  'PATCH /parcels/:id/status': { auth: 'Bearer', roles: 'admin, consultant' },
  'GET /parcels/:parcelId/images': { auth: 'Public', roles: '-' },
  'POST /parcels/:parcelId/images': { auth: 'Bearer', roles: 'admin, consultant' },
  'DELETE /parcels/:parcelId/images/:imageId': { auth: 'Bearer', roles: 'admin, consultant' },
  'GET /parcels/:parcelId/documents': { auth: 'Bearer', roles: 'user' },
  'POST /parcels/:parcelId/documents': { auth: 'Bearer', roles: 'admin, consultant' },
  'DELETE /parcels/:parcelId/documents/:docId': { auth: 'Bearer', roles: 'admin, consultant' },

  // ── Favorites ───────────────────────────────────────
  'GET /favorites': { auth: 'Bearer', roles: 'user' },
  'POST /favorites': { auth: 'Bearer', roles: 'user' },
  'DELETE /favorites/:parcelId': { auth: 'Bearer', roles: 'user' },

  // ── Saved Searches ──────────────────────────────────
  'GET /saved-searches': { auth: 'Bearer', roles: 'user' },
  'POST /saved-searches': { auth: 'Bearer', roles: 'user' },
  'PATCH /saved-searches/:id': { auth: 'Bearer', roles: 'user' },
  'DELETE /saved-searches/:id': { auth: 'Bearer', roles: 'user' },

  // ── Payments ────────────────────────────────────────
  'GET /payments': { auth: 'Bearer', roles: 'user' },
  'POST /payments': { auth: 'Bearer', roles: 'user' },
  'GET /payments/:id': { auth: 'Bearer', roles: 'user' },
  'PATCH /payments/:id/capture': { auth: 'Bearer', roles: 'admin' },
  'PATCH /payments/:id/cancel': { auth: 'Bearer', roles: 'admin' },

  // ── Refunds ─────────────────────────────────────────
  'POST /refunds': { auth: 'Bearer', roles: 'admin' },
  'GET /refunds/:id': { auth: 'Bearer', roles: 'admin' },
  'GET /refunds/payment/:paymentId': { auth: 'Bearer', roles: 'admin' },

  // ── Admin: Pages ────────────────────────────────────
  'GET /admin/pages': { auth: 'Bearer', roles: 'admin' },
  'POST /admin/pages': { auth: 'Bearer', roles: 'admin' },
  'GET /admin/pages/:id': { auth: 'Bearer', roles: 'admin' },
  'PATCH /admin/pages/:id': { auth: 'Bearer', roles: 'admin' },
  'DELETE /admin/pages/:id': { auth: 'Bearer', roles: 'admin' },

  // ── Admin: FAQ ──────────────────────────────────────
  'GET /admin/faq': { auth: 'Bearer', roles: 'admin' },
  'POST /admin/faq': { auth: 'Bearer', roles: 'admin' },
  'GET /admin/faq/:id': { auth: 'Bearer', roles: 'admin' },
  'PATCH /admin/faq/:id': { auth: 'Bearer', roles: 'admin' },
  'DELETE /admin/faq/:id': { auth: 'Bearer', roles: 'admin' },

  // ── Admin: References ───────────────────────────────
  'GET /admin/references': { auth: 'Bearer', roles: 'admin' },
  'POST /admin/references': { auth: 'Bearer', roles: 'admin' },
  'GET /admin/references/:id': { auth: 'Bearer', roles: 'admin' },
  'PATCH /admin/references/:id': { auth: 'Bearer', roles: 'admin' },
  'DELETE /admin/references/:id': { auth: 'Bearer', roles: 'admin' },

  // ── Admin: Settings ─────────────────────────────────
  'GET /admin/settings': { auth: 'Bearer', roles: 'admin' },
  'GET /admin/settings/:key': { auth: 'Bearer', roles: 'admin' },
  'PUT /admin/settings/:key': { auth: 'Bearer', roles: 'admin' },
  'DELETE /admin/settings/:key': { auth: 'Bearer', roles: 'admin' },

  // ── Admin: Audit Log ────────────────────────────────
  'GET /admin/audit-log': { auth: 'Bearer', roles: 'admin' },

  // ── Admin: Media ────────────────────────────────────
  'GET /admin/media': { auth: 'Bearer', roles: 'admin' },
  'POST /admin/media': { auth: 'Bearer', roles: 'admin' },
  'GET /admin/media/:id': { auth: 'Bearer', roles: 'admin' },
  'DELETE /admin/media/:id': { auth: 'Bearer', roles: 'admin' },

  // ── Admin: Reconciliation ───────────────────────────
  'GET /admin/reconciliation': { auth: 'Bearer', roles: 'admin' },

  // ── Public Content ──────────────────────────────────
  'GET /content/pages': { auth: 'Public', roles: '-' },
  'GET /content/pages/:slug': { auth: 'Public', roles: '-' },
  'GET /content/faq': { auth: 'Public', roles: '-' },
  'GET /content/references': { auth: 'Public', roles: '-' },

  // ── Integrations ────────────────────────────────────
  'GET /integrations/sync-state': { auth: 'Bearer', roles: 'admin' },
  'POST /integrations/tkgm/lookup': { auth: 'Bearer', roles: 'admin, consultant' },

  // ── Health / Metrics / Internal ─────────────────────
  'GET /health': { auth: 'Public', roles: '-' },
  'GET /metrics': { auth: 'Public', roles: '-' },
  'GET /internal/pool-stats': { auth: 'Public', roles: '-' },
  'GET /internal/runtime-metrics': { auth: 'Public', roles: '-' },
};

describe('Route-Role Matrix (export)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  it('exports route-role matrix', () => {
    const config = new DocumentBuilder()
      .setTitle('NetTapu Platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(testApp.app, config);

    interface RouteEntry {
      method: string;
      path: string;
      auth: string;
      roles: string;
    }

    const rows: RouteEntry[] = [];

    for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
      const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;
      for (const method of methods) {
        const operation = (pathItem as any)?.[method];
        if (!operation) continue;

        // Strip the global prefix to match the AUTH_MAP key
        const routePath = path.replace(/^\/api\/v1/, '');
        // Convert {param} to :param for matching
        const normalizedPath = routePath.replace(/\{([^}]+)\}/g, ':$1');
        const key = `${method.toUpperCase()} ${normalizedPath}`;

        const meta = AUTH_MAP[key] ?? { auth: 'Public', roles: '-' };

        rows.push({
          method: method.toUpperCase(),
          path,
          auth: meta.auth,
          roles: meta.roles,
        });
      }
    }

    rows.sort(
      (a, b) =>
        a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
    );

    // Output the matrix
    const lines: string[] = [];
    lines.push('| Method | Route | Auth | Roles |');
    lines.push('|--------|-------|------|-------|');
    for (const r of rows) {
      lines.push(`| ${r.method} | \`${r.path}\` | ${r.auth} | ${r.roles} |`);
    }
    lines.push(`\n**Total routes: ${rows.length}**`);

    console.log('\n# NetTapu Platform — Route-Role Matrix\n');
    console.log(lines.join('\n'));

    expect(rows.length).toBeGreaterThan(0);
  });
});
