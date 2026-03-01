#!/usr/bin/env bash
# ── S2: 3DS Timeout Edge Cases ────────────────────────────────
# Tests:
#   2a. Payment stuck in awaiting_3ds past timeout → reconciler expires it
#   2b. Late callback after expiry → must NOT re-provision
#   2c. Valid callback within window → must provision
#   2d. Multiple payments at different 3DS ages — only stale ones expire

set -uo pipefail
source "$(dirname "$0")/config.sh"

RESULT_FILE="${1:?Usage: scenario_s2.sh <result_file>}"
CHECKS=()
ALL_PASS=true

log_info "S2: 3DS Timeout Edge Cases"

# ── Test 2a: Create payment, age it past timeout, trigger reconciler ──
log_info "2a: Creating stale 3DS payment..."

RESP=$(curl -sf -X POST "${MONOLITH_URL}/api/v1/payments" \
  -H "Authorization: Bearer ${CHAOS_USER_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"parcelId\": \"${CHAOS_PARCEL_ID}\",
    \"amount\": \"300.00\",
    \"paymentMethod\": \"credit_card\",
    \"idempotencyKey\": \"${CHAOS_PREFIX}-s2-stale\"
  }" 2>/dev/null)
PID_STALE=$(echo "$RESP" | jq -r '.id // empty')

if [ -z "$PID_STALE" ]; then
  echo '{"passed":false,"reason":"Failed to create stale 3DS payment","critical":true,"checks":[]}' > "$RESULT_FILE"
  exit 1
fi

# Force to awaiting_3ds with timestamp 25 minutes ago (past 20-min threshold)
psql_app -c "
  UPDATE payments.payments
  SET status = 'awaiting_3ds',
      pos_transaction_token = 'chaos-token-s2-stale',
      three_ds_initiated_at = now() - INTERVAL '25 minutes'
  WHERE id = '${PID_STALE}';
" > /dev/null 2>&1

log_info "Payment ${PID_STALE} aged 25 minutes in awaiting_3ds"

# Trigger reconciliation via API (if endpoint exists) or wait for cron
RECON_CODE=$(curl -sf -o /dev/null -w "%{http_code}" \
  -X POST "${MONOLITH_URL}/api/v1/admin/reconciliation/trigger" \
  -H "Authorization: Bearer ${CHAOS_ADMIN_TOKEN}" \
  2>/dev/null || echo "000")

if [ "$RECON_CODE" != "200" ] && [ "$RECON_CODE" != "201" ]; then
  log_warn "Could not trigger reconciler (HTTP ${RECON_CODE}), waiting 30s for cron..."
  sleep 30
fi

sleep 3

STALE_STATUS=$(psql_app -c "SELECT status FROM payments.payments WHERE id = '${PID_STALE}';" 2>/dev/null | tr -d ' ')

if [ "$STALE_STATUS" = "failed" ]; then
  CHECKS+=("{\"name\":\"2a: Stale 3DS expired by reconciler\",\"passed\":true,\"detail\":\"Status: failed after reconciliation\"}")
  log_pass "2a: Stale 3DS payment correctly expired"
else
  CHECKS+=("{\"name\":\"2a: Stale 3DS expired by reconciler\",\"passed\":false,\"detail\":\"Status: ${STALE_STATUS}, expected failed\"}")
  log_fail "2a: Stale 3DS status is ${STALE_STATUS}, expected failed"
  ALL_PASS=false
fi

# ── Test 2b: Late callback after expiry → must NOT re-provision ──
log_info "2b: Sending late callback on expired payment..."

LATE_CODE=$(curl -sf -o /dev/null -w "%{http_code}" \
  -X POST "${MONOLITH_URL}/api/v1/payments/pos-callback/paytr" \
  -H 'Content-Type: application/json' \
  -d "{\"merchant_oid\":\"${PID_STALE}\",\"status\":\"success\",\"total_amount\":\"30000\"}" \
  2>/dev/null || echo "000")

LATE_STATUS=$(psql_app -c "SELECT status FROM payments.payments WHERE id = '${PID_STALE}';" 2>/dev/null | tr -d ' ')

if [ "$LATE_STATUS" = "failed" ]; then
  CHECKS+=("{\"name\":\"2b: Late callback rejected\",\"passed\":true,\"detail\":\"Status still failed, HTTP ${LATE_CODE}\"}")
  log_pass "2b: Late callback did not re-provision expired payment"
else
  CHECKS+=("{\"name\":\"2b: Late callback rejected\",\"passed\":false,\"detail\":\"Status: ${LATE_STATUS} after late callback\"}")
  log_fail "2b: Late callback changed status to ${LATE_STATUS}"
  ALL_PASS=false
fi

# ── Test 2c: Valid callback within window → must provision ──
log_info "2c: Creating fresh 3DS payment with valid callback..."

RESP2=$(curl -sf -X POST "${MONOLITH_URL}/api/v1/payments" \
  -H "Authorization: Bearer ${CHAOS_USER_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"parcelId\": \"${CHAOS_PARCEL_ID}\",
    \"amount\": \"400.00\",
    \"paymentMethod\": \"credit_card\",
    \"idempotencyKey\": \"${CHAOS_PREFIX}-s2-valid\"
  }" 2>/dev/null)
PID_VALID=$(echo "$RESP2" | jq -r '.id // empty')

