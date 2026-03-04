-- 036: Parcel reservation table for "Bana Ayır" 48h hold feature
-- Allows authenticated users to reserve a parcel for 48 hours

CREATE TABLE IF NOT EXISTS listings.parcel_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID NOT NULL REFERENCES listings.parcels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'active', -- 'active' | 'expired' | 'cancelled' | 'converted'
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  cancelled_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ, -- when converted to actual sale/offer
  reason VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active reservation per parcel at a time
CREATE UNIQUE INDEX idx_parcel_reservations_active
  ON listings.parcel_reservations(parcel_id) WHERE status = 'active';

CREATE INDEX idx_parcel_reservations_user
  ON listings.parcel_reservations(user_id);

CREATE INDEX idx_parcel_reservations_expiring
  ON listings.parcel_reservations(expires_at) WHERE status = 'active';

COMMENT ON TABLE listings.parcel_reservations IS '48-hour parcel reservations for authenticated users';
