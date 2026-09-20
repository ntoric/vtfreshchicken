-- 0022_store_pages.sql
-- Store page builder: customizable storefront pages (landing, about, contact, privacy, terms, custom)

CREATE TABLE IF NOT EXISTS store_pages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    slug            TEXT NOT NULL,                    -- 'home', 'about', 'contact', 'privacy-policy', 'terms', or custom slug
    title           TEXT NOT NULL DEFAULT '',
    page_type       TEXT NOT NULL DEFAULT 'custom',   -- 'home' | 'about' | 'contact' | 'privacy' | 'terms' | 'custom'
    status          TEXT NOT NULL DEFAULT 'draft',    -- 'draft' | 'published'
    blocks          JSONB NOT NULL DEFAULT '[]'::jsonb, -- ordered array of block definitions
    meta_title      TEXT NOT NULL DEFAULT '',
    meta_description TEXT NOT NULL DEFAULT '',
    is_system       BOOLEAN NOT NULL DEFAULT false,    -- true for seeded pages (home, about, etc.)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_store_pages_tenant ON store_pages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_store_pages_slug ON store_pages(tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_store_pages_status ON store_pages(tenant_id, status);

-- Auto-update updated_at on store_pages
CREATE OR REPLACE FUNCTION trg_store_pages_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_store_pages_updated_at ON store_pages;
CREATE TRIGGER trg_store_pages_updated_at
    BEFORE UPDATE ON store_pages
    FOR EACH ROW
    EXECUTE FUNCTION trg_store_pages_set_updated_at();

-- Seed default pages for existing tenants
INSERT INTO store_pages (tenant_id, slug, title, page_type, status, is_system, blocks, meta_title, meta_description)
SELECT t.id, 'home', 'Home', 'home', 'published', true,
    jsonb_build_array(
        jsonb_build_object('id', gen_random_uuid()::text, 'type', 'hero', 'props', jsonb_build_object(
            'title', 'Welcome to ' || t.name,
            'subtitle', 'Discover amazing products at great prices',
            'buttonText', 'Shop Now',
            'buttonLink', '/t/' || t.slug || '?view=shop',
            'backgroundImage', '',
            'align', 'center',
            'textColor', '#ffffff',
            'backgroundColor', '#4f46e5'
        )),
        jsonb_build_object('id', gen_random_uuid()::text, 'type', 'featured_products', 'props', jsonb_build_object(
            'title', 'Featured Products',
            'limit', 8,
            'columns', 4
        ))
    ),
    t.name || ' - Online Store',
    'Shop quality products at great prices'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM store_pages sp WHERE sp.tenant_id = t.id AND sp.slug = 'home');

INSERT INTO store_pages (tenant_id, slug, title, page_type, status, is_system, blocks, meta_title, meta_description)
SELECT t.id, 'about', 'About Us', 'about', 'published', true,
    jsonb_build_array(
        jsonb_build_object('id', gen_random_uuid()::text, 'type', 'rich_text', 'props', jsonb_build_object(
            'content', '<h2>About ' || t.name || '</h2><p>We are dedicated to providing the best products and services to our customers. Our mission is to deliver quality, value, and exceptional customer experience.</p>'
        ))
    ),
    'About Us - ' || t.name,
    'Learn more about us'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM store_pages sp WHERE sp.tenant_id = t.id AND sp.slug = 'about');

INSERT INTO store_pages (tenant_id, slug, title, page_type, status, is_system, blocks, meta_title, meta_description)
SELECT t.id, 'contact', 'Contact Us', 'contact', 'published', true,
    jsonb_build_array(
        jsonb_build_object('id', gen_random_uuid()::text, 'type', 'contact_form', 'props', jsonb_build_object(
            'title', 'Get in Touch',
            'subtitle', 'We''d love to hear from you',
            'email', t.contact_email,
            'showMap', false
        ))
    ),
    'Contact Us - ' || t.name,
    'Contact us with any questions'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM store_pages sp WHERE sp.tenant_id = t.id AND sp.slug = 'contact');

INSERT INTO store_pages (tenant_id, slug, title, page_type, status, is_system, blocks, meta_title, meta_description)
SELECT t.id, 'privacy-policy', 'Privacy Policy', 'privacy', 'published', true,
    jsonb_build_array(
        jsonb_build_object('id', gen_random_uuid()::text, 'type', 'rich_text', 'props', jsonb_build_object(
            'content', '<h2>Privacy Policy</h2><p>Your privacy is important to us. This privacy policy explains how ' || t.name || ' collects, uses, and protects your personal information.</p><h3>Information We Collect</h3><p>We collect information you provide when you create an account, place an order, or contact us. This includes your name, email, address, and payment details.</p><h3>How We Use Your Information</h3><p>We use your information to process orders, communicate with you, and improve our services.</p><h3>Data Security</h3><p>We implement appropriate security measures to protect your personal data from unauthorized access.</p>'
        ))
    ),
    'Privacy Policy - ' || t.name,
    'Our privacy policy'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM store_pages sp WHERE sp.tenant_id = t.id AND sp.slug = 'privacy-policy');

INSERT INTO store_pages (tenant_id, slug, title, page_type, status, is_system, blocks, meta_title, meta_description)
SELECT t.id, 'terms', 'Terms & Conditions', 'terms', 'published', true,
    jsonb_build_array(
        jsonb_build_object('id', gen_random_uuid()::text, 'type', 'rich_text', 'props', jsonb_build_object(
            'content', '<h2>Terms & Conditions</h2><p>By using ' || t.name || ', you agree to these terms and conditions. Please read them carefully.</p><h3>Orders & Payments</h3><p>All orders are subject to acceptance and availability. Prices are subject to change without notice.</p><h3>Returns & Refunds</h3><p>We accept returns within 30 days of delivery. Items must be in original condition.</p><h3>Limitation of Liability</h3><p>' || t.name || ' is not liable for indirect or consequential damages.</p>'
        ))
    ),
    'Terms & Conditions - ' || t.name,
    'Our terms and conditions'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM store_pages sp WHERE sp.tenant_id = t.id AND sp.slug = 'terms');
