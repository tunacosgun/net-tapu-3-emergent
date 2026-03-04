#!/usr/bin/env node
/**
 * WebSocket Load Generator for Chaos Test S10
 *
 * Opens N concurrent WebSocket connections, holds them for a specified
 * duration, counts messages received, and reports results as JSON.
 *
 * Usage:
 *   node ws_load.js --url ws://localhost:3001 --connections 500 --duration 15 --output results.json
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Parse CLI arguments
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i].replace(/^--/, '');
  args[key] = process.argv[i + 1];
}

const WS_URL = args.url || 'ws://localhost:3001';
const TARGET_CONNECTIONS = parseInt(args.connections || '500', 10);
const DURATION_SEC = parseInt(args.duration || '15', 10);
const OUTPUT_FILE = args.output || null;

// Metrics
let connected = 0;
let messagesReceived = 0;
let errors = 0;
let cleanClose = 0;
const sockets = [];

console.log(`WebSocket Load Test: ${TARGET_CONNECTIONS} connections to ${WS_URL} for ${DURATION_SEC}s`);

// Connection phase
let connectionsAttempted = 0;

function openConnection(index) {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(WS_URL, {
        headers: { 'X-Chaos-Test': `s10-${index}` },
        handshakeTimeout: 5000,
      });

      const timeout = setTimeout(() => {
        try { ws.terminate(); } catch {}
        errors++;
        resolve();
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        connected++;
        sockets.push(ws);

        ws.on('message', () => {
          messagesReceived++;
        });

        ws.on('error', () => {
          errors++;
        });

        ws.on('close', () => {
          cleanClose++;
        });

        resolve();
      });

      ws.on('error', () => {
        clearTimeout(timeout);
        errors++;
        resolve();
      });
    } catch (e) {
      errors++;
      resolve();
    }
  });
}

async function run() {
  const startTime = Date.now();

  // Open connections in batches of 50 to avoid overwhelming the server
  const BATCH_SIZE = 50;
  for (let batch = 0; batch < TARGET_CONNECTIONS; batch += BATCH_SIZE) {
    const batchEnd = Math.min(batch + BATCH_SIZE, TARGET_CONNECTIONS);
    const promises = [];
    for (let i = batch; i < batchEnd; i++) {
      promises.push(openConnection(i));
      connectionsAttempted++;
    }
    await Promise.all(promises);

    // Small delay between batches
    if (batchEnd < TARGET_CONNECTIONS) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  const connectTime = Date.now() - startTime;
  console.log(`Connected: ${connected}/${TARGET_CONNECTIONS} in ${connectTime}ms (errors: ${errors})`);

  // Hold connections for the specified duration
  console.log(`Holding connections for ${DURATION_SEC}s...`);
  await new Promise(r => setTimeout(r, DURATION_SEC * 1000));

  console.log(`Messages received during hold: ${messagesReceived}`);

  // Close all connections
  console.log('Closing connections...');
  const closeStart = Date.now();

  const closePromises = sockets.map(ws => new Promise((resolve) => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'chaos-test-done');
        const t = setTimeout(() => {
          try { ws.terminate(); } catch {}
          resolve();
        }, 3000);
        ws.on('close', () => {
          clearTimeout(t);
          resolve();
        });
      } else {
        resolve();
      }
    } catch {
      resolve();
    }
  }));

  await Promise.all(closePromises);
  const closeTime = Date.now() - closeStart;
  console.log(`Closed in ${closeTime}ms. Clean closes: ${cleanClose}`);

  // Write results
  const result = {
    url: WS_URL,
    targetConnections: TARGET_CONNECTIONS,
    connected,
    messagesReceived,
    errors,
    cleanClose,
    connectTimeMs: connectTime,
    holdDurationSec: DURATION_SEC,
    closeTimeMs: closeTime,
    timestamp: new Date().toISOString(),
  };

  if (OUTPUT_FILE) {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
    console.log(`Results written to ${OUTPUT_FILE}`);
  }

  // Also print to stdout for debugging
  console.log(JSON.stringify(result));
  process.exit(0);
}

run().catch((err) => {
  console.error(`Fatal error: ${err.message}`);

  const result = {
    connected: 0,
    messagesReceived: 0,
    errors: TARGET_CONNECTIONS,
    cleanClose: 0,
    error: err.message,
  };

  if (OUTPUT_FILE) {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result));
  }

  process.exit(1);
});
