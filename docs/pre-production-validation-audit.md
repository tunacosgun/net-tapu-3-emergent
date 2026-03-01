# NetTapu Pre-Production Validation Audit

**Scope:** Payment engine, auth system, state machine, ledger integrity, race conditions
**Target:** `apps/monolith` on `localhost:3000`
**POS Provider:** `mock` (set via `POS_PROVIDER=mock`)
**3DS Threshold:** Amounts > 100 TRY trigger 3DS flow in mock provider

---

## Prerequisites

```bash
# Terminal variables used throughout this document
BASE=http://localhost:3000/api/v1

# 1. Register a test user
curl -s -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "audit@nettapu.com",
    "password": "AuditPass123!",
    "firstName": "Audit",
    "lastName": "User"
  }' | jq .

# 2. Login — capture tokens
LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "audit@nettapu.com",
    "password": "AuditPass123!"
  }')

TOKEN=$(echo "$LOGIN" | jq -r '.accessToken')
REFRESH=$(echo "$LOGIN" | jq -r '.refreshToken')

echo "TOKEN=$TOKEN"
echo "REFRESH=$REFRESH"

# 3. Create an admin user via direct DB insert (bypass app)
# Role 2 = admin in auth.user_roles
psql -U nettapu_app -d nettapu -c "
  INSERT INTO auth.user_roles (user_id, role_id)
  SELECT u.id, 2 FROM auth.users u WHERE u.email = 'audit@nettapu.com'
  ON CONFLICT DO NOTHING;
"

# 4. Re-login to get admin roles in JWT
LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "audit@nettapu.com",
    "password": "AuditPass123!"
  }')
TOKEN=$(echo "$LOGIN" | jq -r '.accessToken')
REFRESH=$(echo "$LOGIN" | jq -r '.refreshToken')

# 5. Generate a stable parcel UUID for test payments
PARCEL_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
echo "PARCEL_ID=$PARCEL_ID"
```

---

## T1 — Idempotency Correctness

### Purpose
Verify that duplicate `POST /payments` requests with the same `idempotencyKey` return the original payment without creating a second row, a second POS call, or a second ledger entry.

### Test

```bash
IDEMP_KEY="idem-t1-$(date +%s)"

# First request — creates payment
R1=$(curl -s -w "\n%{http_code}" -X POST "$BASE/payments" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"parcelId\": \"$PARCEL_ID\",
    \"amount\": \"250.00\",
    \"paymentMethod\": \"credit_card\",
    \"idempotencyKey\": \"$IDEMP_KEY\"
  }")
HTTP1=$(echo "$R1" | tail -1)
BODY1=$(echo "$R1" | sed '$d')
PID1=$(echo "$BODY1" | jq -r '.id')

echo "Request 1: HTTP $HTTP1 — Payment $PID1"

# Second request — identical payload
R2=$(curl -s -w "\n%{http_code}" -X POST "$BASE/payments" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"parcelId\": \"$PARCEL_ID\",
    \"amount\": \"250.00\",
    \"paymentMethod\": \"credit_card\",
    \"idempotencyKey\": \"$IDEMP_KEY\"
  }")
HTTP2=$(echo "$R2" | tail -1)
BODY2=$(echo "$R2" | sed '$d')
PID2=$(echo "$BODY2" | jq -r '.id')

echo "Request 2: HTTP $HTTP2 — Payment $PID2"
```

### Expected Results
| Assertion | Value |
|-----------|-------|
| HTTP 1 | `201` |
| HTTP 2 | `201` |
| `PID1 == PID2` | `true` (same payment ID returned) |

### DB Verification

