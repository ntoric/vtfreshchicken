package services

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestToStringMap(t *testing.T) {
	in := map[string]any{
		"str":    "hello",
		"int":    float64(42),
		"bool_t": true,
		"bool_f": false,
		"empty":  "",
	}
	out := toStringMap(in)
	if out["str"] != "hello" {
		t.Fatalf("str = %q", out["str"])
	}
	if out["int"] != "42" {
		t.Fatalf("int = %q, want 42", out["int"])
	}
	if out["bool_t"] != "true" {
		t.Fatalf("bool_t = %q", out["bool_t"])
	}
	if out["bool_f"] != "false" {
		t.Fatalf("bool_f = %q", out["bool_f"])
	}
	if out["empty"] != "" {
		t.Fatalf("empty = %q", out["empty"])
	}
}

func TestToStringMapNil(t *testing.T) {
	out := toStringMap(nil)
	if len(out) != 0 {
		t.Fatalf("expected empty map, got %v", out)
	}
}

func TestBoolStr(t *testing.T) {
	if boolStr(true) != "true" {
		t.Fatal("boolStr(true) should be 'true'")
	}
	if boolStr(false) != "false" {
		t.Fatal("boolStr(false) should be 'false'")
	}
}

func TestPtrTimeStr(t *testing.T) {
	if got := ptrTimeStr(nil); got != "" {
		t.Fatalf("ptrTimeStr(nil) = %q, want empty", got)
	}
	now := time.Now()
	if got := ptrTimeStr(&now); got != now.Format(time.RFC3339) {
		t.Fatalf("ptrTimeStr mismatch")
	}
}

func TestRoundTo2(t *testing.T) {
	tests := []struct {
		in, want float64
	}{
		{1.5, 1.5},
		{2.345, 2.35},
		{0, 0},
		{-1.5, -1.5},
		{1234.5678, 1234.57},
		{0.005, 0.01},
		{99.99, 99.99},
	}
	for _, tc := range tests {
		if got := roundTo2(tc.in); got != tc.want {
			t.Errorf("roundTo2(%v) = %v, want %v", tc.in, got, tc.want)
		}
	}
}

func TestBuildOrderFilter(t *testing.T) {
	f := buildOrderFilter(map[string]string{
		"status": "paid",
		"search": "john",
		"from":   "2024-01-01",
		"to":     "2024-12-31",
	})
	if f.Status != "paid" {
		t.Fatalf("status = %q", f.Status)
	}
	if f.Search != "john" {
		t.Fatalf("search = %q", f.Search)
	}
	if f.Dr.From != "2024-01-01" {
		t.Fatalf("from = %q", f.Dr.From)
	}
	if f.Dr.To != "2024-12-31" {
		t.Fatalf("to = %q", f.Dr.To)
	}
}

func TestBuildOrderFilterEmpty(t *testing.T) {
	f := buildOrderFilter(map[string]string{})
	if f.Status != "" || f.Search != "" || f.Dr.From != "" || f.Dr.To != "" {
		t.Fatalf("expected all empty, got %+v", f)
	}
}

func TestBuildProductFilter(t *testing.T) {
	tid := uuid.New()
	f := buildProductFilter(tid, map[string]string{
		"status": "active",
		"search": "shirt",
	})
	if f.TenantID != tid {
		t.Fatal("tenant mismatch")
	}
	if f.Status != "active" {
		t.Fatalf("status = %q", f.Status)
	}
	if f.Search == nil || *f.Search != "shirt" {
		t.Fatalf("search = %v", f.Search)
	}
	if !f.IncludeAll {
		t.Fatal("IncludeAll should be true")
	}
}

func TestBuildProductFilterNoSearch(t *testing.T) {
	tid := uuid.New()
	f := buildProductFilter(tid, map[string]string{})
	if f.Search != nil {
		t.Fatalf("search should be nil, got %v", *f.Search)
	}
}

func TestBuildCustomerFilter(t *testing.T) {
	tid := uuid.New()
	f := buildCustomerFilter(tid, map[string]string{
		"search":  "alice",
		"status":  "active",
	})
	if f.TenantID != tid {
		t.Fatal("tenant mismatch")
	}
	if f.Search == nil || *f.Search != "alice" {
		t.Fatalf("search = %v", f.Search)
	}
	if f.IsActive == nil || !*f.IsActive {
		t.Fatalf("IsActive should be true, got %v", f.IsActive)
	}
}

