/**
 * Export a static route-role matrix from NestJS controller metadata.
 *
 * Usage:  npx tsx scripts/export-route-matrix.ts
 * Output: Markdown table to stdout
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

// Inject required env vars before importing AppModule
Object.assign(process.env, {
  DATABASE_URL:
    process.env.DATABASE_URL ??
    'postgresql://nettapu_app:app_secret_change_me@localhost:5432/nettapu',
  REDIS_URL:
    process.env.REDIS_URL ?? 'redis://:redis_secret_change_me@localhost:6379',
  JWT_SECRET:
    process.env.JWT_SECRET ?? 'route_matrix_script_min_32_chars_ok!!',
  JWT_ISSUER: process.env.JWT_ISSUER ?? 'nettapu',
  JWT_AUDIENCE: process.env.JWT_AUDIENCE ?? 'nettapu-platform',
  POS_PROVIDER: 'mock',
  NODE_ENV: 'development',
});

async function main() {
  // Dynamic import after env vars are set
  const { AppModule } = await import(
    '../apps/monolith/src/app.module'
  );

  const app: INestApplication = await NestFactory.create(AppModule, {
    logger: false,
  });
  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('NetTapu Platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // ── Build the matrix ──────────────────────────────────────────

  interface RouteEntry {
    method: string;
    path: string;
    auth: string;
    roles: string;
    summary: string;
  }

  const rows: RouteEntry[] = [];

  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;
    for (const method of methods) {
      const operation = (pathItem as any)?.[method];
      if (!operation) continue;

      const hasSecurity =
        operation.security && operation.security.length > 0;
      const auth = hasSecurity ? 'Bearer' : 'Public';

      // Try to infer roles from operation description or tags
      const summary = operation.summary ?? operation.operationId ?? '';
      const tags = (operation.tags ?? []).join(', ');

      // Determine roles from path pattern
      let roles = '-';
      if (path.startsWith('/api/v1/admin/')) {
        roles = 'admin';
      } else if (
        path.startsWith('/api/v1/refunds') ||
        path.includes('/capture') ||
        path.includes('/cancel') ||
        path.startsWith('/api/v1/integrations/')
      ) {
        roles = 'admin';
      } else if (
        path.startsWith('/api/v1/parcels') &&
        (method === 'post' || method === 'patch')
      ) {
        roles = 'admin, consultant';
      }

      if (auth === 'Public') {
        roles = '-';
      }

      rows.push({
        method: method.toUpperCase(),
        path,
        auth,
        roles,
        summary: summary || tags,
      });
    }
  }

  // ── Augment with Reflector metadata ───────────────────────────
  // The ROLES_KEY metadata is set by the @Roles() decorator.
  // We can read it from all controllers registered in the app.

  const httpAdapter = app.getHttpAdapter();
  const routerInstance = (httpAdapter as any).getInstance?.();
  if (routerInstance?._router?.stack) {
    // Express router - extract route-level info
    for (const layer of routerInstance._router.stack) {
      if (layer.route) {
        const routePath = `/api/v1${layer.route.path}`;
        const existing = rows.find(
          (r) =>
            r.path === routePath ||
            r.path.replace(/\{[^}]+\}/g, ':$&') === routePath,
        );
        // Additional metadata can be extracted here if needed
      }
    }
  }

  // ── Output markdown ───────────────────────────────────────────

  rows.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  console.log('# NetTapu Platform — Route-Role Matrix\n');
  console.log(
    `Generated: ${new Date().toISOString()}\n`,
  );
  console.log(
    '| Method | Route | Auth | Roles | Description |',
  );
  console.log(
    '|--------|-------|------|-------|-------------|',
  );

  for (const r of rows) {
    console.log(
      `| ${r.method} | \`${r.path}\` | ${r.auth} | ${r.roles} | ${r.summary} |`,
    );
  }

  console.log(`\n**Total routes: ${rows.length}**`);

  await app.close();
}

main().catch((err) => {
  console.error('Failed to generate route matrix:', err);
  process.exit(1);
});
