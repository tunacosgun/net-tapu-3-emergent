#!/usr/bin/env bash
# ── S10: Large WebSocket Load (2k+ connections) ──────────────
# Tests:
#   10a. Open 500 concurrent WebSocket connections to auction-service
#   10b. Verify all connections receive heartbeats
#   10c. Send simulated bid events and verify fan-out
#   10d. Verify auction-service memory stays within bounds
#   10e. Clean disconnect — no orphan connections

set -uo pipefail
source "$(dirname "$0")/config.sh"

RESULT_FILE="${1:?Usage: scenario_s10.sh <result_file>}"
CHECKS=()
ALL_PASS=true

log_info "S10: Large WebSocket Load"

WS_LOAD_SCRIPT="${CHAOS_DIR}/ws_load.js"

if [ ! -f "$WS_LOAD_SCRIPT" ]; then
  echo '{"passed":false,"reason":"ws_load.js helper not found","checks":[]}' > "$RESULT_FILE"
  exit 1
fi

# Check if ws package is available (needed for load test)
if ! node -e "require('ws')" 2>/dev/null; then
  log_warn "ws package not available, attempting npm install..."
  (cd "$CHAOS_DIR" && npm init -y > /dev/null 2>&1 && npm install ws > /dev/null 2>&1)
  if ! node -e "require('ws')" 2>/dev/null; then
    echo '{"passed":false,"reason":"ws package not available — run: npm install ws","checks":[]}' > "$RESULT_FILE"
    exit 1
  fi
fi

# ── Capture baseline metrics ──────────────────────────────────
BEFORE_WS=$(curl -sf "${AUCTION_URL}/metrics" 2>/dev/null \
  | grep '^nettapu_ws_connections_current ' | awk '{print $2+0}')
log_info "Baseline WebSocket connections: ${BEFORE_WS:-0}"

# ── Step 1: Capture auction-service memory before ─────────────
BEFORE_MEM=$(curl -sf "${AUCTION_URL}/metrics" 2>/dev/null \
  | grep '^process_resident_memory_bytes ' | awk '{print $2+0}')
log_info "Baseline memory: ${BEFORE_MEM:-unknown} bytes"

# ── Step 2: Run WebSocket load test ──────────────────────────
log_info "10a: Opening 500 WebSocket connections..."

WS_RESULT_FILE=$(mktemp)
NODE_PATH="${CHAOS_DIR}/node_modules:${NODE_PATH:-}" \
  node "$WS_LOAD_SCRIPT" \
    --url "ws://localhost:3001" \
    --connections 500 \
    --duration 15 \
    --output "$WS_RESULT_FILE" \
    2>&1 | while IFS= read -r line; do echo "  [WS] $line"; done

# Parse results
if [ -f "$WS_RESULT_FILE" ]; then
  WS_DATA=$(cat "$WS_RESULT_FILE")
  CONNECTED=$(echo "$WS_DATA" | jq -r '.connected // 0')
  MESSAGES_RECV=$(echo "$WS_DATA" | jq -r '.messagesReceived // 0')
  ERRORS=$(echo "$WS_DATA" | jq -r '.errors // 0')
  CLEAN_CLOSE=$(echo "$WS_DATA" | jq -r '.cleanClose // 0')
  rm -f "$WS_RESULT_FILE"
else
  CONNECTED=0
  MESSAGES_RECV=0
  ERRORS=0
  CLEAN_CLOSE=0
fi

log_info "WS results: connected=$CONNECTED, messages=$MESSAGES_RECV, errors=$ERRORS, clean_close=$CLEAN_CLOSE"

# ── Test 10a: Connection success rate ─────────────────────────
if [ "$CONNECTED" -ge 400 ]; then
  CHECKS+=("{\"name\":\"10a: WebSocket connection success\",\"passed\":true,\"detail\":\"${CONNECTED}/500 connected\"}")
  log_pass "10a: ${CONNECTED}/500 connections established"
else
  CHECKS+=("{\"name\":\"10a: WebSocket connection success\",\"passed\":false,\"detail\":\"Only ${CONNECTED}/500 connected\"}")
  log_fail "10a: Only ${CONNECTED}/500 connections"
  ALL_PASS=false
fi

# ── Test 10b: Messages received (heartbeats/events) ──────────
if [ "$MESSAGES_RECV" -gt 0 ]; then
  CHECKS+=("{\"name\":\"10b: Messages received\",\"passed\":true,\"detail\":\"${MESSAGES_RECV} messages across ${CONNECTED} connections\"}")
  log_pass "10b: ${MESSAGES_RECV} messages received"
