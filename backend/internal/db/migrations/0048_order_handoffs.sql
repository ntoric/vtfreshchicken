-- Migration 0048: order branch handoffs + per-item branch assignment
--
-- order_items.branch_id marks which branch fulfils that line (NULL = the
-- order's own branch_id). order_handoffs tracks requests to hand an order —
-- or specific items — to another branch. The receiving branch accepts (the
-- order/items move to it) or rejects (the origin branch can try another
-- branch or cancel the order).

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_branch ON order_items(branch_id);

CREATE TABLE IF NOT EXISTS order_handoffs (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    to_branch_id   UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    item_ids       JSONB NOT NULL DEFAULT '[]'::jsonb, -- empty = whole order
    status         TEXT NOT NULL DEFAULT 'pending',    -- pending, accepted, rejected, cancelled
    note           TEXT NOT NULL DEFAULT '',
    created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    responded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    responded_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_handoffs_order ON order_handoffs(order_id);
CREATE INDEX IF NOT EXISTS idx_order_handoffs_to ON order_handoffs(to_branch_id, status);
CREATE INDEX IF NOT EXISTS idx_order_handoffs_tenant ON order_handoffs(tenant_id);
