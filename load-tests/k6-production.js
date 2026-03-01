import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group, fail } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import exec from 'k6/execution';

// ─────────────────────────────────────────────────────────────
// NetTapu Platform — Production Load Test (k6)
// ─────────────────────────────────────────────────────────────
//
// Scenarios:
//   1) 200 concurrent bidders        — REST bids (precise latency)
//   2)  50 concurrent deposit payers  — REST payment initiation
//   3)  20 admin reconciliation       — REST trigger + GET report
//   4) WebSocket connection churn     — Socket.IO rapid cycle
//
// Prerequisites:
//   - Monolith on :3000, auction-service on :3001
//   - Backend started with NODE_ENV=loadtest (relaxes throttle)
//   - A LIVE auction UUID
//   - Admin credentials
//
// Run:
//   # Start backend with relaxed rate limits:
//   NODE_ENV=loadtest npm run start:dev --workspace=apps/monolith
//
//   # Execute load test:
//   k6 run \
//     -e AUCTION_ID=<uuid> \
//     -e ADMIN_EMAIL=admin@test.nettapu.com \
//     -e ADMIN_PASSWORD='Admin123!@#' \
//     load-tests/k6-production.js
//
// Env vars:
//   AUCTION_ID       (required) UUID of a LIVE auction
//   ADMIN_EMAIL      (required) admin user email
//   ADMIN_PASSWORD   (required) admin user password
//   MONOLITH_URL     (default http://localhost:3000)
//   AUCTION_URL      (default http://localhost:3001)
//   DURATION         (default 2m)
//   USER_COUNT       (default 250)
//   REUSE_PREFIX     (default "") set to reuse users from prior run
// ─────────────────────────────────────────────────────────────

// ── Custom Metrics ───────────────────────────────────────────

const bidLatency       = new Trend('bid_e2e_latency_ms', true);
const bidAcceptedTotal = new Counter('bids_accepted');
const bidRejectedTotal = new Counter('bids_rejected');
const bidErrorTotal    = new Counter('bids_error');

const paymentOkTotal   = new Counter('payments_initiated');
const payment3dsTotal  = new Counter('payments_3ds');
const paymentFailTotal = new Counter('payments_failed');

const reconOkTotal     = new Counter('recon_triggered');
const reconLimitTotal  = new Counter('recon_rate_limited');
const reconReportMs    = new Trend('recon_report_latency_ms', true);

const wsConnectedTotal   = new Counter('ws_connected');
const wsDroppedTotal     = new Counter('ws_dropped');
const wsReconnectTotal   = new Counter('ws_reconnected');
const wsMsgTotal         = new Counter('ws_messages_received');
const wsBidViaWsTotal    = new Counter('ws_bids_placed');
const wsConnectMs        = new Trend('ws_connect_ms', true);

const setupUsersCreated  = new Counter('setup_users_created');
const setupUsersReused   = new Counter('setup_users_reused');
const setupUsersFailed   = new Counter('setup_users_failed');

const httpErrRate = new Rate('http_error_rate');

// ── Configuration ────────────────────────────────────────────

const MONO   = __ENV.MONOLITH_URL  || 'http://localhost:3000';
const ACSVC  = __ENV.AUCTION_URL   || 'http://localhost:3001';
const WS_URL = ACSVC.replace(/^http/, 'ws');
const AID    = __ENV.AUCTION_ID;
const ADM_E  = __ENV.ADMIN_EMAIL   || 'admin@nettapu.com';
const ADM_P  = __ENV.ADMIN_PASSWORD || 'Admin123!@#';
const UCNT   = parseInt(__ENV.USER_COUNT || '250', 10);
const DUR    = __ENV.DURATION || '2m';

// Deterministic prefix: set REUSE_PREFIX to skip registration on repeat runs.
// e.g. -e REUSE_PREFIX=lt-1740000000000 reuses users from that timestamp batch.
const REUSE_PREFIX = __ENV.REUSE_PREFIX || '';

// Minimum viable users to start the test — below this we abort
const MIN_USERS = 50;
const USER_PASSWORD = 'LoadTest123!';

if (!AID) {
  throw new Error(
    'AUCTION_ID is required.\n  k6 run -e AUCTION_ID=<uuid> -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... load-tests/k6-production.js',
  );
}

// ── k6 Options ───────────────────────────────────────────────

