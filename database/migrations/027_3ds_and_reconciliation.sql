-- Migration 027: 3D Secure support and reconciliation infrastructure
-- Run as: nettapu_migrator
--
-- Adds:
--   1. awaiting_3ds payment status for 3D Secure redirect flows
--   2. New ledger events for 3DS lifecycle and reconciliation
--   3. 3DS columns on payments.payments (token, timestamps)
--   4. Callback columns on payments.pos_transactions
--   5. payments.reconciliation_runs table
--   6. Updated status transition trigger: pending → awaiting_3ds → provisioned
--   7. Index for reconciliation worker queries

-- ============================================================
-- ALTER TYPE ADD VALUE must run outside a transaction block in PostgreSQL
-- ============================================================

ALTER TYPE payments.payment_status ADD VALUE IF NOT EXISTS 'awaiting_3ds' AFTER 'pending';

ALTER TYPE payments.ledger_event ADD VALUE IF NOT EXISTS 'three_ds_initiated';
ALTER TYPE payments.ledger_event ADD VALUE IF NOT EXISTS 'three_ds_callback_received';
ALTER TYPE payments.ledger_event ADD VALUE IF NOT EXISTS 'three_ds_completed';
ALTER TYPE payments.ledger_event ADD VALUE IF NOT EXISTS 'three_ds_failed';
ALTER TYPE payments.ledger_event ADD VALUE IF NOT EXISTS 'reconciliation_mismatch';
ALTER TYPE payments.ledger_event ADD VALUE IF NOT EXISTS 'reconciliation_resolved';

-- ============================================================
-- Schema changes (transactional)
-- ============================================================
BEGIN;

-- 3DS columns on payments
ALTER TABLE payments.payments
  ADD COLUMN IF NOT EXISTS pos_transaction_token VARCHAR(500),
  ADD COLUMN IF NOT EXISTS three_ds_initiated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS callback_received_at  TIMESTAMPTZ;

-- Callback columns on pos_transactions
ALTER TABLE payments.pos_transactions
  ADD COLUMN IF NOT EXISTS callback_payload     JSONB,
  ADD COLUMN IF NOT EXISTS callback_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS callback_ip          VARCHAR(45);

-- ============================================================
-- Reconciliation runs table
-- ============================================================
CREATE TABLE IF NOT EXISTS payments.reconciliation_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  payments_checked  INTEGER NOT NULL DEFAULT 0,
  mismatches_found  INTEGER NOT NULL DEFAULT 0,
  mismatches_resolved INTEGER NOT NULL DEFAULT 0,
  errors            INTEGER NOT NULL DEFAULT 0,
  details           JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON payments.reconciliation_runs TO nettapu_app;

-- ============================================================
-- Updated status transition trigger — adds awaiting_3ds
-- ============================================================
CREATE OR REPLACE FUNCTION payments.enforce_payment_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'pending'              AND NEW.status IN ('awaiting_3ds', 'provisioned', 'failed')) OR
      (OLD.status = 'awaiting_3ds'         AND NEW.status IN ('provisioned', 'failed')) OR
      (OLD.status = 'provisioned'          AND NEW.status IN ('completed', 'cancelled')) OR
      (OLD.status = 'completed'            AND NEW.status IN ('refunded', 'partially_refunded')) OR
      (OLD.status = 'partially_refunded'   AND NEW.status = 'refunded') OR
      -- Terminal states: failed, cancelled, refunded — no outbound transitions
      (OLD.status IN ('failed', 'cancelled', 'refunded') AND FALSE)
    ) THEN
      RAISE EXCEPTION
        'Invalid payment status transition for payment %: % → %',
        OLD.id, OLD.status, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Index for reconciliation worker: find stale pending/awaiting_3ds payments
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_payments_reconciliation
  ON payments.payments (status, created_at)
  WHERE status IN ('pending', 'awaiting_3ds');

COMMIT;
