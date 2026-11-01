package services

import (
	"errors"
	"strings"
	"testing"

	"github.com/trucommerce/backend/internal/models"
)

func TestDefaultShopBannersAreValid(t *testing.T) {
	if _, err := ValidateShopBanners(DefaultShopBanners()); err != nil {
		t.Fatalf("defaults should validate: %v", err)
	}
}

func TestValidateShopBannersNormalises(t *testing.T) {
	in := []models.ShopBanner{
		{ID: "dup", Title: "  CHICKEN  ", CTALink: "/shop"},
		{ID: "dup", Title: "WINGS", Theme: "plum"},
	}
	out, err := ValidateShopBanners(in)
	if err != nil {
		t.Fatal(err)
	}
	if out[0].Title != "CHICKEN" {
		t.Errorf("title not trimmed: %q", out[0].Title)
	}
	if out[0].Theme != ShopBannerThemes[0] {
		t.Errorf("theme not defaulted: %q", out[0].Theme)
	}
	if out[0].ID == out[1].ID {
		t.Errorf("duplicate IDs not reassigned: %q", out[1].ID)
	}
}

func TestValidateShopBannersRejects(t *testing.T) {
	cases := map[string]models.ShopBanner{
		"missing title":     {Title: " "},
		"bad theme":         {Title: "X", Theme: "neon"},
		"script link":       {Title: "X", CTALink: "javascript:alert(1)"},
		"protocol-relative": {Title: "X", ImageURL: "//evil.example/x.png"},
		"long title":        {Title: strings.Repeat("A", 25)},
	}
	for name, b := range cases {
		if _, err := ValidateShopBanners([]models.ShopBanner{b}); !errors.Is(err, ErrInvalidShopBanners) {
			t.Errorf("%s: want ErrInvalidShopBanners, got %v", name, err)
		}
	}
	tooMany := make([]models.ShopBanner, MaxShopBanners+1)
	for i := range tooMany {
		tooMany[i].Title = "X"
	}
	if _, err := ValidateShopBanners(tooMany); !errors.Is(err, ErrInvalidShopBanners) {
		t.Errorf("too many: want ErrInvalidShopBanners, got %v", err)
	}
}

func TestDecodeShopBanners(t *testing.T) {
	if bs, custom := decodeShopBanners(nil); custom || len(bs) == 0 {
		t.Errorf("NULL should yield defaults, got custom=%v len=%d", custom, len(bs))
	}
	if bs, custom := decodeShopBanners([]byte("[]")); !custom || len(bs) != 0 {
		t.Errorf("[] should yield empty custom list, got custom=%v len=%d", custom, len(bs))
	}
}
