-- 0007_order_workflow.sql
-- Add order management and workflow fields to the orders table.
-- Supports tracking numbers, carriers, status history, and audit timestamps.

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS tracking_number  TEXT,
    ADD COLUMN IF NOT EXISTS carrier          TEXT,
    ADD COLUMN IF NOT EXISTS shipped_at       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS delivered_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancelled_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancel_reason    TEXT,
    ADD COLUMN IF NOT EXISTS internal_notes   TEXT,
    ADD COLUMN IF NOT EXISTS payment_method   TEXT,
    ADD COLUMN IF NOT EXISTS transaction_id   TEXT,
    ADD COLUMN IF NOT EXISTS shipping_method  TEXT,
    ADD COLUMN IF NOT EXISTS customer_email   TEXT,
    ADD COLUMN IF NOT EXISTS customer_name    TEXT,
    ADD COLUMN IF NOT EXISTS status_history   JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Index for filtering by status (already exists but add composite for status+date)
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status_created ON orders(tenant_id, status, created_at DESC);

-- Backfill payment_method, transaction_id, shipping_method from existing data if available
-- (These were previously only in the checkout response, not stored on the order row)
