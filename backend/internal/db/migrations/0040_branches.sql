-- Migration 0040: multi-branch / multi-outlet support
--
-- A store can have multiple branches (outlets). Each branch carries its own
-- delivery service area (circle centre + radius + named areas, same shape as
-- the legacy tenant_settings.service_area). Orders are assigned to the
-- nearest branch whose service area covers the delivery location; when no
-- branch covers it, the order is rejected.
--
-- branch_id columns are nullable everywhere: NULL means "all branches" on
-- offers/discount_codes, "no branch" on orders/users/stock_movements.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'branch_manager';

CREATE TABLE IF NOT EXISTS branches (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL,
    phone       TEXT NOT NULL DEFAULT '',
    email       TEXT NOT NULL DEFAULT '',
    line1       TEXT NOT NULL DEFAULT '',
    line2       TEXT NOT NULL DEFAULT '',
    city        TEXT NOT NULL DEFAULT '',
    state       TEXT NOT NULL DEFAULT '',
    postal_code TEXT NOT NULL DEFAULT '',
    country     TEXT NOT NULL DEFAULT '',
    -- Delivery service area for this branch (circle + named areas).
    center_lat  DOUBLE PRECISION NOT NULL DEFAULT 0,
    center_lng  DOUBLE PRECISION NOT NULL DEFAULT 0,
    radius_km   DOUBLE PRECISION NOT NULL DEFAULT 0,
    areas       JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches(tenant_id);
-- At most one default branch per store.
CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_one_default
    ON branches(tenant_id) WHERE is_default;

ALTER TABLE users           ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE orders          ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE offers          ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE discount_codes  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_branch ON stock_movements(branch_id);

-- Optional per-branch stock overlay. When a row exists for
-- (branch, product[, variant]) it is enforced at checkout; when absent the
-- item draws from the shared store-level stock (products.stock /
-- variants.stock, which is still always decremented).
CREATE TABLE IF NOT EXISTS branch_stock (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES variants(id) ON DELETE CASCADE,
    stock      INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE NULLS NOT DISTINCT (branch_id, product_id, variant_id)
);
CREATE INDEX IF NOT EXISTS idx_branch_stock_tenant ON branch_stock(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branch_stock_product ON branch_stock(product_id);

-- Permissions catalog entries for branch administration. Role grants are
-- managed per-tenant via /api/permissions/seed (SeedDefaultPermissions).
INSERT INTO permissions (code, module, action, description) VALUES
('branches.view',   'branches', 'view',   'View branches/outlets'),
('branches.manage', 'branches', 'manage', 'Create, update, delete branches and their service areas')
ON CONFLICT (code) DO NOTHING;

-- Seed a default branch per store from the legacy service_area setting so
-- delivery enforcement keeps working identically once branches exist.
INSERT INTO branches (tenant_id, name, slug, state, country, center_lat, center_lng, radius_km, areas, is_active, is_default)
SELECT t.id,
       'Main Branch',
       'main',
       COALESCE(ts.service_area->>'state', ''),
       COALESCE(ts.service_area->>'country', ''),
       COALESCE((ts.service_area->>'center_lat')::float8, 0),
       COALESCE((ts.service_area->>'center_lng')::float8, 0),
       COALESCE((ts.service_area->>'radius_km')::float8, 0),
       COALESCE(ts.service_area->'areas', '[]'::jsonb),
       TRUE, TRUE
FROM tenants t
JOIN tenant_settings ts ON ts.tenant_id = t.id
WHERE COALESCE((ts.service_area->>'enabled')::boolean, FALSE)
  AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.tenant_id = t.id);
