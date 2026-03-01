-- Migration 033: Auction core hardening
-- Concurrency safety, time integrity, financial safety, leaderboard indexes
--
-- 1. DB-level bid rejection after auction end time (trigger)
-- 2. DB-level minimum increment enforcement (trigger)
-- 3. Deposit uniqueness across auctions (unique index)
-- 4. Composite indexes for leaderboard queries
-- 5. IP column on bids (already nullable inet)

BEGIN;

-- ── 1. Reject bids after auction ends (DB time authority) ──────
-- This trigger fires BEFORE INSERT on bids and checks:
--   - Auction must be LIVE
--   - NOW() must be before the effective end time
-- Uses DB clock (NOW()), not application clock, for legal safety.
CREATE OR REPLACE FUNCTION auctions.enforce_bid_time_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_status TEXT;
  v_effective_end TIMESTAMPTZ;
BEGIN
  SELECT status, COALESCE(extended_until, scheduled_end)
  INTO v_status, v_effective_end
  FROM auctions.auctions
  WHERE id = NEW.auction_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Auction % does not exist', NEW.auction_id;
  END IF;

  IF v_status != 'live' THEN
    RAISE EXCEPTION 'Auction % is not live (status: %)', NEW.auction_id, v_status;
  END IF;

  IF v_effective_end IS NOT NULL AND NOW() > v_effective_end THEN
    RAISE EXCEPTION 'Auction % has ended (effective_end: %, server_time: %)',
      NEW.auction_id, v_effective_end, NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_bid_time_integrity ON auctions.bids;
CREATE TRIGGER trg_enforce_bid_time_integrity
  BEFORE INSERT ON auctions.bids
  FOR EACH ROW
  EXECUTE FUNCTION auctions.enforce_bid_time_integrity();

-- ── 2. Enforce minimum increment at DB level ───────────────────
-- Ensures bid amount > current_price + minimum_increment
-- Acts as safety net behind the application-level check.
CREATE OR REPLACE FUNCTION auctions.enforce_minimum_increment()
RETURNS TRIGGER AS $$
DECLARE
  v_current_price NUMERIC(15,2);
  v_min_increment NUMERIC(15,2);
  v_starting_price NUMERIC(15,2);
  v_minimum_bid NUMERIC(15,2);
BEGIN
  SELECT COALESCE(current_price, starting_price), minimum_increment, starting_price
  INTO v_current_price, v_min_increment, v_starting_price
  FROM auctions.auctions
  WHERE id = NEW.auction_id;

  v_minimum_bid := v_current_price + v_min_increment;

  IF NEW.amount < v_minimum_bid THEN
    RAISE EXCEPTION 'Bid amount % is below minimum % (current: % + increment: %)',
      NEW.amount, v_minimum_bid, v_current_price, v_min_increment;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_minimum_increment ON auctions.bids;
CREATE TRIGGER trg_enforce_minimum_increment
  BEFORE INSERT ON auctions.bids
  FOR EACH ROW
  EXECUTE FUNCTION auctions.enforce_minimum_increment();

-- ── 3. Deposit uniqueness per auction ──────────────────────────
-- Prevents the same deposit_id from being used in multiple auctions.
-- A deposit is linked to exactly one auction via auction_participants.
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_deposit_unique
  ON auctions.auction_participants (deposit_id)
  WHERE eligible = TRUE;

-- ── 4. Composite indexes for leaderboard queries ───────────────
-- Leaderboard: highest bid per auction, ordered by amount DESC
CREATE INDEX IF NOT EXISTS idx_bids_auction_amount_desc
  ON auctions.bids (auction_id, amount DESC);

-- Bid history: most recent bids per auction
CREATE INDEX IF NOT EXISTS idx_bids_auction_created_desc
  ON auctions.bids (auction_id, created_at DESC);

-- User's bid history in an auction (for "my bids" queries)
CREATE INDEX IF NOT EXISTS idx_bids_auction_user
  ON auctions.bids (auction_id, user_id, created_at DESC);

-- Active auctions (for listing pages)
CREATE INDEX IF NOT EXISTS idx_auctions_status_scheduled_end
  ON auctions.auctions (status, scheduled_end)
  WHERE status IN ('live', 'ending', 'deposit_open', 'scheduled');

-- ── 5. CHECK constraint: starting_price and minimum_increment must be positive
ALTER TABLE auctions.auctions
  DROP CONSTRAINT IF EXISTS chk_auction_prices_positive;
ALTER TABLE auctions.auctions
  ADD CONSTRAINT chk_auction_prices_positive
  CHECK (starting_price > 0 AND minimum_increment > 0 AND required_deposit > 0);

-- ── Grants ─────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION auctions.enforce_bid_time_integrity() TO nettapu_app;
GRANT EXECUTE ON FUNCTION auctions.enforce_minimum_increment() TO nettapu_app;

COMMIT;
