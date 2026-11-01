package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/trucommerce/backend/internal/models"
)

// ShopBannerThemes lists the selectable banner colour schemes, in display order.
// The storefront maps each code to its gradient/accent palette.
var ShopBannerThemes = []string{"crimson", "plum", "forest", "charcoal", "saffron"}

// MaxShopBanners caps the carousel length.
const MaxShopBanners = 10

// DefaultShopBanners is served when a store has never configured banners.
// Images are the brand photos bundled with the frontstore (/brand/*).
func DefaultShopBanners() []models.ShopBanner {
	return []models.ShopBanner{
		{
			ID: "default-fresh", Enabled: true, Theme: "crimson",
			Eyebrow: "Farm Fresh", Title: "CHICKEN",
			Subtitle:   "Whole birds and cuts, cleaned and packed the same morning — delivered chilled to your door.",
			BadgeValue: "100%", BadgeLabel: "FRESH",
			ImageURL: "/brand/range-fresh.jpg",
			CTAText: "Order now", CTALink: "/shop?search=fresh",
			FooterNote: "Cut fresh daily · Same-day delivery",
		},
		{
			ID: "default-grill", Enabled: true, Theme: "plum",
			Eyebrow: "Grill Ready", Title: "BREAST",
			Subtitle:   "Tender boneless breast fillets, trimmed by hand. Season, sear and serve in minutes.",
			BadgeValue: "15%", BadgeLabel: "SAVE",
			ImageURL: "/brand/chicken-table.jpg",
			CTAText: "Shop boneless", CTALink: "/shop?search=breast",
			FooterNote: "Antibiotic-free · Hand trimmed",
		},
		{
			ID: "default-frozen", Enabled: true, Theme: "saffron",
			Eyebrow: "Crispy & Quick", Title: "FROZEN",
			Subtitle:   "Nuggets, strips and snacks from our freezer range — ready when you are.",
			BadgeValue: "10%", BadgeLabel: "OFF",
			ImageURL: "/brand/range-frozen.jpg",
			CTAText: "Shop frozen", CTALink: "/shop?search=frozen",
			FooterNote: "Stock up · Kept frozen in transit",
		},
		{
			ID: "default-cuts", Enabled: true, Theme: "forest",
			Eyebrow: "Everyday", Title: "CUTS",
			Subtitle:   "Curry cut, drumsticks, wings and mince — portioned the way your kitchen needs.",
			BadgeValue: "FREE", BadgeLabel: "DELIVERY",
			ImageURL: "/brand/range-everyday.jpg",
			CTAText: "Browse cuts", CTALink: "/shop?search=chicken",
			FooterNote: "Chilled, never frozen",
		},
	}
}

// ErrInvalidShopBanners wraps every validation failure from ValidateShopBanners.
var ErrInvalidShopBanners = errors.New("invalid shop banners")

func isValidShopBannerTheme(t string) bool {
	for _, k := range ShopBannerThemes {
		if k == t {
			return true
		}
	}
	return false
}

// isSafeBannerURL accepts site-relative paths ("/shop?...") and http(s) URLs.
// Rejects protocol-relative ("//evil") and script URLs.
func isSafeBannerURL(u string) bool {
	if u == "" {
		return true
	}
	if strings.HasPrefix(u, "/") && !strings.HasPrefix(u, "//") {
		return true
	}
	l := strings.ToLower(u)
	return strings.HasPrefix(l, "https://") || strings.HasPrefix(l, "http://")
}

func newBannerID() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return "bn_" + hex.EncodeToString(b)
}

