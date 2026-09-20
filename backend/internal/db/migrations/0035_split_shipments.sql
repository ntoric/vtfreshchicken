-- 0035_split_shipments.sql
-- Per-item shipping: store shipping method, cost, and weight on each order item.
-- Split shipments: link shipments to specific order items via a junction table.

-- Per-item shipping fields on order_items
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS shipping_method TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS shipping_weight NUMERIC(10,3) NOT NULL DEFAULT 0;

-- Junction table linking shipments to specific order items
CREATE TABLE IF NOT EXISTS shipment_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id   UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    quantity      INT NOT NULL DEFAULT 1,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(shipment_id, order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment ON shipment_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_order_item ON shipment_items(order_item_id);
