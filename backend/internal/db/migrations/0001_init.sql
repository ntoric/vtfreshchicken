-- Migration 0001: core schema (multitenancy, auth, catalog, currencies, languages)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================================================
-- Tenancy & auth
-- ============================================================
CREATE TABLE tenants (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-tenant settings (currency, language, branding)
CREATE TABLE tenant_settings (
    tenant_id           UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    default_currency_id UUID,
    default_language    TEXT NOT NULL DEFAULT 'en',
    supported_languages TEXT[] NOT NULL DEFAULT ARRAY['en'],
    brand_color         TEXT,
    logo_url            TEXT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE currencies (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code       TEXT NOT NULL UNIQUE,        -- ISO 4217 e.g. USD
    name       TEXT NOT NULL,
    symbol     TEXT NOT NULL,
    decimals   INT NOT NULL DEFAULT 2,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE exchange_rates (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_code   TEXT NOT NULL,              -- e.g. USD
    quote_code  TEXT NOT NULL,              -- e.g. EUR
    rate        NUMERIC(20,8) NOT NULL,
    fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(base_code, quote_code)
);

CREATE TABLE languages (
    code       TEXT PRIMARY KEY,            -- e.g. en, es, fr
    name       TEXT NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Global roles (superadmin is platform-wide; others are tenant-scoped)
CREATE TYPE user_role AS ENUM ('superadmin', 'business_admin', 'staff', 'customer');

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for superadmin
    email         CITEXT NOT NULL,
    password_hash TEXT NOT NULL,
    full_name     TEXT NOT NULL DEFAULT '',
    role          user_role NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);

-- Staff role assignments within a tenant (granular permissions)
CREATE TABLE staff_roles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_name   TEXT NOT NULL,              -- e.g. catalog_manager, order_manager
    permissions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id, role_name)
);

CREATE TABLE addresses (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    label      TEXT NOT NULL DEFAULT '',
    line1      TEXT NOT NULL,
    line2      TEXT,
    city       TEXT NOT NULL,
    state      TEXT,
    postal_code TEXT,
    country    TEXT NOT NULL,
    phone      TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Catalog: categories, products, attributes, variants
-- ============================================================
CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
    slug        TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    sort_order  INT NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, slug)
);
CREATE INDEX idx_categories_tenant_parent ON categories(tenant_id, parent_id);

-- Translations for category names
CREATE TABLE category_translations (
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    language    TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    PRIMARY KEY (category_id, language)
);

CREATE TABLE attributes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    slug        TEXT NOT NULL,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'text', -- text, number, color, select, boolean
    is_filterable BOOLEAN NOT NULL DEFAULT FALSE,
    is_variant  BOOLEAN NOT NULL DEFAULT FALSE, -- used to define variants
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, slug)
);

CREATE TABLE attribute_options (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
    value        TEXT NOT NULL,
    label        TEXT NOT NULL,
    sort_order   INT NOT NULL DEFAULT 0,
    UNIQUE(attribute_id, value)
);

CREATE TABLE products (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
    slug         TEXT NOT NULL,
    name         TEXT NOT NULL,
    description  TEXT,
    sku          TEXT,
    status       TEXT NOT NULL DEFAULT 'draft', -- draft, active, archived
    base_price   NUMERIC(20,2) NOT NULL DEFAULT 0, -- in tenant default currency
    currency_id  UUID REFERENCES currencies(id),
    is_featured  BOOLEAN NOT NULL DEFAULT FALSE,
    rating       NUMERIC(3,2) NOT NULL DEFAULT 0,
    stock        INT NOT NULL DEFAULT 0,
    image_url    TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, slug)
);
CREATE INDEX idx_products_tenant_status ON products(tenant_id, status);
CREATE INDEX idx_products_tenant_category ON products(tenant_id, category_id);
CREATE INDEX idx_products_tenant_featured ON products(tenant_id, is_featured);

CREATE TABLE product_translations (
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    language    TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    PRIMARY KEY (product_id, language)
);

-- Product-level attribute values (non-variant attributes)
CREATE TABLE product_attribute_values (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
    value_text   TEXT,
    value_number NUMERIC(20,4),
    value_bool   BOOLEAN,
    option_id    UUID REFERENCES attribute_options(id) ON DELETE SET NULL,
    UNIQUE(product_id, attribute_id)
);

CREATE TABLE product_images (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url        TEXT NOT NULL,
    alt        TEXT,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE variants (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku        TEXT,
    name       TEXT NOT NULL DEFAULT '',
    price      NUMERIC(20,2) NOT NULL DEFAULT 0,
    stock      INT NOT NULL DEFAULT 0,
    image_url  TEXT,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_variants_product ON variants(product_id);

-- Variant attribute values (which attribute options define this variant)
CREATE TABLE variant_attribute_values (
    variant_id  UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
    attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
    option_id   UUID NOT NULL REFERENCES attribute_options(id) ON DELETE CASCADE,
    PRIMARY KEY (variant_id, attribute_id)
);

-- ============================================================
-- Offers & discounts
-- ============================================================
CREATE TABLE offers (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    offer_type  TEXT NOT NULL,              -- percentage, fixed, bxgy
    value       NUMERIC(20,2) NOT NULL,     -- percentage (0-100) or fixed amount
    starts_at   TIMESTAMPTZ,
    ends_at     TIMESTAMPTZ,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Apply offers to products or categories
CREATE TABLE offer_targets (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    offer_id   UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL,              -- product, category, all
    target_id  UUID                          -- product_id or category_id; NULL for all
);

CREATE TABLE discount_codes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code        TEXT NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL,            -- percentage, fixed
    value       NUMERIC(20,2) NOT NULL,
    min_subtotal NUMERIC(20,2) NOT NULL DEFAULT 0,
    max_uses    INT,
    used_count  INT NOT NULL DEFAULT 0,
    starts_at   TIMESTAMPTZ,
    ends_at     TIMESTAMPTZ,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

-- ============================================================
-- Cart & orders (minimal for MVP)
-- ============================================================
CREATE TABLE carts (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT,
    currency_code TEXT NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cart_items (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id    UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES variants(id) ON DELETE SET NULL,
    quantity   INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(20,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE orders (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    status        TEXT NOT NULL DEFAULT 'pending', -- pending, paid, shipped, delivered, cancelled
    subtotal      NUMERIC(20,2) NOT NULL DEFAULT 0,
    discount_total NUMERIC(20,2) NOT NULL DEFAULT 0,
    shipping_total NUMERIC(20,2) NOT NULL DEFAULT 0,
    tax_total     NUMERIC(20,2) NOT NULL DEFAULT 0,
    grand_total   NUMERIC(20,2) NOT NULL DEFAULT 0,
    currency_code TEXT NOT NULL DEFAULT 'USD',
    shipping_address JSONB,
    billing_address  JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX idx_orders_tenant_user ON orders(tenant_id, user_id);

CREATE TABLE order_items (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES variants(id) ON DELETE SET NULL,
    name       TEXT NOT NULL,
    sku        TEXT,
    quantity   INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(20,2) NOT NULL,
    line_total NUMERIC(20,2) NOT NULL
);

-- ============================================================
-- Audit / updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated  BEFORE UPDATE ON tenants  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_variants_updated BEFORE UPDATE ON variants FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_updated   BEFORE UPDATE ON orders   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tenant_settings_updated BEFORE UPDATE ON tenant_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
