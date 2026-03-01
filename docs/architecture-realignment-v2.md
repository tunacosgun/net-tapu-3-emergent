# NetTapu Platform — Strategic Architecture Re-Alignment

> Status: DECISION DOCUMENT | Branch: feature/phase-4-crm
> Date: 2026-02-24
> Supersedes: docs/phase-4-crm-architecture.md (CRM deferred to Phase 5)

---

## Executive Summary

CRM is not on the critical path to launch. The core value proposition is
**real-money live auctions on real estate parcels**. Everything that is not
required for a user to browse a parcel, place a deposit, bid in a live auction,
and complete a purchase is post-launch scope.

This document re-sequences the roadmap around that truth.

---

## 1. Core Launch Scope (MVP)

### 1.1 What Must Work on Day 1

```
User browses map → finds parcel → places deposit → joins auction →
bids in real-time → wins → payment captured → parcel marked sold

Admin creates parcel → uploads media → configures auction →
monitors live bids → reviews settlement → handles refunds
```

### 1.2 Module Readiness Assessment

| Module | Status | Launch Blocker? | Gap |
|--------|--------|-----------------|-----|
| Auth (JWT, roles, register/login) | DONE | - | None |
| Listings (parcels, images, docs, search) | DONE | - | Full-text search exists. Map data entity exists. |
| Payments (deposit, POS, ledger, refund) | DONE | - | Mock POS only. Real POS integration needed. |
| Auction Engine (bidding, settlement) | DONE | YES | Not horizontally scalable (see Section 2). |
| WebSocket Gateway | DONE | YES | No sticky sessions. Single Redis. (see Section 2). |
| Admin (CRUD, audit log, settings) | DONE | - | No admin UI — API-only. Sufficient for launch with Postman/internal tool. |
| Notifications | SHELL ONLY | YES | Entities exist, no dispatch worker. Need SMS/email for deposit receipts, bid confirmations, auction results. |
| CRM | SHELL ONLY | No | Deferred to Phase 5. |
| Campaigns | SHELL ONLY | No | Deferred to Phase 6. |
| Mobile (iOS/Android) | NOT STARTED | No | Web-first launch. Mobile follows. |

### 1.3 Launch-Critical Gaps (Ordered by Risk)

```
1. WebSocket horizontal scaling       — breaks at >1 replica (Section 2)
2. Real POS integration               — mock POS cannot take real money
3. Notification dispatch               — users must receive deposit/auction emails+SMS
4. Sniper extension cap               — auctions can run indefinitely
5. Redis high availability            — single point of failure
6. Production SSL + domain            — infra prerequisite
7. Admin UI or internal tool          — operators need to manage auctions
```

---

## 2. Auction Engine Scalability Evaluation

### 2.1 Current Architecture (Single-Instance)

```
                  ┌─────────────┐
                  │    nginx    │
                  │  (no sticky)│
                  └──────┬──────┘
                         │
                  ┌──────▼──────┐
                  │   auction   │
                  │   service   │  ← single container
                  │  (3001)     │
                  │             │
                  │  Gateway    │  Socket.IO + RedisIoAdapter
                  │  BidService │  Redis lock + DB TX
                  │  Workers    │  Ending (1s poll) + Settlement (5s poll)
                  └──┬─────┬───┘
                     │     │
              ┌──────▼┐  ┌─▼──────┐
              │ Redis │  │Postgres│
              │(single)│  │(single)│
              └───────┘  └────────┘
```

### 2.2 What Happens with 3 Replicas Today