export const options = {
  // 5 minutes for setup — enough for 250 users even with rate limits
  setupTimeout: '5m',

  scenarios: {
    bidders: {
      executor: 'constant-vus',
      vus: 200,
      duration: DUR,
      exec: 'bidderScenario',
      tags: { scenario: 'bidders' },
    },
    deposits: {
      executor: 'constant-vus',
      vus: 50,
      duration: DUR,
      exec: 'depositScenario',
      tags: { scenario: 'deposits' },
      startTime: '5s',
    },
    reconciliation: {
      executor: 'constant-vus',
      vus: 20,
      duration: DUR,
      exec: 'reconScenario',
      tags: { scenario: 'reconciliation' },
      startTime: '10s',
    },
    ws_churn: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 100 },
        { duration: '10s', target: 0 },
        { duration: '20s', target: 150 },
        { duration: '10s', target: 0 },
        { duration: '20s', target: 200 },
        { duration: '10s', target: 0 },
      ],
      exec: 'wsChurnScenario',
      tags: { scenario: 'ws_churn' },
    },
  },

  thresholds: {
    bid_e2e_latency_ms:  ['p(95)<500', 'p(99)<1000'],
    ws_connect_ms:       ['p(95)<2000'],
    http_error_rate:     ['rate<0.05'],
    'http_req_duration{scenario:deposits}':       ['p(95)<3000'],
    'http_req_duration{scenario:reconciliation}': ['p(95)<5000'],
  },
};

// ── Helpers ──────────────────────────────────────────────────

const JSON_HDRS = { headers: { 'Content-Type': 'application/json' } };

function authHdrs(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };
}

function makeUUID() {
  const h = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) s += '-';
    else if (i === 14) s += '4';
    else if (i === 19) s += h[((Math.random() * 4) | 0) + 8];
    else s += h[(Math.random() * 16) | 0];
  }
  return s;
}

// Exponential backoff: base * 2^attempt, capped at maxSec, with jitter
function backoffSleep(attempt, baseSec, maxSec) {
  const delay = Math.min(baseSec * Math.pow(2, attempt), maxSec);
  const jitter = delay * 0.2 * Math.random();
  sleep(delay + jitter);
}

// ── Setup ────────────────────────────────────────────────────

export function setup() {
  const t0 = Date.now();

  // ── 1. Admin authentication ────────────────────────────────
  console.log('[setup] Authenticating admin...');
  const admRes = http.post(
    `${MONO}/api/v1/auth/login`,
    JSON.stringify({ email: ADM_E, password: ADM_P }),
    JSON_HDRS,
  );
  if (admRes.status !== 200) {
    fail(`Admin login failed (${admRes.status}): ${admRes.body}`);
  }
  const adminToken = JSON.parse(admRes.body).accessToken;
  console.log('[setup] Admin authenticated');

  // ── 2. Verify auction exists and is LIVE ───────────────────
  console.log(`[setup] Verifying auction ${AID}...`);
  const aucRes = http.get(
    `${ACSVC}/api/v1/auctions/${AID}`,
    authHdrs(adminToken),
  );
  if (aucRes.status !== 200) {
    fail(`Cannot fetch auction ${AID}: status=${aucRes.status}`);
  }
  const auction = JSON.parse(aucRes.body);
  console.log(
    `[setup] Auction: status=${auction.status} price=${auction.currentPrice} deposit=${auction.requiredDeposit}`,
  );
  if (auction.status !== 'LIVE') {
    console.warn(
      `[setup] WARNING: Auction is "${auction.status}" — bids will be rejected. Change status to LIVE before testing.`,
    );
  }

  // ── 3. Provision test users ────────────────────────────────
  const prefix = REUSE_PREFIX || `lt-${Date.now()}`;
  const users = REUSE_PREFIX
    ? reuseExistingUsers(prefix)
    : createNewUsers(prefix);

  // ── 4. Fetch a real parcel for deposit scenario ────────────
  let parcelId = null;
  const parcelsRes = http.get(
    `${MONO}/api/v1/parcels?limit=1`,
    authHdrs(adminToken),
  );
  if (parcelsRes.status === 200) {
    const body = JSON.parse(parcelsRes.body);
    if (body.data && body.data.length > 0) {
      parcelId = body.data[0].id;
    }
  }

  // ── 5. Validate minimum viable setup ───────────────────────
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `[setup] Done in ${elapsed}s: ${users.length}/${UCNT} users, parcel=${parcelId || 'synthetic'}`,
  );

  if (users.length < MIN_USERS) {
    fail(
      `Only ${users.length} users provisioned (min ${MIN_USERS}). ` +
        'Start backend with NODE_ENV=loadtest to relax rate limits, ' +
        'or set -e REUSE_PREFIX=<prefix> to reuse existing users.',
    );
  }

  if (!REUSE_PREFIX) {
    console.log(
      `[setup] To reuse these users next run: -e REUSE_PREFIX=${prefix}`,
    );
  }

  return {
    users,
    adminToken,
    auctionId: AID,
    parcelId,
    requiredDeposit: auction.requiredDeposit || '10000.00',
    currentPrice: auction.currentPrice || '100000.00',
  };
}

