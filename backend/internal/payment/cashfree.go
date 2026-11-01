package payment

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"
)

// CashfreeGateway integrates with Cashfree Payments (PG API).
//
// Flow:
//  1. Frontend calls POST /payment/cashfree/create-order → backend creates a
//     Cashfree order and returns its order_id + payment_session_id.
//  2. Frontend opens the Cashfree JS SDK popup with the payment_session_id.
//  3. Customer pays (UPI, cards, net banking, wallets) in the popup.
//  4. Frontend sends cashfree_order_id to POST /checkout.
//  5. ProcessPayment fetches the order from Cashfree and only accepts it when
//     order_status is PAID and the paid amount/currency match the order total.
//
// Credentials come from the store's gateway config (Backoffice → Developer):
//
//	app_id      — Cashfree App ID (x-client-id)
//	secret_key  — Cashfree Secret Key (x-client-secret)
//	environment — "sandbox" or "production" (optional; inferred from the
//	              App ID's TEST prefix when empty)
//
// falling back to CASHFREE_APP_ID / CASHFREE_SECRET_KEY / CASHFREE_ENV.
// With no credentials at all, the gateway runs in demo mode and simulates
// order creation + verification.
type CashfreeGateway struct {
	appID     string
	secretKey string
	env       string
	client    *http.Client
	// baseURLOverride is used by tests to point at a fake server.
	baseURLOverride string
}

const (
	cashfreeAPIVersion    = "2025-01-01"
	cashfreeSandboxURL    = "https://sandbox.cashfree.com/pg"
	cashfreeProductionURL = "https://api.cashfree.com/pg"
)

var cashfreeOrderIDRe = regexp.MustCompile(`^[A-Za-z0-9_-]{3,45}$`)

func newCashfreeGateway() *CashfreeGateway {
	return &CashfreeGateway{
		appID:     os.Getenv("CASHFREE_APP_ID"),
		secretKey: os.Getenv("CASHFREE_SECRET_KEY"),
		env:       os.Getenv("CASHFREE_ENV"),
		client:    &http.Client{Timeout: 15 * time.Second},
	}
}

type cashfreeCreds struct {
	appID     string
	secretKey string
	env       string // "sandbox" | "production"
}

// credentials resolves credentials for one request: store config wins over
// the environment fallback.
func (g *CashfreeGateway) credentials(cfg map[string]interface{}) cashfreeCreds {
	c := cashfreeCreds{appID: g.appID, secretKey: g.secretKey, env: g.env}
	if cfg != nil {
		if v, ok := cfg["app_id"].(string); ok && strings.TrimSpace(v) != "" {
			c.appID = strings.TrimSpace(v)
		}
		if v, ok := cfg["secret_key"].(string); ok && strings.TrimSpace(v) != "" {
			c.secretKey = strings.TrimSpace(v)
		}
		if v, ok := cfg["environment"].(string); ok && strings.TrimSpace(v) != "" {
			c.env = strings.TrimSpace(v)
		}
	}
	c.env = normalizeCashfreeEnv(c.env, c.appID)
	return c
}

func normalizeCashfreeEnv(env, appID string) string {
	switch strings.ToLower(env) {
	case "production", "prod", "live":
		return "production"
	case "sandbox", "test":
		return "sandbox"
	}
	// Cashfree test App IDs carry a TEST prefix.
	if strings.HasPrefix(strings.ToUpper(appID), "TEST") {
		return "sandbox"
	}
	return "production"
}

func (c cashfreeCreds) configured() bool { return c.appID != "" && c.secretKey != "" }

// demo reports whether to simulate payments. Demo mode is only allowed while
// test payments are enabled, so a production store with missing credentials
// fails closed instead of accepting unpaid orders.
func (c cashfreeCreds) demo() bool { return !c.configured() && IsTestMode() }

func (g *CashfreeGateway) baseURL(env string) string {
	if g.baseURLOverride != "" {
		return g.baseURLOverride
	}
	if env == "production" {
		return cashfreeProductionURL
	}
	return cashfreeSandboxURL
}

func (g *CashfreeGateway) Info() GatewayInfo {
	info := GatewayInfo{
		ID:               "cashfree",
		Name:             "Cashfree",
		Description:      "UPI, Cards, Net Banking & Wallets (India)",
		Icon:             "💳",
		Group:            "wallet",
		RequiresRedirect: true,
		IsActive:         true,
		SortOrder:        16,
	}
	if g.appID != "" {
		info.PublicConfig = map[string]interface{}{"app_id": g.appID}
	} else {
		info.PublicConfig = map[string]interface{}{"demo_mode": true}
	}
	return info
}