```sql
-- Exactly ONE payment row for this idempotency key
SELECT count(*) AS payment_count
FROM payments.payments
WHERE idempotency_key = :'idemp_key';
-- Expected: 1

-- Exactly ONE idempotency key row
SELECT count(*) AS key_count
FROM payments.idempotency_keys
WHERE key = :'idemp_key';
-- Expected: 1

-- Exactly ONE payment_initiated ledger entry
SELECT count(*) AS ledger_count
FROM payments.payment_ledger pl
  JOIN payments.payments p ON pl.payment_id = p.id
WHERE p.idempotency_key = :'idemp_key'
  AND pl.event = 'payment_initiated';
-- Expected: 1

-- No duplicate POS transactions
SELECT count(*) AS pos_tx_count
FROM payments.pos_transactions pt
  JOIN payments.payments p ON pt.payment_id = p.id
WHERE p.idempotency_key = :'idemp_key';
-- Expected: 1 (the initial provision, not 2)
```

---

## T2 — Idempotency Key Reuse with Different Parameters (Double-Spend Prevention)

### Purpose
Verify that reusing an `idempotencyKey` with different `amount`/`parcelId` is rejected with `409 Conflict`, preventing parameter substitution attacks.

### Test

```bash
IDEMP_KEY_CONFLICT="idem-t2-$(date +%s)"

# First: create payment for 250 TRY
curl -s -X POST "$BASE/payments" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"parcelId\": \"$PARCEL_ID\",
    \"amount\": \"250.00\",
    \"paymentMethod\": \"credit_card\",
    \"idempotencyKey\": \"$IDEMP_KEY_CONFLICT\"
  }" | jq '{id, status}'

# Second: same key, different amount (attacker tries 50 TRY)
R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/payments" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"parcelId\": \"$PARCEL_ID\",
    \"amount\": \"50.00\",
    \"paymentMethod\": \"credit_card\",
    \"idempotencyKey\": \"$IDEMP_KEY_CONFLICT\"
  }")

HTTP=$(echo "$R" | tail -1)
MSG=$(echo "$R" | sed '$d' | jq -r '.message')
echo "HTTP: $HTTP — Message: $MSG"
```

### Expected Results
| Assertion | Value |
|-----------|-------|
| HTTP | `409` |
| Message | `Idempotency key already used with different parameters` |

### DB Verification

```sql
-- Payment amount is STILL 250.00 (not overwritten to 50.00)
SELECT amount
FROM payments.payments
WHERE idempotency_key = :'idemp_key';
-- Expected: 250.00

-- Request hash in idempotency_keys reflects original params
SELECT request_hash
FROM payments.idempotency_keys
WHERE key = :'idemp_key';
-- Expected: SHA256 of {parcelId, amount: "250.00", currency: undefined, paymentMethod: "credit_card"}
```

---

## T3 — Unauthorized Access Protection

### Purpose
Verify that protected endpoints reject requests without JWT, with invalid JWT, and enforce role-based access control.

### Test 3a: No Token

```bash
curl -s -w "\n%{http_code}" -X POST "$BASE/payments" \
  -H 'Content-Type: application/json' \
  -d "{
    \"parcelId\": \"$PARCEL_ID\",
    \"amount\": \"100.00\",
    \"paymentMethod\": \"credit_card\",
    \"idempotencyKey\": \"no-auth-$(date +%s)\"
  }"
```

**Expected:** `401`

### Test 3b: Forged/Garbage Token

```bash
curl -s -w "\n%{http_code}" -X POST "$BASE/payments" \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtlLWlkIiwiZW1haWwiOiJhdHRhY2tlckBleGFtcGxlLmNvbSIsInJvbGVzIjpbImFkbWluIl19.invalidsignature' \
  -H 'Content-Type: application/json' \
  -d "{
    \"parcelId\": \"$PARCEL_ID\",
    \"amount\": \"100.00\",
    \"paymentMethod\": \"credit_card\",
    \"idempotencyKey\": \"forged-$(date +%s)\"
  }"
```

**Expected:** `401` (signature verification fails)

### Test 3c: Wrong Algorithm (alg=none)

```bash
# Construct a token with alg: none (JWT bypass attempt)
HEADER=$(echo -n '{"alg":"none","typ":"JWT"}' | base64 | tr -d '=')
PAYLOAD=$(echo -n '{"sub":"fake-id","email":"attacker@test.com","roles":["admin"]}' | base64 | tr -d '=')
FORGED="${HEADER}.${PAYLOAD}."

curl -s -w "\n%{http_code}" -X GET "$BASE/payments" \
  -H "Authorization: Bearer $FORGED"
```