| Component | Behavior | Breaks? |
|-----------|----------|---------|
| **WebSocket handshake** | Client connects to replica A. On reconnect, nginx may route to replica B. Socket.IO requires the same node for the upgrade handshake. | **YES** — connection fails without sticky sessions. |
| **Socket.IO rooms** | RedisIoAdapter broadcasts to all replicas via pub/sub. A message emitted on replica A reaches clients on B and C. | No — this works correctly. |
| **Bid placement** | Redis lock (`bid:lock:auction:{id}`) is global. Only one replica can hold the lock. DB transaction is atomic. | No — Redis lock serializes correctly across replicas. |
| **Bid ordering** | `serverTs` from PostgreSQL `NOW()`. All replicas use the same DB server. Tie-break by UUID. | No — deterministic. PostgreSQL is the single clock. |
| **@VersionColumn** | Optimistic lock on auction row. Concurrent bids from different replicas will conflict — loser gets version mismatch. | No — by design. Redis lock prevents this anyway. |
| **Anti-sniping** | Extension logic runs inside the bid TX holding the Redis lock. Only one replica executes at a time. | No — serialized via lock. |
| **AuctionEndingWorker** | Polls every 1s. Each replica's worker #1 runs independently. Redis lock (`auction:ending:lock:{id}`) prevents duplicate transitions. | No — but wasteful. 3 replicas = 3 queries/sec for same check. |
| **SettlementWorker** | Same as ending worker. Redis lock prevents duplicates. | No — but wasteful. |
| **Rate limiting** | Redis-based. Global counters. Works across replicas. | No. |

**Verdict:** The auction engine is **already horizontally scalable for bid processing**.
The only blocker is **nginx sticky sessions** for WebSocket handshake stability.

### 2.3 Risk: Worker Duplication Across Replicas

With 3 replicas, workers #1 on each replica all attempt to run:
- AuctionEndingWorker: 3 queries/sec instead of 1
- SettlementWorker: 3 queries/5sec instead of 1

This is wasteful but **not incorrect** — Redis locks prevent double execution.
At scale (100+ auctions), this adds ~3x query load for worker polling.

**Fix (Phase 1):** Leader election via Redis. Only one replica runs workers.

```
On startup:
  SET auction:worker:leader {replicaId} NX EX 30

Every 10s:
  If leader: refresh TTL
  If not leader: check if key expired, attempt to claim

Only leader replica enables AuctionEndingWorker + SettlementWorker.
```

This is a <20 line change in `main.ts`.

---

## 3. Production-Grade Real-Time Architecture

### 3.1 WebSocket Gateway Design

**Current:** Socket.IO 4.7 on NestJS gateway at `/ws/auction`.
**Assessment:** Solid. Socket.IO provides automatic reconnection, binary fallback,
room-based broadcasting, and the Redis adapter handles cross-instance pub/sub.

**Required changes for production:**

| Change | Effort | Priority |
|--------|--------|----------|
| Sticky sessions (nginx `ip_hash` or cookie-based) | 1 line in nginx.conf | P0 |
| Connection authentication timeout (reject if no auth in 5s) | Small | P1 |
| Per-room connection limit (max 10K clients per auction room) | Medium | P2 |
| Graceful drain on shutdown (broadcast "reconnecting" before kill) | Small | P1 |

### 3.2 Redis Pub/Sub Usage

**Current architecture is correct.** Socket.IO Redis adapter uses dedicated pub/sub
connections (separate from lock/rate-limit client). Messages flow:

```
Replica A emits to room "auction:123"
  → Redis PUBLISH on adapter channel
  → Replicas B, C receive via SUBSCRIBE
  → Each replica delivers to local Socket.IO clients in that room
```

**Throughput:** At 1,000 bids/min across 50 auctions, pub/sub handles ~200 messages/sec.
Single Redis node handles 100K+ pub/sub messages/sec. No bottleneck.

**Required changes:**

| Change | Effort | Priority |
|--------|--------|----------|
| Redis Sentinel (failover) | Config change in docker-compose + adapter init | P0 |
| Separate Redis instances: pub/sub vs locks vs cache | Config | P2 |

### 3.3 In-Memory vs DB State

**Current design is correct: DB is the source of truth.**

```
┌──────────────────────────────────────────────────────────┐
│                     STATE OWNERSHIP                       │
├──────────────────────┬───────────────────────────────────┤
│ PostgreSQL (durable) │ Redis (ephemeral)                 │
├──────────────────────┼───────────────────────────────────┤
│ auction.status       │ bid:lock:auction:{id}  (5s TTL)   │
│ auction.currentPrice │ ws:bid:rate:user:{id}  (3s TTL)   │
│ auction.extendedUntil│ ws:bid:rate:auction:{id} (3s TTL) │
│ bids (append-only)   │ socket.io adapter channels        │
│ deposits             │ auction:ending:lock:{id} (10s)    │
│ settlement manifests │ auction:settlement:lock:{id} (30s)│
│ payment ledger       │                                   │
└──────────────────────┴───────────────────────────────────┘
```

