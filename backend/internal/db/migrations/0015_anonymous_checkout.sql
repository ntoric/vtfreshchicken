-- 0015_anonymous_checkout.sql
-- Allow tenants to enable/disable anonymous (guest) checkout.
-- Also add session_id to orders so guest orders can be linked to a customer
-- account when they register after purchase.

ALTER TABLE tenant_settings
    ADD COLUMN IF NOT EXISTS anonymous_checkout BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(tenant_id, session_id) WHERE user_id IS NULL;