**Expected:** `401` (JwtStrategy enforces `algorithms: ['HS256']`)

### Test 3d: Non-Admin Accessing Admin Endpoint

```bash
# Register a plain user (no admin role)
curl -s -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "regular@nettapu.com",
    "password": "RegularPass123!",
    "firstName": "Regular",
    "lastName": "User"
  }'

REG_TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email": "regular@nettapu.com", "password": "RegularPass123!"}' \
  | jq -r '.accessToken')

# Attempt to trigger reconciliation (admin-only)
curl -s -w "\n%{http_code}" -X POST "$BASE/admin/reconciliation/trigger" \
  -H "Authorization: Bearer $REG_TOKEN"
```

**Expected:** `403` (RolesGuard blocks non-admin)

### Test 3e: Cross-User Payment Access

```bash
# Create a payment as the audit user
CROSS_PID=$(curl -s -X POST "$BASE/payments" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"parcelId\": \"$PARCEL_ID\",
    \"amount\": \"50.00\",
    \"paymentMethod\": \"credit_card\",
    \"idempotencyKey\": \"cross-user-$(date +%s)\"
  }" | jq -r '.id')

# Regular user tries to read it
curl -s -w "\n%{http_code}" -X GET "$BASE/payments/$CROSS_PID" \
  -H "Authorization: Bearer $REG_TOKEN"
```

**Expected:** `403` (`payment.userId !== user.sub` and user has no admin role)

---

## T4 — JWT Expiration Handling

### Purpose
Verify that expired JWT tokens are rejected and that refresh token rotation works correctly, including revocation on reuse.

### Test 4a: Expired Access Token

```bash
# Decode the token to show expiration
echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq '{exp: .exp, iss: .iss, aud: .aud}'

# Wait for token to expire (JWT_ACCESS_EXPIRATION, default 15m)
# OR: manually craft an expired token for immediate testing.
# For production validation, set JWT_ACCESS_EXPIRATION=5s temporarily,
# login, wait 6 seconds, then:

sleep 6

curl -s -w "\n%{http_code}" -X GET "$BASE/payments" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** `401` (`ignoreExpiration: false` in JwtStrategy)

### Test 4b: Refresh Token Rotation

```bash
# Use the refresh token
ROTATED=$(curl -s -X POST "$BASE/auth/refresh" \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\": \"$REFRESH\"}")

NEW_TOKEN=$(echo "$ROTATED" | jq -r '.accessToken')
NEW_REFRESH=$(echo "$ROTATED" | jq -r '.refreshToken')

echo "New access token received: $([ -n "$NEW_TOKEN" ] && echo 'yes' || echo 'no')"
echo "New refresh token received: $([ -n "$NEW_REFRESH" ] && echo 'yes' || echo 'no')"

# Verify new access token works
curl -s -w "\n%{http_code}" -X GET "$BASE/payments" \
  -H "Authorization: Bearer $NEW_TOKEN" | tail -1
```

**Expected:** New token pair issued, new access token returns `200`.

### Test 4c: Refresh Token Reuse Detection

```bash
# Attempt to reuse the OLD refresh token (already rotated in 4b)
R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/refresh" \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\": \"$REFRESH\"}")

HTTP=$(echo "$R" | tail -1)
echo "Reuse attempt: HTTP $HTTP"
```

**Expected:** `401` (old token's `revoked_at` is set; reuse triggers revocation of all user sessions)

### DB Verification

```sql
-- Old refresh token should be revoked
SELECT id, revoked_at IS NOT NULL AS is_revoked
FROM auth.refresh_tokens
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'audit@nettapu.com')
ORDER BY created_at DESC;
-- Expected: all tokens revoked after reuse detection
```

---

## T5 — 3DS Callback State Transition

### Purpose
Verify the full 3DS lifecycle: `pending` -> `awaiting_3ds` -> `provisioned`, including callback token and amount verification.

### Test 5a: Initiate 3DS Payment (amount > 100)

```bash
IDEMP_3DS="idem-3ds-$(date +%s)"

