-- Per-tenant SMTP configuration for transactional emails.
-- Falls back to platform-level SMTP env vars (SMTP_HOST, SMTP_PORT, etc.) when not configured or disabled.

CREATE TABLE IF NOT EXISTS tenant_smtp_settings (
    tenant_id  UUID NOT NULL PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    host       TEXT NOT NULL DEFAULT '',
    port       INTEGER NOT NULL DEFAULT 587,
    username   TEXT NOT NULL DEFAULT '',
    password   TEXT NOT NULL DEFAULT '',
    from_email TEXT NOT NULL DEFAULT '',
    from_name  TEXT NOT NULL DEFAULT '',
    encryption TEXT NOT NULL DEFAULT 'starttls', -- none | ssl | starttls
    enabled    BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_tenant_smtp_settings_updated
    BEFORE UPDATE ON tenant_smtp_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
