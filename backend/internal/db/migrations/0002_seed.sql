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
VALUES ('11111111-1111-1111-1111-111111111111', 'demo', 'Demo Store', 'A demo multitenant storefront')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO tenant_settings (tenant_id, default_currency_id, default_language, supported_languages, brand_color)
SELECT '11111111-1111-1111-1111-111111111111', c.id, 'en', ARRAY['en','es','ar'], '#4f46e5'
FROM currencies c WHERE c.code = 'USD'
ON CONFLICT (tenant_id) DO NOTHING;

-- Demo categories
INSERT INTO categories (tenant_id, slug, name, description, sort_order) VALUES
    ('11111111-1111-1111-1111-111111111111', 'apparel', 'Apparel', 'Clothing and accessories', 1),
    ('11111111-1111-1111-1111-111111111111', 'electronics', 'Electronics', 'Gadgets and devices', 2),
    ('11111111-1111-1111-1111-111111111111', 'home', 'Home & Living', 'Everything for your home', 3),
    ('11111111-1111-1111-1111-111111111111', 'footwear', 'Footwear', 'Shoes for every occasion', 4)
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- Variant attributes for demo tenant
INSERT INTO attributes (tenant_id, slug, name, type, is_filterable, is_variant) VALUES
    ('11111111-1111-1111-1111-111111111111', 'size', 'Size', 'select', TRUE, TRUE),
    ('11111111-1111-1111-1111-111111111111', 'color', 'Color', 'color', TRUE, TRUE),
    ('11111111-1111-1111-1111-111111111111', 'material', 'Material', 'select', TRUE, FALSE),
    ('11111111-1111-1111-1111-111111111111', 'brand', 'Brand', 'text', TRUE, FALSE)
ON CONFLICT (tenant_id, slug) DO NOTHING;

INSERT INTO attribute_options (attribute_id, value, label, sort_order)
SELECT a.id, v.value, v.label, v.sort_order FROM attributes a
JOIN (VALUES
    ('size','xs','XS',1),('size','s','S',2),('size','m','M',3),('size','l','L',4),('size','xl','XL',5),('size','xxl','XXL',6),
    ('color','red','Red',1),('color','blue','Blue',2),('color','green','Green',3),('color','black','Black',4),('color','white','White',5),('color','navy','Navy',6),
    ('material','cotton','Cotton',1),('material','polyester','Polyester',2),('material','leather','Leather',3),('material','wool','Wool',4)
) AS v(attr, value, label, sort_order) ON v.attr = a.slug
WHERE a.tenant_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (attribute_id, value) DO NOTHING;