**No in-memory auction state.** Every bid reads current price from DB inside a
transaction. This is slower than an in-memory cache but guarantees correctness.
At <1,000 bids/min, DB latency (~2-5ms per bid TX) is not a bottleneck.

**When to add in-memory caching:** Only if bid latency exceeds 50ms p99.
At that point, cache `auction.currentPrice` in Redis with 1s TTL as a read-through
cache for the "can this bid possibly win?" pre-check (before acquiring the lock).

### 3.4 Snapshot Recovery (Reconnection)

**Current behavior:** When a client reconnects, Socket.IO's built-in recovery
sends missed events from the Redis adapter's buffer (default: 1 minute window).

**After buffer expiry:** Client must request full auction state via REST:
`GET /api/v1/auctions/:id` — returns current price, bid count, time remaining, status.

**Required changes:**

| Change | Effort | Priority |
|--------|--------|----------|
| On reconnect, emit `auction:snapshot` event with full state | Small | P1 |
| Add `lastBidId` to snapshot so client can detect gaps | Small | P1 |
| Client-side: request snapshot on reconnect, reconcile with buffer | Client code | P1 |

### 3.5 Reconnection Strategy

Socket.IO handles reconnection automatically with exponential backoff.
Current config inherits Socket.IO defaults:
- Initial delay: 1s
- Max delay: 5s
- Jitter: enabled

**Required changes:**

| Change | Effort | Priority |
|--------|--------|----------|
| Server: emit `auction:state` on client `re-join` event | Small | P1 |
| Server: track `lastBidTs` per client for gap detection | Medium | P2 |
| Client: show "reconnecting..." overlay during disconnect | Client code | P1 |
| Client: auto-rejoin auction room after reconnect | Client code | P1 |

### 3.6 Bid Rate Limiting at Scale

**Current implementation is production-ready:**

```
Layer 1: nginx         10 req/s per IP (connection level)
Layer 2: Redis/user    5 bids per 3s (application level, Lua atomic)
Layer 3: Redis/auction 50 bids per 3s (global per auction, Lua atomic)
```

At 1,000 concurrent bidders across 50 auctions:
- Per-user: 5 bids/3s = 1.67 bids/sec max per person
- Per-auction: 50 bids/3s = 16.7 bids/sec max per auction
- Global: 50 auctions * 16.7 = 835 bids/sec theoretical max
- Redis INCR+EXPIRE: handles 100K+ ops/sec. No bottleneck.

**No changes needed for launch.**

### 3.7 Anti-Sniping at Scale

**Current:** Every bid in the final 60s extends auction by 60s. No cap.

**Problem:** Two determined bidders can extend a 30-minute auction to 4+ hours.
In production with real money, this is a legal and UX risk.

**Proposed fix:**

```
Add to auctions table:
  max_extensions        smallint DEFAULT 10
  extension_count       smallint DEFAULT 0

On sniper bid:
  IF extension_count < max_extensions:
    extend by SNIPER_EXTENSION_SECONDS
    extension_count += 1
    broadcast auction:extended {remaining_extensions}
  ELSE:
    no extension, auction ends at scheduled time
    broadcast auction:final_minute {no_more_extensions: true}
```

**Default:** 10 extensions * 60s = 10 minutes max additional time.
Configurable per auction by admin.

---

## 4. Infrastructure Topology

### 4.1 Production Target Architecture

