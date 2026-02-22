import { check, sleep, fail } from 'k6';
import { Counter, Trend, Rate, Gauge } from 'k6/metrics';
import ws from 'k6/ws';

/**
 * NetTapu — WebSocket Load Test (k6 native)
 *
 * Simulates 1000 listeners + 50 bidders on live auctions.
 * Uses k6 built-in WebSocket support (no external dependencies).
 *
 * NOTE: The auction gateway uses Socket.IO (which layers on top of WebSocket).
 * k6's native ws module speaks raw WebSocket. We use the Socket.IO protocol:
 *   - Connect: send "40" (Socket.IO CONNECT to default namespace)
 *   - Emit: send '42["event_name",{...}]'
 *   - Server messages arrive as '42["event_name",{...}]'
 *
 * Usage:
 *   k6 run \
 *     --env WS_URL=ws://localhost:3001 \
 *     --env TEST_TOKEN=<jwt> \
 *     --env AUCTION_ID=<uuid> \
 *     --env LISTENERS=1000 \
 *     --env BIDDERS=50 \
 *     --out json=load-tests/results/ws-load.json \
 *     load-tests/k6-ws-load.js
 *
 * Via nginx:
 *   k6 run \
 *     --env WS_URL=ws://localhost:80 \
 *     --env TEST_TOKEN=<jwt> \
 *     --env AUCTION_ID=<uuid> \
 *     load-tests/k6-ws-load.js
 */

// ── Metrics ────────────────────────────────────────────────────
const wsConnectTime = new Trend('ws_connect_time', true);
const bidRoundTrip = new Trend('bid_round_trip_ms', true);
const bidsAccepted = new Counter('bids_accepted');
const bidsRejected = new Counter('bids_rejected');
const bidsSent = new Counter('bids_sent');
const wsErrors = new Counter('ws_errors');
const messagesReceived = new Counter('messages_received');
const connectionSuccess = new Rate('ws_connect_success');
const activeConnections = new Gauge('ws_active_connections');

// ── Config ─────────────────────────────────────────────────────
const WS_BASE = __ENV.WS_URL || 'ws://localhost:3001';
const TEST_TOKEN = __ENV.TEST_TOKEN || '';
const AUCTION_ID = __ENV.AUCTION_ID || '';
const LISTENERS = parseInt(__ENV.LISTENERS || '1000', 10);
const BIDDERS = parseInt(__ENV.BIDDERS || '50', 10);
const TEST_DURATION = __ENV.DURATION || '120s';
const BID_INTERVAL_MS = parseInt(__ENV.BID_INTERVAL || '2000', 10);

// Socket.IO handshake: initial HTTP polling then upgrade to WebSocket
// k6 ws module connects directly to the WebSocket transport
const WS_URL = `${WS_BASE}/ws/auction/?EIO=4&transport=websocket&token=${TEST_TOKEN}`;

if (__VU === 0) {
  if (!TEST_TOKEN) console.error('FATAL: --env TEST_TOKEN=<jwt> required');
  if (!AUCTION_ID) console.error('FATAL: --env AUCTION_ID=<uuid> required');
  console.log(`WebSocket load test: ${LISTENERS} listeners + ${BIDDERS} bidders`);
  console.log(`Auction: ${AUCTION_ID}`);
  console.log(`WS URL: ${WS_BASE}/ws/auction/`);
  console.log(`Bid interval: ${BID_INTERVAL_MS}ms`);
}

// ── Options ────────────────────────────────────────────────────
export const options = {
  scenarios: {
    listeners: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: Math.ceil(LISTENERS * 0.2) },
        { duration: '15s', target: Math.ceil(LISTENERS * 0.5) },
        { duration: '15s', target: LISTENERS },
        { duration: TEST_DURATION, target: LISTENERS },
        { duration: '10s', target: 0 },
      ],
      exec: 'listener',
    },
    bidders: {
      executor: 'ramping-vus',
      startVUs: 0,
      startTime: '20s', // let listeners connect first
      stages: [
        { duration: '10s', target: Math.ceil(BIDDERS * 0.5) },
        { duration: '10s', target: BIDDERS },
        { duration: TEST_DURATION, target: BIDDERS },
        { duration: '10s', target: 0 },
      ],
      exec: 'bidder',
    },
  },
  thresholds: {
    ws_connect_success: ['rate>0.95'],
    ws_connect_time: ['p(95)<5000'],
    bid_round_trip_ms: ['p(95)<500', 'p(99)<1000'],
    ws_errors: ['count<100'],
  },
};

// ── Socket.IO Protocol Helpers ─────────────────────────────────
function sioEmit(socket, event, data) {
  // Socket.IO packet type 42 = EVENT
  const payload = JSON.stringify([event, data]);
  socket.send(`42${payload}`);
}

