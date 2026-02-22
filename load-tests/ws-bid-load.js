/**
 * NetTapu — WebSocket Bid Load Test
 *
 * Simulates 1000 concurrent bidders across 50 auctions.
 * Each bidder sends 1 bid every 2 seconds.
 *
 * Run:
 *   npx tsx load-tests/ws-bid-load.js
 *
 * Environment:
 *   WS_URL          — WebSocket URL (default: http://localhost:3001)
 *   MONOLITH_URL    — Monolith URL for auth (default: http://localhost:3000)
 *   TOTAL_BIDDERS   — Total bidders (default: 1000)
 *   TOTAL_AUCTIONS  — Total auctions to distribute across (default: 50)
 *   BID_INTERVAL_MS — Interval between bids per bidder (default: 2000)
 *   TEST_DURATION_S — Test duration in seconds (default: 180)
 *   RAMP_UP_S       — Ramp-up period in seconds (default: 60)
 */

import { io, Socket } from 'socket.io-client';
import { randomUUID } from 'crypto';

// ── Configuration ──────────────────────────────────────────────────
const WS_URL = process.env.WS_URL || 'http://localhost:3001';
const MONOLITH_URL = process.env.MONOLITH_URL || 'http://localhost:3000';
const TOTAL_BIDDERS = parseInt(process.env.TOTAL_BIDDERS || '1000', 10);
const TOTAL_AUCTIONS = parseInt(process.env.TOTAL_AUCTIONS || '50', 10);
const BID_INTERVAL_MS = parseInt(process.env.BID_INTERVAL_MS || '2000', 10);
const TEST_DURATION_S = parseInt(process.env.TEST_DURATION_S || '180', 10);
const RAMP_UP_S = parseInt(process.env.RAMP_UP_S || '60', 10);

// ── Metrics ────────────────────────────────────────────────────────
const metrics = {
  connectAttempts: 0,
  connectSuccess: 0,
  connectFailed: 0,
  bidsSent: 0,
  bidAccepted: 0,
  bidRejected: 0,
  bidTimeout: 0,
  disconnects: 0,
  errors: 0,
  latencies: [] as number[],
  bidSendTimestamps: new Map<string, number>(),
  // Per-auction tracking
  perAuction: new Map<string, { sent: number; accepted: number; rejected: number }>(),
  // Rate limit tracking
  rateLimited: 0,
  // Connection timing
  connectLatencies: [] as number[],
};

// ── Auction IDs (pre-seeded or fetched) ────────────────────────────
let auctionIds: string[] = [];

