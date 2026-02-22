/**
 * NetTapu — Settlement Burst Scenario
 *
 * Simulates 100 auctions ending simultaneously to stress-test:
 *   - Auction-ending worker (1s poll, 10s lock)
 *   - Settlement worker (5s poll, 3 manifests/tick, 5 items/tick, 30s lock)
 *   - DB connection pool (max=25) under settlement write storm
 *   - Redis lock contention between workers
 *
 * Run:
 *   npx ts-node load-tests/settlement-burst.ts
 *
 * Prerequisites:
 *   - 100 active auctions with endTime within the next 30 seconds
 *   - At least 1 bid per auction (so settlement has work to do)
 *   - Admin JWT token for creating auctions
 *
 * Environment:
 *   AUCTION_URL     — Auction service URL (default: http://localhost:3001)
 *   MONOLITH_URL    — Monolith URL (default: http://localhost:3000)
 *   REDIS_URL       — Redis URL for monitoring (default: redis://localhost:6379)
 *   ADMIN_TOKEN     — Admin JWT token (required)
 */

import { randomUUID } from 'crypto';

const AUCTION_URL = process.env.AUCTION_URL || 'http://localhost:3001';
const MONOLITH_URL = process.env.MONOLITH_URL || 'http://localhost:3000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const TOTAL_AUCTIONS = parseInt(process.env.BURST_AUCTIONS || '100', 10);
const MONITOR_DURATION_S = parseInt(process.env.MONITOR_DURATION_S || '120', 10);

if (!ADMIN_TOKEN) {
  console.error('ADMIN_TOKEN environment variable is required');
  process.exit(1);
}

const authHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${ADMIN_TOKEN}`,
};

// ── Metrics ────────────────────────────────────────────────────────
const burstMetrics = {
  auctionsCreated: 0,
  auctionsEnded: 0,
  settlementsStarted: 0,
  settlementsCompleted: 0,
  settlementErrors: 0,
  depositsProcessed: 0,
  refundsProcessed: 0,
  pollTimestamps: [] as number[],
};

// ── Create auctions that end in 30 seconds ─────────────────────────
async function createBurstAuctions(): Promise<string[]> {
  const endTime = new Date(Date.now() + 30_000).toISOString();
  const startTime = new Date(Date.now() - 3600_000).toISOString(); // started 1h ago
  const ids: string[] = [];

  console.log(`Creating ${TOTAL_AUCTIONS} auctions ending at ${endTime}...`);

  const batchSize = 10;
  for (let i = 0; i < TOTAL_AUCTIONS; i += batchSize) {
    const batch = Array.from(
      { length: Math.min(batchSize, TOTAL_AUCTIONS - i) },
      (_, j) => {
        const idx = i + j;
        return fetch(`${AUCTION_URL}/api/v1/auctions`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            parcelId: randomUUID(),
            title: `Burst Test Auction #${idx}`,
            description: 'Settlement burst test',
            startTime,
            endTime,
            startingPrice: '10000.00',
            currency: 'TRY',
            minBidIncrement: '100.00',
            depositAmount: '5000.00',
          }),
        }).then(async (res) => {
          if (res.ok) {
            const body = await res.json();
            burstMetrics.auctionsCreated++;
            return body.id;
          }
          console.error(`Failed to create auction ${idx}: ${res.status}`);
          return null;
        });
      },
    );

    const results = await Promise.all(batch);
    ids.push(...results.filter(Boolean));
    process.stdout.write(`  ↳ ${ids.length}/${TOTAL_AUCTIONS} created\r`);
  }

  console.log(`\n${ids.length} auctions created successfully.`);
  return ids;
}

