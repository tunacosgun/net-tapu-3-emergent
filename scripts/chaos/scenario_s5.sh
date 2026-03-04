#!/usr/bin/env bash
# ── S5: Postgres Restart Mid-Transaction ─────────────────────
# Tests:
#   5a. Start a payment flow, then stop Postgres
#   5b. Verify app returns errors (not hang) during outage
#   5c. Restart Postgres, verify services reconnect
#   5d. Verify payment integrity after restart
#   5e. Verify no partial/corrupted transactions

set -uo pipefail
source "$(dirname "$0")/config.sh"

RESULT_FILE="${1:?Usage: scenario_s5.sh <result_file>}"
CHECKS=()
ALL_PASS=true

log_info "S5: Postgres Restart Mid-Transaction"

# ── Pre-check ─────────────────────────────────────────────────
if ! wait_postgres 5; then
  echo '{"passed":false,"reason":"Postgres not reachable before test","critical":true,"checks":[]}' > "$RESULT_FILE"
  exit 1
fi

if ! wait_monolith 5; then
  echo '{"passed":false,"reason":"Monolith not reachable before test","critical":true,"checks":[]}' > "$RESULT_FILE"
  exit 1
fi

# ── Step 1: Create pre-restart payments (baseline) ────────────
log_info "5a: Creating baseline payments before restart..."

PRE_PIDS=()
for i in $(seq 1 3); do
  RESP=$(curl -sf -X POST "${MONOLITH_URL}/api/v1/payments" \
    -H "Authorization: Bearer ${CHAOS_USER_TOKEN}" \
    -H 'Content-Type: application/json' \
    -d "{
      \"parcelId\": \"${CHAOS_PARCEL_ID}\",
      \"amount\": \"100.00\",
      \"paymentMethod\": \"credit_card\",
      \"idempotencyKey\": \"${CHAOS_PREFIX}-s5-pre-${i}\"
    }" 2>/dev/null)
  PID=$(echo "$RESP" | jq -r '.id // empty')
  if [ -n "$PID" ]; then
    PRE_PIDS+=("$PID")
  fi
done

if [ "${#PRE_PIDS[@]}" -eq 3 ]; then
  CHECKS+=("{\"name\":\"5a: Baseline payments created\",\"passed\":true,\"detail\":\"3/3 payments created\"}")
  log_pass "5a: 3 baseline payments created"
else
  CHECKS+=("{\"name\":\"5a: Baseline payments created\",\"passed\":false,\"detail\":\"${#PRE_PIDS[@]}/3 created\"}")
  log_fail "5a: Only ${#PRE_PIDS[@]}/3 baseline payments"
  ALL_PASS=false
fi

# ── Step 2: Stop Postgres ─────────────────────────────────────
log_info "5b: Stopping Postgres container (${PG_CONTAINER})..."
docker stop "$PG_CONTAINER" > /dev/null 2>&1
sleep 2

# Verify Postgres is down
if PGPASSWORD="$DB_PASS" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
  CHECKS+=("{\"name\":\"5b: Postgres stopped\",\"passed\":false,\"detail\":\"Still accepting connections\"}")
  log_fail "5b: Postgres still up after stop"
  ALL_PASS=false
else
  CHECKS+=("{\"name\":\"5b: Postgres stopped\",\"passed\":true,\"detail\":\"Not accepting connections\"}")
  log_pass "5b: Postgres stopped"
fi

# ── Step 3: Attempt API calls during outage ───────────────────
log_info "5b: Sending requests during Postgres outage..."

OUTAGE_RESPONSES=()
for i in $(seq 1 5); do
  HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 5 \
    -X POST "${MONOLITH_URL}/api/v1/payments" \
    -H "Authorization: Bearer ${CHAOS_USER_TOKEN}" \
    -H 'Content-Type: application/json' \
    -d "{
      \"parcelId\": \"${CHAOS_PARCEL_ID}\",
      \"amount\": \"100.00\",
      \"paymentMethod\": \"credit_card\",
      \"idempotencyKey\": \"${CHAOS_PREFIX}-s5-outage-${i}\"
    }" 2>/dev/null || echo "000")
  OUTAGE_RESPONSES+=("$HTTP_CODE")
