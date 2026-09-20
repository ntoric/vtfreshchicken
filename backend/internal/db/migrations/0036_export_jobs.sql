-- Export jobs for async bulk exports with email delivery
CREATE TABLE IF NOT EXISTS export_jobs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type         TEXT NOT NULL,          -- orders, products, customers, payments, etc.
    format       TEXT NOT NULL DEFAULT 'csv',
    filters      JSONB NOT NULL DEFAULT '{}'::jsonb,
    email        TEXT,                   -- optional; if set, file is emailed on completion
    status       TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
    file_path    TEXT,                   -- relative path under uploads dir
    file_name    TEXT,
    file_size    BIGINT NOT NULL DEFAULT 0,
    rows_total   INT NOT NULL DEFAULT 0,
    rows_done    INT NOT NULL DEFAULT 0,
    error        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at   TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_tenant    ON export_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status    ON export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_user      ON export_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_created   ON export_jobs(created_at DESC);
