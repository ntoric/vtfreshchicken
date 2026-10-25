-- Migration 0003: seed product images (multiple per product for gallery)

INSERT INTO product_images (product_id, url, alt, sort_order)
SELECT p.id, img.url, img.alt, img.sort_order
FROM products p
JOIN (VALUES
    -- Whole Chicken
    ('whole-chicken', 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=900', 'Whole Chicken - Fresh', 0),
    ('whole-chicken', 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=900', 'Whole Chicken - Roast in Skillet', 1),
    ('whole-chicken', 'https://images.unsplash.com/photo-1606728035253-49e8a23146de?w=900', 'Whole Chicken - Roasted', 2),
    -- Chicken Breast
    ('chicken-breast-boneless', 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=900', 'Chicken Breast - Fresh Fillets', 0),
    ('chicken-breast-boneless', 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=900', 'Chicken Breast - Cooked', 1),
    -- Chicken Drumsticks
    ('chicken-drumsticks', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=900', 'Chicken Drumsticks - Crispy', 0),
    ('chicken-drumsticks', 'https://images.unsplash.com/photo-1592011432621-f7f576f44484?w=900', 'Chicken Drumsticks - Grilled', 1),
    -- Chicken Wings
    ('chicken-wings', 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=900', 'Chicken Wings - Buffalo', 0),
    ('chicken-wings', 'https://images.unsplash.com/photo-1602253057119-44d745d9b860?w=900', 'Chicken Wings - Glazed', 1),
    -- Chicken Keema
    ('chicken-keema', 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=900', 'Chicken Keema - Fresh Mince', 0),
    ('chicken-keema', 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=900', 'Chicken Keema - Kebab', 1),
    -- Chicken Curry Cut
    ('chicken-curry-cut', 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=900', 'Chicken Curry Cut - Curry', 0),
    ('chicken-curry-cut', 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=900', 'Chicken Curry Cut - Served', 1),
    -- Frozen Whole Chicken
    ('frozen-whole-chicken', 'https://images.unsplash.com/photo-1501200291289-c5a76c232e5f?w=900', 'Frozen Whole Chicken', 0),
    -- Chicken Nuggets
    ('chicken-nuggets', 'https://images.unsplash.com/photo-1562967916-eb82221dfb92?w=900', 'Chicken Nuggets - Golden', 0),
    ('chicken-nuggets', 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=900', 'Chicken Nuggets - Served', 1),
    -- Chicken Strips
    ('chicken-strips', 'https://images.unsplash.com/photo-1585325701956-60dd9c8553bc?w=900', 'Chicken Strips - Breaded', 0),
    -- Chicken Lollipop
    ('chicken-lollipop', 'https://images.unsplash.com/photo-1614398751058-eb2e0bf63e53?w=900', 'Chicken Lollipop - Party Tray', 0),
    -- Tandoori Chicken
    ('tandoori-chicken', 'https://images.unsplash.com/photo-1617692855027-33b14f061079?w=900', 'Tandoori Chicken - Plated', 0),
    ('tandoori-chicken', 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=900', 'Tandoori Chicken - Grill', 1),
    -- Peri-Peri Wings
    ('peri-peri-wings', 'https://images.unsplash.com/photo-1606502973842-f64bc2785fe5?w=900', 'Peri-Peri Wings - Glazed', 0),
    ('peri-peri-wings', 'https://images.unsplash.com/photo-1602253057119-44d745d9b860?w=900', 'Peri-Peri Wings - Sticky', 1),
    -- BBQ Chicken Skewers
    ('bbq-chicken-skewers', 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=900', 'BBQ Chicken Skewers - Grill', 0),
    ('bbq-chicken-skewers', 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=900', 'BBQ Chicken Skewers - Platter', 1),
    -- Chicken Tikka
    ('chicken-tikka', 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=900', 'Chicken Tikka - Masala', 0),
    -- Chicken Shawarma
    ('chicken-shawarma', 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=900', 'Chicken Shawarma - Wrap', 0),
    -- Farm Eggs
    ('farm-eggs', 'https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=900', 'Farm Eggs - Carton', 0),
    ('farm-eggs', 'https://images.unsplash.com/photo-1587486913049-53fc88980cfc?w=900', 'Farm Eggs - Fresh', 1),
    -- Country Eggs
    ('country-eggs', 'https://images.unsplash.com/photo-1587486913049-53fc88980cfc?w=900', 'Country Eggs - Fresh', 0),
    ('country-eggs', 'https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=900', 'Country Eggs - Carton', 1)
) AS img(slug, url, alt, sort_order)
ON img.slug = p.slug
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;
