#!/usr/bin/env bash
# ── S3: Callback Duplication & Replay Attack Simulation ───────
# Tests:
#   3a. Duplicate callbacks — only first should process
#   3b. Amount tampering — must reject
#   3c. Token mismatch (iyzico) — must reject
#   3d. Fake payment ID — must not crash

set -uo pipefail
source "$(dirname "$0")/config.sh"

RESULT_FILE="${1:?Usage: scenario_s3.sh <result_file>}"
CHECKS=()
ALL_PASS=true

log_info "S3: Callback Duplication & Replay Attack"

# ── Setup: Create a payment and force it to awaiting_3ds ─────
log_info "Creating test payment..."
RESP=$(curl -sf -X POST "${MONOLITH_URL}/api/v1/payments" \
  -H "Authorization: Bearer ${CHAOS_USER_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"parcelId\": \"${CHAOS_PARCEL_ID}\",
    \"amount\": \"500.00\",
    \"paymentMethod\": \"credit_card\",
    \"idempotencyKey\": \"${CHAOS_PREFIX}-s3-main\"
  }" 2>/dev/null)
PAYMENT_ID=$(echo "$RESP" | jq -r '.id // empty')

if [ -z "$PAYMENT_ID" ]; then
  echo '{"passed":false,"reason":"Failed to create test payment","critical":true,"checks":[]}' > "$RESULT_FILE"
  exit 1
fi

# Force to awaiting_3ds with known token
psql_app -c "
  UPDATE payments.payments
  SET status = 'awaiting_3ds',
      pos_transaction_token = 'chaos-token-s3',
      three_ds_initiated_at = now() - INTERVAL '1 minute'
  WHERE id = '${PAYMENT_ID}';
" > /dev/null 2>&1

log_info "Payment ${PAYMENT_ID} set to awaiting_3ds"

# ── Capture baseline rejection metrics ───────────────────────
BEFORE_REJECTIONS=$(curl -sf "${MONOLITH_URL}/metrics" 2>/dev/null \
  | grep '^nettapu_callback_rejected_total' | awk '{sum+=$2} END {print sum+0}')

# ── Test 3a: Send 10 duplicate callbacks ─────────────────────
log_info "3a: Sending 10 duplicate PayTR callbacks..."

CALLBACK_RESULTS=()
for i in $(seq 1 10); do
  HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" \
    -X POST "${MONOLITH_URL}/api/v1/payments/pos-callback/paytr" \
    -H 'Content-Type: application/json' \
    -d "{\"merchant_oid\":\"${PAYMENT_ID}\",\"status\":\"success\",\"total_amount\":\"50000\"}" \
    2>/dev/null || echo "000")
  CALLBACK_RESULTS+=("$HTTP_CODE")
done

# Verify: exactly 1 POS transaction for this payment
sleep 1
POS_TX_COUNT=$(psql_app -c "SELECT count(*) FROM payments.pos_transactions WHERE payment_id = '${PAYMENT_ID}';" 2>/dev/null | tr -d ' ')
PAYMENT_STATUS=$(psql_app -c "SELECT status FROM payments.payments WHERE id = '${PAYMENT_ID}';" 2>/dev/null | tr -d ' ')

if [ "${POS_TX_COUNT:-0}" -eq 1 ]; then
  CHECKS+=("{\"name\":\"3a: No duplicate POS transactions\",\"passed\":true,\"detail\":\"Exactly 1 POS TX after 10 callbacks\"}")
  log_pass "3a: Exactly 1 POS transaction (idempotent)"
else
  CHECKS+=("{\"name\":\"3a: No duplicate POS transactions\",\"passed\":false,\"detail\":\"Expected 1, got ${POS_TX_COUNT}\"}")
  log_fail "3a: Expected 1 POS TX, got ${POS_TX_COUNT}"
  ALL_PASS=false
fi

if [ "$PAYMENT_STATUS" = "provisioned" ]; then
  CHECKS+=("{\"name\":\"3a: Payment provisioned\",\"passed\":true,\"detail\":\"Status: provisioned after callback\"}")
  log_pass "3a: Payment status is provisioned"
