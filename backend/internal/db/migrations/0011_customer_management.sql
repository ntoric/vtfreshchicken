-- 0011_customer_management.sql
-- Add customer profile fields and admin notes to users table.

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_notes TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Backfill existing rows
UPDATE users SET phone = '' WHERE phone IS NULL;
UPDATE users SET admin_notes = '' WHERE admin_notes IS NULL;
