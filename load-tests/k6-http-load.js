import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';

/**
 * NetTapu — k6 HTTP Load Test
 *
 * Three test modes:
 *
 * Mode A — Direct service (bypass nginx):
 *   k6 run \
 *     --env AUCTION_URL=http://localhost:3001 \
 *     --env MONOLITH_URL=http://localhost:3000 \
 *     --env TEST_TOKEN=<jwt> \
 *     load-tests/k6-http-load.js
 *
 * Mode B — Full stack, rate limits disabled:
 *   docker compose -f docker-compose.yml -f docker-compose.loadtest.yml up -d
 *   k6 run \
 *     --env BASE_URL=http://localhost:80 \
 *     --env TEST_TOKEN=<jwt> \
 *     load-tests/k6-http-load.js
 *
 * Mode C — Production simulation (rate limits active):
 *   docker compose up -d
 *   k6 run \
 *     --env BASE_URL=http://localhost:80 \
 *     --env TEST_TOKEN=<jwt> \
 *     --env VUS=30 \
 *     load-tests/k6-http-load.js
 */

// ── Metrics ───────────────────────────────────────────────
const auctionListLatency = new Trend('auction_list_latency', true);
const auctionDetailLatency = new Trend('auction_detail_latency', true);
const paymentInitLatency = new Trend('payment_init_latency', true);

const httpErrors = new Counter('http_errors');
const http429s = new Counter('http_429_rate_limited');
const http503s = new Counter('http_503_nginx_limited');
const statusBreakdown = {
  s200: new Counter('status_200'),
  s201: new Counter('status_201'),
  s400: new Counter('status_400'),
  s401: new Counter('status_401'),
  s404: new Counter('status_404'),
  s409: new Counter('status_409'),
  s429: new Counter('status_429'),
  s500: new Counter('status_500'),
  s503: new Counter('status_503'),
  other: new Counter('status_other'),
};

// ── Config ────────────────────────────────────────────────
// Mode A: set AUCTION_URL + MONOLITH_URL directly
// Mode B/C: set BASE_URL (nginx), URLs derived from it
const BASE_URL = __ENV.BASE_URL || '';
const AUCTION_URL = __ENV.AUCTION_URL || (BASE_URL ? `${BASE_URL}/api/v1/auctions` : 'http://localhost:3001/api/v1/auctions');
const MONOLITH_URL = __ENV.MONOLITH_URL || (BASE_URL ? BASE_URL : 'http://localhost:3000');
const MONOLITH_PREFIX = `${MONOLITH_URL}/api/v1`;

const TEST_TOKEN = __ENV.TEST_TOKEN || '';
const MAX_VUS = parseInt(__ENV.VUS || '500', 10);
const PAY_VUS = parseInt(__ENV.PAY_VUS || '200', 10);

if (!TEST_TOKEN) {
  console.error('FATAL: --env TEST_TOKEN=<jwt> is required.');
}

// Detect mode for logging
const mode = __ENV.AUCTION_URL ? 'A (direct)' : (__ENV.VUS && parseInt(__ENV.VUS) <= 50 ? 'C (production sim)' : 'B (full stack)');
if (__VU === 0) {
  console.log(`Mode: ${mode}`);
  console.log(`Auction URL: ${AUCTION_URL}`);
  console.log(`Monolith URL: ${MONOLITH_PREFIX}`);
  console.log(`Browse VUs: ${MAX_VUS}, Payment VUs: ${PAY_VUS}`);
}

