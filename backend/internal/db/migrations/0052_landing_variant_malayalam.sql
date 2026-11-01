-- Migration 0052: Malayalam landing page variant
--
-- Adds a third homepage design to tenant_settings.landing_variant:
--   malayalam — Malayalam-language landing (LandingMalayalam)
-- Existing values (classic, minimal) are unchanged.

ALTER TABLE tenant_settings
    DROP CONSTRAINT IF EXISTS tenant_settings_landing_variant_check;

ALTER TABLE tenant_settings
    ADD CONSTRAINT tenant_settings_landing_variant_check
    CHECK (landing_variant IN ('classic', 'minimal', 'malayalam'));