function parseSioMessage(raw) {
  // Handle Socket.IO packet types:
  // "0" = CONNECT ack from server (Engine.IO)
  // "40" = Socket.IO CONNECT ack
  // "42[...]" = Socket.IO EVENT
  // "2" = PING, respond with "3" PONG
  if (raw === '2') return { type: 'ping' };
  if (raw.startsWith('0')) return { type: 'open', data: raw.slice(1) };
  if (raw === '40') return { type: 'connect' };
  if (raw.startsWith('42')) {
    try {
      const parsed = JSON.parse(raw.slice(2));
      return { type: 'event', event: parsed[0], data: parsed[1] };
    } catch (_) {
      return { type: 'unknown', raw };
    }
  }
  return { type: 'unknown', raw };
}

// ── Listener scenario ──────────────────────────────────────────
export function listener() {
  const startTime = Date.now();
  let connected = false;
  let joinedAuction = false;
  let stateReceived = false;

  const res = ws.connect(WS_URL, null, function (socket) {
    const connectMs = Date.now() - startTime;
    wsConnectTime.add(connectMs);
    connected = true;
    connectionSuccess.add(1);
    activeConnections.add(1);

    socket.on('message', function (raw) {
      const msg = parseSioMessage(raw);
      messagesReceived.add(1);

      if (msg.type === 'ping') {
        socket.send('3'); // PONG
        return;
      }

      if (msg.type === 'open' || msg.type === 'connect') {
        // Send Socket.IO connect to default namespace
        if (msg.type === 'open') socket.send('40');
        // Join auction room
        sioEmit(socket, 'join_auction', { auctionId: AUCTION_ID });
        joinedAuction = true;
        return;
      }

      if (msg.type === 'event') {
        if (msg.event === 'auction_state') {
          stateReceived = true;
        }
        // Count broadcast events
        if (msg.event === 'bid_accepted') bidsAccepted.add(1);
      }
    });

    socket.on('error', function (e) {
      wsErrors.add(1);
    });

    // Stay connected for the scenario duration
    // k6 ws.connect blocks until socket.close() or timeout
    socket.setTimeout(function () {
      sioEmit(socket, 'leave_auction', { auctionId: AUCTION_ID });
      activeConnections.add(-1);
      socket.close();
    }, parseFloat(TEST_DURATION) * 1000 || 120000);
  });

  if (!connected) {
    connectionSuccess.add(0);
  }

  check(null, {
    'listener connected': () => connected,
    'listener joined auction': () => joinedAuction,
    'listener received state': () => stateReceived,
  });
}

// ── Bidder scenario ────────────────────────────────────────────
export function bidder() {
  const startTime = Date.now();
  let connected = false;
  let bidCount = 0;
  const pendingBids = new Map(); // idempotencyKey → timestamp

  const res = ws.connect(WS_URL, null, function (socket) {
    const connectMs = Date.now() - startTime;
    wsConnectTime.add(connectMs);
    connected = true;
    connectionSuccess.add(1);
    activeConnections.add(1);

    socket.on('message', function (raw) {
      const msg = parseSioMessage(raw);
      messagesReceived.add(1);

      if (msg.type === 'ping') {
        socket.send('3');
        return;
      }

      if (msg.type === 'open' || msg.type === 'connect') {
        if (msg.type === 'open') socket.send('40');
        sioEmit(socket, 'join_auction', { auctionId: AUCTION_ID });
        return;
      }

      if (msg.type === 'event') {
        if (msg.event === 'bid_accepted' && msg.data && msg.data.bid_id) {
          bidsAccepted.add(1);
          // Measure round trip for our bids
          const sentAt = pendingBids.get(msg.data.bid_id);
          if (sentAt) {
            bidRoundTrip.add(Date.now() - sentAt);
            pendingBids.delete(msg.data.bid_id);
          }
        }
        if (msg.event === 'bid_rejected') {
          bidsRejected.add(1);
        }
      }
    });

    socket.on('error', function (e) {
      wsErrors.add(1);
    });

    // Place bids at regular intervals
    socket.setInterval(function () {
      bidCount++;
      const idempotencyKey = `k6-bid-${__VU}-${bidCount}-${Date.now()}`;
      const amount = (100000 + bidCount * 1000 + Math.floor(Math.random() * 500)).toString();

      pendingBids.set(idempotencyKey, Date.now());
      bidsSent.add(1);

      sioEmit(socket, 'place_bid', {
        auctionId: AUCTION_ID,
        amount: amount,
        idempotencyKey: idempotencyKey,
      });
    }, BID_INTERVAL_MS);

    socket.setTimeout(function () {
      sioEmit(socket, 'leave_auction', { auctionId: AUCTION_ID });
      activeConnections.add(-1);
      socket.close();
    }, parseFloat(TEST_DURATION) * 1000 || 120000);
  });

  if (!connected) {
    connectionSuccess.add(0);
  }

  check(null, {
    'bidder connected': () => connected,
    'bidder sent bids': () => bidCount > 0,
  });
}
