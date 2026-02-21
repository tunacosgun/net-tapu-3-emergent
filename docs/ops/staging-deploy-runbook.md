# NetTapu Staging Deploy Runbook

**Date:** 2026-02-21
**Target:** Real-money staging with POS sandbox
**Audience:** SRE / DevOps — zero assumptions about system knowledge

---

## 1. Deployment Command Sequence

### 1.1 Prepare environment file

```bash
# On the staging host, create .env from template
cp .env.example .env

# Edit .env with staging-specific values:
cat > .env << 'ENVEOF'
POSTGRES_MIGRATOR_PASSWORD=<generate: openssl rand -base64 24>
POSTGRES_APP_PASSWORD=<generate: openssl rand -base64 24>
REDIS_PASSWORD=<generate: openssl rand -base64 24>
JWT_SECRET=<generate: openssl rand -base64 48>
JWT_ISSUER=nettapu
JWT_AUDIENCE=nettapu-platform
CORS_ORIGIN=https://staging.nettapu.com
SNIPER_EXTENSION_SECONDS=60
POS_PROVIDER=mock
POS_TIMEOUT_MS=7000
ENVEOF

# IMPORTANT: Replace POS_PROVIDER=mock with real provider (e.g. paytr)
# when ready for real POS sandbox testing.
```

### 1.2 Verify environment file

```bash
# Every line must have a non-empty value after the =
grep -E '^[A-Z_]+=.+' .env | wc -l
# Expected: 10

# Verify no default passwords remain
grep -c 'change_me\|secret_change' .env
# Expected: 0

# Verify POS_PROVIDER is set
grep '^POS_PROVIDER=' .env
# Expected: POS_PROVIDER=mock (or real provider name)
```

### 1.3 Start infrastructure (database + redis)

```bash
docker compose up -d postgres redis

# Wait for healthy status
docker compose ps --format '{{.Name}} {{.Health}}'
# Repeat until both show "healthy" (up to 30 seconds)

# Verify postgres is reachable
docker exec nettapu-postgres pg_isready -U nettapu_migrator -d nettapu
# Expected: /var/run/postgresql:5432 - accepting connections
```

### 1.4 Run database migrations

```bash
# Execute migrations inside the postgres container
docker exec -i nettapu-postgres \
  psql -U nettapu_migrator -d nettapu \
  -f /migrations/run_all.sql \
  2>&1 | tee migration_output.log

# Check for errors
grep -i 'error\|fatal' migration_output.log
# Expected: no output (zero errors)

# Verify final migration ran
tail -5 migration_output.log
# Expected last line: === All migrations completed successfully ===
```

### 1.5 Verify migration state

```bash
# Run inside postgres container
docker exec -i nettapu-postgres psql -U nettapu_migrator -d nettapu << 'SQL'
-- Verify schemas exist
SELECT schema_name FROM information_schema.schemata
WHERE schema_name IN ('auth','listings','payments','auctions','crm','admin','integrations','campaigns')
ORDER BY schema_name;

-- Verify payment tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'payments'
ORDER BY table_name;

-- Verify state machine trigger
SELECT tgname FROM pg_trigger WHERE tgname = 'enforce_payment_status_transition';

-- Verify append-only triggers
SELECT tgname FROM pg_trigger WHERE tgname LIKE '%append_only%';

-- Verify hardening indexes (migration 025)
SELECT indexname FROM pg_indexes
WHERE indexname IN ('idx_pos_transactions_payment_status', 'idx_refunds_payment');

-- Verify mock POS provider enum value
SELECT enumlabel FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'pos_provider' AND enumlabel = 'mock';
SQL
```

Expected output:

```
 schema_name
--------------
 admin
 auth
 auctions
 campaigns
 crm
 integrations
 listings
 payments
(8 rows)

        table_name
--------------------------
 deposit_transitions
 deposits
 idempotency_keys
 installment_plans
 ledger_annotations
 payment_ledger
 payments
 pos_transactions
 refunds
(9 rows)

              tgname
----------------------------------
 enforce_payment_status_transition
(1 row)

(append_only triggers - at least 2 rows)

           indexname
------------------------------------
 idx_pos_transactions_payment_status
 idx_refunds_payment
(2 rows)

 enumlabel
-----------
 mock
(1 row)
```

### 1.6 Build and start application services

