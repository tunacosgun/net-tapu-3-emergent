-- 043: Add username column to users table
-- Username is publicly visible to other bidders in auctions

ALTER TABLE auth.users
  ADD COLUMN username VARCHAR(30) UNIQUE;

-- Backfill existing users with a generated username from first_name + random suffix
UPDATE auth.users
SET username = LOWER(REPLACE(first_name, ' ', '')) || '_' || SUBSTRING(id::text, 1, 6)
WHERE username IS NULL;

-- Now make it NOT NULL
ALTER TABLE auth.users
  ALTER COLUMN username SET NOT NULL;

-- Index for fast lookups
CREATE INDEX idx_users_username ON auth.users (username);