func TestBuildCustomerFilterInactive(t *testing.T) {
	tid := uuid.New()
	f := buildCustomerFilter(tid, map[string]string{"status": "inactive"})
	if f.IsActive == nil || *f.IsActive {
		t.Fatalf("IsActive should be false, got %v", f.IsActive)
	}
}

func TestBuildCustomerFilterNoStatus(t *testing.T) {
	f := buildCustomerFilter(uuid.New(), map[string]string{})
	if f.IsActive != nil {
		t.Fatalf("IsActive should be nil, got %v", *f.IsActive)
	}
}

func TestBuildPaymentTxnFilter(t *testing.T) {
	f := buildPaymentTxnFilter(map[string]string{
		"status":  "success",
		"gateway": "card",
		"type":    "capture",
		"search":  "abc",
		"from":    "2024-01-01",
		"to":      "2024-12-31",
	})
	if f.Status != "success" || f.Gateway != "card" || f.Type != "capture" || f.Search != "abc" {
		t.Fatalf("filter mismatch: %+v", f)
	}
	if f.Dr.From != "2024-01-01" || f.Dr.To != "2024-12-31" {
		t.Fatalf("date range mismatch: %+v", f.Dr)
	}
}

func TestBuildStockMovementFilter(t *testing.T) {
	f := buildStockMovementFilter(map[string]string{
		"movement_type": "adjustment",
		"search":        "sku",
		"from":          "2024-01-01",
		"to":            "2024-12-31",
	})
	if f.MovementType != "adjustment" || f.Search != "sku" {
		t.Fatalf("filter mismatch: %+v", f)
	}
	if f.Dr.From != "2024-01-01" || f.Dr.To != "2024-12-31" {
		t.Fatalf("date range mismatch: %+v", f.Dr)
	}
}

func TestBuildWalletTxnFilter(t *testing.T) {
	f := buildWalletTxnFilter(map[string]string{
		"type":   "debit",
		"source": "purchase",
		"search": "user",
		"from":   "2024-01-01",
	})
	if f.Type != "debit" || f.Source != "purchase" || f.Search != "user" {
		t.Fatalf("filter mismatch: %+v", f)
	}
	if f.Dr.From != "2024-01-01" || f.Dr.To != "" {
		t.Fatalf("date range mismatch: %+v", f.Dr)
	}
}

func TestBuildReturnFilter(t *testing.T) {
	f := buildReturnFilter(map[string]string{
		"status": "approved",
		"type":   "refund",
		"search": "ret",
		"from":   "2024-01-01",
		"to":     "2024-12-31",
	})
	if f.Status != "approved" || f.Type != "refund" || f.Search != "ret" {
		t.Fatalf("filter mismatch: %+v", f)
	}
	if f.Dr.From != "2024-01-01" || f.Dr.To != "2024-12-31" {
		t.Fatalf("date range mismatch: %+v", f.Dr)
	}
}

func TestListExportTypes(t *testing.T) {
	types := ListExportTypes()
	expected := map[string]bool{
		"orders": true, "products": true, "customers": true,
		"transactions": true, "stock_movements": true, "wallet_transactions": true,
		"returns": true, "discounts": true, "offers": true, "users": true, "inventory": true,
	}
	if len(types) != len(expected) {
		t.Fatalf("expected %d export types, got %d: %v", len(expected), len(types), types)
	}
	for _, typ := range types {
		if !expected[typ] {
			t.Fatalf("unexpected export type: %q", typ)
		}
	}
}

func TestExportRegistryComplete(t *testing.T) {
	for key, et := range ExportRegistry {
		if et.Name == "" {
			t.Errorf("export type %q has empty Name", key)
		}
		if len(et.Headers) == 0 {
			t.Errorf("export type %q has no Headers", key)
		}
		if et.CountFn == nil {
			t.Errorf("export type %q has nil CountFn", key)
		}
		if et.BatchFn == nil {
			t.Errorf("export type %q has nil BatchFn", key)
		}
	}
}