R=$(curl -s -X POST "$BASE/payments" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"parcelId\": \"$PARCEL_ID\",
    \"amount\": \"500.00\",
    \"paymentMethod\": \"credit_card\",
    \"idempotencyKey\": \"$IDEMP_3DS\"
  }")

PID_3DS=$(echo "$R" | jq -r '.id')
STATUS=$(echo "$R" | jq -r '.status')
POS_TOKEN=$(echo "$R" | jq -r '.posTransactionToken')
THREE_DS_HTML=$(echo "$R" | jq -r '.threeDsHtmlContent')

echo "Payment: $PID_3DS"
echo "Status: $STATUS"
echo "POS Token: $POS_TOKEN"
echo "3DS HTML present: $([ "$THREE_DS_HTML" != 'null' ] && echo 'yes' || echo 'no')"
```

**Expected:**

| Field | Value |
|-------|-------|
| status | `awaiting_3ds` |
| posTransactionToken | `mock_3ds_{paymentId}_{timestamp}` |
| threeDsHtmlContent | non-null HTML form |

### Test 5b: Simulate Valid POS Callback

```bash
# Mock provider callback with correct token and amount (50000 kuruş = 500.00 TRY)
curl -s -w "\n%{http_code}" -X POST "$BASE/payments/pos-callback/paytr" \
  -H 'Content-Type: application/json' \
  -d "{
    \"merchant_oid\": \"$PID_3DS\",
    \"status\": \"success\",
    \"total_amount\": \"50000\",
    \"pos_transaction_token\": \"$POS_TOKEN\"
  }"
```

**Expected:** `200` with body `OK`

### DB Verification After Callback

```sql
-- Payment transitioned to provisioned
SELECT id, status, pos_transaction_token, callback_received_at
FROM payments.payments
WHERE id = :'pid_3ds';
-- Expected: status = 'provisioned', callback_received_at IS NOT NULL

-- Ledger has complete 3DS lifecycle
SELECT event, metadata
FROM payments.payment_ledger
WHERE payment_id = :'pid_3ds'
ORDER BY created_at;
-- Expected rows (in order):
--   payment_initiated
--   three_ds_initiated      (metadata contains posTransactionToken)
--   three_ds_completed      (metadata contains posReference, callerIp)
--   payment_provisioned     (metadata contains posReference)

-- POS transaction recorded
SELECT provider, status, callback_ip, callback_payload
FROM payments.pos_transactions
WHERE payment_id = :'pid_3ds'
  AND callback_payload IS NOT NULL;
-- Expected: status = 'provisioned', callback_ip = '127.0.0.1' or '::1'
```

### Test 5c: Callback Replay (Idempotency)

```bash
# Send the exact same callback again
R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/payments/pos-callback/paytr" \
  -H 'Content-Type: application/json' \
  -d "{
    \"merchant_oid\": \"$PID_3DS\",
    \"status\": \"success\",
    \"total_amount\": \"50000\",
    \"pos_transaction_token\": \"$POS_TOKEN\"
  }")

HTTP=$(echo "$R" | tail -1)
echo "Replay: HTTP $HTTP"
```

**Expected:** `200` (callback silently ignored — status is no longer `awaiting_3ds`)

```sql
-- Still exactly 4 ledger entries (no duplicates from replay)
SELECT count(*)
FROM payments.payment_ledger
WHERE payment_id = :'pid_3ds';
-- Expected: 4
```

### Test 5d: Callback with Tampered Amount

```bash
IDEMP_TAMPER="idem-tamper-$(date +%s)"

# Create new 3DS payment
R=$(curl -s -X POST "$BASE/payments" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"parcelId\": \"$PARCEL_ID\",
    \"amount\": \"750.00\",
    \"paymentMethod\": \"credit_card\",
    \"idempotencyKey\": \"$IDEMP_TAMPER\"
  }")

PID_TAMPER=$(echo "$R" | jq -r '.id')
TOK_TAMPER=$(echo "$R" | jq -r '.posTransactionToken')

