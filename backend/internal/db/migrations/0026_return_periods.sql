-- Migration 0026: return / refund / replacement validity periods (per-tenant)

ALTER TABLE tenant_settings
    ADD COLUMN IF NOT EXISTS return_period_days       INT NOT NULL DEFAULT 30,
    ADD COLUMN IF NOT EXISTS refund_period_days       INT NOT NULL DEFAULT 30,
    ADD COLUMN IF NOT EXISTS replacement_period_days  INT NOT NULL DEFAULT 15;
