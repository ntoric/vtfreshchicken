-- 0023_idempotency_keys.sql
-- Idempotency key storage for mutation endpoints.
-- Allows clients to safely retry requests without side effects (double charges, duplicate orders, etc.)

CREATE TABLE IF NOT EXISTS idempotency_keys (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id         UUID,
    key             TEXT NOT NULL,
    scope           TEXT NOT NULL,
    request_hash    TEXT,
    status          TEXT NOT NULL DEFAULT 'processing',
    response_status INT,
    response_body   JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    UNIQUE(tenant_id, scope, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON idempotency_keys(tenant_id, scope, key);
CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_keys(created_at);

-- Add idempotency_key column to orders for audit/reconciliation
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
