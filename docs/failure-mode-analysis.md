# NetTapu — Pre-Production Failure Mode Analysis

> Status: AUDIT DOCUMENT
> Date: 2026-02-24
> Scope: Auction engine under adversarial production conditions
> Method: Line-by-line code trace through exact failure paths

---

## Scenario 1: 3 Replicas Behind nginx (No Sticky Sessions)

### What breaks

**WebSocket handshake fails.** Socket.IO's initial transport is HTTP long-polling.
The handshake requires 2-3 HTTP requests to the same server. Without sticky sessions,
nginx round-robins these requests across replicas. Replica B has no knowledge of
the session started on Replica A. The handshake fails. The client never upgrades to
WebSocket.

**Proof:** `redis-io.adapter.ts` creates the adapter at startup (line 29). The adapter
handles cross-instance message broadcast. But it cannot handle cross-instance session
state — that's a Socket.IO engine.io limitation, not an adapter concern.

### What does NOT break

| Component | Why it survives | Code evidence |
|-----------|----------------|---------------|
| Bid atomicity | Redis lock is global. DB TX is atomic. @VersionColumn catches conflicts. | `bid.service.ts:78` lock acquire, `:262` version check |
| Bid ordering | All replicas use PostgreSQL `NOW()` as clock. Single DB = single clock. | `bid.service.ts:228` `serverTs: new Date()` — JS Date, but within a PG TX, the bid row is committed with server time |
| Anti-sniping | Runs inside the locked bid TX. Only one replica executes at a time. | `bid.service.ts:244-258` within Redis lock scope |
| Rate limiting | Redis counters are global. All replicas read/write the same keys. | `redis-lock.service.ts:94-113` Lua INCR+EXPIRE |
| Settlement | Redis lock prevents duplicate processing. Pessimistic DB lock prevents duplicate transitions. | `settlement.worker.ts:130` lock acquire, `settlement.service.ts:78` `pessimistic_write` |
| Ending detection | Redis lock prevents duplicate transitions. DB pessimistic lock double-checks. | `auction-ending.worker.ts:88` lock, `:124` `pessimistic_write` |

### Workers: wasteful but safe