else
  CHECKS+=("{\"name\":\"3a: Payment provisioned\",\"passed\":false,\"detail\":\"Status: ${PAYMENT_STATUS}\"}")
  log_fail "3a: Payment status is ${PAYMENT_STATUS}, expected provisioned"
  ALL_PASS=false
fi

# ── Test 3b: Amount tampering ────────────────────────────────
log_info "3b: Sending callback with tampered amount..."

# Create a new payment for this test
RESP2=$(curl -sf -X POST "${MONOLITH_URL}/api/v1/payments" \
  -H "Authorization: Bearer ${CHAOS_USER_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"parcelId\": \"${CHAOS_PARCEL_ID}\",
    \"amount\": \"750.00\",
    \"paymentMethod\": \"credit_card\",
    \"idempotencyKey\": \"${CHAOS_PREFIX}-s3-tamper\"
  }" 2>/dev/null)
PID_TAMPER=$(echo "$RESP2" | jq -r '.id // empty')

if [ -n "$PID_TAMPER" ]; then
  psql_app -c "
    UPDATE payments.payments
    SET status = 'awaiting_3ds',
        pos_transaction_token = 'chaos-token-tamper',
        three_ds_initiated_at = now() - INTERVAL '1 minute'
    WHERE id = '${PID_TAMPER}';
  " > /dev/null 2>&1

  # Send callback with wrong amount (50000 kuruş = 500 TRY, but payment is 750 TRY = 75000)
  TAMPER_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${MONOLITH_URL}/api/v1/payments/pos-callback/paytr" \
    -H 'Content-Type: application/json' \
    -d "{\"merchant_oid\":\"${PID_TAMPER}\",\"status\":\"success\",\"total_amount\":\"50000\"}" \
    2>/dev/null || echo "000")

  TAMPER_STATUS=$(psql_app -c "SELECT status FROM payments.payments WHERE id = '${PID_TAMPER}';" 2>/dev/null | tr -d ' ')

  if [ "$TAMPER_CODE" = "400" ] && [ "$TAMPER_STATUS" = "awaiting_3ds" ]; then
    CHECKS+=("{\"name\":\"3b: Amount tampering rejected\",\"passed\":true,\"detail\":\"400 returned, payment unchanged\"}")
    log_pass "3b: Amount tampering correctly rejected (400)"
  else
    CHECKS+=("{\"name\":\"3b: Amount tampering rejected\",\"passed\":false,\"detail\":\"HTTP ${TAMPER_CODE}, status ${TAMPER_STATUS}\"}")
    log_fail "3b: Amount tampering not properly rejected"
    ALL_PASS=false
  fi
else
  CHECKS+=("{\"name\":\"3b: Amount tampering rejected\",\"passed\":false,\"detail\":\"Could not create test payment\"}")
  ALL_PASS=false
fi

# ── Test 3c: Token mismatch (iyzico) ────────────────────────
log_info "3c: Sending iyzico callback with wrong token..."

RESP3=$(curl -sf -X POST "${MONOLITH_URL}/api/v1/payments" \
  -H "Authorization: Bearer ${CHAOS_USER_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"parcelId\": \"${CHAOS_PARCEL_ID}\",
    \"amount\": \"200.00\",
    \"paymentMethod\": \"credit_card\",
    \"idempotencyKey\": \"${CHAOS_PREFIX}-s3-token\"
  }" 2>/dev/null)
PID_TOKEN=$(echo "$RESP3" | jq -r '.id // empty')

