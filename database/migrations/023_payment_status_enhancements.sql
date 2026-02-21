-- Migration 023: Payment status enhancements
-- Run as: nettapu_migrator
--
-- Adds pre-auth (provision) support to the payments state machine:
--   pending → provisioned → completed → refunded/partially_refunded
--                ↓
--             cancelled
--
-- ALTER TYPE ADD VALUE kept outside BEGIN/COMMIT for PG compatibility.

-- 1. Add missing payment statuses
ALTER TYPE payments.payment_status ADD VALUE IF NOT EXISTS 'provisioned' AFTER 'pending';
ALTER TYPE payments.payment_status ADD VALUE IF NOT EXISTS 'cancelled' AFTER 'failed';

-- 2. Add missing ledger events
ALTER TYPE payments.ledger_event ADD VALUE IF NOT EXISTS 'payment_provisioned';
ALTER TYPE payments.ledger_event ADD VALUE IF NOT EXISTS 'payment_captured';
ALTER TYPE payments.ledger_event ADD VALUE IF NOT EXISTS 'payment_provision_cancelled';

-- 3. Payment status state machine trigger (must be in transaction)
BEGIN;

CREATE OR REPLACE FUNCTION payments.enforce_payment_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'pending'              AND NEW.status IN ('provisioned', 'failed')) OR
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

CREATE TRIGGER trg_payment_status_transition
  BEFORE UPDATE ON payments.payments
  FOR EACH ROW
  EXECUTE FUNCTION payments.enforce_payment_status_transition();

COMMIT;
