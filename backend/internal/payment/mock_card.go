package payment

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// MockCardGateway simulates a credit/debit card processor.
// In test mode, it uses the test card registry to trigger different
// payment scenarios (success, decline, 3DS, etc.).
// In production, this would call Stripe/Braintree/Adyen etc.
type MockCardGateway struct{}

func (g *MockCardGateway) Info() GatewayInfo {
	info := GatewayInfo{
		ID:          "card",
		Name:        "Credit / Debit Card",
		Description: "Visa, Mastercard, Amex, Discover",
		Icon:        "💳",
		Group:       "card",
		IsActive:    true,
		SortOrder:   10,
	}
	if IsTestMode() {
		info.PublicConfig = map[string]interface{}{
			"test_mode": true,
		}
	}
	return info
}

func (g *MockCardGateway) ProcessPayment(ctx context.Context, req PaymentRequest) (*PaymentResult, error) {
	cardNumber, _ := req.Details["card_number"].(string)
	cardCVV, _ := req.Details["card_cvv"].(string)
	cardExpiry, _ := req.Details["card_expiry"].(string)
	cardName, _ := req.Details["card_name"].(string)

	digits := strings.ReplaceAll(cardNumber, " ", "")
	if len(digits) < 13 {
		return nil, fmt.Errorf("invalid card number")
	}
	if cardName == "" {
		return nil, fmt.Errorf("name on card is required")
	}
	if len(cardCVV) < 3 {
		return nil, fmt.Errorf("invalid CVV")
	}
	if cardExpiry == "" {
		return nil, fmt.Errorf("card expiry is required")
	}

	startTime := time.Now()

	// Look up the card in the test card registry
	testCard := FindTestCard(digits)
	var result *PaymentResult
	var err error

	if testCard != nil {
		// Known test card — use the scenario
		result, err = ProcessTestCard(testCard.Scenario, ctx)
	} else {
		// Unknown card — default to success (for ad-hoc testing)
		select {
		case <-time.After(800 * time.Millisecond):
		case <-ctx.Done():
			return nil, ctx.Err()
		}
		result = &PaymentResult{
			Success:       true,
			Status:        "paid",
			TransactionID: fmt.Sprintf("mock_card_%d", time.Now().UnixNano()),
			Message:       "Payment processed successfully",
		}
	}

	if err != nil {
		return nil, err
	}

	// Log the test transaction
	brand := "card"
	if testCard != nil {
		brand = testCard.Brand
	}
	scenario := TestScenario("success")
	if testCard != nil {
		scenario = testCard.Scenario
	}
	LogTestTransaction(TestTransaction{
		ID:            fmt.Sprintf("ttx_%d", time.Now().UnixNano()),
		Gateway:       "card",
		Amount:        req.Amount,
		Currency:      req.Currency,
		Scenario:      scenario,
		CardNumber:    MaskCardNumber(digits),
		CardBrand:     brand,
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
	Default.Register(&MockCardGateway{})
}
