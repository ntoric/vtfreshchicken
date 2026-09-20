-- 0034_product_shipping_fields.sql
-- Add product-level shipping settings and order-level shipping weight.

-- Product shipping fields:
--   weight          — in kilograms (for weight-based shipping calculation)
--   length, width, height — in centimeters (for volumetric/carrier integration)
--   free_shipping   — per-product free shipping override
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS weight        NUMERIC(10,3) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS length        NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS width         NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS height        NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS free_shipping BOOLEAN     NOT NULL DEFAULT FALSE;

-- Shipping method weight-based rate:
--   weight_rate — additional rate per kg on top of base_rate (0 = flat rate)
ALTER TABLE shipping_methods
    ADD COLUMN IF NOT EXISTS weight_rate NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Order shipping weight:
--   shipping_weight — total physical item weight in kg (for records/carrier integration)
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS shipping_weight NUMERIC(10,3) NOT NULL DEFAULT 0;