done

# Count timeouts (000) vs error responses
TIMEOUTS=0
ERRORS_RETURNED=0
for code in "${OUTAGE_RESPONSES[@]}"; do
  if [ "$code" = "000" ]; then
    TIMEOUTS=$((TIMEOUTS + 1))
  else
    ERRORS_RETURNED=$((ERRORS_RETURNED + 1))
  fi
done

# App should return error codes, not timeout indefinitely
if [ "$TIMEOUTS" -lt 5 ]; then
  CHECKS+=("{\"name\":\"5b: App responds during outage\",\"passed\":true,\"detail\":\"${ERRORS_RETURNED} errors, ${TIMEOUTS} timeouts (of 5)\"}")
  log_pass "5b: App returned errors during outage (not all timeouts)"
else
  CHECKS+=("{\"name\":\"5b: App responds during outage\",\"passed\":false,\"detail\":\"All 5 requests timed out\"}")
  log_fail "5b: All requests timed out during Postgres outage"
  ALL_PASS=false
fi

# ── Step 4: Restart Postgres ──────────────────────────────────
log_info "5c: Restarting Postgres container..."
docker start "$PG_CONTAINER" > /dev/null 2>&1

if wait_postgres 30; then
  CHECKS+=("{\"name\":\"5c: Postgres restarted\",\"passed\":true,\"detail\":\"Accepting connections\"}")
  log_pass "5c: Postgres restarted successfully"
else
  CHECKS+=("{\"name\":\"5c: Postgres restarted\",\"passed\":false,\"detail\":\"Not accepting connections after 30s\"}")
  log_fail "5c: Postgres did not restart"
  ALL_PASS=false
  CHECKS_JSON=$(printf '%s\n' "${CHECKS[@]}" | jq -s '.')
  echo "{\"passed\":false,\"reason\":\"Postgres restart failed.\",\"critical\":true,\"checks\":${CHECKS_JSON}}" > "$RESULT_FILE"
  exit 1
fi

# Wait for connection pool to reconnect
sleep 5

# ── Step 5: Verify services reconnect ─────────────────────────
log_info "5c: Verifying service reconnection..."

# Try a few requests to let the pool warm up
for attempt in $(seq 1 3); do
  curl -sf "${MONOLITH_URL}/api/v1/health" > /dev/null 2>&1
  sleep 1
done

MONO_AFTER=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 \
  "${MONOLITH_URL}/api/v1/health" 2>/dev/null || echo "000")

if [ "$MONO_AFTER" = "200" ]; then
  CHECKS+=("{\"name\":\"5c: Monolith reconnected\",\"passed\":true,\"detail\":\"Healthy after Postgres restart\"}")
  log_pass "5c: Monolith reconnected"
else
  CHECKS+=("{\"name\":\"5c: Monolith reconnected\",\"passed\":false,\"detail\":\"Health HTTP ${MONO_AFTER}\"}")
  log_fail "5c: Monolith health: HTTP ${MONO_AFTER}"
  ALL_PASS=false
fi

# ── Step 6: Verify pre-restart payment integrity ──────────────
log_info "5d: Verifying pre-restart payment integrity..."

INTACT_COUNT=0
for pid in "${PRE_PIDS[@]}"; do
  EXISTS=$(psql_app -c "SELECT count(*) FROM payments.payments WHERE id = '${pid}';" 2>/dev/null | tr -d ' ')
  if [ "${EXISTS:-0}" -eq 1 ]; then
    INTACT_COUNT=$((INTACT_COUNT + 1))
  fi
done

