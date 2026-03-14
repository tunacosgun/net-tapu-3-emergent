# ── Stage 1: Builder ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# 1) Copy workspace manifests + lockfile for deterministic install
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# 2) Install all deps (dev included – needed for next build & tsc)
RUN npm ci

# 3) Copy source code
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# 4) Build shared first, then the Next.js app
RUN npm run build --workspace=packages/shared
WORKDIR /app/apps/web
ARG API_URL=http://monolith:3000
ARG AUCTION_API_URL=http://auction-service:3001
ARG NEXT_PUBLIC_SITE_URL=https://nettapu.com
ARG NEXT_PUBLIC_WS_URL=https://nettapu.com
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ENV API_URL=$API_URL
ENV AUCTION_API_URL=$AUCTION_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
RUN npm run build
WORKDIR /app

# ── Stage 2: Runtime ──────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache dumb-init

# Preserve monorepo layout
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Shared package
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Next.js app
COPY --from=builder /app/apps/web/package.json ./apps/web/
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/next.config.js ./apps/web/next.config.js
COPY --from=builder /app/apps/web/src/i18n ./apps/web/src/i18n
COPY --from=builder /app/apps/web/tailwind.config.ts ./apps/web/tailwind.config.ts
COPY --from=builder /app/apps/web/postcss.config.js ./apps/web/postcss.config.js

WORKDIR /app/apps/web

EXPOSE 3002

ENTRYPOINT ["dumb-init", "--"]
CMD ["npx", "next", "start", "-p", "3002"]
