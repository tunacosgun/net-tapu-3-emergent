# ── Stage 1: Builder ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# 1) Copy workspace manifests + lockfile for deterministic install
COPY package.json package-lock.json ./
COPY apps/monolith/package.json ./apps/monolith/
COPY packages/shared/package.json ./packages/shared/

# 2) Install all deps (dev included – needed for nest build & tsc)
RUN npm ci

# 3) Copy source code
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/monolith ./apps/monolith

# 4) Remove stale incremental-build caches that can cause missing files
RUN rm -f apps/monolith/tsconfig.tsbuildinfo apps/monolith/tsconfig.build.tsbuildinfo \
         packages/shared/tsconfig.tsbuildinfo packages/shared/tsconfig.build.tsbuildinfo

# 5) Build shared first (apps depend on it), then the app
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/monolith

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
COPY --from=builder /app/apps/monolith/package.json ./apps/monolith/
COPY --from=builder /app/apps/monolith/dist ./apps/monolith/dist

WORKDIR /app/apps/monolith

# Cluster mode: 0 = auto-detect CPUs, 1 = disabled, N = explicit count
ENV CLUSTER_WORKERS=0

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