// ── User provisioning strategies ─────────────────────────────

function createNewUsers(prefix) {
  console.log(`[setup] Creating ${UCNT} users (prefix=${prefix})...`);
  const users = [];
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 10;

  for (let i = 0; i < UCNT; i++) {
    const email = `${prefix}-${i}@test.nettapu.com`;

    // Try register
    const result = tryRegister(email);

    if (result.token) {
      users.push({ email, token: result.token });
      consecutiveFailures = 0;
      setupUsersCreated.add(1);
    } else if (result.retry) {
      // 429 rate limited — backoff and retry same index
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.warn(
          `[setup] ${MAX_CONSECUTIVE_FAILURES} consecutive rate limits. ` +
            `Stopping user creation at ${users.length}/${UCNT}. ` +
            'Hint: start backend with NODE_ENV=loadtest',
        );
        break;
      }
      backoffSleep(consecutiveFailures, 2, 30);
      i--; // retry this index
      continue;
    } else {
      // Registration failed (409 conflict, etc.) — try login
      const loginResult = tryLogin(email);
      if (loginResult.token) {
        users.push({ email, token: loginResult.token });
        consecutiveFailures = 0;
        setupUsersReused.add(1);
      } else if (loginResult.retry) {
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.warn(`[setup] Login also rate-limited. Stopping at ${users.length}/${UCNT}.`);
          break;
        }
        backoffSleep(consecutiveFailures, 2, 30);
        i--;
        continue;
      } else {
        setupUsersFailed.add(1);
        consecutiveFailures = 0; // non-429 failure, don't escalate backoff
      }
    }

    // Progress log every 50 users
    if ((users.length % 50 === 0) && users.length > 0) {
      console.log(`[setup] ${users.length}/${UCNT} users ready`);
    }
  }

  return users;
}

function reuseExistingUsers(prefix) {
  console.log(`[setup] Reusing users with prefix=${prefix}, logging in...`);
  const users = [];
  let consecutiveFailures = 0;

  for (let i = 0; i < UCNT; i++) {
    const email = `${prefix}-${i}@test.nettapu.com`;
    const result = tryLogin(email);

    if (result.token) {
      users.push({ email, token: result.token });
      consecutiveFailures = 0;
      setupUsersReused.add(1);
    } else if (result.retry) {
      consecutiveFailures++;
      if (consecutiveFailures >= 10) {
        console.warn(`[setup] Login rate-limited. Got ${users.length} users.`);
        break;
      }
      backoffSleep(consecutiveFailures, 2, 30);
      i--;
      continue;
    } else {
      // User doesn't exist — try register as fallback
      const regResult = tryRegister(email);
      if (regResult.token) {
        users.push({ email, token: regResult.token });
        setupUsersCreated.add(1);
      } else if (regResult.retry) {
        consecutiveFailures++;
        backoffSleep(consecutiveFailures, 2, 30);
        i--;
        continue;
      } else {
        setupUsersFailed.add(1);
      }
      consecutiveFailures = 0;
    }

    if ((users.length % 50 === 0) && users.length > 0) {
      console.log(`[setup] ${users.length}/${UCNT} users ready`);
    }
  }

  return users;
}

// Returns { token: string|null, retry: boolean }
function tryRegister(email) {
  const res = http.post(
    `${MONO}/api/v1/auth/register`,
    JSON.stringify({
      email,
      password: USER_PASSWORD,
      firstName: 'LT',
      lastName: email.split('@')[0].split('-').pop(),
    }),
    JSON_HDRS,
  );

  if (res.status === 201 || res.status === 200) {
    const body = JSON.parse(res.body);
    return { token: body.accessToken, retry: false };
  }
  if (res.status === 429) {
    return { token: null, retry: true };
  }
  // 409 conflict (already exists) or other error
  return { token: null, retry: false };
}

// Returns { token: string|null, retry: boolean }
function tryLogin(email) {
  const res = http.post(
    `${MONO}/api/v1/auth/login`,
    JSON.stringify({ email, password: USER_PASSWORD }),
    JSON_HDRS,
  );

  if (res.status === 200) {
    const body = JSON.parse(res.body);
    return { token: body.accessToken, retry: false };
  }
  if (res.status === 429) {
    return { token: null, retry: true };
  }
  return { token: null, retry: false };
}

// ─────────────────────────────────────────────────────────────
// Scenario 1: 200 Concurrent Bidders (REST)
// ─────────────────────────────────────────────────────────────

