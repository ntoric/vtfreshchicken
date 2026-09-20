package payment

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// MockPaypalGateway simulates PayPal Express Checkout.
// In production, this would redirect to PayPal and handle the OAuth callback.
type MockPaypalGateway struct{}

func (g *MockPaypalGateway) Info() GatewayInfo {
	info := GatewayInfo{
		ID:               "paypal",
		Name:             "PayPal",
		Description:      "Pay with your PayPal account balance or linked card",
		Icon:             "🅿️",
		Group:            "wallet",
		RequiresRedirect: true,
		IsActive:         true,
		SortOrder:        20,
	}
	if IsTestMode() {
		info.PublicConfig = map[string]interface{}{
			"test_mode": true,
		}
	}
	return info
}

func (g *MockPaypalGateway) ProcessPayment(ctx context.Context, req PaymentRequest) (*PaymentResult, error) {
	paypalEmail, _ := req.Details["paypal_email"].(string)
	paypalEmail = strings.TrimSpace(paypalEmail)

	if paypalEmail == "" || !strings.Contains(paypalEmail, "@") {
		return nil, fmt.Errorf("valid PayPal email is required")
	}

	startTime := time.Now()

	// Simulate processing
	select {
	case <-time.After(600 * time.Millisecond):
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	// In test mode, emails containing "fail" trigger a failure
	scenario := TestScenario("success")
	success := true
	status := "paid"
	msg := "PayPal payment completed"

	if IsTestMode() && (strings.Contains(strings.ToLower(paypalEmail), "fail") ||
		strings.Contains(strings.ToLower(paypalEmail), "decline")) {
		scenario = ScenarioDeclined
		success = false
		status = "failed"
		msg = "PayPal payment was declined"
	}

	result := &PaymentResult{
		Success:       success,
		Status:        status,
		TransactionID: fmt.Sprintf("mock_paypal_%d", time.Now().UnixNano()),
		Message:       msg,
	}

	// Log the test transaction
	LogTestTransaction(TestTransaction{
		ID:            fmt.Sprintf("ttx_%d", time.Now().UnixNano()),
		Gateway:       "paypal",
		Amount:        req.Amount,
		Currency:      req.Currency,
		Scenario:      scenario,
		CardNumber:    "",
		CardBrand:     "",
		Success:       result.Success,
		Status:        result.Status,
		TransactionID: result.TransactionID,
		Message:       result.Message,
		CustomerName:  req.CustomerName,
		CustomerEmail: req.CustomerEmail,
		Timestamp:     time.Now(),
		DurationMs:    time.Since(startTime).Milliseconds(),
	})

	return result, nil
}

func init() {
	Default.Register(&MockPaypalGateway{})
}
