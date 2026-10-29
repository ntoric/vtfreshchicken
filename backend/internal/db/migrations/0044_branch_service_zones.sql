-- Migration 0044: multi-level service areas (delivery zones) per branch
--
-- service_zones JSONB shape (sorted ascending by radius_km on write):
--   [
--     { "radius_km": 2,  "charge_type": "free",   "charge": 0,  "label": "" },
--     { "radius_km": 8,  "charge_type": "per_km", "charge": 10, "label": "" },
--     { "radius_km": 15, "charge_type": "flat",   "charge": 80, "label": "" }
--   ]
--
-- Each zone is a concentric ring around the branch centre. A delivery at
-- distance d is charged by the first zone whose radius_km >= d:
--   free   → no delivery charge
--   flat   → fixed "charge" amount
--   per_km → "charge" per km beyond the inner edge of that ring
--            (the previous zone's radius_km), e.g. first 2 km free then
--            ₹10/km beyond that.
-- When zones exist the outermost ring replaces radius_km as the branch's
-- delivery boundary (the circle shown to customers). Zone charges apply at
-- checkout only when the dedicated Shipping module is disabled.

ALTER TABLE branches
    ADD COLUMN IF NOT EXISTS service_zones JSONB NOT NULL DEFAULT '[]'::jsonb;
