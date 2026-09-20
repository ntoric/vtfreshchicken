-- 0021_order_returns.sql
-- Order returns, replacements, and refund tracking

CREATE TABLE IF NOT EXISTS order_returns (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    return_number   TEXT NOT NULL,
    type            TEXT NOT NULL DEFAULT 'refund',   -- 'refund' | 'replacement' | 'exchange'
    status          TEXT NOT NULL DEFAULT 'requested', -- 'requested' | 'approved' | 'rejected' | 'completed' | 'cancelled'
    reason          TEXT NOT NULL DEFAULT '',
    refund_amount   NUMERIC(20,2) NOT NULL DEFAULT 0,
    refund_method   TEXT NOT NULL DEFAULT 'original', -- 'original' | 'wallet' | 'store_credit' | 'none'
    restock         BOOLEAN NOT NULL DEFAULT true,
    status_history  JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by      UUID,                              -- admin user who created/approved
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    UNIQUE (tenant_id, return_number)
);

CREATE INDEX IF NOT EXISTS idx_order_returns_tenant ON order_returns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_returns_order ON order_returns(order_id);
CREATE INDEX IF NOT EXISTS idx_order_returns_status ON order_returns(status);

CREATE TABLE IF NOT EXISTS order_return_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_id       UUID NOT NULL REFERENCES order_returns(id) ON DELETE CASCADE,
    order_item_id   UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
    variant_id      UUID REFERENCES variants(id) ON DELETE SET NULL,
    name            TEXT NOT NULL,
    sku             TEXT,
    quantity        INT NOT NULL DEFAULT 1,
    unit_price      NUMERIC(20,2) NOT NULL,
    line_total      NUMERIC(20,2) NOT NULL,
    reason          TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_order_return_items_return ON order_return_items(return_id);

-- Add return-related columns to orders for quick lookup
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS return_status TEXT; -- null, 'return_requested', 'return_approved', 'return_completed'

-- Auto-update updated_at on order_returns
CREATE OR REPLACE FUNCTION trg_order_returns_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_returns_updated_at ON order_returns;
CREATE TRIGGER trg_order_returns_updated_at
    BEFORE UPDATE ON order_returns
    FOR EACH ROW
    EXECUTE FUNCTION trg_order_returns_set_updated_at();
