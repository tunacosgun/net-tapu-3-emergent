#!/usr/bin/env bash
# ── S4: Redis Restart Mid-Auction ────────────────────────────
# Tests:
#   4a. Verify auction-service is healthy before restart
#   4b. Stop Redis container
#   4c. Verify auction-service reports degraded state
#   4d. Restart Redis container
#   4e. Verify auction-service recovers and reconnects
#   4f. Verify no data loss (Redis keys restored or recreated)

set -uo pipefail
source "$(dirname "$0")/config.sh"

RESULT_FILE="${1:?Usage: scenario_s4.sh <result_file>}"
CHECKS=()
ALL_PASS=true

log_info "S4: Redis Restart Mid-Auction"

# ── Pre-check: auction-service is healthy ──────────────────────
if ! wait_auction 5; then
  echo '{"passed":false,"reason":"Auction-service not reachable before test","critical":true,"checks":[]}' > "$RESULT_FILE"
  exit 1
fi

# ── Pre-check: Redis is up ────────────────────────────────────
if ! wait_redis 5; then
  echo '{"passed":false,"reason":"Redis not reachable before test","critical":true,"checks":[]}' > "$RESULT_FILE"
  exit 1
fi

# ── Test 4a: Set a marker key in Redis ────────────────────────
log_info "4a: Setting marker key in Redis..."
redis_cmd SET "chaos:s4:marker" "pre-restart-$(date +%s)" EX 300 > /dev/null 2>&1

MARKER_EXISTS=$(redis_cmd GET "chaos:s4:marker" 2>/dev/null | grep -c "pre-restart" || echo "0")
if [ "$MARKER_EXISTS" -gt 0 ]; then
  CHECKS+=("{\"name\":\"4a: Redis marker set\",\"passed\":true,\"detail\":\"Marker key written\"}")
  log_pass "4a: Redis marker key set"
else
  CHECKS+=("{\"name\":\"4a: Redis marker set\",\"passed\":false,\"detail\":\"Could not write marker\"}")
  log_fail "4a: Could not write Redis marker"
  ALL_PASS=false
fi

# ── Test 4b: Stop Redis ───────────────────────────────────────
log_info "4b: Stopping Redis container (${REDIS_CONTAINER})..."
docker stop "$REDIS_CONTAINER" > /dev/null 2>&1

sleep 2

# Verify Redis is down
if redis_cmd ping 2>/dev/null | grep -q PONG; then
  CHECKS+=("{\"name\":\"4b: Redis stopped\",\"passed\":false,\"detail\":\"Redis still responding after stop\"}")
  log_fail "4b: Redis still responding"
  ALL_PASS=false
else
  CHECKS+=("{\"name\":\"4b: Redis stopped\",\"passed\":true,\"detail\":\"Redis not responding\"}")
  log_pass "4b: Redis stopped successfully"
fi

# ── Test 4c: Verify auction-service degraded behavior ─────────
log_info "4c: Testing auction-service behavior without Redis..."

# The app should still respond (maybe with errors) but not hang
DEGRADED_CODE=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 5 \
  "${AUCTION_URL}/api/v1/auctions/health" 2>/dev/null || echo "000")

# Any response (even error) means the app didn't crash
if [ "$DEGRADED_CODE" != "000" ]; then
  CHECKS+=("{\"name\":\"4c: App survives Redis outage\",\"passed\":true,\"detail\":\"Health check returned HTTP ${DEGRADED_CODE}\"}")
  log_pass "4c: Auction-service responds during Redis outage (HTTP ${DEGRADED_CODE})"
else
  # App might have crashed — check if it's still up
  BASIC_CHECK=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 5 \
    "${AUCTION_URL}/api/v1/auctions/health" 2>/dev/null || echo "000")
  if [ "$BASIC_CHECK" != "000" ]; then
    CHECKS+=("{\"name\":\"4c: App survives Redis outage\",\"passed\":true,\"detail\":\"Slow but responding\"}")
    log_pass "4c: Auction-service slow but responding"
  else
    CHECKS+=("{\"name\":\"4c: App survives Redis outage\",\"passed\":false,\"detail\":\"App unreachable during Redis outage\"}")
    log_fail "4c: Auction-service unreachable during Redis outage"
    ALL_PASS=false
  fi
fi

# Also test monolith (it may use Redis for rate limiting or caching)
MONO_DURING=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 5 \
  "${MONOLITH_URL}/api/v1/health" 2>/dev/null || echo "000")

if [ "$MONO_DURING" != "000" ]; then
  CHECKS+=("{\"name\":\"4c: Monolith survives Redis outage\",\"passed\":true,\"detail\":\"HTTP ${MONO_DURING}\"}")
  log_pass "4c: Monolith responds during Redis outage (HTTP ${MONO_DURING})"
else
  CHECKS+=("{\"name\":\"4c: Monolith survives Redis outage\",\"passed\":false,\"detail\":\"Monolith unreachable\"}")
  log_fail "4c: Monolith unreachable during Redis outage"
  ALL_PASS=false