if [ -n "$PID_TOKEN" ]; then
  psql_app -c "
    UPDATE payments.payments
    SET status = 'awaiting_3ds',
        pos_transaction_token = 'correct-token-abc',
        three_ds_initiated_at = now() - INTERVAL '1 minute'
    WHERE id = '${PID_TOKEN}';
  " > /dev/null 2>&1

  TOKEN_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${MONOLITH_URL}/api/v1/payments/pos-callback/iyzico" \
    -H 'Content-Type: application/json' \
    -d "{\"paymentId\":\"${PID_TOKEN}\",\"token\":\"wrong-token-xyz\"}" \
    2>/dev/null || echo "000")

  TOKEN_STATUS=$(psql_app -c "SELECT status FROM payments.payments WHERE id = '${PID_TOKEN}';" 2>/dev/null | tr -d ' ')

  if [ "$TOKEN_CODE" = "400" ] && [ "$TOKEN_STATUS" = "awaiting_3ds" ]; then
    CHECKS+=("{\"name\":\"3c: Token mismatch rejected\",\"passed\":true,\"detail\":\"400 returned, payment unchanged\"}")
    log_pass "3c: Token mismatch correctly rejected (400)"
  else
    CHECKS+=("{\"name\":\"3c: Token mismatch rejected\",\"passed\":false,\"detail\":\"HTTP ${TOKEN_CODE}, status ${TOKEN_STATUS}\"}")
    log_fail "3c: Token mismatch not properly rejected"
    ALL_PASS=false
  fi
else
  CHECKS+=("{\"name\":\"3c: Token mismatch rejected\",\"passed\":false,\"detail\":\"Could not create test payment\"}")
  ALL_PASS=false
fi

# ── Test 3d: Fake payment ID ────────────────────────────────
log_info "3d: Sending callback with non-existent payment ID..."
FAKE_CODE=$(curl -sf -o /dev/null -w "%{http_code}" \
  -X POST "${MONOLITH_URL}/api/v1/payments/pos-callback/paytr" \
  -H 'Content-Type: application/json' \
  -d '{"merchant_oid":"00000000-0000-0000-0000-000000000000","status":"success","total_amount":"10000"}' \
  2>/dev/null || echo "000")

# Should return 200 (PayTR expects OK always) — payment silently not found
if [ "$FAKE_CODE" = "200" ] || [ "$FAKE_CODE" = "400" ]; then
  CHECKS+=("{\"name\":\"3d: Fake payment ID handled\",\"passed\":true,\"detail\":\"HTTP ${FAKE_CODE}, no crash\"}")
  log_pass "3d: Fake payment ID handled gracefully (HTTP ${FAKE_CODE})"
else
  CHECKS+=("{\"name\":\"3d: Fake payment ID handled\",\"passed\":false,\"detail\":\"HTTP ${FAKE_CODE}\"}")
  log_fail "3d: Fake payment ID returned HTTP ${FAKE_CODE}"
  ALL_PASS=false
fi

# ── Verify rejection metrics incremented ─────────────────────
AFTER_REJECTIONS=$(curl -sf "${MONOLITH_URL}/metrics" 2>/dev/null \
  | grep '^nettapu_callback_rejected_total' | awk '{sum+=$2} END {print sum+0}')
REJECTION_DELTA=$((AFTER_REJECTIONS - BEFORE_REJECTIONS))

if [ "$REJECTION_DELTA" -ge 2 ]; then
  CHECKS+=("{\"name\":\"Rejection metrics incremented\",\"passed\":true,\"detail\":\"${REJECTION_DELTA} new rejections recorded\"}")
  log_pass "Rejection metrics: +$REJECTION_DELTA"
else
  CHECKS+=("{\"name\":\"Rejection metrics incremented\",\"passed\":false,\"detail\":\"Expected >=2, got ${REJECTION_DELTA}\"}")
  log_fail "Rejection metrics: expected >=2, got $REJECTION_DELTA"
  ALL_PASS=false
fi

# ── Write result ─────────────────────────────────────────────
CHECKS_JSON=$(printf '%s\n' "${CHECKS[@]}" | jq -s '.')
if [ "$ALL_PASS" = "true" ]; then
  echo "{\"passed\":true,\"reason\":\"Callbacks idempotent. Tampered/replayed callbacks rejected. Metrics correct.\",\"checks\":${CHECKS_JSON}}" > "$RESULT_FILE"
else
  echo "{\"passed\":false,\"reason\":\"Callback security or idempotency violation detected.\",\"checks\":${CHECKS_JSON}}" > "$RESULT_FILE"
fi
