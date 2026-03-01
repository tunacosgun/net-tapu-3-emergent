# NetTapu Payment Engine — Technical Validation Report

**Date:** 2026-02-26
**Scope:** `apps/monolith` payment module — idempotency, state machine, ledger, 3DS callbacks, concurrency
**Environment:** PostgreSQL 16, Node.js, POS provider: `mock`, Docker
**Methodology:** Direct HTTP + SQL verification against running system

---

## 1. Executive Summary

The payment engine was subjected to 37 discrete assertions across 5 test categories (T1, T5, T7, T8, T9). All assertions passed. The system correctly enforces idempotency under concurrent load, rejects illegal state transitions at the database layer, maintains append-only ledger integrity, and blocks tampered/forged/replayed 3DS callbacks. No data corruption, duplicate charges, or state machine violations were observed.

---

## 2. Architecture Overview

```
POST /api/v1/payments
  → JwtAuthGuard
    → ValidationPipe (whitelist + forbidNonWhitelisted)
      → PaymentService.initiate()
        → Phase 1: Payment + Ledger + IdempotencyKey (single atomic TX)
        → Phase 2: POS initiateProvision() (external, outside TX)
        → Phase 3: Record result under pessimistic lock

POST /api/v1/payments/pos-callback/{paytr|iyzico}
  → No auth guard (signature-verified internally)
    → PosCallbackService.processCallback()
      → verifyCallback() → extract payment ID → pessimistic lock
      → Token check → Amount check → completeProvision() → commit
```

**Key design properties:**
- Idempotency key stored in the same transaction as the payment (no window for phantom keys)
- POS calls occur outside the transaction (external side effect isolated from DB atomicity)
- All status mutations use `FOR UPDATE` pessimistic locking
- Status transitions enforced by a `BEFORE UPDATE` trigger (`enforce_payment_status_transition`)
- `payment_ledger` is append-only (UPDATE/DELETE blocked by triggers)

---

## 3. Idempotency & Concurrency Guarantees

**T1 — Sequential duplicate:** Two identical `POST /payments` requests with the same `idempotencyKey` returned the same payment ID. DB contained exactly 1 payment row, 1 idempotency key, 1 `payment_initiated` ledger entry. No duplicate POS calls.

**T7 — 10 concurrent requests:** All 10 returned HTTP 201 with the identical payment UUID. DB verification: 1 payment, 1 idempotency key, 2 ledger entries (`payment_initiated` + `payment_provisioned`), 1 POS transaction. Zero 500 errors.

**Mechanism:** PostgreSQL unique constraint on `idempotency_key` raises error code `23505` on race collision. The losing transactions catch this, look up the winning payment by idempotency key, verify the request hash matches (SHA-256 of `{parcelId, amount, currency, paymentMethod}`), and return the existing payment. The early return occurs *before* the POS provision call, preventing duplicate external charges.

**Parameter substitution attack (T2 scenario, verified in audit doc):** Reusing an idempotency key with different parameters returns `409 Conflict` with message `Idempotency key already used with different parameters`.

---

## 4. State Machine & DB Trigger Enforcement

**T8 — 5 illegal transitions tested via direct SQL UPDATE:**

| Transition | Result |
|------------|--------|
| `completed → pending` | REJECTED, ROLLBACK |
| `awaiting_3ds → completed` | REJECTED, ROLLBACK |
| `failed → completed` | REJECTED, ROLLBACK |
| `refunded → completed` | REJECTED, ROLLBACK |
| `partially_refunded → pending` | REJECTED, ROLLBACK |

All 5 produced `RAISE EXCEPTION` from `payments.enforce_payment_status_transition()`. All transactions rolled back. Post-attempt `SELECT` confirmed zero status drift.

**Allowed transitions (enforced at DB layer):**

```
pending            → awaiting_3ds | provisioned | failed
awaiting_3ds       → provisioned | failed
provisioned        → completed | cancelled
completed          → refunded | partially_refunded
partially_refunded → refunded
failed / cancelled / refunded → (terminal, no outbound)
```

This is defense-in-depth: application logic enforces the same rules, but the trigger acts as an independent safety net against bugs, direct DB access, or future code regressions.

---

## 5. Ledger Integrity Model

The `payments.payment_ledger` table is protected by two triggers:
- `trg_payment_ledger_no_update` — blocks all `UPDATE` operations
- `trg_payment_ledger_no_delete` — blocks all `DELETE` operations

Both raise exceptions with the table name, operation, row ID, and executing role.

**Observed ledger sequence for a complete 3DS payment (T5a):**