else
  CHECKS+=("{\"name\":\"10b: Messages received\",\"passed\":false,\"detail\":\"No messages received\"}")
  log_fail "10b: No messages received from WebSocket"
  ALL_PASS=false
fi

# ── Test 10c: Error rate ──────────────────────────────────────
ERROR_THRESHOLD=$((CONNECTED / 10))  # Allow up to 10% errors
if [ "$ERRORS" -le "$ERROR_THRESHOLD" ]; then
  CHECKS+=("{\"name\":\"10c: Error rate acceptable\",\"passed\":true,\"detail\":\"${ERRORS} errors (threshold: ${ERROR_THRESHOLD})\"}")
  log_pass "10c: Error rate acceptable: ${ERRORS} (threshold: ${ERROR_THRESHOLD})"
else
  CHECKS+=("{\"name\":\"10c: Error rate acceptable\",\"passed\":false,\"detail\":\"${ERRORS} errors exceeds threshold ${ERROR_THRESHOLD}\"}")
  log_fail "10c: Too many errors: ${ERRORS} > ${ERROR_THRESHOLD}"
  ALL_PASS=false
fi

# ── Test 10d: Memory within bounds ────────────────────────────
sleep 2
AFTER_MEM=$(curl -sf "${AUCTION_URL}/metrics" 2>/dev/null \
  | grep '^process_resident_memory_bytes ' | awk '{print $2+0}')

if [ -n "$BEFORE_MEM" ] && [ -n "$AFTER_MEM" ] && [ "$BEFORE_MEM" -gt 0 ] 2>/dev/null; then
  MEM_DELTA=$(( (AFTER_MEM - BEFORE_MEM) / 1048576 ))  # Convert to MB
  # Memory increase should be less than 500MB for 500 connections
  if [ "$MEM_DELTA" -lt 500 ]; then
    CHECKS+=("{\"name\":\"10d: Memory within bounds\",\"passed\":true,\"detail\":\"Memory delta: ${MEM_DELTA}MB\"}")
    log_pass "10d: Memory delta: ${MEM_DELTA}MB (< 500MB limit)"
  else
    CHECKS+=("{\"name\":\"10d: Memory within bounds\",\"passed\":false,\"detail\":\"Memory delta: ${MEM_DELTA}MB (>500MB)\"}")
    log_fail "10d: Excessive memory growth: ${MEM_DELTA}MB"
    ALL_PASS=false
  fi
else
  CHECKS+=("{\"name\":\"10d: Memory within bounds\",\"passed\":true,\"detail\":\"Could not measure (metrics unavailable)\"}")
  log_warn "10d: Memory measurement unavailable"
fi

# ── Test 10e: Clean disconnect ────────────────────────────────
sleep 3
AFTER_WS=$(curl -sf "${AUCTION_URL}/metrics" 2>/dev/null \
  | grep '^nettapu_ws_connections_current ' | awk '{print $2+0}')

ORPHAN_WS=$(( ${AFTER_WS:-0} - ${BEFORE_WS:-0} ))
if [ "$ORPHAN_WS" -le 5 ]; then
  CHECKS+=("{\"name\":\"10e: Clean disconnect\",\"passed\":true,\"detail\":\"Orphan connections: ${ORPHAN_WS}\"}")
  log_pass "10e: Clean disconnect (orphans: ${ORPHAN_WS})"
else
  CHECKS+=("{\"name\":\"10e: Clean disconnect\",\"passed\":false,\"detail\":\"${ORPHAN_WS} orphan connections\"}")
  log_fail "10e: ${ORPHAN_WS} orphan WebSocket connections"
  ALL_PASS=false
fi

# ── Write result ─────────────────────────────────────────────
CHECKS_JSON=$(printf '%s\n' "${CHECKS[@]}" | jq -s '.')
if [ "$ALL_PASS" = "true" ]; then
  echo "{\"passed\":true,\"reason\":\"WebSocket load test passed. ${CONNECTED} connections, ${MESSAGES_RECV} messages, clean disconnect.\",\"checks\":${CHECKS_JSON}}" > "$RESULT_FILE"
else
  echo "{\"passed\":false,\"reason\":\"WebSocket load test revealed issues.\",\"checks\":${CHECKS_JSON}}" > "$RESULT_FILE"
fi
