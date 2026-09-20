-- 0009_shipping_module.sql
-- Shipping management: shipping methods, shipping zones, shipping rates.
-- Supports zone-based shipping rate calculation with order-total-based free shipping thresholds.

-- Shipping methods are the delivery options shown to customers (Standard, Express, Overnight, Pickup)
CREATE TABLE shipping_methods (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    code            TEXT NOT NULL,                    -- slug-like code (e.g., 'standard', 'express')
    description     TEXT,
    base_rate       NUMERIC(10,2) NOT NULL DEFAULT 0, -- default rate if no zone-specific rate applies
    currency_code   TEXT NOT NULL DEFAULT 'USD',
    min_days        INT,                              -- minimum estimated delivery days
    max_days        INT,                              -- maximum estimated delivery days
    free_shipping_threshold NUMERIC(10,2),            -- if subtotal >= threshold, shipping is free (NULL = never free)
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_shipping_methods_tenant ON shipping_methods(tenant_id);
CREATE INDEX idx_shipping_methods_active ON shipping_methods(tenant_id, is_active);

-- Shipping zones define geographic regions for shipping rate rules
CREATE TABLE shipping_zones (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    country_code TEXT,                -- ISO 3166-1 alpha-2; NULL = any country
    state_code   TEXT,                -- ISO 3166-2 subdivision; NULL = any state
    city         TEXT,                -- optional city-level zone; NULL = any city
    postal_code_pattern TEXT,         -- optional LIKE pattern for postal codes
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);
CREATE INDEX idx_shipping_zones_tenant ON shipping_zones(tenant_id);
CREATE INDEX idx_shipping_zones_country_state ON shipping_zones(country_code, state_code);

-- Shipping rates link a shipping method to a shipping zone with a specific rate
-- If no zone-specific rate matches, the method's base_rate is used
CREATE TABLE shipping_rates (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    shipping_method_id  UUID NOT NULL REFERENCES shipping_methods(id) ON DELETE CASCADE,
    shipping_zone_id    UUID NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
    rate                NUMERIC(10,2) NOT NULL,  -- shipping cost for this method+zone
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, shipping_method_id, shipping_zone_id)
);
CREATE INDEX idx_shipping_rates_tenant ON shipping_rates(tenant_id);
CREATE INDEX idx_shipping_rates_method_zone ON shipping_rates(shipping_method_id, shipping_zone_id);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trg_shipping_methods_updated_at ON shipping_methods;
CREATE TRIGGER trg_shipping_methods_updated_at BEFORE UPDATE ON shipping_methods
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_shipping_zones_updated_at ON shipping_zones;
CREATE TRIGGER trg_shipping_zones_updated_at BEFORE UPDATE ON shipping_zones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_shipping_rates_updated_at ON shipping_rates;
CREATE TRIGGER trg_shipping_rates_updated_at BEFORE UPDATE ON shipping_rates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed default shipping methods for existing tenants: Standard and Express
INSERT INTO shipping_methods (tenant_id, name, code, description, base_rate, currency_code, min_days, max_days, free_shipping_threshold, is_active, sort_order)
SELECT id, 'Standard Shipping', 'standard', 'Standard delivery (3-5 business days)', 5.99, 'USD', 3, 5, 50.00, TRUE, 0
FROM tenants
WHERE NOT EXISTS (SELECT 1 FROM shipping_methods WHERE tenant_id = tenants.id AND code = 'standard');

INSERT INTO shipping_methods (tenant_id, name, code, description, base_rate, currency_code, min_days, max_days, free_shipping_threshold, is_active, sort_order)
SELECT id, 'Express Shipping', 'express', 'Express delivery (1-2 business days)', 15.00, 'USD', 1, 2, NULL, TRUE, 1
FROM tenants
WHERE NOT EXISTS (SELECT 1 FROM shipping_methods WHERE tenant_id = tenants.id AND code = 'express');