// ── Auth ────────────────────────────────────────────────────────────
async function registerAndLogin(index: number): Promise<string | null> {
  const email = `bidder_${index}_${Date.now()}@loadtest.nettapu.com`;
  const password = 'LoadTest!2024secure';

  try {
    // Register
    await fetch(`${MONOLITH_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        firstName: `Bidder${index}`,
        lastName: 'LoadTest',
      }),
    });

    // Login
    const loginRes = await fetch(`${MONOLITH_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (loginRes.ok) {
      const body = await loginRes.json();
      return body.accessToken || body.access_token;
    }
  } catch (err) {
    console.error(`Auth failed for bidder ${index}:`, (err as Error).message);
  }
  return null;
}

async function fetchActiveAuctions(): Promise<string[]> {
  try {
    const res = await fetch(
      `${MONOLITH_URL}/api/v1/auctions?status=active&limit=50`,
    );
    if (res.ok) {
      const body = await res.json();
      const items = body.data || body.items || body;
      if (Array.isArray(items)) {
        return items.map((a: any) => a.id).filter(Boolean);
      }
    }
  } catch (_) {}

  // Also try auction-service directly
  try {
    const res = await fetch(
      `${WS_URL}/api/v1/auctions?status=active&limit=50`,
    );
    if (res.ok) {
      const body = await res.json();
      const items = body.data || body.items || body;
      if (Array.isArray(items)) {
        return items.map((a: any) => a.id).filter(Boolean);
      }
    }
  } catch (_) {}

  // Fallback: generate deterministic UUIDs for testing
  console.warn('No active auctions found. Using synthetic auction IDs.');
  return Array.from({ length: TOTAL_AUCTIONS }, (_, i) =>
    `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
  );
}

// ── Bidder ──────────────────────────────────────────────────────────
class Bidder {
  private socket: Socket | null = null;
  private token: string;
  private auctionId: string;
  private bidInterval: ReturnType<typeof setInterval> | null = null;
  private currentBidAmount = 1000; // Starting bid amount
  private index: number;

  constructor(index: number, token: string, auctionId: string) {
    this.index = index;
    this.token = token;
    this.auctionId = auctionId;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const connectStart = Date.now();
      metrics.connectAttempts++;

      this.socket = io(`${WS_URL}/ws/auction`, {
        path: '/socket.io',
        transports: ['websocket'],
        auth: { token: this.token },
        reconnection: false,
        timeout: 10000,
      });

      const timeout = setTimeout(() => {
        metrics.connectFailed++;
        this.socket?.disconnect();
        reject(new Error(`Connect timeout for bidder ${this.index}`));
      }, 15000);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        metrics.connectSuccess++;
        metrics.connectLatencies.push(Date.now() - connectStart);

        // Join auction room
        this.socket!.emit('join_auction', { auctionId: this.auctionId });

        this.setupListeners();
        resolve();
      });

      this.socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        metrics.connectFailed++;
        reject(err);
      });
    });
  }

  private setupListeners(): void {
    if (!this.socket) return;

    this.socket.on('bid_accepted', (data: any) => {
      metrics.bidAccepted++;
      const key = data?.idempotencyKey || data?.bid?.idempotencyKey;
      if (key && metrics.bidSendTimestamps.has(key)) {
        const latency = Date.now() - metrics.bidSendTimestamps.get(key)!;
        metrics.latencies.push(latency);
        metrics.bidSendTimestamps.delete(key);
      }
      this.trackAuction('accepted');
    });

    this.socket.on('bid_rejected', (data: any) => {
      metrics.bidRejected++;
      const reason = data?.reason || '';
      if (reason.includes('rate') || reason.includes('throttle')) {
        metrics.rateLimited++;
      }
      const key = data?.idempotencyKey;
      if (key) metrics.bidSendTimestamps.delete(key);
      this.trackAuction('rejected');
    });

    this.socket.on('auction_state', (_data: any) => {
      // Update current highest bid to stay competitive
      if (_data?.currentPrice) {
        const current = parseFloat(_data.currentPrice);
        if (current >= this.currentBidAmount) {
          this.currentBidAmount = current + Math.floor(Math.random() * 500) + 100;
        }
      }
    });

    this.socket.on('disconnect', () => {
      metrics.disconnects++;
    });

    this.socket.on('error', () => {
      metrics.errors++;
    });

    this.socket.on('exception', () => {
      metrics.errors++;
    });
  }

  private trackAuction(type: 'sent' | 'accepted' | 'rejected'): void {
    if (!metrics.perAuction.has(this.auctionId)) {
      metrics.perAuction.set(this.auctionId, { sent: 0, accepted: 0, rejected: 0 });
    }
    metrics.perAuction.get(this.auctionId)![type]++;
  }

  startBidding(): void {
    this.bidInterval = setInterval(() => {
      if (!this.socket?.connected) return;

      const idempotencyKey = `lt-${this.index}-${Date.now()}-${randomUUID().slice(0, 8)}`;
      this.currentBidAmount += Math.floor(Math.random() * 500) + 100;

      metrics.bidSendTimestamps.set(idempotencyKey, Date.now());
      metrics.bidsSent++;
      this.trackAuction('sent');

      this.socket.emit('place_bid', {
        auctionId: this.auctionId,
        amount: String(this.currentBidAmount),
        idempotencyKey,
      });

      // Timeout: if no response in 5s, count as timeout
      setTimeout(() => {
        if (metrics.bidSendTimestamps.has(idempotencyKey)) {
          metrics.bidTimeout++;
          metrics.bidSendTimestamps.delete(idempotencyKey);
        }
      }, 5000);
    }, BID_INTERVAL_MS);
  }

  stop(): void {
    if (this.bidInterval) clearInterval(this.bidInterval);
    if (this.socket) {
      this.socket.emit('leave_auction', { auctionId: this.auctionId });
      this.socket.disconnect();
    }
  }
}

// ── Metrics Reporter ───────────────────────────────────────────────
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function reportMetrics(): void {
  const elapsed = Math.floor((Date.now() - testStartTime) / 1000);
  const bidRate = metrics.bidsSent / Math.max(elapsed, 1);
  const acceptRate = metrics.bidAccepted / Math.max(metrics.bidsSent, 1);

  console.log('\n' + '='.repeat(72));
  console.log(`  NetTapu WebSocket Bid Load Test — ${elapsed}s elapsed`);
  console.log('='.repeat(72));
  console.log(`
  Connections
    Attempts:      ${metrics.connectAttempts}
    Success:       ${metrics.connectSuccess}
    Failed:        ${metrics.connectFailed}
    Disconnects:   ${metrics.disconnects}
    Connect p50:   ${percentile(metrics.connectLatencies, 50)}ms
    Connect p95:   ${percentile(metrics.connectLatencies, 95)}ms

  Bids
    Sent:          ${metrics.bidsSent}  (${bidRate.toFixed(1)}/s)
    Accepted:      ${metrics.bidAccepted}  (${(acceptRate * 100).toFixed(1)}%)
    Rejected:      ${metrics.bidRejected}
    Timeout (5s):  ${metrics.bidTimeout}
    Rate Limited:  ${metrics.rateLimited}
    Errors:        ${metrics.errors}

  Bid Latency (send → ack)
    p50:           ${percentile(metrics.latencies, 50)}ms
    p95:           ${percentile(metrics.latencies, 95)}ms
    p99:           ${percentile(metrics.latencies, 99)}ms
    max:           ${metrics.latencies.length > 0 ? Math.max(...metrics.latencies) : 0}ms

  Memory
    RSS:           ${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB
    Heap Used:     ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB
    Pending Acks:  ${metrics.bidSendTimestamps.size}

  Per-Auction Summary (top 5 by volume)
`);

  const sorted = [...metrics.perAuction.entries()]
    .sort((a, b) => b[1].sent - a[1].sent)
    .slice(0, 5);

  for (const [id, stats] of sorted) {
    console.log(`    ${id.slice(0, 8)}…  sent=${stats.sent} accepted=${stats.accepted} rejected=${stats.rejected}`);
  }
  console.log('='.repeat(72));
}

// ── Main ───────────────────────────────────────────────────────────
let testStartTime: number;

async function main(): Promise<void> {
  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║  NetTapu WebSocket Bid Load Test                                    ║
║  Bidders: ${String(TOTAL_BIDDERS).padEnd(5)} | Auctions: ${String(TOTAL_AUCTIONS).padEnd(5)} | Interval: ${String(BID_INTERVAL_MS).padEnd(5)}ms     ║
║  Duration: ${String(TEST_DURATION_S).padEnd(4)}s | Ramp-up: ${String(RAMP_UP_S).padEnd(4)}s                              ║
╚══════════════════════════════════════════════════════════════════════╝
  `);

  // Fetch active auctions
  console.log('Fetching active auctions...');
  auctionIds = await fetchActiveAuctions();
  console.log(`Found ${auctionIds.length} auctions`);

  if (auctionIds.length === 0) {
    console.error('No auctions available. Exiting.');
    process.exit(1);
  }

  testStartTime = Date.now();
  const bidders: Bidder[] = [];
  const rampDelay = (RAMP_UP_S * 1000) / TOTAL_BIDDERS;

  console.log(`Ramping up ${TOTAL_BIDDERS} bidders over ${RAMP_UP_S}s (${rampDelay.toFixed(0)}ms between each)...\n`);

  // Metrics reporting interval
  const metricsInterval = setInterval(reportMetrics, 10000);

  // Ramp up bidders
  for (let i = 0; i < TOTAL_BIDDERS; i++) {
    const auctionId = auctionIds[i % auctionIds.length];

    // Fire-and-forget: register, login, connect, bid
    (async () => {
      try {
        const token = await registerAndLogin(i);
        if (!token) {
          metrics.connectFailed++;
          return;
        }

        const bidder = new Bidder(i, token, auctionId);
        bidders.push(bidder);

        await bidder.connect();
        bidder.startBidding();
      } catch (err) {
        // Already counted in metrics
      }
    })();

    // Stagger connections to avoid thundering herd
    if (i % 50 === 49) {
      process.stdout.write(`  ↳ ${i + 1}/${TOTAL_BIDDERS} bidders launched\r`);
    }
    await new Promise((r) => setTimeout(r, rampDelay));
  }

  console.log(`\nAll ${TOTAL_BIDDERS} bidders launched. Running for ${TEST_DURATION_S}s...\n`);

  // Wait for test duration (minus ramp-up time already elapsed)
  const remaining = TEST_DURATION_S * 1000 - (Date.now() - testStartTime);
  if (remaining > 0) {
    await new Promise((r) => setTimeout(r, remaining));
  }

  // Shutdown
  console.log('\nShutting down bidders...');
  clearInterval(metricsInterval);

  for (const bidder of bidders) {
    bidder.stop();
  }

  // Final report
  reportMetrics();

  // ── Bottleneck Analysis ──────────────────────────────────────────
  console.log('\n' + '─'.repeat(72));
  console.log('  BOTTLENECK ANALYSIS');
  console.log('─'.repeat(72));

  const p95 = percentile(metrics.latencies, 95);
  const errorRate = (metrics.bidRejected + metrics.bidTimeout) / Math.max(metrics.bidsSent, 1);

  if (p95 > 500) {
    console.log(`  ⚠ Bid latency p95 = ${p95}ms (>500ms) — likely Redis lock contention`);
    console.log(`    bid:lock:auction:{id} TTL=5000ms, ${TOTAL_BIDDERS / auctionIds.length} bidders/auction`);
  }
  if (metrics.rateLimited > metrics.bidsSent * 0.1) {
    console.log(`  ⚠ ${metrics.rateLimited} rate-limited bids (${((metrics.rateLimited / metrics.bidsSent) * 100).toFixed(1)}%)`);
    console.log(`    Per-user limit: 5 bids/3s. Bid interval ${BID_INTERVAL_MS}ms may be too aggressive.`);
  }
  if (metrics.bidTimeout > metrics.bidsSent * 0.05) {
    console.log(`  ⚠ ${metrics.bidTimeout} bid timeouts (${((metrics.bidTimeout / metrics.bidsSent) * 100).toFixed(1)}%)`);
    console.log(`    Possible causes: DB pool exhaustion (max=25), Redis queue backlog`);
  }
  if (metrics.connectFailed > TOTAL_BIDDERS * 0.1) {
    console.log(`  ⚠ ${metrics.connectFailed} connection failures — check nginx ws_limit (10/s) and fd limits`);
  }
  if (errorRate < 0.05) {
    console.log(`  ✓ Error rate ${(errorRate * 100).toFixed(1)}% — within acceptable threshold`);
  }
  if (p95 < 200) {
    console.log(`  ✓ Bid latency p95 = ${p95}ms — excellent`);
  }

  console.log('─'.repeat(72));
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
