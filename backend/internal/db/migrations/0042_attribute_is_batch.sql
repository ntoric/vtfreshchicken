-- Migration 0042: is_batch flag on attributes
--
-- Attributes flagged is_batch are used to define batch-level values (e.g.
-- batch number, manufacture/expiry datetimes) rather than product-level or
-- variant-defining attributes.

ALTER TABLE attributes
    ADD COLUMN IF NOT EXISTS is_batch BOOLEAN NOT NULL DEFAULT FALSE;