```
                           ┌──────────────┐
                           │   CDN        │
                           │ (CloudFlare) │  static assets, images, documents
                           └──────┬───────┘
                                  │
                           ┌──────▼───────┐
                           │   nginx      │
                           │  (2 nodes)   │  SSL termination, rate limiting
                           │  ip_hash     │  sticky sessions for WebSocket
                           └──┬───────┬───┘
                              │       │
               ┌──────────────▼┐    ┌─▼──────────────┐
               │   monolith    │    │ auction-service │
               │  (2 replicas) │    │  (2 replicas)   │
               │  port 3000    │    │  port 3001      │
               │               │    │                 │
               │  REST API     │    │  WebSocket GW   │
               │  Auth         │    │  BidService     │
               │  Listings     │    │  Workers*       │  * leader-elected
               │  Payments     │    │  Settlement     │
               │  Admin        │    │  Metrics        │
               └──┬────────────┘    └──┬──────────────┘
                  │                    │
          ┌───────▼────────────────────▼───────┐
          │                                     │
   ┌──────▼──────┐                      ┌───────▼──────┐
   │  PostgreSQL  │                      │    Redis     │
   │   primary    │                      │  Sentinel    │
   │  (write)     │                      │  (3 nodes)   │
   │              │                      │              │
   │  ┌────────┐  │                      │  primary     │
   │  │replica │  │  ← async streaming   │  replica     │
   │  │(read)  │  │     replication       │  sentinel    │
   │  └────────┘  │                      └──────────────┘
   └──────────────┘
```

### 4.2 Component Decisions

#### Reverse Proxy: nginx (existing)

Already configured. Required changes:
```nginx
upstream auction_service {
  ip_hash;                          # ← ADD: sticky sessions
  server auction-service-1:3001;
  server auction-service-2:3001;
}

upstream monolith {
  server monolith-1:3000;
  server monolith-2:3000;
}
```

No external load balancer needed at launch. nginx handles both HTTP and WebSocket
proxying. If deploying on cloud, a TCP/L4 load balancer (AWS NLB, GCP Network LB)
in front of nginx handles multi-node nginx.

#### Stateless Services: monolith + auction-service

Both are already stateless:
- No in-memory session state (JWT-based auth)
- No in-memory auction state (DB is truth)
- No local file storage (images go to CDN/S3)
- Redis adapter handles cross-instance Socket.IO

Each replica is identical and disposable. Scale by adding containers.

#### Redis: Sentinel (3-node minimum)

```
Current:  Single Redis 7 Alpine, 256MB, LRU eviction
Target:   Redis Sentinel with 1 primary + 1 replica + 1 sentinel

Why Sentinel over Cluster:
- Data size is small (<50MB for locks + rate limiters + pub/sub)
- No need for data sharding
- Sentinel provides automatic failover (10s detection + promotion)
- Socket.IO Redis adapter supports Sentinel natively
- Simpler ops than Redis Cluster
```

Configuration:
```
sentinel monitor nettapu-redis primary-host 6379 2
sentinel down-after-milliseconds nettapu-redis 10000
sentinel failover-timeout nettapu-redis 30000
```

Application changes: Update `ioredis` connection to use Sentinel mode.
Both `RedisIoAdapter` and `RedisLockService` need Sentinel-aware config.

#### PostgreSQL: Primary + Async Read Replica

```
Primary:  All writes (bids, payments, auctions, settlements)
Replica:  Read-heavy queries (parcel listing, search, admin dashboard, audit log)

Replication: PostgreSQL streaming replication (built-in, async)
Lag target: <1 second (acceptable for read-after-write on non-critical paths)

TypeORM config: Use separate DataSource for read replica
  - Write queries: primary connection
  - Read queries: replica connection (listings, search, dashboard)
  - Auction reads: primary only (consistency required for bids)
```

Connection pooling:
```
Primary:    max 30 (monolith) + max 25 (auction-service) = 55 total
Replica:    max 30 (monolith read queries) = 30 total
```

Consider PgBouncer if connection count exceeds 100.

#### CDN: CloudFlare or AWS CloudFront

```
Cache targets:
  - Parcel images (watermarked, thumbnails)  ← highest bandwidth
  - Parcel documents (PDF, KML)
  - Static web assets (JS, CSS, fonts)
  - Map tiles (if self-hosted)

Cache-Control headers:
  - Images: public, max-age=86400, s-maxage=604800
  - Documents: public, max-age=3600
  - Static assets: public, max-age=31536000, immutable

Origin:
  - S3/MinIO bucket for uploads
  - nginx for API passthrough (no caching on API routes)
```

