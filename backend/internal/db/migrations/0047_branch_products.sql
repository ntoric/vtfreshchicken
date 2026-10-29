-- Migration 0047: per-branch product assignment
--
-- products.branch_id is nullable: NULL means the product is store-wide
-- (visible and sellable at every branch). When set, the product is exclusive
-- to that branch — it only appears in that branch's backoffice scope and in
-- storefront listings requested with that branch's context, and checkout
-- rejects it when the order is resolved to a different branch.

ALTER TABLE products ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_branch ON products(branch_id);
