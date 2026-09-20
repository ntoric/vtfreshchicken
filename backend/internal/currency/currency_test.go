package currency

import "testing"

func TestFormatWithSymbol(t *testing.T) {
	tests := []struct {
		name    string
		amount  float64
		symbol  string
		decimals int
		want    string
	}{
		{"usd 2 decimals", 12.5, "$", 2, "$12.50"},
		{"zero", 0, "$", 2, "$0.00"},
		{"negative", -3.25, "€", 2, "€-3.25"},
		{"three decimals", 1.2345, "$", 3, "$1.234"},
		{"no decimals", 99.99, "¥", 0, "¥100"},
		{"large", 1234567.89, "$", 2, "$1234567.89"},
		{"empty symbol", 5.5, "", 2, "5.50"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := FormatWithSymbol(tc.amount, tc.symbol, tc.decimals)
			if got != tc.want {
				t.Fatalf("FormatWithSymbol(%v, %q, %d) = %q, want %q", tc.amount, tc.symbol, tc.decimals, got, tc.want)
			}
		})
	}
}
