-- 0031_seo_fields.sql
-- Add SEO/AEO fields to products, categories, and tenant_settings.

-- Products: per-product SEO overrides
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_title       TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_description TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS og_image         TEXT NOT NULL DEFAULT '';

-- Categories: per-category SEO overrides
ALTER TABLE categories ADD COLUMN IF NOT EXISTS meta_title       TEXT NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS meta_description TEXT NOT NULL DEFAULT '';

-- Tenant settings: store-level SEO defaults
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS meta_title       TEXT NOT NULL DEFAULT '';
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS meta_description TEXT NOT NULL DEFAULT '';
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS og_image         TEXT NOT NULL DEFAULT '';
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS site_url         TEXT NOT NULL DEFAULT '';
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS social_links     JSONB NOT NULL DEFAULT '[]'::jsonb;