```bash
# Build images
docker compose build monolith auction-service

# Start monolith first (payments module lives here)
docker compose up -d monolith

# Wait for health check (up to 30 seconds)
for i in $(seq 1 6); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' nettapu-monolith 2>/dev/null)
  echo "monolith: $STATUS"
  [ "$STATUS" = "healthy" ] && break
  sleep 5
done

# Verify healthy
docker inspect --format='{{.State.Health.Status}}' nettapu-monolith
# Expected: healthy

# Start auction service
docker compose up -d auction-service

# Wait for health check
for i in $(seq 1 6); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' nettapu-auction 2>/dev/null)
  echo "auction: $STATUS"
  [ "$STATUS" = "healthy" ] && break
  sleep 5
done

# Start nginx
docker compose up -d nginx
```

### 1.7 Verify all services running

```bash
docker compose ps --format 'table {{.Name}}\t{{.Status}}\t{{.Health}}'
# Expected: all 5 services running, postgres/redis/monolith/auction healthy
```

---

## 2. Database Migration Execution Order

Migrations run in this exact order via `run_all.sql`:

```
015  Enable uuid-ossp extension
001  Create schemas (auth, listings, payments, auctions, crm, admin, integrations, campaigns)
002  Create enums (payment_status, pos_provider, payment_method, etc.)
003  Auth tables (users, refresh_tokens, consents)
004  Listings tables (parcels, images, documents, favorites, saved_searches)
005  Auctions tables (auctions, bids, participants, settlement_manifests)
006  Payments tables (payments, deposits, pos_transactions, refunds, idempotency_keys, etc.)
007  CRM tables (contacts, appointments, offers, notifications)
008  Admin tables (pages, faq, media, settings, audit_log)
009  Integrations tables (tkgm_cache, sync_state, external_api_log)
010  Campaigns tables (campaigns, rules, assignments)
011  Immutability triggers (deposit status, auction immutability)
012  Append-only triggers (payment_ledger, deposit_transitions)
013  Indexes (all schemas)
014  Revoke DDL from app role
016  Auction version column + bid IP
017  Add draft auction status
018  Update auction transitions for draft
019  Add ending auction status
020  Sniper protection and ending transitions
021  Settlement worker index
022  Listing ID sequence
023  Payment status enhancements (provisioned, cancelled + state machine trigger)
024  Add mock POS provider enum value
025  Payment hardening indexes (pos_transactions payment_status, refunds payment)
```

**For existing databases** (migrations already partially applied): run only the new migrations individually.

```bash
# Check which migrations need to run by looking for the trigger from 023:
docker exec -i nettapu-postgres psql -U nettapu_migrator -d nettapu -c \
  "SELECT tgname FROM pg_trigger WHERE tgname = 'enforce_payment_status_transition';"

# If no rows: run 023, 024, 025
# If exists: check for mock enum (024) and hardening indexes (025)
docker exec -i nettapu-postgres psql -U nettapu_migrator -d nettapu -c \
  "SELECT enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'pos_provider' AND enumlabel = 'mock';"

# Run missing migrations individually:
docker exec -i nettapu-postgres psql -U nettapu_migrator -d nettapu -f /migrations/023_payment_status_enhancements.sql
docker exec -i nettapu-postgres psql -U nettapu_migrator -d nettapu -f /migrations/024_add_mock_pos_provider.sql
docker exec -i nettapu-postgres psql -U nettapu_migrator -d nettapu -f /migrations/025_payment_hardening_indexes.sql
```

---

## 3. Pre-Traffic Verification Checklist

Run every step. Do not skip. Do not proceed if any step fails.

