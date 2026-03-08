-- Add restricted_features column to ip_bans for feature-based bans
ALTER TABLE auth.ip_bans
  ADD COLUMN IF NOT EXISTS restricted_features TEXT[] NOT NULL DEFAULT '{full}';

COMMENT ON COLUMN auth.ip_bans.restricted_features IS 'Which features are restricted: full, auctions, parcels, bidding, messaging';
