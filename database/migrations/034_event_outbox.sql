-- Migration 034: Transactional Outbox for Auction Events
-- Provides at-least-once delivery of domain events via the outbox pattern.
-- Events are written in the same transaction as the state change,
-- then relayed asynchronously by a polling worker.

BEGIN;

-- ── Enum: event types ───────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE auctions.outbox_event_type AS ENUM (
    'BID_ACCEPTED',
    'AUCTION_STARTED',
    'AUCTION_ENDING',
    'AUCTION_ENDED',
    'SNIPER_EXTENSION'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Enum: event processing status ───────────────────────────────────
DO $$ BEGIN
  CREATE TYPE auctions.outbox_event_status AS ENUM (
    'pending',
    'processing',
    'processed',
    'dead_letter'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Sequence: monotonic ordering for relay consumption ──────────────
CREATE SEQUENCE IF NOT EXISTS auctions.outbox_sequence_seq
  AS BIGINT START WITH 1 INCREMENT BY 1 NO CYCLE;

-- ── Table: event_outbox ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auctions.event_outbox (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aggregate_id    UUID NOT NULL,
  event_type      auctions.outbox_event_type NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  status          auctions.outbox_event_status NOT NULL DEFAULT 'pending',
  idempotency_key VARCHAR(255) NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 5,
  last_attempt_at TIMESTAMPTZ,
  processed_at    TIMESTAMPTZ,
  error_details   TEXT,
  sequence        BIGINT NOT NULL DEFAULT nextval('auctions.outbox_sequence_seq'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint on idempotency_key prevents duplicate event writes
ALTER TABLE auctions.event_outbox
  DROP CONSTRAINT IF EXISTS uq_event_outbox_idempotency_key;
ALTER TABLE auctions.event_outbox
  ADD CONSTRAINT uq_event_outbox_idempotency_key UNIQUE (idempotency_key);

-- ── Indexes ─────────────────────────────────────────────────────────

-- Primary relay query: pending events ordered by sequence
CREATE INDEX IF NOT EXISTS idx_event_outbox_pending_sequence
  ON auctions.event_outbox (sequence)
  WHERE status = 'pending';

-- Reclaim stale processing events (stuck for > 30s)
CREATE INDEX IF NOT EXISTS idx_event_outbox_stale_processing
  ON auctions.event_outbox (last_attempt_at)
  WHERE status = 'processing';

-- Aggregate history: lookup all events for a given auction
CREATE INDEX IF NOT EXISTS idx_event_outbox_aggregate
  ON auctions.event_outbox (aggregate_id, sequence);

-- Dead letter monitoring
CREATE INDEX IF NOT EXISTS idx_event_outbox_dead_letter
  ON auctions.event_outbox (created_at)
  WHERE status = 'dead_letter';

-- ── Table: event_consumer_offsets (dedup per consumer group) ────────
CREATE TABLE IF NOT EXISTS auctions.event_consumer_offsets (
  consumer_group  VARCHAR(100) NOT NULL,
  event_id        UUID NOT NULL REFERENCES auctions.event_outbox(id),
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (consumer_group, event_id)
);

-- ── Grants ──────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON auctions.event_outbox TO nettapu_app;
GRANT USAGE ON SEQUENCE auctions.outbox_sequence_seq TO nettapu_app;
GRANT SELECT, INSERT ON auctions.event_consumer_offsets TO nettapu_app;

COMMIT;
