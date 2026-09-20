-- 0010_payments_module.sql
-- Payment management: payment transactions, gateway configurations, and refund tracking.

-- Payment transactions record every payment event for an order.
-- An order may have multiple transactions (e.g., initial capture + partial refund).
CREATE TABLE payment_transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id         UUID,                           -- customer user ID (nullable for guest checkout)
    gateway         TEXT NOT NULL,                  -- e.g., 'card', 'paypal', 'razorpay', 'cod'
    gateway_txn_id  TEXT,                           -- gateway transaction/reference ID
    type            TEXT NOT NULL DEFAULT 'capture', -- 'capture', 'authorize', 'refund', 'void'
    status          TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed', 'refunded', 'partial_refund'
    amount          NUMERIC(10,2) NOT NULL,         -- transaction amount
    currency_code   TEXT NOT NULL DEFAULT 'USD',
    refunded_amount NUMERIC(10,2) NOT NULL DEFAULT 0, -- total refunded for this transaction
    gateway_response JSONB,                         -- raw gateway response (sanitized)
    failure_reason  TEXT,                           -- error message if failed
    customer_email  TEXT,
    customer_name   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payment_txn_tenant ON payment_transactions(tenant_id);
CREATE INDEX idx_payment_txn_order ON payment_transactions(order_id);
CREATE INDEX idx_payment_txn_status ON payment_transactions(tenant_id, status);
CREATE INDEX idx_payment_txn_gateway ON payment_transactions(tenant_id, gateway);
CREATE INDEX idx_payment_txn_created ON payment_transactions(tenant_id, created_at DESC);

-- Payment gateway configurations allow tenants to enable/disable and configure gateways.
-- The actual gateway implementations are in the payment package; this table stores
-- per-tenant configuration (API keys, enabled status, display settings).
CREATE TABLE payment_gateway_configs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    gateway_code    TEXT NOT NULL,                  -- 'card', 'paypal', 'razorpay', 'cod', etc.
    display_name    TEXT NOT NULL,                  -- custom display name (e.g., "Credit Card")
    is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    is_test_mode    BOOLEAN NOT NULL DEFAULT TRUE,  -- use sandbox/test credentials
    sort_order      INT NOT NULL DEFAULT 0,
    config          JSONB NOT NULL DEFAULT '{}'::jsonb, -- encrypted config (API keys, secrets)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, gateway_code)
);
CREATE INDEX idx_payment_gateway_config_tenant ON payment_gateway_configs(tenant_id);

-- Add payment-related fields to orders
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_status     TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS paid_at            TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS refunded_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS payment_metadata   JSONB;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trg_payment_transactions_updated_at ON payment_transactions;
CREATE TRIGGER trg_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_payment_gateway_configs_updated_at ON payment_gateway_configs;
CREATE TRIGGER trg_payment_gateway_configs_updated_at BEFORE UPDATE ON payment_gateway_configs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Backfill payment_status for existing orders based on their status
UPDATE orders SET payment_status = 'paid' WHERE status IN ('paid','processing','shipped','delivered') AND payment_status = 'pending';
UPDATE orders SET payment_status = 'failed' WHERE status = 'failed';
UPDATE orders SET payment_status = 'refunded' WHERE status = 'refunded';
UPDATE orders SET payment_status = 'cancelled' WHERE status = 'cancelled';

-- Backfill paid_at for orders that are already paid
UPDATE orders SET paid_at = created_at WHERE status IN ('paid','processing','shipped','delivered') AND paid_at IS NULL;

-- Seed default gateway configs for existing tenants
INSERT INTO payment_gateway_configs (tenant_id, gateway_code, display_name, is_enabled, is_test_mode, sort_order)
SELECT id, 'card', 'Credit / Debit Card', TRUE, TRUE, 10
FROM tenants
WHERE NOT EXISTS (SELECT 1 FROM payment_gateway_configs WHERE tenant_id = tenants.id AND gateway_code = 'card');

INSERT INTO payment_gateway_configs (tenant_id, gateway_code, display_name, is_enabled, is_test_mode, sort_order)
SELECT id, 'paypal', 'PayPal', TRUE, TRUE, 20
FROM tenants
WHERE NOT EXISTS (SELECT 1 FROM payment_gateway_configs WHERE tenant_id = tenants.id AND gateway_code = 'paypal');

INSERT INTO payment_gateway_configs (tenant_id, gateway_code, display_name, is_enabled, is_test_mode, sort_order)
SELECT id, 'cod', 'Cash on Delivery', TRUE, FALSE, 90
FROM tenants
WHERE NOT EXISTS (SELECT 1 FROM payment_gateway_configs WHERE tenant_id = tenants.id AND gateway_code = 'cod');

INSERT INTO payment_gateway_configs (tenant_id, gateway_code, display_name, is_enabled, is_test_mode, sort_order)
SELECT id, 'razorpay', 'Razorpay', TRUE, TRUE, 30
FROM tenants
WHERE NOT EXISTS (SELECT 1 FROM payment_gateway_configs WHERE tenant_id = tenants.id AND gateway_code = 'razorpay');