export function bidderScenario(data) {
  const user = data.users[exec.vu.idInTest % data.users.length];
  if (!user) { sleep(1); return; }

  const iter = exec.vu.iterationInScenario;
  const idempotencyKey = `bid-${exec.vu.idInTest}-${iter}-${Date.now()}`;
  const basePrice = parseFloat(data.currentPrice);
  const increment = 1000 + Math.floor(Math.random() * 9000) + iter * 100;
  const bidAmount = (basePrice + increment).toFixed(2);

  const t0 = Date.now();
  const res = http.post(
    `${ACSVC}/api/v1/auctions/bids`,
    JSON.stringify({
      auctionId: data.auctionId,
      amount: bidAmount,
      idempotencyKey,
    }),
    authHdrs(user.token),
  );
  const latencyMs = Date.now() - t0;

  httpErrRate.add(res.status >= 500);
  bidLatency.add(latencyMs);

  if (res.status === 201) {
    bidAcceptedTotal.add(1);
  } else if ([400, 403, 409, 429].includes(res.status)) {
    bidRejectedTotal.add(1);
  } else {
    bidErrorTotal.add(1);
  }

  check(res, {
    'bid: not 5xx': (r) => r.status < 500,
    'bid: valid response': (r) => [201, 400, 403, 409, 429].includes(r.status),
  });

  sleep(0.3 + Math.random() * 0.7);
}

// ─────────────────────────────────────────────────────────────
// Scenario 2: 50 Concurrent Deposit Payments
// ─────────────────────────────────────────────────────────────

export function depositScenario(data) {
  const userIdx = data.users.length - 1 - (exec.vu.idInTest % data.users.length);
  const user = data.users[userIdx];
  if (!user) { sleep(1); return; }

  const iter = exec.vu.iterationInScenario;
  const idempotencyKey = `dep-${exec.vu.idInTest}-${iter}-${Date.now()}`;
  const parcelId = data.parcelId || makeUUID();

  const res = http.post(
    `${MONO}/api/v1/payments`,
    JSON.stringify({
      parcelId,
      amount: data.requiredDeposit,
      currency: 'TRY',
      paymentMethod: 'credit_card',
      idempotencyKey,
      description: `Load test deposit ${idempotencyKey}`,
      cardToken: 'tok_test_visa_4242',
      buyer: {
        email: user.email,
        firstName: 'LT',
        lastName: 'User',
        ip: '10.0.0.1',
        phone: '5551234567',
        city: 'Istanbul',
        country: 'TR',
        address: 'Test Caddesi 1',
      },
    }),
    authHdrs(user.token),
  );

  httpErrRate.add(res.status >= 500);

  if (res.status === 201) {
    paymentOkTotal.add(1);
    try {
      const body = JSON.parse(res.body);
      if (body.threeDsRedirectUrl || body.threeDsHtmlContent) {
        payment3dsTotal.add(1);
      }
    } catch (_) { /* ignore */ }
  } else if (res.status === 409) {
    paymentOkTotal.add(1); // idempotency hit — not an error
  } else {
    paymentFailTotal.add(1);
  }

  check(res, {
    'payment: not 5xx': (r) => r.status < 500,
    'payment: valid response': (r) => [201, 400, 409, 422].includes(r.status),
  });

  sleep(1 + Math.random() * 2);
}

// ─────────────────────────────────────────────────────────────
// Scenario 3: 20 Admin Reconciliation Triggers
// ─────────────────────────────────────────────────────────────

export function reconScenario(data) {
  group('recon_trigger', function () {
    const res = http.post(
      `${MONO}/api/v1/admin/reconciliation/trigger`,
      null,
      authHdrs(data.adminToken),
    );

    if (res.status === 200) reconOkTotal.add(1);
    else if (res.status === 429) reconLimitTotal.add(1);
    httpErrRate.add(res.status >= 500);

    check(res, {
      'recon trigger: not 5xx': (r) => r.status < 500,
      'recon trigger: 200 or 429': (r) => r.status === 200 || r.status === 429,
    });
  });

  group('recon_report', function () {
    const t0 = Date.now();
    const res = http.get(
      `${MONO}/api/v1/admin/reconciliation?olderThanMinutes=5&limit=50`,
      authHdrs(data.adminToken),
    );
    reconReportMs.add(Date.now() - t0);
    httpErrRate.add(res.status >= 500);

    check(res, {
      'recon report: 200': (r) => r.status === 200,
      'recon report: valid shape': (r) => {
        try {
          const b = JSON.parse(r.body);
          return typeof b.generatedAt === 'string' && Array.isArray(b.stalePendingPayments);
        } catch (_) { return false; }
      },
    });
  });

  group('finance_summary', function () {
    const res = http.get(
      `${ACSVC}/api/v1/auctions/admin/finance/summary`,
      authHdrs(data.adminToken),
    );
    httpErrRate.add(res.status >= 500);
    check(res, { 'finance summary: 200': (r) => r.status === 200 });
  });

  group('settlements_list', function () {
    const res = http.get(
      `${ACSVC}/api/v1/auctions/admin/settlements?limit=20`,
      authHdrs(data.adminToken),
    );
    httpErrRate.add(res.status >= 500);
    check(res, { 'settlements: not 5xx': (r) => r.status < 500 });
  });

  // Rate limit: 2 triggers/60s. Sleep to stay near the limit.
  sleep(25 + Math.random() * 10);
}

