-- Migration 0030: product requires_shipping flag
-- Products that don't require shipping (digital goods, services, etc.) skip
-- the 'shipped' state and go directly from 'processing' to 'delivered'.

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS requires_shipping BOOLEAN NOT NULL DEFAULT true;
