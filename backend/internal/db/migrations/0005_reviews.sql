-- Migration 0005: product reviews

CREATE TABLE product_reviews (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL DEFAULT 'Anonymous',
    rating     INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title      TEXT NOT NULL DEFAULT '',
    body       TEXT NOT NULL DEFAULT '',
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_approved BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_product ON product_reviews(product_id) WHERE is_approved = TRUE;

-- Seed reviews for demo tenant products
INSERT INTO product_reviews (tenant_id, product_id, author_name, rating, title, body, is_verified, is_approved)
SELECT '11111111-1111-1111-1111-111111111111', p.id, r.author, r.rating, r.title, r.body, r.verified, TRUE
FROM products p
JOIN (VALUES
    ('classic-cotton-tshirt', 'Sarah M.', 5, 'Perfect everyday tee', 'The fabric is so soft and breathable. Fits true to size and the color is exactly as shown. Will be ordering more!', TRUE),
    ('classic-cotton-tshirt', 'James K.', 4, 'Great quality, shrinks slightly', 'Love the shirt but it shrunk a tiny bit after the first wash. Still fits well though. Good value for the price.', TRUE),
    ('classic-cotton-tshirt', 'Priya R.', 5, 'My go-to t-shirt', 'Bought three of these in different colors. They have become my favorite everyday shirts. Highly recommend.', FALSE),
    ('denim-jacket', 'Michael T.', 5, 'Classic denim look', 'This jacket is exactly what I was looking for. The fit is perfect and the denim quality is excellent. Gets better with every wear.', TRUE),
    ('denim-jacket', 'Emma L.', 4, 'Great jacket, runs a bit large', 'Beautiful jacket but I had to size down. The quality is outstanding and it goes with everything.', TRUE),
    ('denim-jacket', 'Carlos D.', 5, 'Best denim jacket I own', 'The vintage wash is perfect. Gets compliments every time I wear it. Worth every penny.', FALSE),
    ('wool-sweater', 'Anna P.', 5, 'So cozy and warm', 'Perfect for winter. The wool is soft, not itchy at all. The fit is relaxed and comfortable.', TRUE),
    ('wool-sweater', 'David W.', 4, 'Warm but needs careful washing', 'Keeps me very warm but you need to hand wash it carefully. Followed the instructions and it has held up well.', TRUE),
    ('wireless-headphones', 'Alex J.', 5, ' Incredible sound quality', 'The noise cancellation is amazing. I can wear these for hours without discomfort. Battery life is as advertised - 30 hours.', TRUE),
    ('wireless-headphones', 'Lisa K.', 4, 'Great sound, pricey', 'Sound quality is top notch. The only downside is the price, but you get what you pay for. Comfortable for long sessions.', TRUE),
    ('wireless-headphones', 'Robert H.', 5, 'Best headphones ever', 'I have tried many noise-cancelling headphones and these are by far the best. The bass is deep and clear.', FALSE),
    ('wireless-headphones', 'Mei C.', 4, 'Excellent for travel', 'Used these on a 10-hour flight and they made it so much more bearable. Comfortable and the ANC is impressive.', TRUE),
    ('wireless-headphones', 'Tom B.', 3, 'Good but not perfect', 'Sound is great but the app could be better. Sometimes the Bluetooth disconnects briefly. Overall decent.', TRUE),
    ('smart-watch', 'Jennifer S.', 5, 'Love the health tracking', 'Tracks my steps, heart rate, and sleep perfectly. The battery lasts almost a week. The notifications are seamless.', TRUE),
    ('smart-watch', 'Kevin O.', 4, 'Great watch, learning curve', 'Takes some time to figure out all the features but once you do it is incredibly useful. The display is crisp and bright.', TRUE),
    ('smart-watch', 'Nina A.', 5, 'Perfect fitness companion', 'This watch has motivated me to stay active. The workout tracking is accurate and the design looks great on the wrist.', FALSE),
    ('bluetooth-speaker', 'Chris M.', 5, 'Surprising bass for the size', 'Cannot believe how much sound comes from this small speaker. The bass is deep and it fills the room. Waterproof too!', TRUE),
    ('bluetooth-speaker', 'Sophie L.', 4, 'Great portable speaker', 'Perfect for the beach and pool. Sound quality is good for the size. Battery lasts a long time.', TRUE),
    ('ceramic-mug', 'Olivia R.', 5, 'Beautiful craftsmanship', 'The mug feels substantial and the glaze is gorgeous. It keeps my coffee warm for a decent time. Love it!', TRUE),
    ('ceramic-mug', 'Pat D.', 5, 'My favorite mug', 'Bought one for myself and one as a gift. Both arrived perfectly packed. The artisan quality is evident.', FALSE),
    ('ceramic-mug', 'Frank G.', 4, 'Nice mug, a bit heavy', 'Beautiful mug but it is on the heavier side. That said, the quality is excellent and it feels durable.', TRUE),
    ('scented-candle', 'Grace W.', 5, 'Amazing lavender scent', 'The lavender fragrance fills the whole room without being overpowering. Burns evenly and lasts a long time.', TRUE),
    ('scented-candle', 'Daniel B.', 4, 'Great candle, wish it was bigger', 'The scent is wonderful and relaxing. My only wish is that it came in a larger size. Still, great value.', TRUE),
    ('scented-candle', 'Yuki N.', 5, 'Perfect for relaxing evenings', 'Light this candle and instantly feel calm. The soy wax burns clean with no soot. Highly recommend.', FALSE),
    ('running-sneakers', 'Marcus J.', 5, 'Lightest sneakers I own', 'These are incredibly lightweight and breathable. Perfect for my morning runs. The mesh keeps my feet cool.', TRUE),
    ('running-sneakers', 'Rachel P.', 4, 'Comfortable but size up', 'Very comfortable once I sized up by half. The cushioning is great for long runs. Good value for the quality.', TRUE),
    ('running-sneakers', 'Ahmed S.', 5, 'Best running shoes', 'I have tried many running shoes and these are the best. Lightweight, comfortable, and they look great too.', FALSE),
    ('leather-boots', 'Victoria C.', 5, 'Premium quality leather', 'These boots are stunning. The leather is full-grain and ages beautifully. They are comfortable after breaking them in.', TRUE),
    ('leather-boots', 'Steve M.', 4, 'Durable and stylish', 'Been wearing these for 3 months and they still look new. Took about a week to break in but now they are very comfortable.', TRUE),
    ('leather-boots', 'Hannah B.', 5, 'Worth the investment', 'Yes they are expensive but the quality is unmatched. These will last for years. The craftsmanship is exceptional.', FALSE)
) AS r(slug, author, rating, title, body, verified)
ON r.slug = p.slug
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;