# Send callback with wrong amount (10000 kuruş = 100 TRY, expected 75000)
R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/payments/pos-callback/paytr" \
  -H 'Content-Type: application/json' \
  -d "{
    \"merchant_oid\": \"$PID_TAMPER\",
    \"status\": \"success\",
    \"total_amount\": \"10000\",
    \"pos_transaction_token\": \"$TOK_TAMPER\"
  }")

HTTP=$(echo "$R" | tail -1)
echo "Tampered amount: HTTP $HTTP"
```

**Expected:** `400` (BadRequestException: `Callback amount does not match payment`)

### Test 5e: Callback with Missing Amount Field

```bash
IDEMP_NOAMT="idem-noamt-$(date +%s)"

R=$(curl -s -X POST "$BASE/payments" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"parcelId\": \"$PARCEL_ID\",
    \"amount\": \"300.00\",
    \"paymentMethod\": \"credit_card\",
    \"idempotencyKey\": \"$IDEMP_NOAMT\"
  }")

PID_NOAMT=$(echo "$R" | jq -r '.id')
TOK_NOAMT=$(echo "$R" | jq -r '.posTransactionToken')

# Callback omitting total_amount entirely
R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/payments/pos-callback/paytr" \
  -H 'Content-Type: application/json' \
  -d "{
    \"merchant_oid\": \"$PID_NOAMT\",
    \"status\": \"success\",
    \"pos_transaction_token\": \"$TOK_NOAMT\"
  }")

HTTP=$(echo "$R" | tail -1)
echo "Missing amount: HTTP $HTTP"
```

**Expected:** `400` (amount mismatch — missing field now treated as tampered)

### Test 5f: Callback with Wrong Token

```bash
IDEMP_BADTOK="idem-badtok-$(date +%s)"

R=$(curl -s -X POST "$BASE/payments" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"parcelId\": \"$PARCEL_ID\",
    \"amount\": \"400.00\",
    \"paymentMethod\": \"credit_card\",
    \"idempotencyKey\": \"$IDEMP_BADTOK\"
  }")

PID_BADTOK=$(echo "$R" | jq -r '.id')

# Send callback with fabricated token
R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/payments/pos-callback/paytr" \
  -H 'Content-Type: application/json' \
  -d "{
    \"merchant_oid\": \"$PID_BADTOK\",
    \"status\": \"success\",
    \"total_amount\": \"40000\",
    \"pos_transaction_token\": \"forged_token_attack\"
  }")

HTTP=$(echo "$R" | tail -1)
echo "Wrong token: HTTP $HTTP"
```

**Expected:** `400` (token mismatch — service rejects mismatched `posTransactionToken`)

### DB Verification for T5d/e/f

```sql
-- All three payments MUST still be in awaiting_3ds (NOT provisioned)
SELECT id, status
FROM payments.payments
WHERE idempotency_key IN (:'idemp_tamper', :'idemp_noamt', :'idemp_badtok');
-- Expected: all status = 'awaiting_3ds'

-- No three_ds_completed or payment_provisioned entries for tampered payments
SELECT p.idempotency_key, pl.event
FROM payments.payment_ledger pl
  JOIN payments.payments p ON pl.payment_id = p.id
WHERE p.idempotency_key IN (:'idemp_tamper', :'idemp_noamt', :'idemp_badtok')
  AND pl.event IN ('three_ds_completed', 'payment_provisioned');
-- Expected: 0 rows
```

---

## T6 — Ledger Integrity

### Purpose
Verify the append-only constraint on `payment_ledger`: no rows can be updated or deleted, ensuring audit trail immutability.

### Test 6a: Attempt UPDATE on Ledger

```sql
-- Get any ledger entry ID
SELECT id FROM payments.payment_ledger LIMIT 1;
-- Store as :ledger_id

