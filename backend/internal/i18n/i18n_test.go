package i18n

import "testing"

func TestResolveLanguage(t *testing.T) {
	supported := []string{"en", "fr", "es"}
	tests := []struct {
		name     string
		accept   string
		fallback string
		want     string
	}{
		{"exact match first", "fr,en;q=0.9", "en", "fr"},
		{"base match en-US", "en-US,en;q=0.9", "fr", "en"},
		{"base match es-MX", "es-MX,en;q=0.9", "en", "es"},
		{"no match falls back", "de,zh", "en", "en"},
		{"empty header falls back", "", "en", "en"},
		{"first supported wins", "de,fr,en", "en", "fr"},
		{"case-insensitive", "FR,en", "en", "fr"},
		{"whitespace trimmed", " fr , en ", "en", "fr"},
		{"q values ignored", "fr;q=0.1,en;q=0.9", "en", "fr"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := ResolveLanguage(tc.accept, supported, tc.fallback)
			if got != tc.want {
				t.Fatalf("ResolveLanguage(%q, %v, %q) = %q, want %q", tc.accept, supported, tc.fallback, got, tc.want)
			}
		})
	}
}

func TestResolveLanguageEmptySupported(t *testing.T) {
	if got := ResolveLanguage("en,fr", nil, "en"); got != "en" {
		t.Fatalf("expected fallback 'en' when supported is empty, got %q", got)
	}
}

func TestResolveLanguageEmptyFallback(t *testing.T) {
	if got := ResolveLanguage("de,zh", []string{"en"}, ""); got != "" {
		t.Fatalf("expected empty fallback, got %q", got)
	}
}