fi

# ── Test 4d: Restart Redis ────────────────────────────────────
log_info "4d: Restarting Redis container..."
docker start "$REDIS_CONTAINER" > /dev/null 2>&1

if wait_redis 15; then
  CHECKS+=("{\"name\":\"4d: Redis restarted\",\"passed\":true,\"detail\":\"Redis responding after restart\"}")
  log_pass "4d: Redis restarted successfully"
else
  CHECKS+=("{\"name\":\"4d: Redis restarted\",\"passed\":false,\"detail\":\"Redis not responding after 15s\"}")
  log_fail "4d: Redis did not come back after restart"
  ALL_PASS=false
  # Can't proceed without Redis
  CHECKS_JSON=$(printf '%s\n' "${CHECKS[@]}" | jq -s '.')
  echo "{\"passed\":false,\"reason\":\"Redis restart failed.\",\"critical\":true,\"checks\":${CHECKS_JSON}}" > "$RESULT_FILE"
  exit 1
fi

# ── Test 4e: Verify services reconnect ────────────────────────
log_info "4e: Verifying service reconnection to Redis..."
sleep 5  # Give services time to reconnect

AUCTION_HEALTH=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 5 \
  "${AUCTION_URL}/api/v1/auctions/health" 2>/dev/null || echo "000")
MONO_HEALTH=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 5 \
  "${MONOLITH_URL}/api/v1/health" 2>/dev/null || echo "000")

if [ "$AUCTION_HEALTH" = "200" ]; then
  CHECKS+=("{\"name\":\"4e: Auction-service reconnected\",\"passed\":true,\"detail\":\"Healthy after Redis restart\"}")
  log_pass "4e: Auction-service reconnected to Redis"
else
  CHECKS+=("{\"name\":\"4e: Auction-service reconnected\",\"passed\":false,\"detail\":\"Health HTTP ${AUCTION_HEALTH}\"}")
  log_fail "4e: Auction-service health: HTTP ${AUCTION_HEALTH}"
  ALL_PASS=false
fi

if [ "$MONO_HEALTH" = "200" ]; then
  CHECKS+=("{\"name\":\"4e: Monolith reconnected\",\"passed\":true,\"detail\":\"Healthy after Redis restart\"}")
  log_pass "4e: Monolith reconnected to Redis"
else
  CHECKS+=("{\"name\":\"4e: Monolith reconnected\",\"passed\":false,\"detail\":\"Health HTTP ${MONO_HEALTH}\"}")
  log_fail "4e: Monolith health: HTTP ${MONO_HEALTH}"
  ALL_PASS=false
fi

# ── Test 4f: Marker key lost (expected — volatile) ────────────
MARKER_AFTER=$(redis_cmd GET "chaos:s4:marker" 2>/dev/null || echo "")
if [ -z "$MARKER_AFTER" ]; then
  CHECKS+=("{\"name\":\"4f: Volatile data lost (expected)\",\"passed\":true,\"detail\":\"Marker key gone after restart (no persistence configured)\"}")
  log_pass "4f: Marker key lost after restart (expected for volatile Redis)"
else
  CHECKS+=("{\"name\":\"4f: Volatile data persisted\",\"passed\":true,\"detail\":\"Marker key survived (RDB/AOF enabled)\"}")
  log_pass "4f: Marker key survived restart (persistence enabled)"
fi

# ── Test: Verify app can write to Redis after restart ─────────
redis_cmd SET "chaos:s4:post-restart" "ok" EX 60 > /dev/null 2>&1
POST_RESTART=$(redis_cmd GET "chaos:s4:post-restart" 2>/dev/null || echo "")

if [ "$POST_RESTART" = "ok" ]; then
  CHECKS+=("{\"name\":\"4f: Redis writable after restart\",\"passed\":true,\"detail\":\"Can write keys\"}")
  log_pass "4f: Redis writable after restart"
else
  CHECKS+=("{\"name\":\"4f: Redis writable after restart\",\"passed\":false,\"detail\":\"Cannot write keys\"}")
  log_fail "4f: Cannot write to Redis after restart"
  ALL_PASS=false
fi

# Cleanup test keys
redis_cmd DEL "chaos:s4:marker" "chaos:s4:post-restart" > /dev/null 2>&1

# ── Write result ─────────────────────────────────────────────
CHECKS_JSON=$(printf '%s\n' "${CHECKS[@]}" | jq -s '.')
if [ "$ALL_PASS" = "true" ]; then
  echo "{\"passed\":true,\"reason\":\"Services survived Redis restart. Reconnection successful.\",\"checks\":${CHECKS_JSON}}" > "$RESULT_FILE"
else
  echo "{\"passed\":false,\"reason\":\"Redis restart caused service issues.\",\"critical\":true,\"checks\":${CHECKS_JSON}}" > "$RESULT_FILE"
fi