#### Background Workers

Already implemented. Workers run inside the auction-service process:

| Worker | Poll Interval | Redis Lock | Function |
|--------|---------------|------------|----------|
| AuctionEndingWorker | 1s | 10s TTL | LIVE → ENDING → ENDED transitions |
| SettlementWorker | 5s | 30s TTL | Manifest processing, capture/refund |

**Phase 1 addition:** IdempotencyCleanupWorker (daily, already scripted in SQL).

**Phase 4 addition:** NotificationDispatchWorker (poll `crm.notification_queue`).

No external job scheduler needed. Workers are in-process with Redis leader election.

---

## 5. Launch Roadmap (Revised Sequencing)

### Phase 1 — Real-Time Core Stabilization

**Goal:** The auction engine can run 3 replicas without breakage.

| Task | Type | Effort |
|------|------|--------|
| Add `ip_hash` to nginx upstream for auction-service | Config | 1 line |
| Redis Sentinel setup (docker-compose + adapter config) | Infra | 1 day |
| Update `RedisIoAdapter` + `RedisLockService` for Sentinel | Code | Small |
| Leader election for workers (Redis SET NX) | Code | Small |
| Cap sniper extensions (`max_extensions` column + logic) | Code + Migration | Small |
| Increase bid lock TTL from 5s → 10s | Config | 1 line |
| Graceful WebSocket drain on shutdown | Code | Small |
| Reconnect snapshot (`auction:state` on rejoin) | Code | Small |
| Validate: deploy 3 auction-service replicas, run k6 WS load test | Test | 1 day |

**Exit criteria:** 3 replicas, 500 concurrent WebSocket clients, 50 concurrent
auctions, zero dropped connections on rolling restart, zero duplicate settlements.

### Phase 2 — Payment Production Readiness

**Goal:** Real POS provider processes real TRY transactions.

| Task | Type | Effort |
|------|------|--------|
| Integrate PayTR (or iyzico) POS provider | Code | Medium |
| POS webhook receiver (async payment confirmation) | Code | Medium |
| 3D Secure flow for credit card payments | Code | Medium |
| Production POS credentials + test mode validation | Config | Small |
| Reconciliation worker (daily POS ↔ ledger check) | Code | Medium |
| Payment receipt generation (PDF) | Code | Small |
| Validate: end-to-end payment with test card on staging | Test | 1 day |

**Exit criteria:** Full deposit → capture → refund cycle with real POS in test mode.

### Phase 3 — Notifications

**Goal:** Users receive transactional SMS and email.

| Task | Type | Effort |
|------|------|--------|
| NotificationDispatchWorker (polls `crm.notification_queue`) | Code | Medium |
| SMS provider integration (Netgsm, Twilio, or similar) | Code | Medium |
| Email provider integration (AWS SES, SendGrid, or similar) | Code | Medium |
| Template system (deposit receipt, bid confirmation, auction result, welcome) | Code | Medium |
| Queue retry logic (exponential backoff, max 3 attempts) | Code | Small |
| Notification preferences (user opt-out for marketing) | Code | Small |
| Validate: place bid → receive SMS confirmation within 30s | Test | 1 day |

**Exit criteria:** Deposit receipt, bid confirmation, auction won/lost, and
welcome email all delivered within 60 seconds.

### Phase 4 — Admin + Listing Management

**Goal:** Operators can manage parcels and auctions without raw SQL.

| Task | Type | Effort |
|------|------|--------|
| Admin panel UI (React/Next.js or internal tool like Retool) | Frontend | Large |
| Parcel CRUD UI (create, edit, upload images, set auction params) | Frontend | Large |
| Auction management UI (schedule, monitor live, review settlement) | Frontend | Large |
| User management UI (search, roles, ban) | Frontend | Medium |
| Settlement dashboard (pending captures, failed refunds) | Frontend | Medium |
| Audit log viewer | Frontend | Small |

