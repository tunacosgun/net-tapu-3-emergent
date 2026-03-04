-- Migration 029: Password reset tokens + email verification tokens
-- Depends on: 003_auth_tables.sql (auth.users)

BEGIN;

-- ── Password reset tokens ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth.password_reset_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash      VARCHAR(255) NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_tokens_user_id ON auth.password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires ON auth.password_reset_tokens(expires_at) WHERE used_at IS NULL;

-- ── Email verification tokens ────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth.email_verification_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash      VARCHAR(255) NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_verification_tokens_user_id ON auth.email_verification_tokens(user_id);
CREATE INDEX idx_email_verification_tokens_expires ON auth.email_verification_tokens(expires_at) WHERE used_at IS NULL;

-- Grant to app role
GRANT SELECT, INSERT, UPDATE ON auth.password_reset_tokens TO nettapu_app;
GRANT SELECT, INSERT, UPDATE ON auth.email_verification_tokens TO nettapu_app;

COMMIT;