if [ "$INTACT_COUNT" -eq "${#PRE_PIDS[@]}" ]; then
  CHECKS+=("{\"name\":\"5d: Pre-restart data intact\",\"passed\":true,\"detail\":\"${INTACT_COUNT}/${#PRE_PIDS[@]} payments found\"}")
  log_pass "5d: All pre-restart payments intact"
else
  CHECKS+=("{\"name\":\"5d: Pre-restart data intact\",\"passed\":false,\"detail\":\"${INTACT_COUNT}/${#PRE_PIDS[@]} found\"}")
  log_fail "5d: Only ${INTACT_COUNT}/${#PRE_PIDS[@]} pre-restart payments found"
  ALL_PASS=false
fi

# ── Step 7: Verify new payments work after restart ────────────
log_info "5d: Creating post-restart payments..."

POST_SUCCESS=0
for i in $(seq 1 3); do
  HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "${MONOLITH_URL}/api/v1/payments" \
    -H "Authorization: Bearer ${CHAOS_USER_TOKEN}" \
    -H 'Content-Type: application/json' \
    -d "{
      \"parcelId\": \"${CHAOS_PARCEL_ID}\",
      \"amount\": \"100.00\",
      \"paymentMethod\": \"credit_card\",
      \"idempotencyKey\": \"${CHAOS_PREFIX}-s5-post-${i}\"
    }" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "201" ]; then
    POST_SUCCESS=$((POST_SUCCESS + 1))
  fi
done

if [ "$POST_SUCCESS" -eq 3 ]; then
  CHECKS+=("{\"name\":\"5d: Post-restart payments work\",\"passed\":true,\"detail\":\"3/3 created successfully\"}")
  log_pass "5d: Post-restart payments work (3/3)"
else
  CHECKS+=("{\"name\":\"5d: Post-restart payments work\",\"passed\":false,\"detail\":\"${POST_SUCCESS}/3 succeeded\"}")
  log_fail "5d: Only ${POST_SUCCESS}/3 post-restart payments"
  ALL_PASS=false
fi

# ── Step 8: Verify no partial transactions ────────────────────
log_info "5e: Checking for partial/corrupted transactions..."

# Check for payments without ledger entries (created during outage)
PARTIAL=$(psql_app -c "
  SELECT count(*) FROM payments.payments p
  LEFT JOIN payments.payment_ledger l ON l.payment_id = p.id
  WHERE p.idempotency_key LIKE '${CHAOS_PREFIX}-s5-outage-%'
    AND p.status NOT IN ('failed')
    AND l.id IS NULL;
" 2>/dev/null | tr -d ' ')

# During-outage payments should either not exist or be in failed state
OUTAGE_CREATED=$(psql_app -c "
  SELECT count(*) FROM payments.payments
  WHERE idempotency_key LIKE '${CHAOS_PREFIX}-s5-outage-%';
" 2>/dev/null | tr -d ' ')

if [ "${PARTIAL:-0}" -eq 0 ]; then
  CHECKS+=("{\"name\":\"5e: No partial transactions\",\"passed\":true,\"detail\":\"${OUTAGE_CREATED} outage payments, none partial\"}")
  log_pass "5e: No partial transactions"
else
  CHECKS+=("{\"name\":\"5e: No partial transactions\",\"passed\":false,\"detail\":\"${PARTIAL} partial transactions detected\"}")
  log_fail "5e: ${PARTIAL} partial transactions"
  ALL_PASS=false
fi

# ── Write result ─────────────────────────────────────────────
CHECKS_JSON=$(printf '%s\n' "${CHECKS[@]}" | jq -s '.')
if [ "$ALL_PASS" = "true" ]; then
  echo "{\"passed\":true,\"reason\":\"Postgres restart handled. Data intact. Services reconnected. No partial transactions.\",\"checks\":${CHECKS_JSON}}" > "$RESULT_FILE"
else
  echo "{\"passed\":false,\"reason\":\"Postgres restart revealed integrity or recovery issues.\",\"critical\":true,\"checks\":${CHECKS_JSON}}" > "$RESULT_FILE"
fi