| # | Event | Timestamp |
|---|-------|-----------|
| 1 | `payment_initiated` | T+0ms |
| 2 | `three_ds_initiated` | T+166ms |
| 3 | `three_ds_completed` | T+12.6s (callback arrival) |
| 4 | `payment_provisioned` | T+12.6s (same TX as #3) |

Every payment has a `payment_initiated` entry. Every status change produces a corresponding ledger event. Amounts in ledger entries match the payment amount exactly (verified via `WHERE pl.amount != p.amount` returning 0 rows).

---

## 6. 3DS Callback Security & Replay Protection

Six callback scenarios tested against `POST /api/v1/payments/pos-callback/paytr`:

| Scenario | HTTP | State Change | Mechanism |
|----------|------|-------------|-----------|
| Valid callback (correct token + amount) | 200 | `awaiting_3ds → provisioned` | Normal flow |
| Replay (identical callback resent) | 200 | None | Status guard: `!= awaiting_3ds` → silent return |
| Tampered amount (10000 vs 75000 kuruş) | 400 | None | `checkAmountMismatch()` detects cents difference |
| Missing amount field | 400 | None | Missing field treated as tampered (returns mismatch) |
| Forged token | 400 | None | `verifyCallback()` rejects unknown token at signature layer |
| Fabricated payment ID + token | 400 | None | Signature verification fails before DB lookup |

**Rejection hierarchy (ordered):**
1. Signature verification (`verifyCallback`) — rejects unknown tokens
2. Payment lookup — rejects nonexistent payment IDs
3. Status guard — silently ignores already-processed payments
4. Token match — rejects mismatched `posTransactionToken`
5. Amount match — rejects mismatched or missing amounts
6. Controller re-throws all exceptions (no silent swallow)

**Post-fix verification:** The controller now re-throws all caught exceptions. Token verification applies to all providers (not just iyzico). Missing amount fields are treated as mismatch, not skipped.

---

## 7. Reconciliation Safety

**T9 — Live-tested** with 3 artificially aged `awaiting_3ds` payments (`three_ds_initiated_at` set to NOW() - 20 minutes, exceeding the 15-minute stale threshold).

| Assertion | Result |
|-----------|--------|
| All 3 stale payments transitioned to `failed` | PASS |
| Each payment received paired ledger entries (`reconciliation_mismatch` + `reconciliation_resolved`) | PASS (6 entries total) |
| `reconciliation_mismatch` metadata contains `resolution: marked_failed` | PASS |
| `reconciliation_resolved` metadata contains `resolved_by: reconciliation_worker` | PASS |
| `reconciliation_runs` row created with `errors = 0`, `completed_at IS NOT NULL` | PASS |
| Second trigger found 0 stale payments (already resolved) | PASS |
| Advisory lock released after completion (`pg_locks` check) | PASS |
| 3rd trigger request within 60s returned `429` | PASS |
| No duplicate `reconciliation_runs` rows from rate-limited requests | PASS |

**Verified design properties:**
- Distributed lock via `pg_try_advisory_lock(hashtext('nettapu_reconciliation_tick'))` prevents concurrent runs
- Stale thresholds: pending > 30min, awaiting_3ds > 15min, refunds > 30min
- Resolution writes paired ledger entries (always 1:1 mismatch:resolved per payment)
- Admin trigger endpoint rate-limited to 2 req/60s (ThrottlerException on 3rd request)
- Idempotent: re-running on already-resolved payments produces 0 mismatches

---

## 8. Risk Assessment

| Risk | Severity | Mitigation Status |
|------|----------|-------------------|
| Duplicate POS charges on race condition | Critical | **Mitigated.** 23505 handler exits before POS call. Verified with 10x concurrency. |
| Backward state transition | Critical | **Mitigated.** DB trigger blocks all illegal transitions. Verified with 5 cases. |
| Callback amount tampering | High | **Mitigated.** Cents comparison + missing-field rejection. Verified. |
| Callback token forgery | High | **Mitigated.** Signature verification rejects unknown tokens. Verified. |
| Callback replay / double-processing | High | **Mitigated.** Status guard (`!= awaiting_3ds`) prevents re-execution. Verified. |
| Ledger tampering | High | **Mitigated.** UPDATE/DELETE triggers on `payment_ledger`. |
| Mock POS in production | Critical | **Mitigated.** `main.ts` refuses to start with `POS_PROVIDER=mock` when `NODE_ENV=production`. |
| JWT secret default in production | Critical | **Mitigated.** `main.ts` refuses to start with default secret when `NODE_ENV=production`. |

---

## 9. Remaining Attack Surface

1. ~~**Reconciliation worker not live-tested.**~~ **RESOLVED.** T9 executed and passed — advisory lock, stale expiration, paired ledger entries, rate limiting all verified.
2. **Real POS adapters (PayTR, iyzico) not tested.** Signature verification uses HMAC-SHA256 with timing-safe comparison in code, but has not been tested against actual provider callbacks. Integration testing with provider sandboxes is required.
3. **No rate-limit validation executed.** Throttle decorators are present (`@Throttle`) but 429 behavior was not exercised in this session.
4. **Cross-user payment access.** Controller checks `payment.userId !== user.sub` but this was not tested in this session (T3e).
5. **Idempotency key expiration.** Keys expire after 72 hours. No test verified that expired keys allow re-creation with different parameters.

---

## 10. Production Readiness Verdict

**CONDITIONAL — Ready for production with one prerequisite:**

1. ~~**Execute T9**~~ **DONE.** Reconciliation worker validated end-to-end.
2. **Execute integration test against PayTR/iyzico sandbox** to validate real HMAC signature verification paths before accepting live payment traffic.

The core payment engine — idempotency, state machine, ledger integrity, 3DS callback security, reconciliation, and concurrency handling — is production-grade. All 37 assertions across 5 test categories (T1, T5, T7, T8, T9) passed under adversarial conditions. The codebase includes defense-in-depth at both application and database layers, with no observed gaps in the tested surface area.
