-- Idempotency key cleanup
-- Schedule as cron job: daily at 03:00 UTC
-- Usage: psql -U nettapu_app -d nettapu -f cleanup_expired_idempotency_keys.sql
--
-- Crontab entry:
--   0 3 * * * psql -U nettapu_app -d nettapu -f /path/to/cleanup_expired_idempotency_keys.sql >> /var/log/nettapu/idempotency_cleanup.log 2>&1
--
-- Keys have a 72-hour TTL set at creation. This job deletes keys
-- whose expires_at has passed. Batch-limited to avoid long locks.
-- The idx_idempotency_keys_expires index (migration 013) covers this query.

DELETE FROM payments.idempotency_keys
WHERE id IN (
  SELECT id FROM payments.idempotency_keys
  WHERE expires_at < NOW()
  ORDER BY expires_at
  LIMIT 10000
);