// ─────────────────────────────────────────────────────────────
// Scenario 4: WebSocket Connection Churn
// ─────────────────────────────────────────────────────────────
// Socket.IO v4 wire protocol (over raw WebSocket):
//   Engine.IO: 0=OPEN, 2=PING, 3=PONG, 4=MESSAGE
//   Socket.IO: 0=CONNECT, 2=EVENT, 4=CONNECT_ERROR
//   Combined: "42" = Engine.IO MESSAGE + Socket.IO EVENT
// ─────────────────────────────────────────────────────────────

export function wsChurnScenario(data) {
  const user = data.users[exec.vu.idInTest % data.users.length];
  if (!user) { sleep(1); return; }

  const connectStart = Date.now();
  let phase = 'handshake';

  const res = ws.connect(
    `${WS_URL}/ws/auction/?EIO=4&transport=websocket`,
    {},
    function (socket) {
      socket.on('open', function () {
        wsConnectedTotal.add(1);
      });

      socket.on('message', function (msg) {
        wsMsgTotal.add(1);

        // Engine.IO OPEN
        if (msg.charAt(0) === '0' && phase === 'handshake') {
          socket.send('40' + JSON.stringify({ token: user.token }));
          return;
        }

        // Socket.IO CONNECT ACK
        if (msg.substring(0, 2) === '40' && phase === 'handshake') {
          phase = 'connected';
          wsConnectMs.add(Date.now() - connectStart);

          // Join auction room
          socket.send(
            '42' + JSON.stringify(['join_auction', { auctionId: data.auctionId }]),
          );
          phase = 'joined';

          // 50% chance: place a bid via WS
          if (Math.random() > 0.5) {
            socket.setTimeout(function () {
              const key = `wsbid-${exec.vu.idInTest}-${Date.now()}`;
              const base = parseFloat(data.currentPrice);
              const amount = (base + 2000 + Math.floor(Math.random() * 10000)).toFixed(2);
              socket.send(
                '42' + JSON.stringify([
                  'place_bid',
                  { auctionId: data.auctionId, amount, idempotencyKey: key },
                ]),
              );
              wsBidViaWsTotal.add(1);
            }, 1000 + Math.floor(Math.random() * 2000));
          }

          // Leave + disconnect after 2-7s
          const stayMs = 2000 + Math.floor(Math.random() * 5000);
          socket.setTimeout(function () {
            socket.send(
              '42' + JSON.stringify(['leave_auction', { auctionId: data.auctionId }]),
            );
            phase = 'leaving';
            socket.setTimeout(function () { socket.close(); }, 300);
          }, stayMs);

          return;
        }

        // Engine.IO PING → PONG
        if (msg === '2') { socket.send('3'); return; }

        // Socket.IO CONNECT_ERROR
        if (msg.substring(0, 2) === '44') {
          wsDroppedTotal.add(1);
          phase = 'error';
          socket.close();
          return;
        }
      });

      socket.on('error', function () { wsDroppedTotal.add(1); });
      socket.on('close', function () { /* counted elsewhere */ });
    },
  );

  check(res, { 'ws: upgrade 101': (r) => r && r.status === 101 });

  sleep(0.5 + Math.random());
  wsReconnectTotal.add(1);
}

// ── Teardown ─────────────────────────────────────────────────

export function teardown(data) {
  console.log('────────────────────────────────────────────────');
  console.log('Load test complete.');
  console.log(`  Users provisioned: ${data.users.length}`);
  console.log(`  Auction: ${data.auctionId}`);
  console.log('');
  console.log('Cleanup:');
  console.log(`  DELETE FROM auth.users WHERE email LIKE '${REUSE_PREFIX || 'lt-'}%@test.nettapu.com';`);
  console.log('────────────────────────────────────────────────');
}