// ValidateShopBanners trims, validates and normalises banners in place
// (assigns IDs, defaults the theme). Returns an error wrapping
// ErrInvalidShopBanners describing the first problem found.
func ValidateShopBanners(banners []models.ShopBanner) ([]models.ShopBanner, error) {
	if len(banners) > MaxShopBanners {
		return nil, fmt.Errorf("%w: at most %d banners allowed", ErrInvalidShopBanners, MaxShopBanners)
	}
	limits := []struct {
		name string
		max  int
		get  func(*models.ShopBanner) *string
	}{
		{"eyebrow", 40, func(b *models.ShopBanner) *string { return &b.Eyebrow }},
		{"title", 24, func(b *models.ShopBanner) *string { return &b.Title }},
		{"subtitle", 200, func(b *models.ShopBanner) *string { return &b.Subtitle }},
		{"badge_value", 8, func(b *models.ShopBanner) *string { return &b.BadgeValue }},
		{"badge_label", 12, func(b *models.ShopBanner) *string { return &b.BadgeLabel }},
		{"image_url", 1000, func(b *models.ShopBanner) *string { return &b.ImageURL }},
		{"cta_text", 30, func(b *models.ShopBanner) *string { return &b.CTAText }},
		{"cta_link", 500, func(b *models.ShopBanner) *string { return &b.CTALink }},
		{"phone", 30, func(b *models.ShopBanner) *string { return &b.Phone }},
		{"footer_note", 80, func(b *models.ShopBanner) *string { return &b.FooterNote }},
	}
	out := make([]models.ShopBanner, len(banners))
	seen := map[string]bool{}
	for i := range banners {
		b := banners[i]
		n := i + 1
		for _, f := range limits {
			p := f.get(&b)
			*p = strings.TrimSpace(*p)
			if utf8.RuneCountInString(*p) > f.max {
				return nil, fmt.Errorf("%w: banner %d: %s must be at most %d characters", ErrInvalidShopBanners, n, f.name, f.max)
			}
		}
		if b.Title == "" {
			return nil, fmt.Errorf("%w: banner %d: title is required", ErrInvalidShopBanners, n)
		}
		if b.Theme == "" {
			b.Theme = ShopBannerThemes[0]
		}
		if !isValidShopBannerTheme(b.Theme) {
			return nil, fmt.Errorf("%w: banner %d: unknown theme %q", ErrInvalidShopBanners, n, b.Theme)
		}
		if !isSafeBannerURL(b.ImageURL) {
			return nil, fmt.Errorf("%w: banner %d: image_url must be a /path or http(s) URL", ErrInvalidShopBanners, n)
		}
		if !isSafeBannerURL(b.CTALink) {
			return nil, fmt.Errorf("%w: banner %d: cta_link must be a /path or http(s) URL", ErrInvalidShopBanners, n)
		}
		b.ID = strings.TrimSpace(b.ID)
		if b.ID == "" || len(b.ID) > 40 || seen[b.ID] {
			b.ID = newBannerID()
		}
		seen[b.ID] = true
		out[i] = b
	}
	return out, nil
}

// decodeShopBanners turns the raw JSONB column into banners, serving the
// defaults when the column is NULL (never configured).
func decodeShopBanners(raw []byte) ([]models.ShopBanner, bool) {
	if raw == nil {
		return DefaultShopBanners(), false
	}
	var bs []models.ShopBanner
	if err := json.Unmarshal(raw, &bs); err != nil {
		return DefaultShopBanners(), false
	}
	if bs == nil {
		bs = []models.ShopBanner{}
	}
	return bs, true
}

// GetShopBanners returns the store's banners and whether they have been
// customised (false = built-in defaults).
func (s *Store) GetShopBanners(ctx context.Context, tenantID uuid.UUID) ([]models.ShopBanner, bool, error) {
	var raw []byte
	err := s.Pool.QueryRow(ctx,
		`SELECT shop_banners FROM tenant_settings WHERE tenant_id=$1`, tenantID).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return DefaultShopBanners(), false, nil
	}
	if err != nil {
		return nil, false, err
	}
	bs, custom := decodeShopBanners(raw)
	return bs, custom, nil
}

// SetShopBanners validates and stores the banners, leaving every other store
// setting untouched. Pass nil to reset to the built-in defaults.
func (s *Store) SetShopBanners(ctx context.Context, tenantID uuid.UUID, banners []models.ShopBanner) ([]models.ShopBanner, error) {
	var raw []byte
	if banners != nil {
		clean, err := ValidateShopBanners(banners)
		if err != nil {
			return nil, err
		}
		banners = clean
		raw, err = json.Marshal(clean)
		if err != nil {
			return nil, err
		}
	}
	tag, err := s.Pool.Exec(ctx,
		`UPDATE tenant_settings SET shop_banners=$2 WHERE tenant_id=$1`, tenantID, raw)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, pgx.ErrNoRows
	}
	if banners == nil {
		return DefaultShopBanners(), nil
	}
	return banners, nil
}
