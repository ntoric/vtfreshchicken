-- 0038_shipments_estimated_delivery.sql
-- Optional estimated delivery date on shipments, settable by admins when
-- creating a shipment and displayed in the order details shipment section.

ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS estimated_delivery TIMESTAMPTZ;
