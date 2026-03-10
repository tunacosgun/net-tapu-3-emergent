-- Add notification preferences JSONB column to users
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT NULL;
