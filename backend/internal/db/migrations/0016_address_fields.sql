-- 0016_address_fields.sql
-- Add first_name, last_name, email to addresses table
-- so saved addresses can fully populate the checkout shipping form.

ALTER TABLE addresses
    ADD COLUMN IF NOT EXISTS first_name TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS last_name TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