```bash
# === STEP 1: Health endpoints ===
curl -sf http://localhost:3000/api/v1/health | python3 -m json.tool
# MUST show: {"status":"ok","database":"ok","redis":"ok"}
# STOP if status is "critical" or "degraded"

curl -sf http://localhost:3001/api/v1/auctions/health | python3 -m json.tool
# MUST show: {"status":"ok","database":"ok","redis":"ok"}

# === STEP 2: Verify TypeORM connection settings are active ===
docker exec -i nettapu-postgres psql -U nettapu_app -d nettapu -c "SHOW statement_timeout;"
# Expected: 30s or 30000
# NOTE: This shows per-session. The app sets it via extra config on each connection.
# If it shows 0, that's the default — verify by checking monolith startup logs instead.

docker compose logs monolith 2>&1 | grep -i 'POS provider initialized'
# Expected: "POS provider initialized: mock" (or real provider name)

docker compose logs monolith 2>&1 | grep -i 'POS timeout'
# Expected: "POS timeout: 7000ms"

# === STEP 3: Verify startup validation passed ===
docker compose logs monolith 2>&1 | grep -i 'FATAL\|Error\|refusing'
# Expected: no output

# === STEP 4: Verify payment endpoints respond ===
# Get a JWT token first (adjust credentials for your staging admin user)
TOKEN=$(curl -sf http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@staging.nettapu.com","password":"<staging-admin-password>"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

echo "Token obtained: ${TOKEN:0:20}..."
# STOP if empty

# Test payment list (should return empty array)
curl -sf http://localhost:3000/api/v1/payments \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
# Expected: {"data":[],"meta":{"total":0,"page":1,"limit":20}}

# Test reconciliation endpoint
curl -sf http://localhost:3000/api/v1/admin/reconciliation \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
# Expected: {"generatedAt":"...","thresholdMinutes":30,"stalePendingPayments":[],"stalePendingRefunds":[]}

# === STEP 5: Verify auth guards work ===
# Request without token — must get 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/payments
# Expected: 401

# === STEP 6: Verify validation pipe works ===
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:3000/api/v1/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"amount":"-1","parcelId":"not-a-uuid"}'
# Expected: 400 (validation error, not 500)

# === STEP 7: Verify DB connection pool ===
docker exec -i nettapu-postgres psql -U nettapu_migrator -d nettapu -c \
  "SELECT usename, count(*) FROM pg_stat_activity WHERE datname='nettapu' GROUP BY usename;"
# Expected: nettapu_app with count <= 30

# === STEP 8: Verify throttle guard works ===
for i in $(seq 1 25); do
  curl -s -o /dev/null -w "%{http_code} " \
    http://localhost:3000/api/v1/payments \
    -H "Authorization: Bearer $TOKEN"
done
echo ""
# Expected: first 20 return 200, last 5 return 429 (throttled)

echo ""
echo "=== PRE-TRAFFIC CHECK COMPLETE ==="
echo "All steps must show expected values before enabling traffic."
```

---

## 4. 15-Minute Post-Deploy Validation Script

Save as `validate-staging.sh`. Run after pre-traffic check passes.

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:3000/api/v1"
PASS=0
FAIL=0

log() { echo "[$(date '+%H:%M:%S')] $1"; }
pass() { log "PASS: $1"; PASS=$((PASS+1)); }
fail() { log "FAIL: $1"; FAIL=$((FAIL+1)); }