// ── Monitor settlement progress via REST polling ───────────────────
async function monitorSettlements(auctionIds: string[]): Promise<void> {
  const start = Date.now();
  const endedSet = new Set<string>();
  const settledSet = new Set<string>();

  console.log(`\nMonitoring ${auctionIds.length} auctions for ${MONITOR_DURATION_S}s...`);
  console.log('Columns: elapsed | ended | settling | settled | errors\n');

  while ((Date.now() - start) / 1000 < MONITOR_DURATION_S) {
    burstMetrics.pollTimestamps.push(Date.now());

    // Sample 10 random auctions to check status
    const sample = auctionIds
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(10, auctionIds.length));

    await Promise.all(
      sample.map(async (id) => {
        try {
          const res = await fetch(`${AUCTION_URL}/api/v1/auctions/${id}`, {
            headers: authHeaders,
          });
          if (res.ok) {
            const auction = await res.json();
            if (auction.status === 'ended' || auction.status === 'settled') {
              endedSet.add(id);
            }
            if (auction.status === 'settled') {
              settledSet.add(id);
            }
          }
        } catch (_) {}
      }),
    );

    burstMetrics.auctionsEnded = endedSet.size;
    burstMetrics.settlementsCompleted = settledSet.size;

    const elapsed = ((Date.now() - start) / 1000).toFixed(0);
    process.stdout.write(
      `  ${elapsed.padStart(4)}s | ended: ${endedSet.size}/${auctionIds.length} | settled: ${settledSet.size}/${auctionIds.length}\r`,
    );

    // All settled? Done early.
    if (settledSet.size >= auctionIds.length) {
      console.log(`\n\nAll ${auctionIds.length} auctions settled!`);
      break;
    }

    await new Promise((r) => setTimeout(r, 5000));
  }
}

// ── Main ───────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║  NetTapu Settlement Burst Test                                      ║
║  Auctions: ${String(TOTAL_AUCTIONS).padEnd(5)} | End in: 30s | Monitor: ${String(MONITOR_DURATION_S).padEnd(4)}s               ║
╚══════════════════════════════════════════════════════════════════════╝
  `);

  // Step 1: Create burst auctions
  const ids = await createBurstAuctions();
  if (ids.length === 0) {
    console.error('No auctions created. Check admin token and service availability.');
    process.exit(1);
  }

  // Step 2: Wait for auctions to approach endTime
  const waitMs = 25_000; // 25s, so we start monitoring 5s before end
  console.log(`\nWaiting ${waitMs / 1000}s for auctions to approach endTime...`);
  await new Promise((r) => setTimeout(r, waitMs));

  // Step 3: Monitor settlement progress
  await monitorSettlements(ids);

  // ── Report ─────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(72));
  console.log('  SETTLEMENT BURST RESULTS');
  console.log('='.repeat(72));

  const totalTime = (Date.now() - burstMetrics.pollTimestamps[0]) / 1000;

  console.log(`
  Created:            ${burstMetrics.auctionsCreated}
  Ended:              ${burstMetrics.auctionsEnded}
  Settled:            ${burstMetrics.settlementsCompleted}
  Total monitoring:   ${totalTime.toFixed(0)}s
  `);

  // ── Expected bottleneck analysis ─────────────────────────────
  console.log('─'.repeat(72));
  console.log('  SETTLEMENT THROUGHPUT ANALYSIS');
  console.log('─'.repeat(72));

  // Worker processes: 3 manifests/tick, 5s poll → 3 auctions per 5s = 36/min
  const theoreticalThroughput = (3 / 5) * 60; // 36 auctions/minute
  const timeToSettle100 = (100 / theoreticalThroughput) * 60;

  console.log(`
  Settlement worker constants:
    POLL_INTERVAL_MS         = 5000ms
    MAX_MANIFESTS_PER_TICK   = 3
    ITEMS_PER_TICK           = 5
    WORKER_LOCK_TTL_MS       = 30000ms

  Theoretical max throughput: ${theoreticalThroughput} auctions/minute
  Time to settle 100 auctions: ~${timeToSettle100.toFixed(0)}s (single worker)

  Auction-ending worker:
    POLL_INTERVAL_MS         = 1000ms
    WORKER_LOCK_TTL_MS       = 10000ms
    Processes all expired auctions per tick

  Bottleneck prediction:
    - Settlement is the bottleneck (3/tick vs all-at-once ending)
    - 100 auctions / 3 per tick = ~34 ticks × 5s = ~170s to clear backlog
    - DB pool (max=25) can sustain this — each settlement uses 1-2 connections
    - Redis lock: one lock per auction, no contention between different auctions
    - Risk: if single settlement takes >30s, lock expires → duplicate processing
  `);

  console.log('='.repeat(72));
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