-- Demo products (a few across categories)
INSERT INTO products (tenant_id, category_id, slug, name, description, sku, status, base_price, currency_id, is_featured, stock, image_url, rating)
SELECT '11111111-1111-1111-1111-111111111111', c.id, p.slug, p.name, p.description, p.sku, 'active', p.price, cur.id, p.featured, p.stock, p.image, p.rating
FROM currencies cur
JOIN categories c ON c.tenant_id = '11111111-1111-1111-1111-111111111111'
JOIN (VALUES
    ('apparel','classic-cotton-tshirt','Classic Cotton T-Shirt','A soft, breathable everyday tee.','TSHIRT-001', 19.99, TRUE, 120, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600', 4.50),
    ('apparel','denim-jacket','Vintage Denim Jacket','Timeless denim with a modern fit.','JACKET-001', 79.99, TRUE, 45, 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600', 4.70),
    ('apparel','wool-sweater','Cozy Wool Sweater','Warm and stylish for the winter.','SWEATER-001', 59.99, FALSE, 60, 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600', 4.30),
    ('electronics','wireless-headphones','Wireless Noise-Cancelling Headphones','Immersive sound, 30h battery.','HEAD-001', 149.99, TRUE, 80, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600', 4.80),
    ('electronics','smart-watch','Smart Watch Series 5','Health tracking and notifications.','WATCH-001', 199.99, TRUE, 50, 'https://images.unsplash.com/photo-1546868871-7041f2a55e0f?w=600', 4.60),
    ('electronics','bluetooth-speaker','Portable Bluetooth Speaker','Waterproof with deep bass.','SPEAKER-001', 39.99, FALSE, 200, 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600', 4.40),
    ('home','ceramic-mug','Handmade Ceramic Mug','Crafted by artisans, 350ml.','MUG-001', 14.99, FALSE, 300, 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600', 4.90),
    ('home','scented-candle','Lavender Scented Candle','Soy wax, 45h burn time.','CANDLE-001', 12.99, TRUE, 150, 'https://images.unsplash.com/photo-1602874801006-7d99b0f2793e?w=600', 4.70),
    ('footwear','running-sneakers','Air Running Sneakers','Lightweight, breathable mesh.','SHOE-001', 89.99, TRUE, 70, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600', 4.60),
    ('footwear','leather-boots','Premium Leather Boots','Full-grain leather, durable.','BOOT-001', 159.99, FALSE, 35, 'https://images.unsplash.com/photo-1605812860427-4024433b70df?w=600', 4.50)
) AS p(cat_slug, slug, name, description, sku, price, featured, stock, image, rating)
ON p.cat_slug = c.slug
WHERE cur.code = 'USD'
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- Spanish translations for a few products
INSERT INTO product_translations (product_id, language, name, description)
SELECT p.id, 'es', t.name, t.description
FROM products p
JOIN (VALUES
    ('classic-cotton-tshirt','Camiseta de algodón clásica','Una camiseta suave y transpirable para todos los días.'),
    ('denim-jacket','Chaqueta vaquera vintage','Denim atemporal con un ajuste moderno.'),
    ('wireless-headphones','Auriculares inalámbricos','Sonido inmersivo, batería de 30h.')
) AS t(slug, name, description) ON t.slug = p.slug
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (product_id, language) DO NOTHING;

-- Variants for the t-shirt (size x color combos)
INSERT INTO variants (product_id, sku, name, price, stock, image_url)
SELECT p.id, v.sku, v.name, v.price, v.stock, p.image_url
FROM products p
JOIN (VALUES
    ('classic-cotton-tshirt','TSHIRT-001-S-RED','S / Red', 19.99, 20),
    ('classic-cotton-tshirt','TSHIRT-001-M-BLU','M / Blue', 19.99, 30),
    ('classic-cotton-tshirt','TSHIRT-001-L-BLK','L / Black', 19.99, 40),
    ('classic-cotton-tshirt','TSHIRT-001-XL-WHT','XL / White', 19.99, 30)
) AS v(slug, sku, name, price, stock) ON v.slug = p.slug
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;

-- Variant attribute values
INSERT INTO variant_attribute_values (variant_id, attribute_id, option_id)
SELECT v.id, a.id, o.id
FROM variants v
JOIN products p ON p.id = v.product_id
JOIN (VALUES
    ('TSHIRT-001-S-RED','size','s'),('TSHIRT-001-S-RED','color','red'),
    ('TSHIRT-001-M-BLU','size','m'),('TSHIRT-001-M-BLU','color','blue'),
    ('TSHIRT-001-L-BLK','size','l'),('TSHIRT-001-L-BLK','color','black'),
    ('TSHIRT-001-XL-WHT','size','xl'),('TSHIRT-001-XL-WHT','color','white')
) AS vv(sku, attr, val) ON vv.sku = v.sku
JOIN attributes a ON a.tenant_id = p.tenant_id AND a.slug = vv.attr
JOIN attribute_options o ON o.attribute_id = a.id AND o.value = vv.val
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;

-- Product attribute values (brand, material)
INSERT INTO product_attribute_values (product_id, attribute_id, value_text)
SELECT p.id, a.id, vv.brand
FROM products p
JOIN attributes a ON a.tenant_id = p.tenant_id AND a.slug = 'brand'
JOIN (VALUES
    ('classic-cotton-tshirt','TruBasics'),
    ('denim-jacket','DenimCo'),
    ('wool-sweater','WoolCraft'),
    ('wireless-headphones','SoundMax'),
    ('smart-watch','TechWear'),
    ('bluetooth-speaker','SoundMax'),
    ('ceramic-mug','ArtisanHome'),
    ('scented-candle','CozyScents'),
    ('running-sneakers','RunPro'),
    ('leather-boots','BootWorks')
) AS vv(slug, brand) ON vv.slug = p.slug
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (product_id, attribute_id) DO NOTHING;

INSERT INTO product_attribute_values (product_id, attribute_id, value_text)
SELECT p.id, a.id, vv.material
FROM products p
JOIN attributes a ON a.tenant_id = p.tenant_id AND a.slug = 'material'
JOIN (VALUES
    ('classic-cotton-tshirt','cotton'),
    ('wool-sweater','wool'),
    ('denim-jacket','cotton')
) AS vv(slug, material) ON vv.slug = p.slug
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (product_id, attribute_id) DO NOTHING;

-- An offer: 10% off all apparel
INSERT INTO offers (tenant_id, name, description, offer_type, value, is_active)
VALUES ('11111111-1111-1111-1111-111111111111', 'Apparel Sale', '10% off all apparel', 'percentage', 10, TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO offer_targets (offer_id, target_type, target_id)
SELECT o.id, 'category', c.id
FROM offers o
JOIN categories c ON c.tenant_id = o.tenant_id AND c.slug = 'apparel'
WHERE o.tenant_id = '11111111-1111-1111-1111-111111111111' AND o.name = 'Apparel Sale'
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