if [ -n "$PID_VALID" ]; then
  # Set to awaiting_3ds with recent timestamp (1 minute ago, well within window)
  psql_app -c "
    UPDATE payments.payments
    SET status = 'awaiting_3ds',
        pos_transaction_token = 'chaos-token-s2-valid',
        three_ds_initiated_at = now() - INTERVAL '1 minute'
    WHERE id = '${PID_VALID}';
  " > /dev/null 2>&1

  VALID_CODE=$(curl -sf -o /dev/null -w "%{http_code}" \
    -X POST "${MONOLITH_URL}/api/v1/payments/pos-callback/paytr" \
    -H 'Content-Type: application/json' \
    -d "{\"merchant_oid\":\"${PID_VALID}\",\"status\":\"success\",\"total_amount\":\"40000\"}" \
    2>/dev/null || echo "000")

  sleep 1
  VALID_STATUS=$(psql_app -c "SELECT status FROM payments.payments WHERE id = '${PID_VALID}';" 2>/dev/null | tr -d ' ')

  if [ "$VALID_STATUS" = "provisioned" ]; then
    CHECKS+=("{\"name\":\"2c: Valid callback provisions\",\"passed\":true,\"detail\":\"Status: provisioned, HTTP ${VALID_CODE}\"}")
    log_pass "2c: Valid callback correctly provisioned payment"
  else
    CHECKS+=("{\"name\":\"2c: Valid callback provisions\",\"passed\":false,\"detail\":\"Status: ${VALID_STATUS}\"}")
    log_fail "2c: Valid callback did not provision, status: ${VALID_STATUS}"
    ALL_PASS=false
  fi
else
  CHECKS+=("{\"name\":\"2c: Valid callback provisions\",\"passed\":false,\"detail\":\"Could not create test payment\"}")
  ALL_PASS=false
fi

# ── Test 2d: Mixed-age payments — only stale ones expire ──
log_info "2d: Creating mixed-age 3DS payments..."

PID_FRESH=""
PID_OLD=""

# Fresh payment (2 minutes old — within window)
RESP3=$(curl -sf -X POST "${MONOLITH_URL}/api/v1/payments" \
  -H "Authorization: Bearer ${CHAOS_USER_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"parcelId\": \"${CHAOS_PARCEL_ID}\",
    \"amount\": \"150.00\",
    \"paymentMethod\": \"credit_card\",
    \"idempotencyKey\": \"${CHAOS_PREFIX}-s2-fresh\"
  }" 2>/dev/null)
PID_FRESH=$(echo "$RESP3" | jq -r '.id // empty')

# Old payment (30 minutes — past window)
RESP4=$(curl -sf -X POST "${MONOLITH_URL}/api/v1/payments" \
  -H "Authorization: Bearer ${CHAOS_USER_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"parcelId\": \"${CHAOS_PARCEL_ID}\",
    \"amount\": \"250.00\",
    \"paymentMethod\": \"credit_card\",
    \"idempotencyKey\": \"${CHAOS_PREFIX}-s2-old\"
  }" 2>/dev/null)
PID_OLD=$(echo "$RESP4" | jq -r '.id // empty')

if [ -n "$PID_FRESH" ] && [ -n "$PID_OLD" ]; then
  psql_app -c "
    UPDATE payments.payments
    SET status = 'awaiting_3ds',
        pos_transaction_token = 'chaos-token-s2-fresh',
        three_ds_initiated_at = now() - INTERVAL '2 minutes'
    WHERE id = '${PID_FRESH}';
    UPDATE payments.payments
    SET status = 'awaiting_3ds',
        pos_transaction_token = 'chaos-token-s2-old',
        three_ds_initiated_at = now() - INTERVAL '30 minutes'
    WHERE id = '${PID_OLD}';
  " > /dev/null 2>&1

  # Trigger reconciliation
  curl -sf -X POST "${MONOLITH_URL}/api/v1/admin/reconciliation/trigger" \
    -H "Authorization: Bearer ${CHAOS_ADMIN_TOKEN}" > /dev/null 2>&1
  sleep 5

  FRESH_STATUS=$(psql_app -c "SELECT status FROM payments.payments WHERE id = '${PID_FRESH}';" 2>/dev/null | tr -d ' ')
  OLD_STATUS=$(psql_app -c "SELECT status FROM payments.payments WHERE id = '${PID_OLD}';" 2>/dev/null | tr -d ' ')

  if [ "$FRESH_STATUS" = "awaiting_3ds" ] && [ "$OLD_STATUS" = "failed" ]; then
    CHECKS+=("{\"name\":\"2d: Selective expiry\",\"passed\":true,\"detail\":\"Fresh: awaiting_3ds, Old: failed\"}")
    log_pass "2d: Only stale payment expired, fresh one preserved"
  else
    CHECKS+=("{\"name\":\"2d: Selective expiry\",\"passed\":false,\"detail\":\"Fresh: ${FRESH_STATUS}, Old: ${OLD_STATUS}\"}")
    log_fail "2d: Fresh=${FRESH_STATUS} Old=${OLD_STATUS}, expected awaiting_3ds/failed"
    ALL_PASS=false
  fi
else
  CHECKS+=("{\"name\":\"2d: Selective expiry\",\"passed\":false,\"detail\":\"Could not create test payments\"}")
  ALL_PASS=false
fi

# ── Write result ─────────────────────────────────────────────
CHECKS_JSON=$(printf '%s\n' "${CHECKS[@]}" | jq -s '.')
if [ "$ALL_PASS" = "true" ]; then
  echo "{\"passed\":true,\"reason\":\"3DS timeouts handled correctly. Stale expired, fresh preserved, late callbacks rejected.\",\"checks\":${CHECKS_JSON}}" > "$RESULT_FILE"
else
  echo "{\"passed\":false,\"reason\":\"3DS timeout handling has issues.\",\"checks\":${CHECKS_JSON}}" > "$RESULT_FILE"
fi
