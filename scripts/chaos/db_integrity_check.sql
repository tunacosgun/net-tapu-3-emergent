-- ── DB Integrity Check ────────────────────────────────────────
-- Returns rows ONLY if integrity violations exist.
-- Empty result = PASS. Any rows = FAIL.
--
-- Run with: psql -f db_integrity_check.sql
-- Each query is labeled with a CHECK_ID for programmatic parsing.

-- CHECK_1: Orphaned payments (payment exists without any ledger entry)
SELECT 'CHECK_1_ORPHANED_PAYMENTS' AS check_id, p.id AS entity_id,
       p.status, p.created_at::text
FROM payments.payments p
LEFT JOIN payments.payment_ledger l ON l.payment_id = p.id
WHERE l.id IS NULL
  AND p.created_at > now() - INTERVAL '1 hour';

-- CHECK_2: Orphaned idempotency keys (key points to non-existent payment)
SELECT 'CHECK_2_ORPHANED_IDEMPOTENCY_KEYS' AS check_id, k.key AS entity_id,
       (k.response_body->>'paymentId') AS payment_id, k.created_at::text
FROM payments.idempotency_keys k
LEFT JOIN payments.payments p ON p.id = (k.response_body->>'paymentId')::uuid
WHERE p.id IS NULL
  AND k.created_at > now() - INTERVAL '1 hour';

-- CHECK_3: Duplicate POS transactions per payment per status
SELECT 'CHECK_3_DUPLICATE_POS_TX' AS check_id,
       payment_id AS entity_id,
       provider, status, count(*) AS duplicate_count
FROM payments.pos_transactions
WHERE created_at > now() - INTERVAL '1 hour'
GROUP BY payment_id, provider, status
HAVING count(*) > 1;

-- CHECK_4: Idle in transaction sessions older than 60 seconds
SELECT 'CHECK_4_IDLE_IN_TX' AS check_id,
       pid::text AS entity_id,
       state, usename,
       (extract(epoch FROM (now() - query_start)))::int::text AS duration_seconds
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND query_start < now() - INTERVAL '60 seconds'
  AND pid != pg_backend_pid();

-- CHECK_5: Payments stuck in pending for more than 5 minutes (during test)
SELECT 'CHECK_5_STUCK_PENDING' AS check_id, id AS entity_id,
       status, created_at::text
FROM payments.payments
WHERE status = 'pending'
  AND created_at > now() - INTERVAL '1 hour'
  AND created_at < now() - INTERVAL '5 minutes';

-- CHECK_6: Payments stuck in awaiting_3ds for more than 20 minutes
SELECT 'CHECK_6_STUCK_3DS' AS check_id, id AS entity_id,
       status, three_ds_initiated_at::text
FROM payments.payments
WHERE status = 'awaiting_3ds'
  AND three_ds_initiated_at IS NOT NULL
  AND three_ds_initiated_at < now() - INTERVAL '20 minutes';