// do sends an authenticated request to the Cashfree PG API.
func (g *CashfreeGateway) do(ctx context.Context, creds cashfreeCreds, method, path string, body interface{}) ([]byte, int, error) {
	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, 0, err
		}
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, g.baseURL(creds.env)+path, rdr)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("x-client-id", creds.appID)
	req.Header.Set("x-client-secret", creds.secretKey)
	req.Header.Set("x-api-version", cashfreeAPIVersion)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	client := g.client
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("cashfree API error: %w", err)
	}
	defer resp.Body.Close()
	out, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	return out, resp.StatusCode, nil
}

// cashfreeAPIError extracts Cashfree's error message from a response body.
func cashfreeAPIError(op string, status int, body []byte) error {
	var e struct {
		Message string `json:"message"`
		Code    string `json:"code"`
	}
	if json.Unmarshal(body, &e) == nil && e.Message != "" {
		return fmt.Errorf("cashfree %s failed (status %d): %s", op, status, e.Message)
	}
	return fmt.Errorf("cashfree %s failed (status %d)", op, status)
}

type cashfreeOrder struct {
	CfOrderID        json.RawMessage `json:"cf_order_id"`
	OrderID          string          `json:"order_id"`
	OrderAmount      float64         `json:"order_amount"`
	OrderCurrency    string          `json:"order_currency"`
	OrderStatus      string          `json:"order_status"`
	PaymentSessionID string          `json:"payment_session_id"`
}

type cashfreePayment struct {
	CfPaymentID   json.RawMessage `json:"cf_payment_id"`
	PaymentStatus string          `json:"payment_status"`
	PaymentAmount float64         `json:"payment_amount"`
}

// ============================================================
// OrderCreator interface
// ============================================================

func (g *CashfreeGateway) CreateOrder(ctx context.Context, req CreateOrderRequest) (*CreateOrderResult, error) {
	creds := g.credentials(req.Config)
	currency := strings.ToUpper(strings.TrimSpace(req.Currency))
	if currency == "" {
		currency = "INR"
	}
	amount := roundMoney(req.Amount)
	if amount < 1 {
		return nil, fmt.Errorf("amount must be at least 1 %s", currency)
	}

	orderID := newCashfreeOrderID()

	if !creds.configured() && !creds.demo() {
		return nil, fmt.Errorf("Cashfree is not configured")
	}
	if creds.demo() {
		return &CreateOrderResult{
			GatewayOrderID:   "demo_" + orderID,
			Amount:           int64(math.Round(amount * 100)),
			Currency:         currency,
			PaymentSessionID: "session_demo",
			Mode:             "demo",
		}, nil
	}

	phone := normalizeCashfreePhone(req.CustomerPhone)
	if phone == "" {
		return nil, fmt.Errorf("a valid phone number is required to pay with Cashfree")
	}

	customer := map[string]interface{}{
		"customer_id":    cashfreeCustomerID(req.CustomerEmail, phone),
		"customer_phone": phone,
	}
	if name := strings.TrimSpace(req.CustomerName); len(name) >= 3 {
		customer["customer_name"] = truncate(name, 100)
	}
	if email := strings.TrimSpace(req.CustomerEmail); len(email) >= 3 {
		customer["customer_email"] = truncate(email, 100)
	}

	payload := map[string]interface{}{
		"order_id":         orderID,
		"order_amount":     amount,
		"order_currency":   currency,
		"customer_details": customer,
	}
	if r := strings.TrimSpace(req.Receipt); r != "" {
		payload["order_tags"] = map[string]string{"receipt": truncate(r, 255)}
	}

	body, status, err := g.do(ctx, creds, http.MethodPost, "/orders", payload)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, cashfreeAPIError("order creation", status, body)
	}
	var o cashfreeOrder
	if err := json.Unmarshal(body, &o); err != nil {
		return nil, fmt.Errorf("failed to parse cashfree response: %w", err)
	}
	if o.PaymentSessionID == "" {
		return nil, fmt.Errorf("cashfree did not return a payment session")
	}

	return &CreateOrderResult{
		GatewayOrderID:   o.OrderID,
		Amount:           int64(math.Round(o.OrderAmount * 100)),
		Currency:         o.OrderCurrency,
		KeyID:            creds.appID,
		PaymentSessionID: o.PaymentSessionID,
		Mode:             creds.env,
	}, nil
}

// ============================================================
// Gateway interface — ProcessPayment verifies the order with Cashfree
// ============================================================

