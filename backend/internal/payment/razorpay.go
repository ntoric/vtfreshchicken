package payment

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// RazorpayGateway integrates with the Razorpay payment platform.
//
// Flow:
//   1. Frontend calls backend CreateOrder → Razorpay order is created → returns razorpay_order_id
//   2. Frontend opens Razorpay checkout.js modal with the order_id
//   3. User pays (UPI, cards, netbanking, wallets) in the modal
//   4. Razorpay returns razorpay_payment_id + razorpay_signature
//   5. Frontend sends these to POST /checkout
//   6. ProcessPayment verifies the HMAC-SHA256 signature
//
// Demo mode: When RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are empty,
// the gateway simulates order creation and payment verification.
// This allows full end-to-end testing without real Razorpay keys.
type RazorpayGateway struct {
	keyID     string
	keySecret string
}

func newRazorpayGateway() *RazorpayGateway {
	return &RazorpayGateway{
		keyID:     os.Getenv("RAZORPAY_KEY_ID"),
		keySecret: os.Getenv("RAZORPAY_KEY_SECRET"),
	}
}

// credentials resolves the API credentials for a single request: values stored
// in the store's gateway config take precedence over the environment fallback
// captured at startup.
func (g *RazorpayGateway) credentials(cfg map[string]interface{}) (keyID, keySecret string) {
	keyID, keySecret = g.keyID, g.keySecret
	if cfg != nil {
		if v, ok := cfg["key_id"].(string); ok && v != "" {
			keyID = v
		}
		if v, ok := cfg["key_secret"].(string); ok && v != "" {
			keySecret = v
		}
	}
	return keyID, keySecret
}

func (g *RazorpayGateway) Info() GatewayInfo {
	info := GatewayInfo{
		ID:               "razorpay",
		Name:             "Razorpay",
		Description:      "UPI, Cards, Net Banking, Wallets & EMI (India)",
		Icon:             "🇮🇳",
		Group:            "wallet",
		RequiresRedirect: true,
		IsActive:         true,
		SortOrder:        15,
	}
	if g.keyID != "" {
		info.PublicConfig = map[string]interface{}{
			"key_id": g.keyID,
		}
	} else {
		// Demo mode — provide a fake key so the frontend can still render
		info.PublicConfig = map[string]interface{}{
			"key_id":     "rzp_test_demo_key",
			"demo_mode":  true,
		}
	}
	return info
}

// ============================================================
// OrderCreator interface
// ============================================================

type razorpayOrderAPIResp struct {
	ID       string `json:"id"`
	Amount   int64  `json:"amount"`   // in paise
	Currency string `json:"currency"`
	Status   string `json:"status"`
}

func (g *RazorpayGateway) CreateOrder(ctx context.Context, req CreateOrderRequest) (*CreateOrderResult, error) {
	keyID, keySecret := g.credentials(req.Config)

	// Razorpay expects amount in smallest currency unit (paise for INR)
	amountInPaise := int64(req.Amount * 100)

	if keyID == "" || keySecret == "" {
		// Demo mode — return a fake order ID
		return &CreateOrderResult{
			GatewayOrderID: fmt.Sprintf("order_demo_%d", time.Now().UnixNano()),
			Amount:         amountInPaise,
			Currency:       req.Currency,
			KeyID:          "rzp_test_demo_key",
		}, nil
	}

	// Real mode — call Razorpay API
	payload, _ := json.Marshal(map[string]interface{}{
		"amount":          amountInPaise,
		"currency":        req.Currency,
		"receipt":         req.Receipt,
		"payment_capture": 1, // auto-capture
	})

	httpReq, err := http.NewRequestWithContext(ctx, "POST", "https://api.razorpay.com/v1/orders", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	httpReq.SetBasicAuth(keyID, keySecret)
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("razorpay API error: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("razorpay order creation failed (status %d): %s", resp.StatusCode, string(body))
	}

	var orderResp razorpayOrderAPIResp
	if err := json.Unmarshal(body, &orderResp); err != nil {
		return nil, fmt.Errorf("failed to parse razorpay response: %w", err)
	}

	return &CreateOrderResult{
		GatewayOrderID: orderResp.ID,
		Amount:         orderResp.Amount,
		Currency:       orderResp.Currency,
		KeyID:          keyID,
	}, nil
}

// ============================================================
// Gateway interface — ProcessPayment verifies the signature
// ============================================================

func (g *RazorpayGateway) ProcessPayment(ctx context.Context, req PaymentRequest) (*PaymentResult, error) {
	_, keySecret := g.credentials(req.Config)

	razorpayOrderID, _ := req.Details["razorpay_order_id"].(string)
	razorpayPaymentID, _ := req.Details["razorpay_payment_id"].(string)
	razorpaySignature, _ := req.Details["razorpay_signature"].(string)

	// If no Razorpay payment fields are present, the frontend checkout modal
	// wasn't completed.
	if razorpayOrderID == "" || razorpayPaymentID == "" {
		return nil, fmt.Errorf("Razorpay payment not completed. Please click 'Pay with Razorpay' to open the checkout.")
	}

	if keySecret == "" {
		// Demo mode — simulate verification success
		// In demo mode, we accept any non-empty payment_id and order_id
		return &PaymentResult{
			Success:       true,
			Status:        "paid",
			TransactionID: razorpayPaymentID,
			Message:       "Razorpay payment verified (demo mode)",
		}, nil
	}

	// Real mode — verify HMAC-SHA256 signature
	// Signature = HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
	if razorpaySignature == "" {
		return nil, fmt.Errorf("missing Razorpay signature")
	}

	expectedSig := computeRazorpaySignature(razorpayOrderID, razorpayPaymentID, keySecret)
	if !hmac.Equal([]byte(expectedSig), []byte(razorpaySignature)) {
		return &PaymentResult{
			Success: false,
			Status:  "failed",
			Message: "Razorpay signature verification failed. Payment rejected.",
		}, nil
	}

	return &PaymentResult{
		Success:       true,
		Status:        "paid",
		TransactionID: razorpayPaymentID,
		Message:       "Razorpay payment verified",
	}, nil
}

// computeRazorpaySignature computes the HMAC-SHA256 signature that Razorpay
// uses for payment verification.
func computeRazorpaySignature(orderID, paymentID, keySecret string) string {
	data := orderID + "|" + paymentID
	h := hmac.New(sha256.New, []byte(keySecret))
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}

// razorpaySupportedCurrency checks if the currency is supported by Razorpay.
// Razorpay primarily supports INR but also supports international currencies
// for specific account types.
func razorpaySupportedCurrency(code string) bool {
	code = strings.ToUpper(code)
	supported := map[string]bool{
		"INR": true, "USD": true, "EUR": true, "GBP": true,
		"AED": true, "SGD": true, "AUD": true, "CAD": true,
		"JPY": true, "MYR": true, "THB": true,
	}
	return supported[code]
}

func init() {
	Default.Register(newRazorpayGateway())
}
