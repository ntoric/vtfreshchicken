-- 0032_shipping_providers.sql
-- Shipping provider integration (Delhivery, etc.) and shipment tracking.

-- Per-tenant shipping provider configurations.
CREATE TABLE IF NOT EXISTS shipping_providers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider_code TEXT NOT NULL, -- e.g. 'delhivery'
    display_name  TEXT NOT NULL DEFAULT '',
    api_key       TEXT NOT NULL DEFAULT '',
    api_base_url  TEXT NOT NULL DEFAULT '',  -- override; empty = use provider default
    is_enabled    BOOLEAN NOT NULL DEFAULT false,
    is_test_mode  BOOLEAN NOT NULL DEFAULT true,
    config        JSONB NOT NULL DEFAULT '{}'::jsonb, -- provider-specific extra config
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, provider_code)
);

-- Shipments link orders to carrier tracking records.
CREATE TABLE IF NOT EXISTS shipments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider_code     TEXT NOT NULL,        -- e.g. 'delhivery'
    tracking_number   TEXT NOT NULL DEFAULT '',  -- waybill / AWB number
    carrier           TEXT NOT NULL DEFAULT '',
    awb_url           TEXT NOT NULL DEFAULT '',  -- printable label URL
    status            TEXT NOT NULL DEFAULT 'pending', -- pending|booked|picked_up|in_transit|out_for_delivery|delivered|cancelled|failed
    pickup_scheduled_at TIMESTAMPTZ,
    picked_up_at      TIMESTAMPTZ,
    delivered_at      TIMESTAMPTZ,
    raw_metadata      JSONB NOT NULL DEFAULT '{}'::jsonb, -- last raw tracking response
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipments_tenant ON shipments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number) WHERE tracking_number <> '';

-- updated_at triggers
CREATE TRIGGER set_updated_at_shipping_providers BEFORE UPDATE ON shipping_providers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_shipments BEFORE UPDATE ON shipments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
