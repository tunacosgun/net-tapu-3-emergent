-- Per-auction anti-sniping configuration
ALTER TABLE auctions.auctions ADD COLUMN IF NOT EXISTS sniper_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE auctions.auctions ADD COLUMN IF NOT EXISTS sniper_window_seconds INTEGER;
ALTER TABLE auctions.auctions ADD COLUMN IF NOT EXISTS sniper_extension_seconds INTEGER;
ALTER TABLE auctions.auctions ADD COLUMN IF NOT EXISTS max_sniper_extensions INTEGER;