func (g *CashfreeGateway) ProcessPayment(ctx context.Context, req PaymentRequest) (*PaymentResult, error) {
	creds := g.credentials(req.Config)

	orderID, _ := req.Details["cashfree_order_id"].(string)
	orderID = strings.TrimSpace(orderID)
	if orderID == "" {
		return nil, fmt.Errorf("Cashfree payment not completed. Please click 'Pay with Cashfree' to complete the payment.")
	}

	if !creds.configured() && !creds.demo() {
		return nil, fmt.Errorf("Cashfree is not configured")
	}
	if creds.demo() {
		if !strings.HasPrefix(orderID, "demo_") {
			return nil, fmt.Errorf("invalid Cashfree order reference")
		}
		return &PaymentResult{
			Success:       true,
			Status:        "paid",
			TransactionID: orderID,
			Message:       "Cashfree payment verified (demo mode)",
		}, nil
	}

	if !cashfreeOrderIDRe.MatchString(orderID) {
		return nil, fmt.Errorf("invalid Cashfree order reference")
	}

	body, status, err := g.do(ctx, creds, http.MethodGet, "/orders/"+orderID, nil)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, cashfreeAPIError("order lookup", status, body)
	}
	var o cashfreeOrder
	if err := json.Unmarshal(body, &o); err != nil {
		return nil, fmt.Errorf("failed to parse cashfree response: %w", err)
	}

	if o.OrderStatus != "PAID" {
		return &PaymentResult{
			Success: false,
			Status:  "failed",
			Message: "Cashfree payment is not complete (status: " + strings.ToLower(o.OrderStatus) + "). Please try again.",
		}, nil
	}

	// The amount the customer paid must match what this checkout charges —
	// otherwise a cheaper paid order could be replayed against a larger cart.
	if math.Abs(roundMoney(o.OrderAmount)-roundMoney(req.Amount)) > 0.01 ||
		(req.Currency != "" && !strings.EqualFold(o.OrderCurrency, req.Currency)) {
		return &PaymentResult{
			Success: false,
			Status:  "failed",
			Message: fmt.Sprintf("Paid amount (%.2f %s) does not match the order total (%.2f %s). Please contact support with payment reference %s.",
				o.OrderAmount, o.OrderCurrency, req.Amount, strings.ToUpper(req.Currency), orderID),
		}, nil
	}

	// Use the successful payment's ID as the transaction reference when
	// available; fall back to the Cashfree order ID.
	txnID := orderID
	if pid := g.successfulPaymentID(ctx, creds, orderID); pid != "" {
		txnID = pid
	}

	return &PaymentResult{
		Success:       true,
		Status:        "paid",
		TransactionID: txnID,
		Message:       "Cashfree payment verified",
	}, nil
}

// successfulPaymentID returns the cf_payment_id of the order's successful
// payment, or "" if it can't be determined.
func (g *CashfreeGateway) successfulPaymentID(ctx context.Context, creds cashfreeCreds, orderID string) string {
	body, status, err := g.do(ctx, creds, http.MethodGet, "/orders/"+orderID+"/payments", nil)
	if err != nil || status != http.StatusOK {
		return ""
	}
	var payments []cashfreePayment
	if json.Unmarshal(body, &payments) != nil {
		return ""
	}
	for _, p := range payments {
		if p.PaymentStatus == "SUCCESS" {
			return strings.Trim(string(p.CfPaymentID), `"`)
		}
	}
	return ""
}

// ============================================================
// Helpers
// ============================================================

func newCashfreeOrderID() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return fmt.Sprintf("vtc_%d_%s", time.Now().Unix(), hex.EncodeToString(b))
}

// normalizeCashfreePhone reduces a phone number to the 10-digit form Cashfree
// expects for Indian numbers. Returns "" when it can't produce a valid number.
func normalizeCashfreePhone(raw string) string {
	var digits strings.Builder
	for _, r := range raw {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		}
	}
	d := digits.String()
	switch {
	case len(d) == 10:
		return d
	case len(d) == 12 && strings.HasPrefix(d, "91"):
		return d[2:]
	case len(d) == 11 && strings.HasPrefix(d, "0"):
		return d[1:]
	}
	return ""
}

// cashfreeCustomerID derives a stable alphanumeric customer ID (3–50 chars).
func cashfreeCustomerID(email, phone string) string {
	key := strings.ToLower(strings.TrimSpace(email))
	if key == "" {
		key = phone
	}
	sum := sha256.Sum256([]byte(key))
	return "cust" + hex.EncodeToString(sum[:])[:20]
}

func roundMoney(v float64) float64 { return math.Round(v*100) / 100 }

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}

func init() {
	Default.Register(newCashfreeGateway())
}
