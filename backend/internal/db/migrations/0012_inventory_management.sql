-- 0012_inventory_management.sql
-- Inventory and stock management module

-- Low stock threshold on products (admin-configurable)
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INT NOT NULL DEFAULT 5;

-- Track stock on hand separately from the products.stock column for variant-aware products
ALTER TABLE products ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN NOT NULL DEFAULT TRUE;

-- Stock movements audit log
CREATE TABLE IF NOT EXISTS stock_movements (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id   UUID REFERENCES variants(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL,        -- purchase, adjustment, order, restock, return, cancellation
    quantity     INT NOT NULL,           -- positive = stock in, negative = stock out
    reason       TEXT,
    reference    TEXT,                   -- order ID, PO number, etc.
    created_by   UUID REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant ON stock_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_variant ON stock_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at DESC);
