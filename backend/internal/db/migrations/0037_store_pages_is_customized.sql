-- 0037_store_pages_is_customized.sql
-- Track whether a store page has been customized via the page builder.
-- Seeded system pages start with is_customized=false so the storefront can
-- fall back to the rich built-in landing page; once a tenant edits the page
-- through the page builder, is_customized is set to true and the storefront
-- renders the builder blocks instead.

ALTER TABLE store_pages
    ADD COLUMN IF NOT EXISTS is_customized BOOLEAN NOT NULL DEFAULT false;
