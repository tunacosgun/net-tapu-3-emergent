-- Migration 031: PostGIS extension, geography columns, spatial indexes, price history
-- SRID 4326 (WGS 84) — standard for GPS coordinates
-- Uses GEOGRAPHY type for accurate distance queries in meters

BEGIN;

-- ── Enable PostGIS ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;

-- ── Add geography columns to parcels ─────────────────────────
-- GEOGRAPHY(Point, 4326) enables ST_DWithin in meters without projection
ALTER TABLE listings.parcels
  ADD COLUMN IF NOT EXISTS location GEOGRAPHY(Point, 4326),
  ADD COLUMN IF NOT EXISTS boundary GEOGRAPHY(Polygon, 4326);

-- ── Backfill location from existing lat/lng ──────────────────
-- Only for parcels that have both latitude and longitude
UPDATE listings.parcels
SET location = ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)::geography
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND location IS NULL;

-- ── Spatial indexes (GIST) ───────────────────────────────────
-- These are the key indexes for performant geo-queries
CREATE INDEX IF NOT EXISTS idx_parcels_location_gist
  ON listings.parcels USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_parcels_boundary_gist
  ON listings.parcels USING GIST (boundary);

-- Composite: status + location for filtered geo-queries (active parcels only)
-- PostGIS GIST can't do composite with btree in one index, so we use a partial index
CREATE INDEX IF NOT EXISTS idx_parcels_active_location_gist
  ON listings.parcels USING GIST (location)
  WHERE status = 'active';

-- ── Price change history ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS listings.price_change_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id       UUID NOT NULL REFERENCES listings.parcels(id) ON DELETE CASCADE,
  old_price       NUMERIC(15, 2),
  new_price       NUMERIC(15, 2) NOT NULL,
  change_type     VARCHAR(50) NOT NULL,  -- manual, bulk_percentage, bulk_region, google_sync, algorithm
  change_percent  NUMERIC(8, 4),         -- percentage change (positive = increase)
  changed_by      UUID REFERENCES auth.users(id),
  metadata        JSONB,                 -- strategy params, region filter, etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_price_change_parcel ON listings.price_change_log(parcel_id, created_at DESC);

-- ── Grants ───────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON listings.parcels TO nettapu_app;
GRANT SELECT, INSERT ON listings.price_change_log TO nettapu_app;

COMMIT;
