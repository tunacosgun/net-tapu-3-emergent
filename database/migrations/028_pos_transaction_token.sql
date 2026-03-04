-- Migration 028: Ensure pos_transaction_token column + index on payments.payments
-- Run as: nettapu_migrator
--
-- Idempotent: safe to run even if column already exists (e.g. from migration 027).
-- Compatible with PostgreSQL 16.

BEGIN;

-- Add the column if it does not already exist
ALTER TABLE payments.payments
  ADD COLUMN IF NOT EXISTS pos_transaction_token VARCHAR(500);

-- Partial index: only rows that have a token (3DS payments)
CREATE INDEX IF NOT EXISTS idx_payments_pos_transaction_token
  ON payments.payments (pos_transaction_token)
  WHERE pos_transaction_token IS NOT NULL;

COMMIT;
