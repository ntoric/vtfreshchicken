-- Migration 0002: seed base currencies, languages, and a demo tenant + catalog

INSERT INTO currencies (code, name, symbol, decimals) VALUES
    ('USD', 'US Dollar', '$', 2),
    ('EUR', 'Euro', '€', 2),
    ('GBP', 'British Pound', '£', 2),
    ('INR', 'Indian Rupee', '₹', 2),
    ('AED', 'UAE Dirham', 'د.إ', 2),
    ('JPY', 'Japanese Yen', '¥', 0)
ON CONFLICT (code) DO NOTHING;

INSERT INTO languages (code, name) VALUES
    ('en', 'English'),
    ('es', 'Spanish'),
    ('fr', 'French'),
    ('ar', 'Arabic'),
    ('de', 'German')
ON CONFLICT (code) DO NOTHING;

-- Demo tenant
INSERT INTO tenants (id, slug, name, description)
VALUES ('11111111-1111-1111-1111-111111111111', 'demo', 'VT Fresh Chicken', 'Farm-fresh & frozen chicken, delivered daily')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO tenant_settings (tenant_id, default_currency_id, default_language, supported_languages, brand_color)
SELECT '11111111-1111-1111-1111-111111111111', c.id, 'en', ARRAY['en'], '#dc2626'
FROM currencies c WHERE c.code = 'INR'
ON CONFLICT (tenant_id) DO NOTHING;

-- Demo categories
INSERT INTO categories (tenant_id, slug, name, description, sort_order) VALUES
    ('11111111-1111-1111-1111-111111111111', 'fresh-chicken', 'Fresh Chicken', 'Chilled whole birds and fresh cuts, delivered daily', 1),
    ('11111111-1111-1111-1111-111111111111', 'frozen-chicken', 'Frozen Chicken', 'Flash-frozen chicken and crispy snacks for your freezer', 2),
    ('11111111-1111-1111-1111-111111111111', 'marinated', 'Marinated', 'Pre-marinated chicken, ready for the pan or grill', 3),
    ('11111111-1111-1111-1111-111111111111', 'eggs-extras', 'Eggs & Extras', 'Farm eggs and specialty items to complete your order', 4)
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- Variant attributes for demo tenant
INSERT INTO attributes (tenant_id, slug, name, type, is_filterable, is_variant) VALUES
    ('11111111-1111-1111-1111-111111111111', 'pack-size', 'Pack Size', 'select', TRUE, TRUE),
    ('11111111-1111-1111-1111-111111111111', 'cut', 'Cut', 'select', TRUE, FALSE),
    ('11111111-1111-1111-1111-111111111111', 'storage', 'Storage', 'select', TRUE, FALSE),
    ('11111111-1111-1111-1111-111111111111', 'farming', 'Farming', 'select', TRUE, FALSE)
ON CONFLICT (tenant_id, slug) DO NOTHING;

INSERT INTO attribute_options (attribute_id, value, label, sort_order)
SELECT a.id, v.value, v.label, v.sort_order FROM attributes a
JOIN (VALUES
    ('pack-size','500g','500 g',1),('pack-size','1kg','1 kg',2),('pack-size','1-5kg','1.5 kg',3),('pack-size','2kg','2 kg',4),
    ('pack-size','6pcs','6 pcs',5),('pack-size','12pcs','12 pcs',6),('pack-size','30pcs','30 pcs',7),
    ('cut','whole-bird','Whole Bird',1),('cut','breast','Breast',2),('cut','thigh','Thigh',3),('cut','drumstick','Drumstick',4),
    ('cut','wings','Wings',5),('cut','keema','Keema / Mince',6),('cut','curry-cut','Curry Cut',7),
    ('storage','chilled','Chilled (0–4°C)',1),('storage','frozen','Frozen (-18°C)',2),
    ('farming','free-range','Free-Range',1),('farming','farm-raised','Farm-Raised',2),('farming','antibiotic-free','Antibiotic-Free',3)
) AS v(attr, value, label, sort_order) ON v.attr = a.slug
WHERE a.tenant_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (attribute_id, value) DO NOTHING;

