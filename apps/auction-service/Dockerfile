# ── Stage 1: Builder ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# 1) Copy workspace manifests + lockfile for deterministic install
COPY package.json package-lock.json ./
COPY apps/auction-service/package.json ./apps/auction-service/
COPY packages/shared/package.json ./packages/shared/

# 2) Install all deps (dev included – needed for nest build & tsc)
RUN npm ci

# 3) Copy source code
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/auction-service ./apps/auction-service

# 4) Remove stale incremental-build caches that can cause missing files
RUN rm -f apps/auction-service/tsconfig.tsbuildinfo apps/auction-service/tsconfig.build.tsbuildinfo \
         packages/shared/tsconfig.tsbuildinfo packages/shared/tsconfig.build.tsbuildinfo

# 5) Build shared first (apps depend on it), then the app
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/auction-service

# 6) Prune devDependencies for a leaner runtime image
RUN npm prune --production

# ── Stage 2: Runtime ──────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# dumb-init: PID 1 signal forwarding for graceful cluster shutdown
RUN apk add --no-cache dumb-init

# Preserve monorepo layout so workspace symlinks keep working:
#   node_modules/@nettapu/shared  →  ../../packages/shared
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Shared package (symlink target)
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# App build output
COPY --from=builder /app/apps/auction-service/package.json ./apps/auction-service/
COPY --from=builder /app/apps/auction-service/dist ./apps/auction-service/dist

WORKDIR /app/apps/auction-service

# Cluster mode: 0 = auto-detect CPUs, 1 = disabled, N = explicit count
# Default 0 (auto) in production, override with docker-compose env
ENV CLUSTER_WORKERS=0

EXPOSE 3001

# dumb-init forwards SIGTERM/SIGINT to the cluster primary,
# which then gracefully shuts down all workers
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
