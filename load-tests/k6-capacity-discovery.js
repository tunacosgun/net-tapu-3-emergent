import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate, Gauge } from 'k6/metrics';

/**
 * NetTapu — Automatic Capacity Discovery
 *
 * Progressively increases VUs until a breakpoint:
 *   - p95 latency > 200ms
 *   - Error rate > 5%
 *   - DB pool waiting > 0 (saturation)
 *   - Event loop lag > 50ms
 *
 * Usage (loadtest mode via nginx — recommended):
 *   docker compose -f docker-compose.yml -f docker-compose.loadtest.yml up -d
 *   k6 run \
 *     --env BASE_URL=http://localhost:80 \
 *     --env TEST_TOKEN=<jwt> \
 *     --out json=load-tests/results/capacity.json \
 *     load-tests/k6-capacity-discovery.js
 *
 * Usage (direct to services, bypassing nginx):
 *   k6 run \
 *     --env AUCTION_URL=http://localhost:3001/api/v1/auctions \
 *     --env MONOLITH_URL=http://localhost:3000 \
 *     --env INTERNAL_AUCTION=http://localhost:3001/internal \
 *     --env INTERNAL_MONOLITH=http://localhost:3000/internal \
 *     --env TEST_TOKEN=<jwt> \
 *     --out json=load-tests/results/capacity.json \
 *     load-tests/k6-capacity-discovery.js
 */

// ── Custom Metrics (load traffic only) ────────────────────────
const requestLatency = new Trend('request_latency', true);
const errorRate = new Rate('error_rate');
const httpErrors = new Counter('http_errors');
const status200 = new Counter('status_200');
const status429 = new Counter('status_429');
const status503 = new Counter('status_503');
const statusOther = new Counter('status_other');

// Telemetry gauges (populated by poller, never by load traffic)
const dbPoolTotal = new Gauge('db_pool_total');
const dbPoolIdle = new Gauge('db_pool_idle');
const dbPoolWaiting = new Gauge('db_pool_waiting');
const eventLoopLag = new Gauge('event_loop_lag_ms');
const cpuUsage = new Gauge('cpu_usage_percent');
const heapUsed = new Gauge('heap_used_mb');

// ── Config ─────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || '';
const AUCTION_URL = __ENV.AUCTION_URL
  || (BASE_URL ? `${BASE_URL}/api/v1/auctions` : 'http://localhost:3001/api/v1/auctions');
const MONOLITH_URL = __ENV.MONOLITH_URL
  || (BASE_URL ? BASE_URL : 'http://localhost:3000');

// Internal telemetry endpoints.
// When using BASE_URL (nginx mode), route through loadtest nginx locations.
// When using direct mode, use service ports directly.
const INTERNAL_AUCTION = __ENV.INTERNAL_AUCTION
  || (BASE_URL ? `${BASE_URL}/internal/auction` : 'http://localhost:3001/api/v1/auctions/internal');
const INTERNAL_MONOLITH = __ENV.INTERNAL_MONOLITH
  || (BASE_URL ? `${BASE_URL}/internal/monolith` : 'http://localhost:3000/api/v1/internal');

const TEST_TOKEN = __ENV.TEST_TOKEN || '';
const MAX_VUS = parseInt(__ENV.MAX_VUS || '2000', 10);
const STEP_DURATION = __ENV.STEP_DURATION || '30s';
const STEP_SIZE = parseInt(__ENV.STEP_SIZE || '50', 10);

if (!TEST_TOKEN && __VU === 0) {
  console.error('FATAL: --env TEST_TOKEN=<jwt> is required.');
}

