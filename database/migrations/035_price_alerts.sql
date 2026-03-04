-- 035: Price alerts table for "Fiyat Düşünce Haber Ver" feature
-- Users can subscribe to get notified when a parcel's price drops

CREATE TABLE IF NOT EXISTS listings.price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parcel_id UUID NOT NULL REFERENCES listings.parcels(id) ON DELETE CASCADE,
  target_price NUMERIC(15,2),
  alert_type VARCHAR(30) NOT NULL DEFAULT 'any_drop', -- 'any_drop' | 'target_price'
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_notified_at TIMESTAMPTZ,
  triggered_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, parcel_id)
);

CREATE INDEX idx_price_alerts_parcel_active
  ON listings.price_alerts(parcel_id) WHERE is_active = true;

CREATE INDEX idx_price_alerts_user
  ON listings.price_alerts(user_id);

COMMENT ON TABLE listings.price_alerts IS 'User subscriptions for price drop notifications on specific parcels';