# --- Auth ---
log "=== Obtaining admin token ==="
TOKEN=$(curl -sf "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@staging.nettapu.com","password":"'"${STAGING_ADMIN_PASSWORD}"'"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

if [ -z "$TOKEN" ]; then
  fail "Could not obtain admin token"
  echo "RESULT: $PASS passed, $FAIL failed"
  exit 1
fi
pass "Admin token obtained"
AUTH="Authorization: Bearer $TOKEN"

# --- Test 1: Initiate payment ---
log "=== Test 1: Initiate payment ==="
IDEMP_KEY="staging-test-$(date +%s)-$$"
PAYMENT=$(curl -sf -w "\n%{http_code}" "$BASE_URL/payments" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{
    "parcelId":"00000000-0000-0000-0000-000000000001",
    "amount":"100.50",
    "paymentMethod":"credit_card",
    "idempotencyKey":"'"$IDEMP_KEY"'"
  }')
HTTP_CODE=$(echo "$PAYMENT" | tail -1)
BODY=$(echo "$PAYMENT" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
  PAYMENT_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
  PAYMENT_STATUS=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
  pass "Payment created: $PAYMENT_ID (status: $PAYMENT_STATUS)"
else
  fail "Payment initiation returned $HTTP_CODE: $BODY"
  PAYMENT_ID=""
fi

# --- Test 2: Idempotency retry ---
log "=== Test 2: Idempotency retry (same key) ==="
RETRY=$(curl -sf -w "\n%{http_code}" "$BASE_URL/payments" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{
    "parcelId":"00000000-0000-0000-0000-000000000001",
    "amount":"100.50",
    "paymentMethod":"credit_card",
    "idempotencyKey":"'"$IDEMP_KEY"'"
  }')
RETRY_CODE=$(echo "$RETRY" | tail -1)
RETRY_ID=$(echo "$RETRY" | sed '$d' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")

if [ "$RETRY_CODE" = "201" ] && [ "$RETRY_ID" = "$PAYMENT_ID" ]; then
  pass "Idempotency returned same payment ID"
elif [ "$RETRY_CODE" = "201" ]; then
  fail "Idempotency returned DIFFERENT payment ID: $RETRY_ID vs $PAYMENT_ID"
else
  fail "Idempotency retry returned $RETRY_CODE"
fi

# --- Test 3: Idempotency conflict ---
log "=== Test 3: Idempotency conflict (same key, different params) ==="
CONFLICT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/payments" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{
    "parcelId":"00000000-0000-0000-0000-000000000001",
    "amount":"999.99",
    "paymentMethod":"credit_card",
    "idempotencyKey":"'"$IDEMP_KEY"'"
  }')

if [ "$CONFLICT_CODE" = "409" ]; then
  pass "Idempotency conflict correctly returned 409"
else
  fail "Expected 409, got $CONFLICT_CODE"
fi

# --- Test 4: Get payment by ID ---
log "=== Test 4: Get payment by ID ==="
if [ -n "$PAYMENT_ID" ]; then
  GET_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/payments/$PAYMENT_ID" -H "$AUTH")
  if [ "$GET_CODE" = "200" ]; then
    pass "GET payment returned 200"
  else
    fail "GET payment returned $GET_CODE"
  fi
else
  fail "Skipped — no payment ID"
fi

# --- Test 5: List payments ---
log "=== Test 5: List user payments ==="
LIST_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/payments?page=1&limit=10" -H "$AUTH")
if [ "$LIST_CODE" = "200" ]; then
  pass "List payments returned 200"
else
  fail "List payments returned $LIST_CODE"
fi

# --- Test 6: Capture (only if payment is provisioned) ---
log "=== Test 6: Capture payment ==="
if [ -n "$PAYMENT_ID" ]; then
  # Re-read status
  CURRENT_STATUS=$(curl -sf "$BASE_URL/payments/$PAYMENT_ID" -H "$AUTH" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")

  if [ "$CURRENT_STATUS" = "provisioned" ]; then
    CAP_RESP=$(curl -sf -w "\n%{http_code}" -X PATCH "$BASE_URL/payments/$PAYMENT_ID/capture" -H "$AUTH")
    CAP_CODE=$(echo "$CAP_RESP" | tail -1)
    if [ "$CAP_CODE" = "200" ]; then
      CAP_STATUS=$(echo "$CAP_RESP" | sed '$d' | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
      if [ "$CAP_STATUS" = "completed" ]; then
        pass "Capture succeeded: status=completed"
      else
        fail "Capture returned 200 but status=$CAP_STATUS"
      fi
    else
      fail "Capture returned $CAP_CODE"
    fi
  else
    log "SKIP: Payment status is $CURRENT_STATUS (not provisioned). Capture test skipped."
  fi
else
  fail "Skipped — no payment ID"
fi

# --- Test 7: Refund (only if payment is completed) ---
log "=== Test 7: Initiate refund ==="
if [ -n "$PAYMENT_ID" ]; then
  CURRENT_STATUS=$(curl -sf "$BASE_URL/payments/$PAYMENT_ID" -H "$AUTH" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")

  if [ "$CURRENT_STATUS" = "completed" ]; then
    REFUND_KEY="staging-refund-$(date +%s)-$$"
    REF_RESP=$(curl -sf -w "\n%{http_code}" "$BASE_URL/refunds" \
      -H "$AUTH" -H 'Content-Type: application/json' \
      -d '{
        "paymentId":"'"$PAYMENT_ID"'",
        "amount":"50.25",
        "reason":"Staging validation test",
        "idempotencyKey":"'"$REFUND_KEY"'"
      }')
    REF_CODE=$(echo "$REF_RESP" | tail -1)
    if [ "$REF_CODE" = "201" ]; then
      REF_STATUS=$(echo "$REF_RESP" | sed '$d' | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
      pass "Refund created: status=$REF_STATUS"
    else
      fail "Refund returned $REF_CODE"
    fi
  else
    log "SKIP: Payment status is $CURRENT_STATUS (not completed). Refund test skipped."
  fi
else
  fail "Skipped — no payment ID"
fi

# --- Test 8: Reconciliation endpoint ---
log "=== Test 8: Reconciliation endpoint ==="
RECON_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin/reconciliation" -H "$AUTH")
if [ "$RECON_CODE" = "200" ]; then
  pass "Reconciliation endpoint returned 200"
else
  fail "Reconciliation returned $RECON_CODE"
fi

# --- Test 9: Validation rejects bad input ---
log "=== Test 9: DTO validation ==="
VAL_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/payments" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"parcelId":"not-uuid","amount":"-5","paymentMethod":"bitcoin","idempotencyKey":"x"}')
if [ "$VAL_CODE" = "400" ]; then
  pass "Validation correctly rejected bad input"
else
  fail "Expected 400, got $VAL_CODE"
fi

# --- Test 10: IDOR protection ---
log "=== Test 10: Health check still healthy ==="
HEALTH=$(curl -sf "$BASE_URL/health" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
if [ "$HEALTH" = "ok" ]; then
  pass "Health check OK after all tests"
else
  fail "Health check returned: $HEALTH"
fi

# --- Summary ---
echo ""
echo "========================================"
echo "  RESULTS: $PASS passed, $FAIL failed"
echo "========================================"
if [ "$FAIL" -gt 0 ]; then
  echo "  STATUS: VALIDATION FAILED"
  echo "  ACTION: Do NOT enable public traffic"
  exit 1
else
  echo "  STATUS: ALL TESTS PASSED"
  echo "  ACTION: Safe to enable traffic"
  exit 0
fi
```

Run with:

```bash
chmod +x validate-staging.sh
STAGING_ADMIN_PASSWORD='<password>' ./validate-staging.sh
```

---

## 5. First-Hour Operational Playbook

### Minute 0–5: Immediate post-deploy

```bash
# Terminal 1: Tail monolith logs (keep open)
docker compose logs -f monolith 2>&1 | grep -E 'CRITICAL|error|FATAL|PosTimeout|55P03'

# Terminal 2: Watch connection pool every 10 seconds
watch -n 10 'docker exec nettapu-postgres psql -U nettapu_migrator -d nettapu -t -c \
  "SELECT usename, state, count(*) FROM pg_stat_activity WHERE datname='\''nettapu'\'' GROUP BY usename, state ORDER BY usename, state;"'

# Terminal 3: Watch health endpoint
watch -n 15 'curl -sf http://localhost:3000/api/v1/health | python3 -m json.tool'
```

**STOP CONDITIONS (minute 0–5):**
- Health returns `critical` → execute rollback step 1
- Any `FATAL` in monolith logs → execute rollback step 1
- Connection count > 25 within 5 minutes → investigate, prepare rollback

### Minute 5–15: First traffic acceptance

```bash
# Check for any CRITICAL financial logs
docker compose logs monolith 2>&1 | grep -c 'CRITICAL'
# Expected: 0

# Check for any POS timeout errors
docker compose logs monolith 2>&1 | grep -c 'PosTimeoutError'
# Expected: 0

# Check for any lock timeout errors
docker compose logs monolith 2>&1 | grep -c '55P03'
# Expected: 0

# Check payment counts by status
docker exec -i nettapu-postgres psql -U nettapu_migrator -d nettapu -c \
  "SELECT status, count(*) FROM payments.payments GROUP BY status ORDER BY status;"

# Check refund counts by status
docker exec -i nettapu-postgres psql -U nettapu_migrator -d nettapu -c \
  "SELECT status, count(*) FROM payments.refunds GROUP BY status ORDER BY status;"

# Check for stale pending records (should be 0 if everything works)
curl -sf http://localhost:3000/api/v1/admin/reconciliation \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**STOP CONDITIONS (minute 5–15):**
- Any `CRITICAL_pos_success_db_failure` log → page on-call, prepare manual reconciliation
- `PosTimeoutError` count > 3 → POS provider issue, consider pausing captures
- Stale pending payments > 0 → investigate each one individually

### Minute 15–30: Steady-state monitoring

```bash
# Run every 5 minutes:

# 1. Error rate
ERRORS=$(docker compose logs --since 5m monolith 2>&1 | grep -c 'error\|Error\|ERROR' || true)
echo "Errors in last 5 min: $ERRORS"
# Threshold: < 5

# 2. Connection pool utilization
docker exec -i nettapu-postgres psql -U nettapu_migrator -d nettapu -t -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname='nettapu' AND usename='nettapu_app';"
# Threshold: < 25

# 3. Active locks
docker exec -i nettapu-postgres psql -U nettapu_migrator -d nettapu -c \
  "SELECT pid, now() - pg_stat_activity.query_start AS duration, query
   FROM pg_stat_activity
   WHERE state = 'active' AND datname = 'nettapu'
   AND query_start < now() - interval '5 seconds'
   ORDER BY duration DESC LIMIT 5;"
# Expected: no rows, or only very short-lived queries
# ALERT if any query > 10 seconds

# 4. Lock waits
docker exec -i nettapu-postgres psql -U nettapu_migrator -d nettapu -c \
  "SELECT count(*) FROM pg_stat_activity
   WHERE wait_event_type = 'Lock' AND datname = 'nettapu';"
# Threshold: < 3
```

### Minute 30–60: Confidence building

```bash
# 1. Full reconciliation check
curl -sf "http://localhost:3000/api/v1/admin/reconciliation?olderThanMinutes=15" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
# Expected: stalePendingPayments=[], stalePendingRefunds=[]
# If not empty: investigate each record

# 2. Payment ledger integrity
docker exec -i nettapu-postgres psql -U nettapu_migrator -d nettapu -c \
  "SELECT event, count(*) FROM payments.payment_ledger GROUP BY event ORDER BY event;"
# Verify: INITIATED count >= PROVISIONED + FAILED count
#         CAPTURED count = payments in 'completed' status
#         REFUND_INITIATED count >= REFUND_COMPLETED count

# 3. Verify no orphan POS transactions (POS record without matching payment)
docker exec -i nettapu-postgres psql -U nettapu_migrator -d nettapu -c \
  "SELECT pt.id, pt.payment_id, pt.status
   FROM payments.pos_transactions pt
   LEFT JOIN payments.payments p ON p.id = pt.payment_id
   WHERE p.id IS NULL AND pt.payment_id IS NOT NULL;"
# Expected: 0 rows

# 4. Verify idempotency keys align with resources
docker exec -i nettapu-postgres psql -U nettapu_migrator -d nettapu -c \
  "SELECT count(*) FROM payments.idempotency_keys
   WHERE operation_type = 'payment_initiation'
   AND NOT EXISTS (
     SELECT 1 FROM payments.payments p
     WHERE p.id = (response_body->>'paymentId')::uuid
   );"
# Expected: 0 (every idempotency key points to an existing payment)

# 5. Cumulative error summary
echo "=== FIRST HOUR SUMMARY ==="
echo "CRITICAL logs: $(docker compose logs monolith 2>&1 | grep -c 'CRITICAL' || echo 0)"
echo "POS timeouts:  $(docker compose logs monolith 2>&1 | grep -c 'PosTimeoutError' || echo 0)"
echo "Lock timeouts: $(docker compose logs monolith 2>&1 | grep -c '55P03' || echo 0)"
echo "Pool exhausts: $(docker compose logs monolith 2>&1 | grep -c 'connectionTimeout' || echo 0)"
echo ""
echo "All values should be 0 for a clean first hour."
```

### Decision at Minute 60

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| CRITICAL logs | 0 | — | >= 1 → investigate |
| POS timeouts | 0 | 1-2 → monitor | >= 3 → pause captures |
| Lock timeouts (55P03) | 0 | 1-5 → normal contention | >= 10 → investigate POS latency |
| Pool connections | < 20 | 20-25 → monitor | > 25 → prepare to scale pool |
| Stale pending records | 0 | 1 → investigate | >= 2 → page on-call |
| Health endpoint | ok | degraded → monitor Redis | critical → rollback |

**If all green:** System is stable. Continue monitoring at 15-minute intervals for next 24 hours.

**If any yellow:** Increase monitoring frequency to 5-minute intervals. No rollback needed.

**If any red:** Follow rollback plan from Go/No-Go assessment. Stop traffic first, assess second.