-- Demo products (a few across categories)
INSERT INTO products (tenant_id, category_id, slug, name, description, sku, status, base_price, currency_id, is_featured, stock, image_url, rating)
SELECT '11111111-1111-1111-1111-111111111111', c.id, p.slug, p.name, p.description, p.sku, 'active', p.price, cur.id, p.featured, p.stock, p.image, p.rating
FROM currencies cur
JOIN categories c ON c.tenant_id = '11111111-1111-1111-1111-111111111111'
JOIN (VALUES
    ('fresh-chicken','whole-chicken','Whole Chicken (Skin-On)','Farm-fresh whole broiler, cleaned and ready to roast. Approx. 1.2 kg.','CHK-WHL-001', 8.99, TRUE, 60, 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=600', 4.80),
    ('fresh-chicken','chicken-breast-boneless','Chicken Breast (Boneless)','Lean, high-protein boneless breast fillets, trimmed fresh daily.','CHK-BRS-002', 9.49, TRUE, 80, 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=600', 4.70),
    ('fresh-chicken','chicken-drumsticks','Chicken Drumsticks','Meaty drumsticks — perfect for frying, grilling or slow curries.','CHK-DRM-003', 6.99, FALSE, 90, 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600', 4.60),
    ('fresh-chicken','chicken-wings','Chicken Wings','Plump wings, great for buffalo, BBQ or tandoori style.','CHK-WNG-004', 7.49, TRUE, 75, 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600', 4.70),
    ('fresh-chicken','chicken-keema','Chicken Keema (Mince)','Finely ground chicken — ideal for kebabs, kofta and bolognese.','CHK-KEM-005', 8.49, FALSE, 50, 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=600', 4.50),
    ('fresh-chicken','chicken-curry-cut','Chicken Curry Cut (Bone-In)','Bone-in pieces cut to size for rich curries and biryani.','CHK-CRC-006', 7.99, FALSE, 70, 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600', 4.60),
    ('frozen-chicken','frozen-whole-chicken','Frozen Whole Chicken','Flash-frozen whole bird — stock the freezer and save.','FRZ-WHL-007', 5.99, FALSE, 40, 'https://images.unsplash.com/photo-1501200291289-c5a76c232e5f?w=600', 4.40),
    ('frozen-chicken','chicken-nuggets','Crispy Chicken Nuggets','Golden, ready-to-fry nuggets. A family favourite.','FRZ-NUG-008', 5.49, TRUE, 120, 'https://images.unsplash.com/photo-1562967916-eb82221dfb92?w=600', 4.80),
    ('frozen-chicken','chicken-strips','Crispy Chicken Strips','Breaded tenderloin strips — fry or bake in minutes.','FRZ-STR-009', 6.49, FALSE, 100, 'https://images.unsplash.com/photo-1585325701956-60dd9c8553bc?w=600', 4.60),
    ('frozen-chicken','chicken-lollipop','Chicken Lollipop (Frozen)','Frenched wingettes, lightly seasoned and ready to fry.','FRZ-LOL-010', 7.99, FALSE, 60, 'https://images.unsplash.com/photo-1614398751058-eb2e0bf63e53?w=600', 4.70),
    ('marinated','tandoori-chicken','Tandoori Chicken (Marinated)','Classic tandoori masala marinade — just roast or grill.','MAR-TND-011', 10.99, TRUE, 35, 'https://images.unsplash.com/photo-1617692855027-33b14f061079?w=600', 4.90),
    ('marinated','peri-peri-wings','Peri-Peri Chicken Wings','Fiery peri-peri glazed wings, ready for the pan.','MAR-PER-012', 9.49, FALSE, 45, 'https://images.unsplash.com/photo-1606502973842-f64bc2785fe5?w=600', 4.70),
    ('marinated','bbq-chicken-skewers','BBQ Chicken Skewers','Smoky BBQ-marinated cubes on skewers — grill and serve.','MAR-BBQ-013', 9.99, FALSE, 40, 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600', 4.60),
    ('marinated','chicken-tikka','Chicken Tikka (Marinated)','Yogurt & spice tikka marinade — pan, grill or air-fry.','MAR-TIK-014', 10.49, FALSE, 38, 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600', 4.80),
    ('marinated','chicken-shawarma','Chicken Shawarma Strips','Middle-Eastern spiced strips for wraps and bowls.','MAR-SHW-015', 9.99, FALSE, 42, 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600', 4.50),
    ('eggs-extras','farm-eggs','Farm Fresh Eggs','Free-range eggs, collected daily from partner farms.','EGG-016', 3.49, FALSE, 150, 'https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=600', 4.80),
    ('eggs-extras','country-eggs','Country Eggs (12 pcs)','Desi country eggs with rich, deep-orange yolks.','EGG-017', 8.99, FALSE, 80, 'https://images.unsplash.com/photo-1587486913049-53fc88980cfc?w=600', 4.90)
) AS p(cat_slug, slug, name, description, sku, price, featured, stock, image, rating)
ON p.cat_slug = c.slug
WHERE cur.code = 'USD'
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- Spanish translations for a few products
INSERT INTO product_translations (product_id, language, name, description)
SELECT p.id, 'es', t.name, t.description
FROM products p
JOIN (VALUES
    ('whole-chicken','Pollo entero (con piel)','Pollo broiler fresco de granja, limpio y listo para asar.'),
    ('chicken-breast-boneless','Pechuga de pollo (sin hueso)','Filetes de pechuga magros y ricos en proteína.'),
    ('chicken-wings','Alitas de pollo','Alitas carnosas — ideales estilo buffalo, BBQ o tandoori.')
) AS t(slug, name, description) ON t.slug = p.slug
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (product_id, language) DO NOTHING;

-- Variants for the whole chicken (pack sizes)
INSERT INTO variants (product_id, sku, name, price, stock, image_url)
SELECT p.id, v.sku, v.name, v.price, v.stock, p.image_url
FROM products p
JOIN (VALUES
    ('whole-chicken','CHK-WHL-001-1KG','1 kg', 8.99, 25),
    ('whole-chicken','CHK-WHL-001-15KG','1.5 kg', 12.49, 20),
    ('whole-chicken','CHK-WHL-001-2KG','2 kg', 15.99, 15)
) AS v(slug, sku, name, price, stock) ON v.slug = p.slug
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;

-- Variants for the chicken breast (pack sizes)
INSERT INTO variants (product_id, sku, name, price, stock, image_url)
SELECT p.id, v.sku, v.name, v.price, v.stock, p.image_url
FROM products p
JOIN (VALUES
    ('chicken-breast-boneless','CHK-BRS-002-500G','500 g', 4.99, 30),
    ('chicken-breast-boneless','CHK-BRS-002-1KG','1 kg', 9.49, 30),
    ('chicken-breast-boneless','CHK-BRS-002-2KG','2 kg', 18.49, 20)
) AS v(slug, sku, name, price, stock) ON v.slug = p.slug
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;

-- Variants for farm eggs (pack sizes)
INSERT INTO variants (product_id, sku, name, price, stock, image_url)
SELECT p.id, v.sku, v.name, v.price, v.stock, p.image_url
FROM products p
JOIN (VALUES
    ('farm-eggs','EGG-016-6','6 pcs', 3.49, 60),
    ('farm-eggs','EGG-016-12','12 pcs', 6.49, 50),
    ('farm-eggs','EGG-016-30','30 pcs', 15.49, 40)
) AS v(slug, sku, name, price, stock) ON v.slug = p.slug
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;

-- Variant attribute values
INSERT INTO variant_attribute_values (variant_id, attribute_id, option_id)
SELECT v.id, a.id, o.id
FROM variants v
JOIN products p ON p.id = v.product_id
JOIN (VALUES
    ('CHK-WHL-001-1KG','pack-size','1kg'),('CHK-WHL-001-15KG','pack-size','1-5kg'),('CHK-WHL-001-2KG','pack-size','2kg'),
    ('CHK-BRS-002-500G','pack-size','500g'),('CHK-BRS-002-1KG','pack-size','1kg'),('CHK-BRS-002-2KG','pack-size','2kg'),
    ('EGG-016-6','pack-size','6pcs'),('EGG-016-12','pack-size','12pcs'),('EGG-016-30','pack-size','30pcs')
) AS vv(sku, attr, val) ON vv.sku = v.sku
JOIN attributes a ON a.tenant_id = p.tenant_id AND a.slug = vv.attr
JOIN attribute_options o ON o.attribute_id = a.id AND o.value = vv.val
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;

-- Product attribute values (cut / storage / farming / pack-size) so storefront filters work
INSERT INTO product_attribute_values (product_id, attribute_id, value_text, option_id)
SELECT p.id, a.id, o.value, o.id
FROM products p
JOIN (VALUES
    ('whole-chicken','cut','whole-bird'),('whole-chicken','storage','chilled'),('whole-chicken','farming','free-range'),
    ('chicken-breast-boneless','cut','breast'),('chicken-breast-boneless','storage','chilled'),('chicken-breast-boneless','farming','antibiotic-free'),
    ('chicken-drumsticks','cut','drumstick'),('chicken-drumsticks','storage','chilled'),('chicken-drumsticks','farming','farm-raised'),('chicken-drumsticks','pack-size','1kg'),
    ('chicken-wings','cut','wings'),('chicken-wings','storage','chilled'),('chicken-wings','farming','farm-raised'),('chicken-wings','pack-size','1kg'),
    ('chicken-keema','cut','keema'),('chicken-keema','storage','chilled'),('chicken-keema','farming','antibiotic-free'),('chicken-keema','pack-size','500g'),
    ('chicken-curry-cut','cut','curry-cut'),('chicken-curry-cut','storage','chilled'),('chicken-curry-cut','farming','farm-raised'),('chicken-curry-cut','pack-size','1kg'),
    ('frozen-whole-chicken','cut','whole-bird'),('frozen-whole-chicken','storage','frozen'),('frozen-whole-chicken','farming','farm-raised'),('frozen-whole-chicken','pack-size','1-5kg'),
    ('chicken-nuggets','storage','frozen'),('chicken-nuggets','farming','farm-raised'),('chicken-nuggets','pack-size','500g'),
    ('chicken-strips','storage','frozen'),('chicken-strips','farming','farm-raised'),('chicken-strips','pack-size','500g'),
    ('chicken-lollipop','cut','wings'),('chicken-lollipop','storage','frozen'),('chicken-lollipop','farming','farm-raised'),('chicken-lollipop','pack-size','1kg'),
    ('tandoori-chicken','cut','curry-cut'),('tandoori-chicken','storage','chilled'),('tandoori-chicken','farming','free-range'),('tandoori-chicken','pack-size','1kg'),
    ('peri-peri-wings','cut','wings'),('peri-peri-wings','storage','chilled'),('peri-peri-wings','farming','farm-raised'),('peri-peri-wings','pack-size','1kg'),
    ('bbq-chicken-skewers','cut','breast'),('bbq-chicken-skewers','storage','chilled'),('bbq-chicken-skewers','farming','antibiotic-free'),('bbq-chicken-skewers','pack-size','500g'),
    ('chicken-tikka','cut','breast'),('chicken-tikka','storage','chilled'),('chicken-tikka','farming','free-range'),('chicken-tikka','pack-size','500g'),
    ('chicken-shawarma','cut','thigh'),('chicken-shawarma','storage','chilled'),('chicken-shawarma','farming','farm-raised'),('chicken-shawarma','pack-size','500g'),
    ('farm-eggs','farming','free-range'),
    ('country-eggs','farming','antibiotic-free'),('country-eggs','pack-size','12pcs')
) AS vv(slug, attr, val) ON vv.slug = p.slug
JOIN attributes a ON a.tenant_id = p.tenant_id AND a.slug = vv.attr
JOIN attribute_options o ON o.attribute_id = a.id AND o.value = vv.val
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (product_id, attribute_id) DO NOTHING;

-- An offer: 10% off all fresh chicken
INSERT INTO offers (tenant_id, name, description, offer_type, value, is_active)
VALUES ('11111111-1111-1111-1111-111111111111', 'Fresh Week Sale', '10% off all fresh chicken', 'percentage', 10, TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO offer_targets (offer_id, target_type, target_id)
SELECT o.id, 'category', c.id
FROM offers o
JOIN categories c ON c.tenant_id = o.tenant_id AND c.slug = 'fresh-chicken'
WHERE o.tenant_id = '11111111-1111-1111-1111-111111111111' AND o.name = 'Fresh Week Sale'
ON CONFLICT DO NOTHING;

-- A discount code
INSERT INTO discount_codes (tenant_id, code, description, discount_type, value, is_active)
VALUES ('11111111-1111-1111-1111-111111111111', 'WELCOME10', '10% off your first order', 'percentage', 10, TRUE)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- Exchange rates (base USD)
INSERT INTO exchange_rates (base_code, quote_code, rate) VALUES
    ('USD','EUR',0.92),
    ('USD','GBP',0.79),
    ('USD','INR',83.20),
    ('USD','AED',3.67),
    ('USD','JPY',156.50),
    ('USD','USD',1.0)
ON CONFLICT (base_code, quote_code) DO UPDATE SET rate = EXCLUDED.rate, fetched_at = NOW();
