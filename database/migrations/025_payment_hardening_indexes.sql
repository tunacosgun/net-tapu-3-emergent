-- Migration 025: Payment hardening indexes
-- Run as: nettapu_migrator
-- Adds missing indexes for pos_transactions and refunds payment lookups

BEGIN;

CREATE INDEX IF NOT EXISTS idx_pos_transactions_payment_status
  ON payments.pos_transactions (payment_id, status);

CREATE INDEX IF NOT EXISTS idx_refunds_payment
  ON payments.refunds (payment_id);

COMMIT;
