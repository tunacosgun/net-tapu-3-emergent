-- Migration 032: Geo hardening — auto-sync trigger, constraints, boundary validation
-- Ensures location column stays in sync with lat/lng on every UPDATE/INSERT

BEGIN;

-- ── Auto-sync location from lat/lng on INSERT/UPDATE ───────────
CREATE OR REPLACE FUNCTION listings.sync_parcel_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(
      ST_MakePoint(NEW.longitude::float8, NEW.latitude::float8),
      4326
    )::geography;
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_parcel_location ON listings.parcels;
CREATE TRIGGER trg_sync_parcel_location
  BEFORE INSERT OR UPDATE OF latitude, longitude
  ON listings.parcels
  FOR EACH ROW
  EXECUTE FUNCTION listings.sync_parcel_location();

-- ── Constraint: location cannot exist without lat/lng ──────────
-- Prevents manually setting location while lat/lng is NULL
ALTER TABLE listings.parcels
  DROP CONSTRAINT IF EXISTS chk_location_requires_latlng;

ALTER TABLE listings.parcels
  ADD CONSTRAINT chk_location_requires_latlng
  CHECK (
    location IS NULL
    OR (latitude IS NOT NULL AND longitude IS NOT NULL)
  );

-- ── Constraint: boundary must be valid geometry ────────────────
-- ST_IsValid check ensures no self-intersecting or degenerate polygons
-- Note: This runs on INSERT/UPDATE via a trigger since CHECK can't call PostGIS functions
CREATE OR REPLACE FUNCTION listings.validate_parcel_boundary()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.boundary IS NOT NULL THEN
    IF NOT ST_IsValid(NEW.boundary::geometry) THEN
      RAISE EXCEPTION 'Invalid boundary geometry: polygon is not valid (self-intersecting or degenerate)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_parcel_boundary ON listings.parcels;
CREATE TRIGGER trg_validate_parcel_boundary
  BEFORE INSERT OR UPDATE OF boundary
  ON listings.parcels
  FOR EACH ROW
  EXECUTE FUNCTION listings.validate_parcel_boundary();

-- ── Grants ─────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION listings.sync_parcel_location() TO nettapu_app;
GRANT EXECUTE ON FUNCTION listings.validate_parcel_boundary() TO nettapu_app;

COMMIT;
