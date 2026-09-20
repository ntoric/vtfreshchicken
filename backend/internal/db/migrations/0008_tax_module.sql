-- 0008_tax_module.sql
-- Tax management: tax classes, tax zones, tax rates.
-- Supports zone-based (country/state) tax calculation with product-level tax classes.

-- Tax classes group products for tax purposes (e.g., Standard, Reduced, Zero-rated, Exempt)
CREATE TABLE tax_classes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);
CREATE INDEX idx_tax_classes_tenant ON tax_classes(tenant_id);

-- Tax zones define geographic regions for tax rules
CREATE TABLE tax_zones (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    country_code TEXT,                -- ISO 3166-1 alpha-2 (e.g., 'US', 'GB', 'DE'); NULL = any country
    state_code   TEXT,                -- ISO 3166-2 subdivision (e.g., 'CA', 'NY'); NULL = any state in the country
    city         TEXT,                -- Optional city-level zone; NULL = any city
    postal_code_pattern TEXT,         -- Optional LIKE pattern for postal codes
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);
CREATE INDEX idx_tax_zones_tenant ON tax_zones(tenant_id);
CREATE INDEX idx_tax_zones_country_state ON tax_zones(country_code, state_code);

-- Tax rates link a tax class to a tax zone with a percentage rate
CREATE TABLE tax_rates (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tax_class_id  UUID NOT NULL REFERENCES tax_classes(id) ON DELETE CASCADE,
    tax_zone_id   UUID NOT NULL REFERENCES tax_zones(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,           -- human-readable rate name (e.g., "US-CA Standard 7.25%")
    rate          NUMERIC(6,4) NOT NULL,   -- percentage, e.g., 7.2500 = 7.25%
    compound      BOOLEAN NOT NULL DEFAULT FALSE,  -- if true, tax is added on top of other taxes
    priority      INT NOT NULL DEFAULT 0,  -- lower priority taxes are calculated first
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from TIMESTAMPTZ,            -- optional date when rate becomes active
    effective_to   TIMESTAMPTZ,            -- optional date when rate expires
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, tax_class_id, tax_zone_id)
);
CREATE INDEX idx_tax_rates_tenant ON tax_rates(tenant_id);
CREATE INDEX idx_tax_rates_class_zone ON tax_rates(tax_class_id, tax_zone_id);

-- Add tax_class_id to products (nullable — falls back to tenant default tax class)
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS tax_class_id UUID REFERENCES tax_classes(id) ON DELETE SET NULL;

-- Add tax-related settings to tenant_settings
ALTER TABLE tenant_settings
    ADD COLUMN IF NOT EXISTS tax_inclusive  BOOLEAN NOT NULL DEFAULT FALSE,  -- prices include tax
    ADD COLUMN IF NOT EXISTS tax_shipping   BOOLEAN NOT NULL DEFAULT FALSE,  -- apply tax to shipping cost
    ADD COLUMN IF NOT EXISTS default_tax_class_id UUID REFERENCES tax_classes(id) ON DELETE SET NULL;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tax_classes_updated_at ON tax_classes;
CREATE TRIGGER trg_tax_classes_updated_at BEFORE UPDATE ON tax_classes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tax_zones_updated_at ON tax_zones;
CREATE TRIGGER trg_tax_zones_updated_at BEFORE UPDATE ON tax_zones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tax_rates_updated_at ON tax_rates;
CREATE TRIGGER trg_tax_rates_updated_at BEFORE UPDATE ON tax_rates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed a default "Standard" tax class for existing tenants
INSERT INTO tax_classes (tenant_id, name, description, is_default, is_active)
SELECT id, 'Standard', 'Standard tax rate for most products', TRUE, TRUE
FROM tenants
WHERE NOT EXISTS (
    SELECT 1 FROM tax_classes WHERE tenant_id = tenants.id AND name = 'Standard'
);

-- Set the default_tax_class_id for tenants that don't have one
UPDATE tenant_settings ts
SET default_tax_class_id = (
    SELECT id FROM tax_classes WHERE tenant_id = ts.tenant_id AND is_default = TRUE LIMIT 1
)
WHERE ts.default_tax_class_id IS NULL
  AND EXISTS (SELECT 1 FROM tax_classes WHERE tenant_id = ts.tenant_id AND is_default = TRUE);

-- Assign all existing products to the default tax class of their tenant
UPDATE products p
SET tax_class_id = (
    SELECT tc.id FROM tax_classes tc
    WHERE tc.tenant_id = p.tenant_id AND tc.is_default = TRUE
    LIMIT 1
)
WHERE p.tax_class_id IS NULL
  AND EXISTS (SELECT 1 FROM tax_classes tc WHERE tc.tenant_id = p.tenant_id AND tc.is_default = TRUE);