UPDATE payments.payment_ledger
SET amount = '0.01'
WHERE id = :'ledger_id';
```

**Expected:** `ERROR: Table payments.payment_ledger is append-only. UPDATE is prohibited.`

### Test 6b: Attempt DELETE on Ledger

```sql
DELETE FROM payments.payment_ledger
WHERE id = :'ledger_id';
```

**Expected:** `ERROR: Table payments.payment_ledger is append-only. DELETE is prohibited.`

### Test 6c: Ledger Completeness Audit

```sql
-- Every payment must have at least a payment_initiated entry
SELECT p.id, p.status, p.created_at
FROM payments.payments p
WHERE NOT EXISTS (
  SELECT 1 FROM payments.payment_ledger pl
  WHERE pl.payment_id = p.id
    AND pl.event = 'payment_initiated'
);
-- Expected: 0 rows (no orphan payments without ledger init)

-- Every provisioned payment must have payment_provisioned entry
SELECT p.id
FROM payments.payments p
WHERE p.status = 'provisioned'
  AND NOT EXISTS (
    SELECT 1 FROM payments.payment_ledger pl
    WHERE pl.payment_id = p.id
      AND pl.event = 'payment_provisioned'
  );
-- Expected: 0 rows

-- Ledger amount must match payment amount for every entry
SELECT pl.id, pl.amount AS ledger_amount, p.amount AS payment_amount
FROM payments.payment_ledger pl
  JOIN payments.payments p ON pl.payment_id = p.id
WHERE pl.amount != p.amount;
-- Expected: 0 rows (all ledger entries reflect the payment amount)
```

---

## T7 — Race Condition Safety (Parallel Idempotency)

### Purpose
Verify that N simultaneous `POST /payments` requests with the same idempotency key produce exactly one payment, one ledger entry, and one POS transaction — no 500 errors.

### Test

```bash
IDEMP_RACE="idem-race-$(date +%s)"

PAYLOAD="{
  \"parcelId\": \"$PARCEL_ID\",
  \"amount\": \"200.00\",
  \"paymentMethod\": \"credit_card\",
  \"idempotencyKey\": \"$IDEMP_RACE\"
}"

# Fire 10 concurrent requests
for i in $(seq 1 10); do
  curl -s -w "HTTP:%{http_code} " -o /tmp/race_$i.json \
    -X POST "$BASE/payments" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "$PAYLOAD" &
done
wait

echo "--- HTTP Codes ---"
for i in $(seq 1 10); do echo -n "[$i] "; cat /tmp/race_$i.json | jq -r '.id'; done

echo "--- Unique Payment IDs ---"
for i in $(seq 1 10); do cat /tmp/race_$i.json; done | jq -r '.id' | sort -u
```

### Expected Results
| Assertion | Value |
|-----------|-------|
| All HTTP codes | `201` (no 500s) |
| Unique payment IDs | Exactly 1 |

### DB Verification

```sql
SELECT count(*) AS payment_count
FROM payments.payments
WHERE idempotency_key = :'idemp_race';
-- Expected: 1

SELECT count(*) AS ledger_count
FROM payments.payment_ledger pl
  JOIN payments.payments p ON pl.payment_id = p.id
WHERE p.idempotency_key = :'idemp_race'
  AND pl.event = 'payment_initiated';
-- Expected: 1
```

---

## T8 — Invalid Status Transition Protection (DB Trigger)

### Purpose
Verify that the `enforce_payment_status_transition` trigger rejects illegal state transitions at the database layer, independent of application logic.

### Test 8a: provisioned -> pending (backward)

```sql
-- Find a provisioned payment from T5
UPDATE payments.payments
SET status = 'pending'
WHERE id = :'pid_3ds'
  AND status = 'provisioned';
```

**Expected:** `ERROR: Invalid payment status transition for payment {id}: provisioned -> pending`

### Test 8b: pending -> completed (skip provisioned)

```sql
-- Create a raw pending payment for this test
INSERT INTO payments.payments (user_id, amount, status, payment_method, idempotency_key)
SELECT id, 100.00, 'pending', 'credit_card', 'trigger-test-' || gen_random_uuid()
FROM auth.users WHERE email = 'audit@nettapu.com'
RETURNING id;
-- Store as :trigger_pid

