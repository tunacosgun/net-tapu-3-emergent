-- Migration 026: Add extension_count column for sniper cap
-- Run as: nettapu_migrator

BEGIN;

ALTER TABLE auctions.auctions
  ADD COLUMN IF NOT EXISTS extension_count INTEGER NOT NULL DEFAULT 0;

COMMIT;
