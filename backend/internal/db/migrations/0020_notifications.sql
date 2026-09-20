-- Notification events: catalog of events that can trigger notifications
CREATE TABLE notification_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code            TEXT NOT NULL,                          -- e.g., order_placed, order_shipped, customer_registered
    name            TEXT NOT NULL,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    is_instant      BOOLEAN NOT NULL DEFAULT true,          -- instant delivery vs scheduled digest
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_notif_events_tenant ON notification_events(tenant_id);

-- Notification templates: content per event per medium
CREATE TABLE notification_templates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_id        UUID NOT NULL REFERENCES notification_events(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    medium          TEXT NOT NULL,                          -- email | sms | push
    subject         TEXT,                                   -- email subject line
    body_html       TEXT,                                   -- HTML body (for email / push)
    body_text       TEXT,                                   -- plain text body (for SMS / fallback)
    parameters      JSONB NOT NULL DEFAULT '[]'::jsonb,     -- available template parameters: [{"key":"customer_name","label":"Customer Name","required":true}]
    recipient_type  TEXT NOT NULL DEFAULT 'customer',       -- customer | staff | business_admin | all_staff | all_customers | specific_emails
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, event_id, medium)
);
CREATE INDEX idx_notif_templates_tenant ON notification_templates(tenant_id);
CREATE INDEX idx_notif_templates_event ON notification_templates(event_id);

-- Notification recipients: specific email/phone targets for a template (when recipient_type = specific_emails)
CREATE TABLE notification_recipients (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    template_id     UUID NOT NULL REFERENCES notification_templates(id) ON DELETE CASCADE,
    name            TEXT,
    email           TEXT,
    phone           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notif_recipients_template ON notification_recipients(template_id);

-- Notification logs: record of sent notifications
CREATE TABLE notification_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    template_id     UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
    event_id        UUID REFERENCES notification_events(id) ON DELETE SET NULL,
    medium          TEXT NOT NULL,                          -- email | sms | push
    recipient       TEXT NOT NULL,                          -- email address or phone number
    subject         TEXT,
    body            TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',        -- pending | sent | failed
    error           TEXT,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notif_logs_tenant ON notification_logs(tenant_id);
CREATE INDEX idx_notif_logs_status ON notification_logs(tenant_id, status);
CREATE INDEX idx_notif_logs_created ON notification_logs(tenant_id, created_at DESC);

-- Update triggers
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_notif_events BEFORE UPDATE ON notification_events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_notif_templates BEFORE UPDATE ON notification_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed default notification events for existing tenants
INSERT INTO notification_events (tenant_id, code, name, description, is_instant)
SELECT t.id, e.code, e.name, e.description, e.is_instant
FROM tenants t
CROSS JOIN (VALUES
    ('order_placed', 'Order Placed', 'Triggered when a customer places an order', true),
    ('order_confirmed', 'Order Confirmed', 'Triggered when an order is confirmed', true),
    ('order_shipped', 'Order Shipped', 'Triggered when an order is shipped', true),
    ('order_delivered', 'Order Delivered', 'Triggered when an order is delivered', true),
    ('order_cancelled', 'Order Cancelled', 'Triggered when an order is cancelled', true),
    ('order_refunded', 'Order Refunded', 'Triggered when a refund is processed', true),
    ('customer_registered', 'Customer Registered', 'Triggered when a new customer registers', true),
    ('customer_welcome', 'Welcome Email', 'Sent to new customers after registration', true),
    ('password_reset', 'Password Reset', 'Triggered when a password reset is requested', true),
    ('low_stock_alert', 'Low Stock Alert', 'Triggered when a product reaches low stock threshold', true),
    ('abandoned_cart', 'Abandoned Cart', 'Sent to customers with items left in cart', false),
    ('payment_received', 'Payment Received', 'Triggered when a payment is successfully captured', true),
    ('payment_failed', 'Payment Failed', 'Triggered when a payment attempt fails', true),
    ('product_review_request', 'Review Request', 'Sent to customers after delivery to request a review', false)
) AS e(code, name, description, is_instant)
WHERE NOT EXISTS (
    SELECT 1 FROM notification_events ne WHERE ne.tenant_id = t.id AND ne.code = e.code
);