UPDATE payments.payments
SET status = 'completed'
WHERE id = :'trigger_pid';
```

**Expected:** `ERROR: Invalid payment status transition for payment {id}: pending -> completed`

### Test 8c: failed -> provisioned (terminal state)

```sql
UPDATE payments.payments
SET status = 'failed'
WHERE id = :'trigger_pid';
-- This succeeds (pending -> failed is valid)

UPDATE payments.payments
SET status = 'provisioned'
WHERE id = :'trigger_pid';
```

**Expected:** `ERROR: Invalid payment status transition for payment {id}: failed -> provisioned`

### Test 8d: Complete valid transition chain via API

```bash
# Use the provisioned payment from T5a
# Capture (provisioned -> completed)
curl -s -w "\n%{http_code}" -X PATCH "$BASE/payments/$PID_3DS/capture" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** `200` — status becomes `completed`

```sql
SELECT status FROM payments.payments WHERE id = :'pid_3ds';
-- Expected: completed

-- Verify full chain in ledger
SELECT event FROM payments.payment_ledger
WHERE payment_id = :'pid_3ds'
ORDER BY created_at;
-- Expected sequence:
--   payment_initiated
--   three_ds_initiated
--   three_ds_completed
--   payment_provisioned
--   payment_captured
```

### Full State Machine Reference

```
pending ──┬── awaiting_3ds ──┬── provisioned ──┬── completed ──┬── refunded
          │                  │                 │               │
          ├── provisioned    ├── failed        ├── cancelled   └── partially_refunded ── refunded
          │                  │                 │
          └── failed         └── (terminal)    └── (terminal)

Terminal states (no outbound): failed, cancelled, refunded
```

---

## T9 — Reconciliation Safety

### Purpose
Verify that the reconciliation worker correctly identifies stale payments, uses advisory locking for distributed safety, and writes paired ledger entries.

### Test 9a: Admin Reconciliation Report

```bash
curl -s -X GET "$BASE/admin/reconciliation?olderThanMinutes=0" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Expected:** JSON with `generatedAt`, `thresholdMinutes`, `stalePendingPayments[]`, `stalePendingRefunds[]`

### Test 9b: Manual Trigger

```bash
R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/admin/reconciliation/trigger" \
  -H "Authorization: Bearer $TOKEN")

HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
echo "HTTP: $HTTP — Body: $BODY"
```

**Expected:** `200` with `{"triggered": true}`

### Test 9c: Rate Limit on Trigger (2 req/60s)

```bash
# Second request immediately
R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/admin/reconciliation/trigger" \
  -H "Authorization: Bearer $TOKEN")
HTTP2=$(echo "$R" | tail -1)

# Third request — should be rate-limited
R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/admin/reconciliation/trigger" \
  -H "Authorization: Bearer $TOKEN")
HTTP3=$(echo "$R" | tail -1)

echo "2nd: $HTTP2 — 3rd: $HTTP3"
```

**Expected:** 3rd request returns `429` (throttle: 2 req/60s)

### Test 9d: Stale 3DS Payment Expiration

```bash
# Create a payment that will be stuck in awaiting_3ds
IDEMP_STALE="idem-stale-$(date +%s)"

R=$(curl -s -X POST "$BASE/payments" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"parcelId\": \"$PARCEL_ID\",
    \"amount\": \"600.00\",
    \"paymentMethod\": \"credit_card\",
    \"idempotencyKey\": \"$IDEMP_STALE\"
  }")

PID_STALE=$(echo "$R" | jq -r '.id')
echo "Stale payment: $PID_STALE (status: awaiting_3ds)"
```

```sql
-- Artificially age the 3DS initiation to make it stale (> 15 min)
UPDATE payments.payments
SET three_ds_initiated_at = NOW() - INTERVAL '20 minutes'
WHERE id = :'pid_stale';
```

```bash
# Trigger reconciliation
curl -s -X POST "$BASE/admin/reconciliation/trigger" \
  -H "Authorization: Bearer $TOKEN"
```

### DB Verification After Reconciliation

```sql
-- Payment should now be 'failed' (expired by reconciliation worker)
SELECT status FROM payments.payments WHERE id = :'pid_stale';
-- Expected: failed

