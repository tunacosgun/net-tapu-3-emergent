# Changelog

## v1.0-core-stable (2026-02-23)

### Payment Engine — Atomic Idempotency

- **Atomic idempotency fix**: `PaymentService.initiate()` now catches PostgreSQL
  `unique_violation` (23505) on concurrent duplicate requests and returns the
  existing payment instead of surfacing a 500. The race window between the
  fast-path idempotency check and the Phase 1 transaction commit is fully closed.

- **10x deterministic concurrency validation**: E2E test fires 10 parallel
  identical payment requests and asserts all 10 succeed with the same payment ID,
  exactly 1 DB row, 1 POS transaction, and 1 ledger entry set (initiated +
  provisioned). Passes deterministically across 3 consecutive runs.

- **Side-effect singularity guarantee**: Race-losing requests exit `initiate()`
  via early return before POS provisioning and `recordPosResult` are reached.
  No duplicate POS calls, no duplicate ledger writes — provable by code path
  analysis and verified by deep DB assertions in the concurrency test.

- **Structured race-resolution logging**: When a concurrent request resolves via
  the catch-and-return path, a structured JSON log is emitted with event
  `idempotency_race_resolved`, the payment ID, status, and idempotency key.
  A fallthrough guard logs `idempotency_race_lookup_failed` for the theoretical
  edge case where the winner's record is not yet visible.

### Infrastructure

- E2E test suite: 34 tests across 7 suites (auth, parcels, payments,
  concurrency, admin, role-access, route-matrix)
- Swagger/OpenAPI auto-discovery at `/api/v1/docs`
- Route-role matrix: 66 routes with ground-truth auth/role mapping
- Cold-start determinism verified (stop containers, restart, 34/34 pass)
