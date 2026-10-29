-- Migration 0046: delivery partners (riders)
--
-- A delivery partner is a store user with the 'delivery_partner' role who can
-- only access the dedicated delivery portal. Each partner is allocated to one
-- or more branches (delivery_partner_branches) and sees orders marked 'ready'
-- for the branches they cover. Partners claim ready orders themselves, or
-- staff/managers/admins assign orders to them. Claiming (or starting an
-- assigned delivery) moves the order ready → shipped; the partner then marks
-- it delivered.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'delivery_partner';

-- Which branches a delivery partner is allocated to. Every partner must have
-- at least one row here (enforced by the API); partners can cover multiple
-- branches.
CREATE TABLE IF NOT EXISTS delivery_partner_branches (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_dpb_tenant ON delivery_partner_branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dpb_user   ON delivery_partner_branches(user_id);
CREATE INDEX IF NOT EXISTS idx_dpb_branch ON delivery_partner_branches(branch_id);

-- The delivery partner currently assigned to an order (NULL = unassigned).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_partner_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_assigned_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_orders_delivery_partner ON orders(delivery_partner_id);
