-- Migration 0027: per-product return / refund / replacement configuration
-- Nullable columns — when NULL, the tenant-level default period is used.

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS return_period_days       INT,
    ADD COLUMN IF NOT EXISTS refund_period_days       INT,
    ADD COLUMN IF NOT EXISTS replacement_period_days  INT;
