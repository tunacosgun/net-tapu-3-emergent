-- User device registration for push notifications (FCM)
CREATE TABLE IF NOT EXISTS auth.user_devices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token  VARCHAR(500) NOT NULL,
  platform      VARCHAR(20) NOT NULL CHECK (platform IN ('web', 'ios', 'android')),
  device_name   VARCHAR(255),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_user_devices_token ON auth.user_devices(device_token);
CREATE INDEX idx_user_devices_user ON auth.user_devices(user_id) WHERE is_active = TRUE;
