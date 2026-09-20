-- Migration 0028: per-product return / refund / replacement type toggles
-- Nullable booleans — when NULL, the type is allowed (default: all enabled).

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS return_enabled       BOOLEAN,
    ADD COLUMN IF NOT EXISTS refund_enabled       BOOLEAN,
    ADD COLUMN IF NOT EXISTS replacement_enabled  BOOLEAN;
