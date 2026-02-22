# Expected Bottlenecks — 1000 Bidders × 50 Auctions

## Scenario Parameters

| Parameter | Value |
|-----------|-------|
| Concurrent bidders | 1,000 |
| Active auctions | 50 |
| Bidders per auction | 20 |
| Bid interval | 2s per bidder |
| Aggregate bid rate | 500 bids/s (1000 / 2) |
| Per-auction bid rate | 10 bids/s (20 / 2) |
| Test duration | 180s |

---

## 1. Redis Lock Contention (CRITICAL)

**Lock:** `bid:lock:auction:{id}` — SET NX PX 5000

Each auction gets a single lock. With 20 bidders sending 1 bid/2s = 10 bids/s per auction, and the bid processing pipeline taking ~20-50ms:

```
Lock acquisition rate:  10/s per auction
Lock hold time:         ~30-50ms (14-phase pipeline)
Lock contention:        10 × 0.05 = 0.5 (50% lock utilization)
Expected retry/reject:  ~5-15% of bids under sustained load
```

**Impact:** Bids that can't acquire the lock within timeout get rejected. At 50% utilization, Redis single-thread model handles this — but p99 latency spikes to 200-500ms.

**Mitigation:** Lock TTL (5s) is generous. Bottleneck is lock wait, not lock starvation.

---

## 2. DB Connection Pool Exhaustion (HIGH)

**Config:** `max: 25` connections for auction-service.

```
Bid writes:             ~500/s → ~500 short transactions/s
Avg transaction time:   ~5-10ms (INSERT bid + UPDATE auction)
Connections needed:     500 × 0.01 = 5 sustained
```

At 5 connections sustained, pool of 25 handles steady-state fine. **Burst risk:** When settlement starts processing concurrently (SELECT FOR UPDATE with longer hold times), pool pressure rises:

```
Settlement transactions: ~3/tick × 5 items × 50-200ms each = 3-6 connections held
Bid transactions:        5 sustained
Total peak:              ~11 connections
Headroom:                14 connections (56%)
```

**Verdict:** Pool of 25 is adequate. Exhaustion risk only under >2000 bids/s or if statement_timeout (10s) causes connection pile-up from slow queries.

---

## 3. WebSocket Memory (HIGH)

**Per-connection overhead (Socket.IO + Engine.IO):**

```
Socket.IO socket object:     ~2-4 KB
Engine.IO transport:         ~1-2 KB
Event listeners + buffers:   ~1-2 KB
Node.js internal FD:         ~1 KB
Total per connection:        ~5-9 KB

1,000 connections:           ~5-9 MB
```

**Additional overhead per room:**

```
50 auction rooms × 20 members:  negligible (Set of socket IDs)
Broadcast fan-out buffer:        ~50 bytes × 20 members × 10 events/s = ~10 KB/s per room
Total broadcast:                 ~500 KB/s for all rooms
```

**Node.js process total estimate:**

```
Base Node.js heap:          ~50 MB
1,000 WebSocket connections: ~9 MB
Redis adapter overhead:      ~5 MB
Bid processing buffers:      ~10 MB
Total RSS:                   ~75-100 MB
```

**Verdict:** Comfortable under 256MB container limit. Risk appears at ~5,000+ connections.

---

## 4. Per-User Rate Limiter (MEDIUM)

**Limits:**
- Per-user: 5 bids per 3 seconds
- Per-auction: 50 bids per 3 seconds

**Our scenario:**
- Each bidder sends 1 bid/2s = 1.5 bids/3s → **under per-user limit** ✓
- 20 bidders × 1.5 bids/3s = 30 bids/3s per auction → **under per-auction limit** ✓

**When it breaks:**
- BID_INTERVAL_MS < 600ms → per-user rate limit fires
- >33 bidders per auction → per-auction rate limit fires

---

## 5. Nginx Rate Limiting (MEDIUM)

**nginx.conf zones:**
- `ws_limit`: 10 connections/s per IP
- `api_limit`: 30 requests/s per IP

**Risk:** All k6 VUs from same IP hit `api_limit` at 30r/s. With 500 VUs polling auctions at ~0.3 req/s each = 150 req/s → **rate limited**.

**Mitigation:** Run k6 from multiple IPs, or temporarily increase nginx rate limit for load testing.

---

## 6. Settlement Worker Throughput (MEDIUM)

**Constants:**
```
POLL_INTERVAL_MS       = 5,000ms
MAX_MANIFESTS_PER_TICK = 3
ITEMS_PER_TICK         = 5
WORKER_LOCK_TTL_MS     = 30,000ms
```

**100 auctions ending simultaneously:**
```
Ending worker:     processes all expired/tick → all 100 marked "ended" in ~1-2 ticks (1-2s)
Settlement worker: 3 auctions/tick → 100 / 3 = 34 ticks × 5s = ~170s to clear
```

**Bottleneck:** Settlement is I/O bound — each settlement manifest creates deposits, processes payments, writes ledger entries. If any single settlement takes >30s, lock expires and a concurrent worker could reprocess → idempotency keys protect against double-processing, but wasted work.

---

## 7. Redis Pub/Sub Fan-Out (LOW)

**Socket.IO Redis adapter** broadcasts every bid event to all nodes:

```
Events/s:        ~500 (all bids) + ~500 (responses) = ~1,000 events/s
Avg payload:     ~200 bytes
Redis pub/sub:   ~200 KB/s throughput
```

Redis pub/sub handles ~100K msg/s easily. Not a bottleneck.

---

## 8. PostgreSQL Write Amplification (LOW)

**Per accepted bid:**
- INSERT into `bids` (append-only)
- UPDATE `auctions` SET currentPrice, currentWinnerId, version++
- Optional: INSERT into `bid_rejections` for losing validation

```
500 bids/s × ~2 writes/bid = ~1,000 writes/s
```

PostgreSQL with WAL handles 5,000-10,000 writes/s on SSD. Not a bottleneck at this scale.

---

## Summary: What Breaks at 10K Concurrent Users

| Component | 1K Users | 5K Users | 10K Users |
|-----------|----------|----------|-----------|
| Redis bid lock | ✓ OK | ⚠ p99 >1s | ❌ Lock starvation |
| DB pool (25) | ✓ OK | ⚠ 80% utilization | ❌ Exhausted |
| WebSocket memory | ✓ ~100MB | ⚠ ~400MB | ❌ >512MB, OOM risk |
| Node.js event loop | ✓ OK | ⚠ Lag >50ms | ❌ Lag >200ms |
| Settlement worker | ⚠ Slow drain | ❌ Backlog grows | ❌ Multi-hour backlog |
| Nginx rate limit | ⚠ Some 429s | ❌ Mass 429s | ❌ Unusable from single IP |
| PostgreSQL writes | ✓ OK | ✓ OK | ⚠ WAL pressure |

**First bottleneck to hit:** Settlement worker throughput (3 auctions/tick) followed by DB connection pool exhaustion.

**Scaling path:**
1. Increase `MAX_MANIFESTS_PER_TICK` to 10 (config change)
2. Increase DB pool to 50 (config change)
3. Add PostgreSQL read replica for GET queries
4. Add Redis Sentinel for lock availability
5. Horizontal scale: multiple auction-service instances with distributed lock coordination
