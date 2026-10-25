-- Migration 0039: configurable delivery service area (per-tenant)
--
-- service_area JSONB shape:
--   {
--     "enabled":    bool,     -- when false, no delivery-area restriction
--     "label":      string,   -- human label, e.g. "Malappuram district, Kerala"
--     "state":      string,   -- default address state for deliveries
--     "country":    string,   -- default address country for deliveries
--     "center_lat": float,    -- service circle centre latitude
--     "center_lng": float,    -- service circle centre longitude
--     "radius_km":  float,    -- service circle radius in kilometres
--     "areas":      []string  -- named towns/areas shown in the location picker
--   }

ALTER TABLE tenant_settings
    ADD COLUMN IF NOT EXISTS service_area JSONB;

-- Seed the existing store with the current launch area (Malappuram district,
-- Kerala) so storefront behaviour stays identical until changed in the
-- backoffice.
UPDATE tenant_settings
SET service_area = '{
  "enabled": true,
  "label": "Malappuram district, Kerala",
  "state": "Kerala",
  "country": "India",
  "center_lat": 11.051,
  "center_lng": 76.071,
  "radius_km": 50,
  "areas": [
    "Malappuram", "Manjeri", "Perinthalmanna", "Tirur", "Tirurangadi",
    "Parappanangadi", "Tanur", "Ponnani", "Kottakkal", "Valanchery",
    "Kondotty", "Kuttippuram", "Edappal", "Changaramkulam", "Chemmad",
    "Vengara", "Puthanathani", "Kalpakanchery", "Kolathur", "Pulamanthole",
    "Nilambur", "Wandoor", "Areekode", "Edavanna", "Vaniyambalam",
    "Mankada", "Melattur", "Pandikkad", "Karuvarakundu"
  ]
}'::jsonb
WHERE service_area IS NULL;
