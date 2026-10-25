-- Migration 0041: store-level kill switch for the return / refund / replacement policy
--
-- When returns_enabled is false, customers cannot request returns, refunds, or
-- replacements on the storefront — all eligibility is reported as unavailable.
-- Existing return records remain manageable in the backoffice.

ALTER TABLE tenant_settings
    ADD COLUMN IF NOT EXISTS returns_enabled BOOLEAN NOT NULL DEFAULT TRUE;
