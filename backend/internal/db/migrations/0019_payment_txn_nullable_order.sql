-- Allow payment_transactions.order_id to be NULL.
-- Wallet top-ups are recorded as payment transactions but have no associated order.
-- Previously, order_id was NOT NULL which prevented recording non-order payments.

ALTER TABLE payment_transactions ALTER COLUMN order_id DROP NOT NULL;
