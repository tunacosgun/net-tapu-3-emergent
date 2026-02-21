-- Migration 022: Database-backed sequence for listing IDs
-- Run as: nettapu_migrator
--
-- Replaces the in-memory counter in ParcelService with a
-- PostgreSQL sequence that is safe under horizontal scaling.
-- Format: NT-000001, NT-000002, ...
--
-- Idempotent: CREATE SEQUENCE IF NOT EXISTS + conditional setval.

BEGIN;

CREATE SEQUENCE IF NOT EXISTS listings.listing_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

DO $$
DECLARE
  max_val BIGINT;
BEGIN
  LOCK TABLE listings.parcels IN EXCLUSIVE MODE;

  SELECT COALESCE(
    MAX(
      CASE
        WHEN listing_id ~ '^NT-[0-9]+$'
        THEN CAST(SUBSTRING(listing_id FROM 4) AS BIGINT)
        ELSE 0
      END
    ), 0
  ) INTO max_val FROM listings.parcels;

  IF max_val > 0 THEN
    PERFORM setval('listings.listing_id_seq', max_val);
  END IF;
END $$;

GRANT USAGE, SELECT ON SEQUENCE listings.listing_id_seq TO nettapu_app;

COMMIT;
