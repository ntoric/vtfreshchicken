-- 0033_order_tax_fields.sql
-- Add per-item and per-order tax breakdown storage.

-- Per-item tax fields: store the tax amount, effective rate, and tax class
-- assigned at the time of purchase so historical orders remain accurate even
-- if tax configuration changes later.
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS tax_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tax_rate     NUMERIC(6,4)  NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tax_class_id UUID          REFERENCES tax_classes(id) ON DELETE SET NULL;

-- Per-order tax breakdown: JSONB array of TaxBreakdownLine records capturing
-- the full breakdown (rate name, class, zone, taxable amount, tax amount) at
-- the time of purchase.
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS tax_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb;