const AUTH_PARAMS = {
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TEST_TOKEN}`,
  },
};

// ── Options ──────────────────────────────────────────────
export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: Math.ceil(MAX_VUS * 0.2) },
        { duration: '30s', target: Math.ceil(MAX_VUS * 0.6) },
        { duration: '60s', target: MAX_VUS },
        { duration: '60s', target: MAX_VUS },   // sustained
        { duration: '15s', target: 0 },
      ],
    },
    payment_burst: {
      executor: 'ramping-vus',
      startTime: '30s',
      startVUs: 0,
      stages: [
        { duration: '15s', target: Math.ceil(PAY_VUS * 0.25) },
        { duration: '30s', target: PAY_VUS },
        { duration: '60s', target: PAY_VUS },    // sustained
        { duration: '15s', target: 0 },
      ],
      exec: 'paymentInitiation',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    auction_list_latency: ['p(95)<1000'],
    auction_detail_latency: ['p(95)<500'],
    payment_init_latency: ['p(95)<3000'],
  },
};

// ── Helpers ──────────────────────────────────────────────
function trackStatus(res) {
  const s = res.status;
  if (s === 200)      statusBreakdown.s200.add(1);
  else if (s === 201) statusBreakdown.s201.add(1);
  else if (s === 400) statusBreakdown.s400.add(1);
  else if (s === 401) statusBreakdown.s401.add(1);
  else if (s === 404) statusBreakdown.s404.add(1);
  else if (s === 409) statusBreakdown.s409.add(1);
  else if (s === 429) { statusBreakdown.s429.add(1); http429s.add(1); }
  else if (s === 500) statusBreakdown.s500.add(1);
  else if (s === 503) { statusBreakdown.s503.add(1); http503s.add(1); }
  else                statusBreakdown.other.add(1);

  if (s >= 400 && s !== 429 && s !== 503) {
    httpErrors.add(1);
  }
}

// Trailing slash needed when going through nginx location /api/v1/auctions/
// Safe to include even in direct mode (NestJS handles it)
function auctionListUrl(query) {
  return `${AUCTION_URL}/?${query}`;
}

function auctionDetailUrl(id) {
  return `${AUCTION_URL}/${id}`;
}

// ── Scenario 1: Browse Auctions ─────────────────────────
export default function () {
  group('browse_auctions', () => {
    const listRes = http.get(auctionListUrl('page=1&limit=20'));
    auctionListLatency.add(listRes.timings.duration);
    trackStatus(listRes);

    const listOk = check(listRes, {
      'auction list 2xx': (r) => r.status >= 200 && r.status < 300,
    });

    if (listOk && listRes.status === 200) {
      try {
        const body = JSON.parse(listRes.body);
        const items = body.data || [];

        // Empty array is valid — no auctions exist yet
        if (Array.isArray(items) && items.length > 0) {
          const auction = items[Math.floor(Math.random() * items.length)];
          if (auction.id) {
            const detailRes = http.get(auctionDetailUrl(auction.id));
            auctionDetailLatency.add(detailRes.timings.duration);
            trackStatus(detailRes);

            check(detailRes, {
              'auction detail 2xx': (r) => r.status >= 200 && r.status < 300,
            });
          }
        }
      } catch (_) {
        // parse error — not a test failure
      }
    }

    sleep(Math.random() * 1.5 + 0.5); // 0.5-2s think time
  });
}

// ── Scenario 2: Payment Initiation ──────────────────────
export function paymentInitiation() {
  group('payment_flow', () => {
    const idempotencyKey = `k6-${__VU}-${__ITER}-${Date.now()}`;

    // POST /api/v1/payments — controller is @Post() (no sub-path)
    const payRes = http.post(
      `${MONOLITH_PREFIX}/payments`,
      JSON.stringify({
        parcelId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        amount: '50000.00',
        currency: 'TRY',
        paymentMethod: 'credit_card',
        idempotencyKey,
        description: 'k6 load test payment',
        cardToken: 'tok_test_loadtest',
      }),
      AUTH_PARAMS,
    );

    paymentInitLatency.add(payRes.timings.duration);
    trackStatus(payRes);

    check(payRes, {
      'payment accepted': (r) =>
        r.status === 200 || r.status === 201 || r.status === 409,
    });

    sleep(Math.random() * 2 + 1); // 1-3s think time
  });
}
