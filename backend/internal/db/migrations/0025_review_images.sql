-- Migration 0025: review images (multiple images per product review)

CREATE TABLE review_images (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id  UUID NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
    url        TEXT NOT NULL,
    alt        TEXT,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_review_images_review ON review_images(review_id);
