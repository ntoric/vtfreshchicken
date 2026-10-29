-- Migration 0045: is_internal flag on attributes
--
-- Attributes flagged is_internal are for internal use only (e.g. expiry date,
-- manufacturing date, supplier codes). Their definitions and values are
-- excluded from public storefront responses (bootstrap, product list/detail)
-- but remain fully available via admin endpoints.

ALTER TABLE attributes
    ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT FALSE;