-- Reconciliation ledger entries (always in pairs)
SELECT event, metadata->>'resolution' AS resolution
FROM payments.payment_ledger
WHERE payment_id = :'pid_stale'
  AND event IN ('reconciliation_mismatch', 'reconciliation_resolved')
ORDER BY created_at;
-- Expected:
--   reconciliation_mismatch    | marked_failed
--   reconciliation_resolved    | (resolved_by: reconciliation_worker)

-- Reconciliation run recorded
SELECT id, payments_checked, mismatches_found, mismatches_resolved, errors, completed_at
FROM payments.reconciliation_runs
ORDER BY started_at DESC
LIMIT 1;
-- Expected: completed_at IS NOT NULL, mismatches_found >= 1, errors = 0

-- Advisory lock released
SELECT NOT EXISTS (
  SELECT 1 FROM pg_locks
  WHERE locktype = 'advisory'
    AND objid = hashtext('nettapu_reconciliation_tick')
) AS lock_released;
-- Expected: true
```

---

## T10 — Forged Callback Signature Rejection

### Purpose
Verify that a completely fabricated callback (unknown token, not issued by POS) is rejected at the signature verification layer.

### Test

```bash
R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/payments/pos-callback/paytr" \
  -H 'Content-Type: application/json' \
  -d "{
    \"merchant_oid\": \"00000000-0000-0000-0000-000000000000\",
    \"status\": \"success\",
    \"total_amount\": \"99999\",
    \"pos_transaction_token\": \"completely_forged_token\"
  }")

HTTP=$(echo "$R" | tail -1)
echo "Forged callback: HTTP $HTTP"
```

**Expected:** `400` (mock gateway `verifyCallback` rejects unknown tokens)

```sql
-- No payment was created or modified
SELECT count(*) FROM payments.payments
WHERE id = '00000000-0000-0000-0000-000000000000';
-- Expected: 0
```

---

## Summary Matrix

| Test | Category | Expected HTTP | DB Invariant |
|------|----------|--------------|--------------|
| T1 | Idempotency | 201 + 201 (same ID) | 1 payment, 1 ledger init, 1 POS TX |
| T2 | Double-spend prevention | 409 | Original amount preserved |
| T3a | No auth | 401 | No row created |
| T3b | Forged JWT | 401 | No row created |
| T3c | alg:none bypass | 401 | No row created |
| T3d | Role escalation | 403 | No action taken |
| T3e | Cross-user access | 403 | No data leaked |
| T4a | Expired JWT | 401 | — |
| T4b | Token refresh | 200 | New token pair, old revoked |
| T4c | Refresh reuse | 401 | All sessions revoked |
| T5a | 3DS initiation | 201 | status=awaiting_3ds, token set |
| T5b | Valid callback | 200 | status=provisioned, 4 ledger entries |
| T5c | Callback replay | 200 | No duplicate ledger entries |
| T5d | Amount tamper | 400 | status=awaiting_3ds (unchanged) |
| T5e | Missing amount | 400 | status=awaiting_3ds (unchanged) |
| T5f | Wrong token | 400 | status=awaiting_3ds (unchanged) |
| T6a | Ledger UPDATE | SQL ERROR | Row unchanged |
| T6b | Ledger DELETE | SQL ERROR | Row preserved |
| T6c | Ledger audit | — | 0 orphans, 0 mismatches |
| T7 | Race condition (10x) | All 201 | 1 payment, 1 ledger, 1 POS TX |
| T8a | Backward transition | SQL ERROR | Status unchanged |
| T8b | Skip transition | SQL ERROR | Status unchanged |
| T8c | Terminal escape | SQL ERROR | Status unchanged |
| T8d | Valid capture | 200 | status=completed |
| T9a | Recon report | 200 | — |
| T9b | Manual trigger | 200 | Run recorded |
| T9c | Trigger rate limit | 429 | — |
| T9d | Stale 3DS expiry | 200 | status=failed, paired ledger entries |
| T10 | Forged callback | 400 | No mutation |
