-- Migration 0029: replacement / exchange order linking
-- When a return of type 'replacement' or 'exchange' is approved, a new order
-- is automatically created to ship the replacement items. These columns link
-- the replacement order back to the original order and the return that triggered it.

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS replaces_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS return_id        UUID REFERENCES order_returns(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS order_tag        TEXT; -- 'replacement', 'exchange', or NULL for normal orders

CREATE INDEX IF NOT EXISTS idx_orders_replaces_order_id ON orders(replaces_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_return_id ON orders(return_id);
