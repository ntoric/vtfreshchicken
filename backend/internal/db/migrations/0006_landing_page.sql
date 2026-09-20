-- 0006_landing_page.sql
-- Add landing page support to tenant_settings.
-- Landing pages can be enabled/disabled and have configurable content
-- (hero, features, testimonials, CTA, etc.) stored as JSONB.

ALTER TABLE tenant_settings
    ADD COLUMN IF NOT EXISTS landing_page_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS landing_page_content JSONB;
