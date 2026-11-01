-- Migration 0049: storefront landing page variant
--
-- Selects which homepage design the frontstore renders at "/".
--   classic — the original editorial landing (LandingHome)
--   minimal — the clean, simple landing (LandingMinimal)
-- Managed by superadmin under Backoffice → Developer → Landing Page.

ALTER TABLE tenant_settings
    ADD COLUMN IF NOT EXISTS landing_variant TEXT NOT NULL DEFAULT 'classic';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenant_settings_landing_variant_check'
    ) THEN
        ALTER TABLE tenant_settings
            ADD CONSTRAINT tenant_settings_landing_variant_check
            CHECK (landing_variant IN ('classic', 'minimal'));
    END IF;
END $$;