**Note:** API already exists for all of the above. This phase is purely frontend.

**Exit criteria:** Admin can create a parcel, schedule an auction, monitor live
bidding, and review settlement — all through a web interface.

### Phase 5 — Public UI (Map + Detail + Auction)

**Goal:** End users can browse and bid through a web interface.

| Task | Type | Effort |
|------|------|--------|
| Map-based parcel browser (Leaflet/Mapbox with parcel boundaries) | Frontend | Large |
| Parcel detail page (images, documents, map, price, auction schedule) | Frontend | Medium |
| User registration + login flow | Frontend | Medium |
| Deposit placement flow (3D Secure integration) | Frontend | Medium |
| Live auction room UI (real-time bid feed, countdown, place bid) | Frontend | Large |
| Responsive design (mobile web) | Frontend | Medium |
| SEO (SSR for parcel pages) | Frontend | Medium |

**Exit criteria:** A user can register, browse parcels on a map, place a deposit,
join a live auction, bid, and see the result — all through a web browser.

### Phase 6 — CRM

**Goal:** Sales team can manage leads, tasks, and pipeline.

| Task | Type | Effort |
|------|------|--------|
| Implement Phase 4 CRM architecture (see `docs/phase-4-crm-architecture.md`) | Code | Large |
| Migrations 020-024 (leads, tasks, notes, indexes, triggers) | Migration | Small |
| Lead pipeline (CRUD, status transitions, kanban view) | Code + UI | Medium |
| Task management (CRUD, my-tasks, overdue detection) | Code + UI | Medium |
| Notes system (polymorphic, per-lead/parcel/contact) | Code + UI | Small |
| ContactRequest → Lead auto-conversion | Code | Small |
| CrmEventHook integration (payments → lead, listings → lead) | Code | Small |
| CRM dashboard (pipeline stats, consultant metrics, conversion) | Code + UI | Medium |

**Exit criteria:** Consultant can manage assigned leads through a pipeline,
create tasks and notes, receive automatic lead creation from contact requests,
and view dashboard metrics.

### Phase 7 — Mobile (iOS + Android)

**Goal:** Native mobile apps for end users.

| Task | Type | Effort |
|------|------|--------|
| React Native or native app shell | Mobile | Large |
| Map browsing + parcel detail | Mobile | Large |
| Push notification integration | Mobile | Medium |
| Live auction participation (WebSocket client) | Mobile | Large |
| Deposit + payment flow | Mobile | Medium |
| App Store / Play Store submission | Ops | Medium |

### Phase 8 — Campaigns + Advanced Features

**Goal:** Marketing tools, gamification, advanced analytics.

| Task | Type | Effort |
|------|------|--------|
| Campaign module activation (entities exist, add services) | Code | Medium |
| Discount rules engine | Code | Medium |
| Installment plan management | Code | Medium |
| Analytics dashboard | Code + UI | Large |
| A/B testing framework | Code | Medium |

---

## 6. What This Document Changes

| Before | After |
|--------|-------|
| CRM was Phase 4 (next) | CRM is now Phase 6 |
| Auction scaling was implicit | Auction scaling is Phase 1 (explicit, measured) |
| POS was mock-only | Real POS integration is Phase 2 (pre-launch gate) |
| Notifications had no worker | Notification dispatch is Phase 3 (pre-launch gate) |
| No frontend in roadmap | Admin UI (Phase 4) + Public UI (Phase 5) are explicit phases |
| Single Redis was accepted | Redis Sentinel is Phase 1 requirement |
| Sticky sessions were missing | nginx `ip_hash` is Phase 1, task #1 |

**CRM architecture design (`docs/phase-4-crm-architecture.md`) remains valid.**
It is deferred, not discarded. The aggregate root (Lead), propagation pattern
(CrmEventHook), and index strategy are locked in and will be implemented in Phase 6.

---

## 7. Launch Gate Checklist

Before accepting real money from real users, ALL of the following must be true:

