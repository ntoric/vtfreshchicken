-- 0043_store_modules.sql
-- Store modules / feature flags managed from Backoffice → Developer → Modules & Features.
-- Each module gates its related menus, pages, widgets, and components on both the
-- frontstore and the backoffice.

CREATE TABLE store_modules (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_code  TEXT NOT NULL,                 -- 'returns', 'tax', 'shipping', 'promotions', 'discounts', 'page_builder'
    display_name TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    is_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order   INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, module_code)
);
CREATE INDEX idx_store_modules_tenant ON store_modules(tenant_id);

DROP TRIGGER IF EXISTS trg_store_modules_updated_at ON store_modules;
CREATE TRIGGER trg_store_modules_updated_at BEFORE UPDATE ON store_modules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed default modules for existing tenants (all enabled).
INSERT INTO store_modules (tenant_id, module_code, display_name, description, is_enabled, sort_order)
SELECT t.id, m.module_code, m.display_name, m.description, TRUE, m.sort_order
FROM tenants t
CROSS JOIN (VALUES
    ('returns',      'Returns & Refunds', 'Customer return, refund, and replacement requests plus the backoffice returns workspace.',                                            10),
    ('tax',          'Tax',               'Tax classes, zones, and rates; tax calculation at checkout and tax settings in the backoffice.',                                      20),
    ('shipping',     'Shipping',          'Shipping methods, zones, rates, and carrier shipments; delivery method selection at checkout.',                                     30),
    ('promotions',   'Promotions',        'Storefront offers and promotional pricing applied to products.',                                                                    40),
    ('discounts',    'Discounts',         'Discount codes and the coupon field at checkout.',                                                                                  50),
    ('page_builder', 'Page Builder',      'Custom storefront pages built with the page builder and served under /p/:slug.',                                                    60)
) AS m(module_code, display_name, description, sort_order)
WHERE NOT EXISTS (
    SELECT 1 FROM store_modules sm WHERE sm.tenant_id = t.id AND sm.module_code = m.module_code
);
