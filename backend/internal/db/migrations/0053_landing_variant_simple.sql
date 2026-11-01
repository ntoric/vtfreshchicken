-- Migration 0053: Simple landing page variant
--
-- Adds a fourth homepage design to tenant_settings.landing_variant:
--   simple — stripped-down landing: intro, product grid, shop CTA
-- Existing values (classic, minimal, malayalam) are unchanged.

ALTER TABLE tenant_settings
    DROP CONSTRAINT IF EXISTS tenant_settings_landing_variant_check;

ALTER TABLE tenant_settings
    ADD CONSTRAINT tenant_settings_landing_variant_check
    CHECK (landing_variant IN ('classic', 'minimal', 'malayalam', 'simple'));
