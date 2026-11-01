-- Migration 0051: shop page banner carousel
--
-- Ordered list of promotional banners shown at the top of /shop.
-- NULL means "never configured" — the backend then serves the built-in
-- default banners (services.DefaultShopBanners). An empty array is an explicit
-- choice to show no banners (the storefront falls back to its plain hero).
-- Managed under Backoffice → Content → Shop Banners
-- (GET/PUT /api/settings/shop-banners); not writable through PUT /api/settings.

ALTER TABLE tenant_settings
    ADD COLUMN IF NOT EXISTS shop_banners JSONB;