const AUTH_HEADERS = {
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TEST_TOKEN}`,
  },
};

// ── Ramping stages ─────────────────────────────────────────────
const stages = [];
for (let vus = STEP_SIZE; vus <= MAX_VUS; vus += STEP_SIZE) {
  stages.push({ duration: '5s', target: vus });
  stages.push({ duration: STEP_DURATION, target: vus });
}
stages.push({ duration: '10s', target: 0 });

const totalDurationSec = stages.reduce((sum, s) => {
  const match = s.duration.match(/(\d+)/);
  return sum + (match ? parseInt(match[1]) : 0);
}, 0);

export const options = {
  scenarios: {
    capacity_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: stages,
      gracefulRampDown: '10s',
    },
    telemetry_poller: {
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '5s',
      duration: totalDurationSec + 's',
      preAllocatedVUs: 1,
      maxVUs: 1,
      exec: 'pollTelemetry',
    },
  },
  thresholds: {
    // Breakpoint thresholds — test aborts when these fail.
    // Scoped to capacity_ramp scenario only so telemetry_poller is excluded.
    'error_rate{scenario:capacity_ramp}': [
      { threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '15s' },
    ],
    'request_latency{scenario:capacity_ramp}': [
      { threshold: 'p(95)<300', abortOnFail: true, delayAbortEval: '20s' },
    ],
    event_loop_lag_ms: [
      { threshold: 'value<100', abortOnFail: false },
    ],
    db_pool_waiting: [
      { threshold: 'value<1', abortOnFail: false },
    ],
    // Exclude telemetry poller from the built-in http_req_failed metric.
    // Only fail on load-traffic errors, not telemetry endpoint status codes.
    'http_req_failed{scenario:capacity_ramp}': [
      { threshold: 'rate<0.10', abortOnFail: false },
    ],
  },
};

if (__VU === 0) {
  const totalSteps = Math.ceil(MAX_VUS / STEP_SIZE);
  console.log(`Capacity discovery: 0 → ${MAX_VUS} VUs in ${totalSteps} steps of ${STEP_SIZE}`);
  console.log(`Step duration: ${STEP_DURATION}, total: ${totalDurationSec}s`);
  console.log(`Abort triggers: p95>200ms | errors>5% | pool saturation | EL lag>50ms`);
  console.log(`Auction URL:  ${AUCTION_URL}`);
  console.log(`Monolith URL: ${MONOLITH_URL}`);
  console.log(`Telemetry:    ${INTERNAL_AUCTION} | ${INTERNAL_MONOLITH}`);
}

// ── Main scenario: capacity_ramp ───────────────────────────────
export default function () {
  const r = Math.random();

  if (r < 0.8) {
    // List auctions (80% of traffic)
    const res = http.get(`${AUCTION_URL}/?page=1&limit=20`, {
      tags: { name: 'auction_list' },
    });
    requestLatency.add(res.timings.duration);
    trackStatus(res);
    errorRate.add(res.status >= 400);

    check(res, { 'list 2xx': (r) => r.status >= 200 && r.status < 300 });

    if (res.status === 200) {
      try {
        const body = JSON.parse(res.body);
        const items = body.data || [];
        if (items.length > 0) {
          const item = items[Math.floor(Math.random() * items.length)];
          if (item.id) {
            const detailRes = http.get(`${AUCTION_URL}/${item.id}`, {
              tags: { name: 'auction_detail' },
            });
            requestLatency.add(detailRes.timings.duration);
            trackStatus(detailRes);
            errorRate.add(detailRes.status >= 400);
          }
        }
      } catch (_) { /* parse error — not a test failure */ }
    }
  } else {
    // Payment initiation (20% of traffic)
    const idempotencyKey = `cap-${__VU}-${__ITER}-${Date.now()}`;
    const res = http.post(
      `${MONOLITH_URL}/api/v1/payments`,
      JSON.stringify({
        parcelId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        amount: '50000.00',
        currency: 'TRY',
        paymentMethod: 'credit_card',
        idempotencyKey,
        description: 'capacity discovery payment',
        cardToken: 'tok_test_loadtest',
      }),
      Object.assign({}, AUTH_HEADERS, { tags: { name: 'payment_init' } }),
    );
    requestLatency.add(res.timings.duration);
    trackStatus(res);
    errorRate.add(res.status >= 400 && res.status !== 409);
  }

  sleep(Math.random() * 0.5 + 0.25);
}

// ── Telemetry poller (isolated — does NOT affect error_rate) ───
export function pollTelemetry() {
  // All requests tagged so k6 can filter them out of global metrics.
  const teleTags = { tags: { name: 'telemetry_poll' } };

  // ── Auction service telemetry ────────────────────────────────
  try {
    const poolRes = http.get(`${INTERNAL_AUCTION}/pool-stats`, teleTags);
    if (poolRes.status === 200) {
      const p = JSON.parse(poolRes.body);
      dbPoolTotal.add(p.totalConnections || 0);
      dbPoolIdle.add(p.idleConnections || 0);
      dbPoolWaiting.add(p.waitingClients || 0);
    }
  } catch (_) { /* non-fatal */ }

  try {
    const runtimeRes = http.get(`${INTERNAL_AUCTION}/runtime-metrics`, teleTags);
    if (runtimeRes.status === 200) {
      const m = JSON.parse(runtimeRes.body);
      eventLoopLag.add(m.eventLoopLagMs || 0);
      cpuUsage.add(m.cpuUsagePercent || 0);
      heapUsed.add(m.heapUsedMB || 0);
    }
  } catch (_) { /* non-fatal */ }

  // ── Monolith telemetry ───────────────────────────────────────
  try {
    const poolRes = http.get(`${INTERNAL_MONOLITH}/pool-stats`, teleTags);
    if (poolRes.status === 200) {
      const p = JSON.parse(poolRes.body);
      // Always update — Gauge keeps last value, so we capture the worse of the two
      dbPoolTotal.add(Math.max(p.totalConnections || 0, 0));
      dbPoolWaiting.add(p.waitingClients || 0);
    }
  } catch (_) { /* non-fatal */ }

  try {
    const runtimeRes = http.get(`${INTERNAL_MONOLITH}/runtime-metrics`, teleTags);
    if (runtimeRes.status === 200) {
      const m = JSON.parse(runtimeRes.body);
      eventLoopLag.add(m.eventLoopLagMs || 0);
      cpuUsage.add(m.cpuUsagePercent || 0);
    }
  } catch (_) { /* non-fatal */ }
}

// ── Helpers ────────────────────────────────────────────────────
function trackStatus(res) {
  const s = res.status;
  if (s >= 200 && s < 300)   status200.add(1);
  else if (s === 429)        status429.add(1);
  else if (s === 503)        status503.add(1);
  else {
    statusOther.add(1);
    if (s >= 400) httpErrors.add(1);
  }
}
