package payment

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// fakeCashfree serves a minimal Cashfree PG API for one order.
func fakeCashfree(t *testing.T, status string, amount float64) (*httptest.Server, *map[string]interface{}) {
	t.Helper()
	var created map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-client-id") != "TEST_APP" || r.Header.Get("x-client-secret") != "secret" {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"message":"authentication Failed"}`))
			return
		}
		if r.Header.Get("x-api-version") == "" {
			t.Errorf("missing x-api-version header")
		}
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/orders":
			_ = json.NewDecoder(r.Body).Decode(&created)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"cf_order_id":        12345,
				"order_id":           created["order_id"],
				"order_amount":       created["order_amount"],
				"order_currency":     created["order_currency"],
				"order_status":       "ACTIVE",
				"payment_session_id": "session_abc",
			})
		case r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/payments"):
			_, _ = w.Write([]byte(`[{"cf_payment_id":"999","payment_status":"FAILED"},{"cf_payment_id":5114910,"payment_status":"SUCCESS"}]`))
		case r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/orders/"):
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"order_id":       strings.TrimPrefix(r.URL.Path, "/orders/"),
				"order_amount":   amount,
				"order_currency": "INR",
				"order_status":   status,
			})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	return srv, &created
}

func testGateway(url string) *CashfreeGateway {
	return &CashfreeGateway{client: http.DefaultClient, baseURLOverride: url}
}

var testCfg = map[string]interface{}{"app_id": "TEST_APP", "secret_key": "secret"}

func TestCashfreeCreateOrder(t *testing.T) {
	srv, created := fakeCashfree(t, "ACTIVE", 499.5)
	g := testGateway(srv.URL)

	res, err := g.CreateOrder(context.Background(), CreateOrderRequest{
		Amount: 499.5, Currency: "inr", CustomerName: "Asha K",
		CustomerEmail: "asha@example.com", CustomerPhone: "+91 98765-43210", Config: testCfg,
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.PaymentSessionID != "session_abc" || res.Mode != "sandbox" || res.Amount != 49950 {
		t.Fatalf("unexpected result: %+v", res)
	}
	cust := (*created)["customer_details"].(map[string]interface{})
	if cust["customer_phone"] != "9876543210" {
		t.Errorf("phone not normalized: %v", cust["customer_phone"])
	}
	if (*created)["order_currency"] != "INR" {
		t.Errorf("currency not upper-cased: %v", (*created)["order_currency"])
	}
}

func TestCashfreeCreateOrderRequiresPhone(t *testing.T) {
	srv, _ := fakeCashfree(t, "ACTIVE", 100)
	_, err := testGateway(srv.URL).CreateOrder(context.Background(), CreateOrderRequest{
		Amount: 100, Currency: "INR", Config: testCfg,
	})
	if err == nil || !strings.Contains(err.Error(), "phone") {
		t.Fatalf("expected phone error, got %v", err)
	}
}

func TestCashfreeProcessPayment(t *testing.T) {
	cases := []struct {
		name    string
		status  string
		paid    float64
		charge  float64
		success bool
	}{
		{"paid and matching", "PAID", 250, 250, true},
		{"not paid", "ACTIVE", 250, 250, false},
		{"amount mismatch", "PAID", 10, 250, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv, _ := fakeCashfree(t, tc.status, tc.paid)
			res, err := testGateway(srv.URL).ProcessPayment(context.Background(), PaymentRequest{
				Amount: tc.charge, Currency: "INR", Config: testCfg,
				Details: map[string]interface{}{"cashfree_order_id": "vtc_1_abc"},
			})
			if err != nil {
				t.Fatal(err)
			}
			if res.Success != tc.success {
				t.Fatalf("success=%v, want %v (%s)", res.Success, tc.success, res.Message)
			}
			if tc.success && res.TransactionID != "5114910" {
				t.Errorf("transaction id = %q, want successful cf_payment_id", res.TransactionID)
			}
		})
	}
}

func TestCashfreeProcessPaymentRejectsBadOrderID(t *testing.T) {
	g := testGateway("http://unused")
	_, err := g.ProcessPayment(context.Background(), PaymentRequest{
		Amount: 1, Config: testCfg,
		Details: map[string]interface{}{"cashfree_order_id": "../../refunds"},
	})
	if err == nil {
		t.Fatal("expected error for invalid order id")
	}
}

func TestCashfreeDemoModeOnlyOutsideProduction(t *testing.T) {
	g := testGateway("http://unused")
	req := PaymentRequest{Amount: 1, Details: map[string]interface{}{"cashfree_order_id": "demo_vtc_1"}}

	t.Setenv("APP_ENV", "development")
	if res, err := g.ProcessPayment(context.Background(), req); err != nil || !res.Success {
		t.Fatalf("demo payment should succeed in development: %v %+v", err, res)
	}

	t.Setenv("APP_ENV", "production")
	if _, err := g.ProcessPayment(context.Background(), req); err == nil {
		t.Fatal("unconfigured Cashfree must fail in production")
	}
}

func TestNormalizeCashfreeEnv(t *testing.T) {
	if normalizeCashfreeEnv("", "TEST123") != "sandbox" {
		t.Error("TEST app id should infer sandbox")
	}
	if normalizeCashfreeEnv("", "12345abc") != "production" {
		t.Error("non-TEST app id should infer production")
	}
	if normalizeCashfreeEnv("sandbox", "12345abc") != "sandbox" {
		t.Error("explicit environment should win")
	}
}