3 replicas = 3 instances of AuctionEndingWorker (each worker #1). Each polls every 1s.
Each attempts `redisLock.acquire()` on the same auction. Only one succeeds. The others
return `null` and skip (line 90: `if (!lockValue) return`).

**Waste:** 3x query load on PostgreSQL for auction expiry detection. At 100 auctions,
that's 300 queries/sec instead of 100. Not dangerous, but unnecessary.

### State at risk: None
### Double bids possible: No
### Ordering inconsistent: No
### Auction freeze: No (if WebSocket handshake succeeds)
### Recovery: Automatic (add `ip_hash` to nginx)
### Data invariants at risk: None

---

## Scenario 2: Redis Primary Crash During Active Auction

### Trace: What happens in each component

**1. RedisLockService** (`redis-lock.service.ts:39-49`)
```
redis.on('error') → redisHealthy = false, metrics.redisHealthStatus.set(0)
redis.on('close') → redisHealthy = false
```
ioredis config: `enableOfflineQueue: false` → all pending commands immediately reject.
`maxRetriesPerRequest: 1` → fail after one retry.

**2. Bid placement** (`auction.gateway.ts:266-278`)
```
if (!this.redisLock.isHealthy()) {
  → emit 'bid_rejected' { reason_code: 'service_unavailable' }
  → return
}
```
Even if the health check passes (race between flag update and bid attempt),
`checkBidRateLimit()` will throw → caught at line 284-296 → `service_unavailable`.
Even if rate limit passes, `redisLock.acquire()` in BidService will throw →
caught at line 390-413 → `bid_rejected`.

**Bids are blocked at 3 defense layers. No bid reaches the database.**

**3. AuctionEndingWorker** (`auction-ending.worker.ts:59-83`)
```
tick() → auctionRepo query (PostgreSQL, not Redis) → finds expired auctions
processAuction() → redisLock.acquire() → THROWS (Redis down)
catch at line 103-106 → logs error
```
**CRITICAL FINDING:** The ending worker does NOT check `redisLock.isHealthy()`.
It tries to acquire the lock every tick (every 1s). Every attempt throws. Every
throw generates an error log. Result: **1 error log per second per expired auction
per replica for the entire Redis outage duration.**

With 10 expired auctions and 3 replicas: 30 error logs/sec. In a 5-minute outage:
9,000 error log entries. Not a crash risk, but a log flood that obscures real issues.

**4. SettlementWorker** (`settlement.worker.ts:89-97`)
```
if (!this.redisLock.isHealthy()) {
  → logger.warn('redis_unhealthy')
  → return (skip tick)
}
```
Settlement worker DOES check health. It skips gracefully. 1 warning per 5s per replica.

**5. Socket.IO Redis Adapter** (`redis-io.adapter.ts:20-25`)
```
pubClient.on('error', (err) => this.logger.error(...))
subClient.on('error', (err) => this.logger.error(...))
```
Error handlers prevent process crash. But:
- `pubClient` can't publish → `server.to(room).emit(...)` silently drops messages.
  Socket.IO adapter swallows publish errors internally.
- `subClient` loses subscription → messages from other replicas are not received.
- **Local clients still receive messages from local emits** (same-process delivery
  bypasses Redis).
- **Cross-replica broadcasts silently fail.**

### What state is lost

| Lost | Duration | Impact |
|------|----------|--------|
| Rate limit counters | 3s TTL, irrelevant | None — they reset naturally |
| Bid locks | 5s TTL | None — they expire |
| Worker locks | 10-30s TTL | None — they expire |
| Socket.IO adapter channels | Until reconnect | Clients on other replicas miss broadcasts |

**No durable state is lost.** All auction state (price, bids, status) lives in PostgreSQL.

### The real danger: auction temporal freeze

```
Timeline:
  T+0:    Redis crashes
  T+0:    All bids blocked (service_unavailable)
  T+0:    Workers can't acquire locks → auctions stop transitioning
  T+0:    Scheduled auction end passes — but LIVE → ENDING never happens
  T+10s:  Bid locks expire (5s TTL)
  T+30s:  Settlement locks expire (30s TTL)
  T+300s: Redis recovers (5 min outage)
  T+300s: ioredis reconnects (auto, default behavior)
  T+300s: redisHealthy = true
  T+301s: Next ending worker tick → finds expired auctions → transitions them
  T+301s: Bids resume
  T+302s: Socket.IO adapter resubscribes (ioredis autoResubscribe: true default)
```

**During the 5-minute outage:**
- Users see the auction as "still live" but can't bid
- The countdown timer in the client hits zero, but no `auction_ending` event arrives
- **Users think the platform is broken**

### Can double bids occur: No
### Can ordering become inconsistent: No
### Can an auction freeze: YES — auction hangs in LIVE state past scheduled end
### Is recovery automatic: YES — ioredis reconnects, workers resume
### Data invariants at risk: None (temporal only, not data)

### Missing: Health-based client notification

No mechanism exists to tell WebSocket clients "bidding is temporarily suspended."
Clients just see `bid_rejected` with `service_unavailable` and don't know why or
for how long.

---

## Scenario 3: Node Process Restart Mid-Auction

### Trace: 5 crash points in the bid pipeline

**Crash Point A: Between Redis lock acquire (Phase 1) and DB connect (Phase 2)**
```
bid.service.ts:78  → lockValue acquired ✓
bid.service.ts:93  → qr = createQueryRunner() — PROCESS DIES HERE
```
- Redis lock persists for 5s TTL, then expires.
- No DB transaction started → nothing to rollback.
- Client socket dies → no response sent.
- Client retries with same `idempotencyKey` → Phase 0 finds nothing → proceeds fresh.
- **Safe. 5s delay for this auction while lock is held.**

**Crash Point B: Between bid INSERT (Phase 11) and COMMIT (Phase 13)**
```
bid.service.ts:230 → savedBid = await qr.manager.save(Bid, newBid) ✓
                   → PROCESS DIES before qr.commitTransaction()
```
- PostgreSQL detects dead connection → auto-rollbacks uncommitted TX.
- Bid row does NOT exist. Auction price NOT updated.
- Redis lock: still held, expires in ≤5s.
- Client socket dies → no response.
- Client retries → fresh bid placement.
- **Safe. No ghost data.**

**Crash Point C: Between COMMIT (Phase 13) and lock release (Phase 14)**
```
bid.service.ts:281 → await qr.commitTransaction() ✓  ← BID IS IN DB
bid.service.ts:305 → await this.redisLock.release()   ← PROCESS DIES
```
- Bid IS committed. `currentPrice` IS updated. `bidCount` IS incremented.
- Redis lock persists for ≤5s → other bids blocked temporarily.
- **The broadcast never happens** — gateway code at lines 372-389 hasn't executed.
- All clients have stale view of the auction until the next successful bid triggers
  a new broadcast.
- Client retries with same `idempotencyKey` → Phase 0 finds existing bid → returns
  `toResponse(existing)` (line 73) → client knows bid was accepted.

**DATA INTEGRITY: PRESERVED.**
**UX: Degraded. Other 4,999 clients don't see the bid until next broadcast.**

**Crash Point D: During AuctionEndingWorker `transitionEndingToEnded`**
```
auction-ending.worker.ts:207 → await qr.manager.save(Auction, locked) [ENDED]
                             → await qr.commitTransaction() ✓
                             → PROCESS DIES before broadcastAuctionEnded()
```
- Auction IS in ENDED state in DB. Winner IS determined.
- WebSocket broadcast never sent. Clients don't know the auction ended.
- On restart: SettlementWorker picks up ENDED auction → initiates settlement →
  broadcasts `auction_settlement_pending`.
- **Clients skip directly from "LIVE" to "SETTLEMENT_PENDING", missing the
  ENDING and ENDED events.**

**Crash Point E: During settlement manifest item processing**
```
settlement.worker.ts:303 → await settlementService.updateManifestData(manifest, items)
                         → PROCESS DIES after some items processed
```
- Manifest data is persisted after EACH item (line 303).
- Already-processed items: status = `acknowledged` (saved).
- Currently-processing item: depends on sub-phase:
  - If POS call succeeded but DB write failed: deposit may be `held` (POS captured but
    DB not updated). On restart, `processCaptureItem` re-reads deposit status. If POS
    was truly idempotent and recorded the capture, deposit status should still be `held`
    (DB write didn't happen). Next retry calls POS again with same `idempotency_key`.
    **Relies on POS provider idempotency.**
  - If deposit is in `refund_pending`: worker detects this state, skips initiation,
    retries POS refund call. **Safe by design.**

### State at risk

| State | Risk | Mitigation |
|-------|------|------------|
| Committed bid not broadcast | Clients have stale view | Next bid or client reconnect fixes it |
| Auction ended but not broadcast | Clients miss ENDED event | Settlement broadcast eventually arrives |
| Settlement item mid-POS-call | POS may have captured but DB not updated | Re-read deposit status + POS idempotency key |

### Can double bids occur: No (idempotency key + @VersionColumn)
### Can ordering become inconsistent: No (bids committed before crash are deterministic)
### Can an auction freeze: Temporarily (5s lock TTL), then auto-recovers on restart
### Is recovery automatic: YES (workers resume on restart, clients auto-reconnect)
### Data invariants at risk: POS-captured-but-DB-not-updated (requires POS idempotency)

---

## Scenario 4: Network Partition Between One Replica and Redis

### Difference from Scenario 2

Redis is alive. Other replicas work normally. Only one replica is partitioned.

### Trace: partitioned replica behavior

```
Partitioned replica:
  redisLockService.redis → error event fires → redisHealthy = false

  Bid attempts:
    gateway:266 → isHealthy() = false → bid_rejected(service_unavailable)
    Even if race: rate limit EVAL throws → bid_rejected(service_unavailable)

  Workers:
    SettlementWorker: skips tick (health check)
    AuctionEndingWorker: tries acquire() → throws → logs error per tick

  Socket.IO:
    pubClient → can't publish → broadcast to remote replicas fails
    subClient → can't subscribe → messages from remote replicas not received
    Local clients → still connected, still receive local emits (if any)

Healthy replicas:
  Process bids normally
  Run workers normally
  Broadcast to each other via Redis pub/sub
  Clients on healthy replicas see normal behavior
```

### The silent partition problem

Clients connected to the partitioned replica:
1. Can't bid (rejected)
2. Don't receive bid broadcasts from other replicas
3. **Still see the auction as "live" with the last-known price**
4. Their countdown timer continues ticking locally
5. They think the auction is idle (no new bids), which may cause them to not bid
6. **They could miss the auction ending entirely**

There is no mechanism to:
- Detect that a replica is partitioned from the client's perspective
- Notify clients to reconnect to a different server
- Force-disconnect clients when Redis is unavailable

### Can double bids occur: No (partitioned replica can't process bids)
### Can ordering become inconsistent: No
### Can an auction freeze: No (healthy replicas keep running). But partitioned clients see frozen view.
### Is recovery automatic: YES (ioredis reconnects when partition heals)
### Data invariants at risk: None

### Missing: partition-aware client eviction

When a replica detects Redis is unhealthy, it should emit a `reconnect_required` event
to all connected clients, forcing them to reconnect (potentially to a healthy replica).

---

## Scenario 5: PostgreSQL Connection Pool Exhaustion

### The dangerous interplay: Redis lock + DB connection wait

```
bid.service.ts execution order:
  Line 78:  lockValue = await this.redisLock.acquire(...)  ← HOLDS REDIS LOCK
  Line 93:  qr = this.dataSource.createQueryRunner()
  Line 94:  await qr.connect()                             ← BLOCKS HERE IF POOL FULL

  connectionTimeoutMillis = 5000 (5s)
  BID_LOCK_TTL_MS = 5000 (5s)

  If pool is full:
    T+0:    Lock acquired (5s TTL)
    T+5:    Connection timeout fires AND lock expires simultaneously
    T+5:    qr.connect() throws → catch at line 298 → rollback (no TX started) → throw
    T+5:    finally at line 304-308 → release(key, lockValue) → but lock already expired
    T+5:    Lock was released by TTL. Another bid may have already acquired it.
```

### Race condition: overlapping bids on lock expiry

```
Timeline:
  T+0s:   Bid A acquires lock (5s TTL)
  T+0s:   Bid A calls qr.connect() → blocks (pool full)
  T+5s:   Lock expires (Redis auto-deletes)
  T+5s:   Bid B acquires fresh lock (5s TTL)
  T+5.1s: Bid A connection timeout fires → catch block
  T+5.1s: Bid A's finally block: release(key, lockValue) → Lua script checks value
          → lockValue is Bid A's value, but Redis now has Bid B's value → release returns 0 (no-op)
          → Bid B's lock is NOT accidentally released ← SAFE (Lua compare-and-delete)
  T+5.1s: Bid B proceeds with DB TX
  T+5.1s: Bid A's qr.connect() threw → no DB TX started → bid A fails

  Result: Only Bid B proceeds. Bid A fails with connection error.
```

**The Lua compare-and-delete is the critical safety net here.** Without it, Bid A's
release would delete Bid B's lock, allowing a third bid to proceed in parallel with
Bid B.

### But what if the pool frees up just before timeout?

```
  T+0s:   Bid A acquires lock (5s TTL)
  T+0s:   qr.connect() blocks
  T+4.5s: Pool connection frees up → Bid A gets connection
  T+4.5s: Bid A starts DB TX → queries take 1s
  T+5s:   Lock expires (Redis auto-deletes) while Bid A is still in DB TX
  T+5s:   Bid B acquires fresh lock
  T+5s:   Bid B starts DB TX
  T+5.5s: Bid A tries to UPDATE auction → @VersionColumn check
  T+5.5s: Bid B tries to UPDATE auction → @VersionColumn check

  Both are in separate DB transactions with separate DB connections.
  PostgreSQL row-level lock (on the auction row) serializes them:
    - First to reach UPDATE: acquires PG row lock, writes
    - Second to reach UPDATE: waits for PG row lock, reads new version
    - @VersionColumn mismatch → OptimisticLockVersionMismatchError → rollback
```

**ONE bid succeeds, ONE bid fails with version mismatch.** No double bids.
But this is an edge case that only occurs when:
1. Pool is nearly full (connection wait ~4-5s)
2. Redis lock expires before DB TX completes
3. A second bid arrives within the millisecond window

### Can double bids occur: No (@VersionColumn is the last defense)
### Can ordering become inconsistent: No
### Can an auction freeze: No (bids fail, they don't hang indefinitely)
### Is recovery automatic: YES (pool connections free up as TX complete)
### Data invariants at risk: None

### Critical metric to monitor

```
WHERE the time goes for a bid:
  Redis lock acquire:  <1ms
  DB connection wait:  0-5000ms  ← THE BOTTLENECK
  DB transaction:      5-50ms
  Redis lock release:  <1ms

  If db_connection_wait > 100ms → alarm
  If db_connection_wait > 2000ms → critical (approaching lock TTL)
```

---

## Scenario 6: 5,000 Concurrent Bidders in a Single Auction Room

### Throughput analysis

```
Rate limiting funnel:
  5,000 users × 1.67 bids/sec (5 per 3s)  = 8,350 bid ATTEMPTS/sec
  Per-auction rate limit: 50 per 3s         = 16.7 bids PASS rate limit/sec
  Redis lock serialization (~30ms per bid)  ≈ 33 bids/sec theoretical max

  Actual throughput: ~16.7 bids/sec (rate limit is the bottleneck, not locks)
  Rejection rate: 8,350 - 16.7 = 8,333 rejections/sec (99.8%)
```

### Redis operations per second

```
Each bid ATTEMPT (including rejected ones):
  1. checkBidRateLimit()        → 1 Redis EVAL (Lua INCR+EXPIRE)
  2. checkAuctionRateLimit()    → 1 Redis EVAL (if user rate passed)

  8,350 × 2 = 16,700 Redis ops/sec maximum
  (Most are rejected at step 1, so actual: ~8,350 + 16.7 = ~8,367 ops/sec)

  Single Redis: 100K+ ops/sec capacity → 8.4% utilization → fine
```

### PostgreSQL operations per second

```
Each ACCEPTED bid (16.7/sec):
  Gateway:   1 SELECT auction (referencePrice lookup at gateway:356-360)
  BidService Phase 0:  1 SELECT bid (idempotency check)
  BidService Phase 4:  1 SELECT auction
  BidService Phase 6:  1 SELECT participant
  BidService Phase 7:  1 SELECT consent
  BidService Phase 8:  (uses in-memory auction from Phase 4)
  BidService Phase 10: 1 SELECT bid (duplicate amount check)
  BidService Phase 11: 1 INSERT bid
  BidService Phase 12: 1 UPDATE auction
  COMMIT:    1 commit

  Total: 8 queries per accepted bid
  16.7 × 8 = ~134 queries/sec for bid processing

  Plus: 8,333 rejected bids also hit gateway:356 (1 SELECT auction each)
  BUT: these are rejected BEFORE bidService.placeBid() is called,
  except some hit BidService Phase 0 and Phase 1.

  Rate-limited bids: rejected at gateway level (no DB query)
  Lock-contention bids: rejected at Phase 1 (no DB query, only Redis)

  Real DB load: ~134 queries/sec + gateway auction lookups for accepted bids only
```

**HOWEVER:** The gateway reads `auction.currentPrice` at line 356-360 for
`referencePrice` BEFORE rate limiting. This means ALL 8,350 bids/sec trigger a
DB query.

**CORRECTION:** No — rate limiting happens at lines 280-348, BEFORE the auction
lookup at line 356. Rate-limited bids never reach the DB query.

Only the 16.7 bids/sec that pass rate limiting hit the DB for `referencePrice`.

### Broadcast fan-out

```
Each accepted bid → broadcastBidAccepted() → server.to('auction:123').emit(...)
  → Redis adapter publishes once to Redis pub/sub channel
  → Each replica delivers to local clients in the room

Per broadcast:
  Message size: ~200 bytes JSON
  Recipients: 5,000 clients
  Network: 5,000 × 200 = 1MB per broadcast

At 16.7 bids/sec: 16.7MB/sec outbound bandwidth

With 3 replicas (~1,667 clients each):
  Per-replica: 1,667 × 200 × 16.7 = 5.56MB/sec
  Plus Redis pub/sub: 200 bytes × 16.7 = 3.34KB/sec (negligible)
```

**5.56MB/sec per replica** is manageable. But if sniper extensions trigger rapid
bidding at the end, bursts could reach 33 bids/sec (lock serialization limit) ×
1,667 × 200 bytes = ~11MB/sec. Still within typical server NIC capacity (1Gbps).

### Memory pressure

```
Socket.IO per-connection overhead: ~5-9KB
5,000 connections: 25-45MB
Room tracking (1 room for 5,000): ~40KB (array of socket IDs)
Message buffers (during broadcast): ~1MB per broadcast × pipeline depth
Node.js event loop: single-threaded → broadcast fan-out is sequential

Total auction-service memory for this room: ~50-60MB
Node.js heap default: 1.5GB → 4% utilization → fine
```

### The real bottleneck: client-side experience

```
Client receives: 16.7 bid_accepted events/sec
Each event: parse JSON, update UI, animate bid
At 16.7 events/sec: UI updates every 60ms

Mobile clients on slow networks:
  WebSocket message buffering → messages arrive in bursts
  UI can't keep up → stale price displayed
  User bids on stale price → PRICE_CHANGED rejection

  This is a UX problem, not a data integrity problem.
```

### Can double bids occur: No
### Can ordering become inconsistent: No
### Can an auction freeze: No (rate limiting protects infrastructure)
### Is recovery automatic: N/A (no failure, just high load)
### Data invariants at risk: None

---

## PRODUCTION HARDENING PLAN

### H1: Leader Election for Workers

**Problem:** 3 replicas run 3 instances of AuctionEndingWorker and SettlementWorker.
Wasteful queries. Error log floods on Redis failure.

**Design:**

```
Mechanism: Redis SET NX with TTL renewal

Key:      auction:worker:leader
Value:    {replicaId}:{pid}:{startedAt}
TTL:      15 seconds
Renewal:  Every 5 seconds (well within TTL)

Startup:
  1. Attempt SET NX EX 15
  2. If acquired: start workers, begin renewal interval
  3. If not acquired: skip workers, begin leader-watch interval

Leader watch (non-leaders):
  Every 5 seconds: GET auction:worker:leader
  If key missing: attempt SET NX EX 15
  If acquired: start workers

Shutdown:
  DEL auction:worker:leader (only if value matches)
  Workers stop via onModuleDestroy

Failover:
  If leader crashes: TTL expires in ≤15s
  Next watch cycle: another replica claims leadership
  Maximum worker gap: 20 seconds (15s TTL + 5s watch interval)
```

**What this does NOT change:** The Redis lock on each individual auction. Even with
leader election, the processing lock per auction remains. Leader election only
controls which replica runs the polling loop.

### H2: Redis Pub/Sub vs Streams — Decision: Keep Pub/Sub

**Analysis:**

| Feature | Pub/Sub (current) | Streams |
|---------|-------------------|---------|
| Delivery guarantee | At-most-once | At-least-once (with consumer groups) |
| Message persistence | None (fire-and-forget) | Persisted until trimmed |
| Replay on reconnect | No | Yes (read from last-known ID) |
| Socket.IO adapter support | Native (`@socket.io/redis-adapter`) | None (would require custom adapter) |
| Latency | Microseconds | Milliseconds (XREAD polling or XREADGROUP blocking) |
| Complexity | Low | High (consumer groups, ACKs, trimming) |

**Decision: Pub/Sub for WebSocket broadcasting. No change.**

**Rationale:**
1. Socket.IO Redis adapter is built on pub/sub. Switching to Streams requires a
   custom adapter — high effort, high risk.
2. Lost messages during a 5-minute Redis outage are acceptable for UI state broadcasts.
   The client gets a fresh snapshot on reconnect (`join_auction` → `auction_state`).
3. Bid acceptance is NOT delivered via pub/sub. It goes through the DB → broadcast path.
   If the broadcast is lost, the bid is still committed. The client sees it on next
   refresh or next broadcast.
4. Streams add operational complexity (trimming, consumer group management, dead letter
   queues) without solving a real problem.

**What Streams WOULD solve:** Message replay on reconnect without a DB round-trip.
Not worth the complexity at current scale. Revisit if >50K concurrent connections.

### H3: Auction State Persistence Model — No Change Needed

**Current model is correct:**

```
Truth:     PostgreSQL (auction row, bids table)
Ephemeral: Redis (locks, rate limits, pub/sub channels)
None:      In-memory (no auction state cached in Node.js process)
```

Every bid reads `auction.currentPrice` from the database inside a transaction.
This guarantees consistency. The cost is ~5-10ms per bid for the DB read. At
16.7 bids/sec, this is 16.7 × 10ms = 167ms of DB time per second = 17% of
one connection's capacity. Not a bottleneck.

**When to add a read cache:** Only if bid p99 latency exceeds 100ms due to DB
read contention. At that point, cache `auction.currentPrice` in Redis with a
1s TTL as a pre-check ("can this bid amount possibly win?") BEFORE acquiring the
lock. The DB read inside the TX remains the source of truth.

**NOT YET. YAGNI at current scale.**

### H4: Snapshot Strategy

**Current:** Client receives `auction_state` on `join_auction` (gateway:198-215).
Contains: status, current_price, bid_count, participant_count, time_remaining_ms,
extended_until.

**Missing:** No snapshot on reconnect. No snapshot on Redis recovery. No way for
a client with a stale view to realize it's stale.

**Hardening:**

```
1. On Socket.IO 'reconnect' event (client-side):
   Client emits 'join_auction' again → receives fresh auction_state
   (This already works if the client re-joins rooms on reconnect)

2. Server: track lastBroadcastTs per room
   On join_auction: include last_bid_id and last_broadcast_ts in snapshot
   Client compares with its local state → knows if it missed anything

3. On Redis recovery (redisHealthy transitions false → true):
   Server emits 'auction_state' to all local clients in auction rooms
   → Requires iterating server.sockets and checking room membership

4. Periodic heartbeat (every 10s):
   Server emits 'auction_heartbeat' to each room with:
     { current_price, bid_count, time_remaining_ms, server_time }
   Client compares server_time with local clock → detects drift
   Client compares current_price with local state → detects staleness
```

**Heartbeat is the critical addition.** It makes stale views self-correcting within
10 seconds. Without it, a client that misses one broadcast stays stale indefinitely.

### H5: Reconnect Protocol

**Current:** Socket.IO handles reconnection with exponential backoff (1s → 5s max).
Client reconnects, `handleConnection` fires, but rooms are NOT auto-rejoined.

**Hardening:**

```
Client-side protocol:
  1. Socket.IO fires 'connect' event
  2. Client checks: was I in an auction room?
  3. If yes: emit 'join_auction' { auctionId }
  4. Server responds with 'auction_state' snapshot
  5. Client reconciles snapshot with local state:
     - If snapshot.current_price !== local.current_price → update UI
     - If snapshot.bid_count > local.bid_count → fetch missed bids via REST
     - If snapshot.status !== local.status → update UI (e.g., auction ended)

Server-side protocol:
  1. handleConnection: log, increment metrics (existing)
  2. On 'join_auction': send auction_state (existing)
  3. NEW: If client sends 'rejoin_auction' { auctionId, lastBidId }:
     - Query bids WHERE auctionId = $1 AND id > $2 ORDER BY serverTs
     - Send missed bids as 'bid_history' event
     - Then send current 'auction_state'
```

**The `rejoin_auction` event is the key addition.** It lets the client catch up on
missed bids without refreshing the page.

### H6: Idempotent Bid Submission Protocol

**Current implementation is already correct.** Tracing the full path:

```
Phase 0: SELECT bid WHERE idempotencyKey = $1 (fast path, no lock)
Phase 1: Redis lock acquire
Phase 3: SELECT bid WHERE idempotencyKey = $1 (re-check inside TX)
Phase 11: INSERT bid (idempotencyKey is unique-indexed)

If duplicate key violation: DB rejects INSERT → TX rollback → error
But this can't happen because:
  - Phase 3 re-check catches concurrent duplicates within the TX
  - Redis lock prevents concurrent bids on the same auction
  - idempotencyKey is client-generated, unique per bid attempt

Cross-auction idempotency:
  If same idempotencyKey is used for two different auctions:
  Phase 0 returns the first bid (from the other auction)
  Client receives the first bid's response → wrong auction!

  BUG? Not a bug — idempotencyKey is per-bid, not per-auction.
  But the response at line 73 returns toResponse(existing) without
  checking if existing.auctionId matches dto.auctionId.
```

**FINDING: Missing validation.** If a client reuses an idempotency key across
auctions (unlikely but possible with a buggy client), Phase 0 returns the wrong
bid. The fix:

```
Phase 0 should check:
  existing.auctionId === dto.auctionId
If not: reject with CONFLICT (idempotency key collision)
```

**This is a low-probability bug but a real one.** A malicious client could submit
the same idempotency key to multiple auctions to probe bid existence.

### H7: Rate Limiting Strategy — Needs One Fix

**Current implementation is solid for normal operation:**

```
Layer 1: nginx   → 10 req/s per IP (WebSocket connection initiation)
Layer 2: Redis   → 5 bids per 3s per user (1.67/s)
Layer 3: Redis   → 50 bids per 3s per auction (16.7/s)
Layer 4: Redis   → bid lock (1 bid at a time per auction)
```

**Missing: global bid rate limit across all auctions.**

With 50 concurrent auctions, theoretical max throughput:
50 × 16.7 = 835 bids/sec system-wide. Each bid = 1 Redis lock + 1 DB TX.
835 DB TXs/sec with 25 connection pool → pool exhaustion in seconds.

**Fix: Add Layer 3.5 — global system rate limit:**
```
Key: ws:bid:rate:global
Limit: 200 bids per 3 seconds (~67/sec)
This caps total DB bid TX throughput regardless of auction count.
```

67 bids/sec × 8 queries × 30ms avg = ~16 connections occupied continuously.
With 25 pool: 64% utilization. Safe headroom.

### H8: Backpressure Strategy

**Current:** None. When a bid is rate-limited or lock-contended, the client
receives an immediate rejection. There is no queuing, no retry-after header,
no exponential backoff signal.

**Hardening:**

```
1. On bid_rejected with reason_code = 'lock_contention':
   Include retry_after_ms: 100-500 (random jitter)
   Client waits before retrying
   Prevents thundering herd on lock release

2. On bid_rejected with reason_code = 'rate_limited':
   Include retry_after_ms: remaining window time
   (e.g., if 3s window, 2s remaining → retry_after_ms: 2000)
   Client knows exactly when to retry

3. On bid_rejected with reason_code = 'auction_rate_limited':
   Include retry_after_ms: 500-3000 (random jitter)
   Spreads retry load across the window

4. On bid_rejected with reason_code = 'service_unavailable':
   Include retry_after_ms: 5000-10000
   Signal that this is a systemic issue, not transient

5. Server-side: connection-level backpressure
   If a single client sends > 20 messages/sec (any type, not just bids):
   Disconnect with code 4008 (policy violation)
   Prevents WebSocket flood attacks that bypass bid rate limiting
```

### H9: Observability Requirements

**Currently tracked (sufficient):**
- `ws_active_connections` (gauge)
- `ws_bids_total` (counter)
- `ws_bid_rejections_total` (by reason_code)
- `user_rate_limit_hits_total`
- `auction_rate_limit_hits_total`
- `auction_extensions_total`
- `settlement_*` metrics (comprehensive)
- `redis_health_status`

**MISSING (must add):**

```
CRITICAL (blocks launch):
  bid_lock_wait_ms          histogram  Time spent waiting for Redis lock (should be <1ms normally)
  bid_db_connect_wait_ms    histogram  Time spent waiting for DB connection from pool
  bid_total_latency_ms      histogram  End-to-end bid processing time (lock to commit)
  bid_lock_timeout_total    counter    Lock TTL expired before release (Scenario 5 edge case)
  db_pool_active            gauge      Active connections (total - idle)
  db_pool_waiting           gauge      Requests waiting for a connection
  db_pool_exhaustion_total  counter    Connection request rejections due to full pool

IMPORTANT (add before scale):
  ws_room_size              gauge      Clients per auction room (detect 5K+ rooms)
  ws_broadcast_fan_out_ms   histogram  Time to deliver broadcast to all local clients
  ws_messages_per_sec       gauge      Total WebSocket messages/sec (all types)
  auction_ending_delay_ms   histogram  Time between scheduled end and actual ENDING transition
  redis_lock_contention_total counter  Lock acquire returned null (someone else holds it)
  redis_command_latency_ms  histogram  Per-command Redis latency

NICE TO HAVE:
  bid_acceptance_rate       gauge      Accepted bids / total attempts (should be <5% at peak)
  sniper_extension_count    gauge      Per-auction extension count (detect runaway auctions)
  settlement_item_latency_ms histogram Per-item settlement processing time
```

**The three most critical missing metrics:**
1. `bid_db_connect_wait_ms` — this is the canary for Scenario 5
2. `db_pool_waiting` — if this goes above 0, pool exhaustion is imminent
3. `auction_ending_delay_ms` — if this exceeds 10s, something is blocking workers

---

## INVARIANT VERIFICATION MATRIX

For each scenario, which data invariants are at risk?

```
INVARIANT                                    S1  S2  S3  S4  S5  S6
─────────────────────────────────────────────────────────────────────
No duplicate bids (idempotency key unique)   ✓   ✓   ✓   ✓   ✓   ✓
No double-spend (deposit captured once)      ✓   ✓   ⚠   ✓   ✓   ✓
Bid ordering deterministic                   ✓   ✓   ✓   ✓   ✓   ✓
Auction price monotonically increasing       ✓   ✓   ✓   ✓   ✓   ✓
Append-only tables never modified            ✓   ✓   ✓   ✓   ✓   ✓
Winner = highest bid, earliest timestamp     ✓   ✓   ✓   ✓   ✓   ✓
Every deposit settled (captured or refunded) ✓   ⚠   ⚠   ✓   ✓   ✓
Financial ledger complete                    ✓   ✓   ⚠   ✓   ✓   ✓

Legend:
  ✓  = invariant preserved by code, verified in trace
  ⚠  = invariant preserved IF external dependency is correct
       S3 ⚠: POS provider must honor idempotency keys on capture/refund
       S2 ⚠: Settlement resumes after Redis recovery, but 48h expiry could hit
              if Redis outage + recovery delays exceed settlement window
```

---

## PRIORITY-ORDERED HARDENING ACTIONS

| Priority | Action | Scenario | Effort | Risk Eliminated |
|----------|--------|----------|--------|-----------------|
| P0 | nginx `ip_hash` for auction upstream | S1 | 1 line | WebSocket handshake failure |
| P0 | Redis Sentinel (3-node) | S2, S4 | 1 day | Redis SPOF, 5-minute auction freeze |
| P0 | Add `bid_db_connect_wait_ms` + `db_pool_waiting` metrics | S5 | Small | Invisible pool exhaustion |
| P0 | AuctionEndingWorker: add `isHealthy()` check before tick | S2 | 2 lines | Error log flood (30/sec) |
| P1 | Leader election for workers | S1 | Small | 3x wasteful worker queries |
| P1 | Heartbeat broadcast (10s) with current_price + server_time | S2, S3, S4 | Small | Stale client views |
| P1 | `rejoin_auction` event with missed bid catch-up | S3 | Medium | Silent bid gaps after restart |
| P1 | Global system bid rate limit (200/3s) | S6 | Small | DB pool exhaustion under multi-auction load |
| P1 | Backpressure: `retry_after_ms` in bid_rejected responses | S6 | Small | Thundering herd on lock release |
| P1 | Increase bid lock TTL from 5s to 10s | S5 | 1 line | Lock expiry during pool wait |
| P1 | Sniper extension cap (max_extensions column) | S6 | Migration + small code | Unbounded auction duration |
| P2 | Partition-aware client eviction (emit `reconnect_required` on Redis unhealthy) | S4 | Small | Clients stuck on partitioned replica |
| P2 | Idempotency key: validate auctionId match in Phase 0 | S3 | 2 lines | Cross-auction key collision |
| P2 | WebSocket flood protection (>20 msg/sec → disconnect) | S6 | Small | WS-level DoS bypass |
| P2 | Connection-level backpressure (emit `system_degraded` when Redis or DB stressed) | S2, S5 | Medium | Users unaware of system issues |
| P3 | Redis Streams evaluation for bid audit trail | Future | Large | Not needed at current scale |
| P3 | Separate DB connection pools (workers vs bids) | S5 | Medium | Worker queries starving bid connections |
