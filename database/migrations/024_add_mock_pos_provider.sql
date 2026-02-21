-- Migration 024: Add 'mock' to pos_provider enum
-- Run as: nettapu_migrator
--
-- Required for MockPosGateway — all POS transaction records
-- need a valid provider value. ALTER TYPE ADD VALUE must be
-- outside a transaction block for PG compatibility.

ALTER TYPE payments.pos_provider ADD VALUE IF NOT EXISTS 'mock';
