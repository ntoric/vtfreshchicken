-- Migration 0003: seed product images (multiple per product for gallery)

INSERT INTO product_images (product_id, url, alt, sort_order)
SELECT p.id, img.url, img.alt, img.sort_order
FROM products p
JOIN (VALUES
    -- Classic Cotton T-Shirt
    ('classic-cotton-tshirt', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900', 'Classic Cotton T-Shirt - Front', 0),
    ('classic-cotton-tshirt', 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=900', 'Classic Cotton T-Shirt - Side', 1),
    ('classic-cotton-tshirt', 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=900', 'Classic Cotton T-Shirt - Detail', 2),
    ('classic-cotton-tshirt', 'https://images.unsplash.com/photo-1622445275576-721325763afe?w=900', 'Classic Cotton T-Shirt - Back', 3),
    -- Denim Jacket
    ('denim-jacket', 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=900', 'Vintage Denim Jacket - Front', 0),
    ('denim-jacket', 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=900', 'Vintage Denim Jacket - Back', 1),
    ('denim-jacket', 'https://images.unsplash.com/photo-1576995853123-5a10305d93c7?w=900', 'Vintage Denim Jacket - Detail', 2),
    -- Wool Sweater
    ('wool-sweater', 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=900', 'Cozy Wool Sweater - Front', 0),
    ('wool-sweater', 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=900', 'Cozy Wool Sweater - Side', 1),
    ('wool-sweater', 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=900', 'Cozy Wool Sweater - Detail', 2),
    -- Wireless Headphones
    ('wireless-headphones', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900', 'Wireless Headphones - Front', 0),
    ('wireless-headphones', 'https://images.unsplash.com/photo-1484704849700-f032a568e965?w=900', 'Wireless Headphones - Side', 1),
    ('wireless-headphones', 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=900', 'Wireless Headphones - Detail', 2),
    ('wireless-headphones', 'https://images.unsplash.com/photo-1487215078519-e21cc028629e?w=900', 'Wireless Headphones - Case', 3),
    -- Smart Watch
    ('smart-watch', 'https://images.unsplash.com/photo-1546868871-7041f2a55e0f?w=900', 'Smart Watch - Front', 0),
    ('smart-watch', 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=900', 'Smart Watch - Side', 1),
    ('smart-watch', 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=900', 'Smart Watch - Wrist', 2),
    -- Bluetooth Speaker
    ('bluetooth-speaker', 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=900', 'Bluetooth Speaker - Front', 0),
    ('bluetooth-speaker', 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=900&sat=-100', 'Bluetooth Speaker - Side', 1),
    ('bluetooth-speaker', 'https://images.unsplash.com/photo-1589003077984-894e133d4ab2?w=900', 'Bluetooth Speaker - Detail', 2),
    -- Ceramic Mug
    ('ceramic-mug', 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=900', 'Ceramic Mug - Front', 0),
    ('ceramic-mug', 'https://images.unsplash.com/photo-1577937927443-0ec6d22fc1fa?w=900', 'Ceramic Mug - Top', 1),
    ('ceramic-mug', 'https://images.unsplash.com/photo-1514258252712-31e3919ec91a?w=900', 'Ceramic Mug - Detail', 2),
    -- Scented Candle
    ('scented-candle', 'https://images.unsplash.com/photo-1602874801006-7d99b0f2793e?w=900', 'Scented Candle - Front', 0),
    ('scented-candle', 'https://images.unsplash.com/photo-1610557892470-55d9e80e0b12?w=900', 'Scented Candle - Lit', 1),
    ('scented-candle', 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=900', 'Scented Candle - Detail', 2),
    -- Running Sneakers
    ('running-sneakers', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900', 'Running Sneakers - Side', 0),
    ('running-sneakers', 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=900', 'Running Sneakers - Front', 1),
    ('running-sneakers', 'https://images.unsplash.com/photo-1600185365483-52d8dbd6d4f4?w=900', 'Running Sneakers - Top', 2),
    ('running-sneakers', 'https://images.unsplash.com/photo-1606107557195-0e88a8fd5daa?w=900', 'Running Sneakers - Detail', 3),
    -- Leather Boots
    ('leather-boots', 'https://images.unsplash.com/photo-1605812860427-4024433b70df?w=900', 'Leather Boots - Side', 0),
    ('leather-boots', 'https://images.unsplash.com/photo-1542838132-7c790cd1d2ec?w=900', 'Leather Boots - Front', 1),
    ('leather-boots', 'https://images.unsplash.com/photo-1608256246200-44e641a3c0a2?w=900', 'Leather Boots - Detail', 2)
) AS img(slug, url, alt, sort_order)
ON img.slug = p.slug
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;
