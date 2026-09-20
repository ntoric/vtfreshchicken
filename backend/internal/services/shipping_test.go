package services

import (
	"testing"

	"github.com/trucommerce/backend/internal/models"
)

func TestZoneMatches(t *testing.T) {
	tests := []struct {
		name    string
		zone    models.ShippingZone
		country string
		state   string
		city    string
		postal  string
		want    bool
	}{
		{"empty zone matches all", models.ShippingZone{}, "US", "CA", "LA", "90001", true},
		{"country match", models.ShippingZone{CountryCode: "US"}, "US", "", "", "", true},
		{"country mismatch", models.ShippingZone{CountryCode: "US"}, "CA", "", "", "", false},
		{"state match", models.ShippingZone{CountryCode: "US", StateCode: "CA"}, "US", "CA", "", "", true},
		{"state mismatch", models.ShippingZone{CountryCode: "US", StateCode: "NY"}, "US", "CA", "", "", false},
		{"city match case-insensitive", models.ShippingZone{City: "Los Angeles"}, "", "", "los angeles", "", true},
		{"city mismatch", models.ShippingZone{City: "San Francisco"}, "", "", "Los Angeles", "", false},
		{"postal pattern %", models.ShippingZone{PostalCodePattern: "90%"}, "", "", "", "90001", true},
		{"postal pattern _", models.ShippingZone{PostalCodePattern: "9000_"}, "", "", "", "90001", true},
		{"postal pattern mismatch", models.ShippingZone{PostalCodePattern: "91%"}, "", "", "", "90001", false},
		{"empty postal with pattern", models.ShippingZone{PostalCodePattern: "90%"}, "", "", "", "", true},
		{"all match", models.ShippingZone{CountryCode: "US", StateCode: "CA", City: "Los Angeles", PostalCodePattern: "90%"}, "US", "CA", "Los Angeles", "90001", true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := zoneMatches(tc.zone, tc.country, tc.state, tc.city, tc.postal)
			if got != tc.want {
				t.Fatalf("zoneMatches = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestLikeMatch(t *testing.T) {
	tests := []struct {
		s, pattern string
		want        bool
	}{
		{"90001", "90%", true},
		{"90001", "9000_", true},
		{"90001", "90001", true},
		{"90001", "90002", false},
		{"abc", "a%c", true},
		{"abc", "a_c", true},
		{"ac", "a_c", false},
		{"test.txt", "%.txt", true},
		{"test.csv", "%.txt", false},
		{"", "", true},
		{"", "%", true},
		{"", "_", false},
		{"a.b", "a.b", true},
		{"axb", "a.b", false},
		{"a+b", "a+b", true},
	}
	for _, tc := range tests {
		got := likeMatch(tc.s, tc.pattern)
		if got != tc.want {
			t.Errorf("likeMatch(%q, %q) = %v, want %v", tc.s, tc.pattern, got, tc.want)
		}
	}
}

func TestZoneSpecificity(t *testing.T) {
	tests := []struct {
		name string
		zone models.ShippingZone
		want int
	}{
		{"empty", models.ShippingZone{}, 0},
		{"country only", models.ShippingZone{CountryCode: "US"}, 1},
		{"state only", models.ShippingZone{StateCode: "CA"}, 2},
		{"city only", models.ShippingZone{City: "LA"}, 4},
		{"postal only", models.ShippingZone{PostalCodePattern: "90%"}, 8},
		{"all", models.ShippingZone{CountryCode: "US", StateCode: "CA", City: "LA", PostalCodePattern: "90%"}, 15},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := zoneSpecificity(tc.zone); got != tc.want {
				t.Fatalf("zoneSpecificity = %d, want %d", got, tc.want)
			}
		})
	}
}

func TestSortShippingZonesBySpecificity(t *testing.T) {
	zones := []models.ShippingZone{
		{Name: "catch-all"},
		{Name: "country", CountryCode: "US"},
		{Name: "state", CountryCode: "US", StateCode: "CA"},
		{Name: "full", CountryCode: "US", StateCode: "CA", City: "LA", PostalCodePattern: "90%"},
	}
	sortShippingZonesBySpecificity(zones)
	if zones[0].Name != "full" {
		t.Fatalf("expected most specific first, got %q", zones[0].Name)
	}
	if zones[3].Name != "catch-all" {
		t.Fatalf("expected least specific last, got %q", zones[3].Name)
	}
}

func TestPluralize(t *testing.T) {
	if got := pluralize(1); got != "" {
		t.Fatalf("pluralize(1) = %q, want empty", got)
	}
	if got := pluralize(2); got != "s" {
		t.Fatalf("pluralize(2) = %q, want 's'", got)
	}
	if got := pluralize(0); got != "s" {
		t.Fatalf("pluralize(0) = %q, want 's'", got)
	}
}