```
Infrastructure:
  [ ] 2+ auction-service replicas with sticky sessions
  [ ] Redis Sentinel (automatic failover tested)
  [ ] PostgreSQL primary + read replica
  [ ] SSL/TLS on production domain
  [ ] CDN for static assets and images
  [ ] Automated backups (DB + Redis RDB)
  [ ] Monitoring dashboards (Prometheus + Grafana)
  [ ] Alerting on: health degraded, Redis down, POS circuit open,
      settlement failed, bid rejection spike

Application:
  [ ] Real POS provider integrated (PayTR or iyzico)
  [ ] 3D Secure flow tested with real test cards
  [ ] Sniper extension cap enforced
  [ ] Notification dispatch operational (SMS + email)
  [ ] Deposit receipt sent within 60s
  [ ] Auction result notification sent within 5m
  [ ] Reconnection snapshot working (no stale bid displays)
  [ ] Leader-elected workers (no duplicate settlements)

Legal & Compliance:
  [ ] KVKK consent flow (exists, needs UI)
  [ ] Auction rules acceptance (consent entity exists)
  [ ] Financial audit trail (append-only ledger, verified)
  [ ] Refund SLA documented and tested

Load Testing:
  [ ] 500 concurrent WebSocket clients sustained for 30 minutes
  [ ] 50 concurrent auctions with settlement completion
  [ ] Rolling restart with zero dropped connections
  [ ] POS chaos test passed (50% failure rate, 100% eventual consistency)
  [ ] Redis failover during active auction (Sentinel promotion, <10s disruption)
```

---

## 8. Risk Matrix

| Risk | Likelihood | Impact | Mitigation | Phase |
|------|-----------|--------|------------|-------|
| WebSocket drops on deploy | High | High | Sticky sessions + graceful drain | 1 |
| Redis SPOF during live auction | Medium | Critical | Redis Sentinel | 1 |
| Unbounded auction duration (sniping) | High | Medium | Extension cap (10 max) | 1 |
| POS timeout during settlement | Medium | High | Circuit breaker (exists) + retry (exists) + manual reconciliation | 2 |
| Duplicate settlement (multi-worker) | Low | Critical | Leader election + Redis lock (exists) | 1 |
| Notification delivery failure | Medium | Medium | Retry queue (3 attempts) + dead letter + manual re-send | 3 |
| DB connection exhaustion under load | Low | High | PgBouncer if >100 connections | 1 (monitor) |
| Bid ordering dispute | Low | Critical | Server timestamp is single clock (PG). Append-only bids. Deterministic. | Already mitigated |

---

## 9. Appendix: Files to Modify per Phase

### Phase 1 (Real-Time Stabilization)

```
MODIFY:
  nginx/nginx.conf                          — ip_hash for auction upstream
  docker-compose.yml                        — Redis Sentinel config, 2nd auction replica
  apps/auction-service/src/adapters/redis-io.adapter.ts  — Sentinel connection
  apps/auction-service/src/modules/auctions/services/redis-lock.service.ts — Sentinel
  apps/auction-service/src/main.ts          — Leader election on startup
  apps/auction-service/src/modules/auctions/services/bid.service.ts — Lock TTL 5→10
  apps/auction-service/src/modules/auctions/gateways/auction.gateway.ts — Reconnect snapshot

NEW MIGRATION:
  database/migrations/025_auction_extension_cap.sql  — max_extensions + extension_count columns

VERIFY:
  load-tests/k6-ws-load.js                 — Run against 3 replicas
```

### Phase 2 (Payment Production)

```
MODIFY:
  apps/monolith/src/modules/payments/       — Real POS provider service
  packages/shared/src/interfaces/           — IPosGateway implementation

NEW:
  apps/monolith/src/modules/payments/services/paytr-gateway.service.ts
  apps/monolith/src/modules/payments/controllers/pos-webhook.controller.ts
```

### Phase 3 (Notifications)

```
NEW:
  apps/monolith/src/modules/crm/services/notification-dispatch.service.ts
  apps/monolith/src/modules/crm/services/sms-provider.service.ts
  apps/monolith/src/modules/crm/services/email-provider.service.ts
  apps/monolith/src/modules/crm/templates/
```
