-- Migration 030: IP bans + login attempt tracking
-- Depends on: 003_auth_tables.sql (auth.users)

BEGIN;

-- ── IP / Account bans ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth.ip_bans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address      INET,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reason          VARCHAR(500) NOT NULL,
  banned_by       UUID REFERENCES auth.users(id),
  expires_at      TIMESTAMPTZ,              -- NULL = permanent
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_ban_target CHECK (ip_address IS NOT NULL OR user_id IS NOT NULL)
);

CREATE INDEX idx_ip_bans_ip ON auth.ip_bans(ip_address) WHERE is_active = true;
CREATE INDEX idx_ip_bans_user ON auth.ip_bans(user_id) WHERE is_active = true;

-- ── Login attempt tracking (brute force protection) ──────────
CREATE TABLE IF NOT EXISTS auth.login_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) NOT NULL,
  ip_address      INET,
  user_agent      VARCHAR(500),
  success         BOOLEAN NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_attempts_email ON auth.login_attempts(email, created_at);
CREATE INDEX idx_login_attempts_ip ON auth.login_attempts(ip_address, created_at);

-- Auto-cleanup: delete login attempts older than 7 days (run via cron or pg_cron)
-- For now we rely on application-level queries with time windows.

-- Grant to app role
GRANT SELECT, INSERT, UPDATE ON auth.ip_bans TO nettapu_app;
GRANT SELECT, INSERT ON auth.login_attempts TO nettapu_app;

COMMIT;
