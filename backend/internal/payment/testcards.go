package payment

import (
	"context"
	"fmt"
	"strings"
)

// TestScenario defines what happens when a test card is used.
type TestScenario string

const (
	ScenarioSuccess          TestScenario = "success"
	ScenarioDeclined         TestScenario = "declined"
	ScenarioInsufficientFunds TestScenario = "insufficient_funds"
	ScenarioExpiredCard      TestScenario = "expired_card"
	ScenarioIncorrectCVC     TestScenario = "incorrect_cvc"
	ScenarioProcessingError  TestScenario = "processing_error"
	Scenario3DSChallenge     TestScenario = "3ds_challenge"
	ScenarioFraudBlocked     TestScenario = "fraud_blocked"
	ScenarioSlowApproval     TestScenario = "slow_approval"
	ScenarioRefund           TestScenario = "refund"
)

// TestCard represents a test card number that triggers a specific payment scenario.
type TestCard struct {
	Number      string       `json:"number"`       // full card number (no spaces)
	Brand       string       `json:"brand"`        // visa, mastercard, amex, discover
	Scenario    TestScenario `json:"scenario"`     // what happens when this card is used
	Description string       `json:"description"`  // human-readable description
	ExpectedResult string    `json:"expected_result"` // "paid", "failed", "pending"
}

// TestCards is the registry of all test cards.
var TestCards = []TestCard{
	// Success scenarios
	{
		Number:      "4242424242424242",
		Brand:       "visa",
		Scenario:    ScenarioSuccess,
		Description: "Visa — Successful payment",
		ExpectedResult: "paid",
	},
	{
		Number:      "5555555555554444",
		Brand:       "mastercard",
		Scenario:    ScenarioSuccess,
		Description: "Mastercard — Successful payment",
		ExpectedResult: "paid",
	},
	{
		Number:      "378282246310005",
		Brand:       "amex",
		Scenario:    ScenarioSuccess,
		Description: "Amex — Successful payment (15 digits)",
		ExpectedResult: "paid",
	},
	{
		Number:      "6011111111111117",
		Brand:       "discover",
		Scenario:    ScenarioSuccess,
		Description: "Discover — Successful payment",
		ExpectedResult: "paid",
	},
	{
		Number:      "4000000000009995",
		Brand:       "visa",
		Scenario:    ScenarioSuccess,
		Description: "Visa — Successful payment (alt)",
		ExpectedResult: "paid",
	},

	// Decline scenarios
	{
		Number:      "4000000000000002",
		Brand:       "visa",
		Scenario:    ScenarioDeclined,
		Description: "Visa — Card declined (generic decline)",
		ExpectedResult: "failed",
	},
	{
		Number:      "4000000000009998",
		Brand:       "visa",
		Scenario:    ScenarioInsufficientFunds,
		Description: "Visa — Insufficient funds",
		ExpectedResult: "failed",
	},
	{
		Number:      "4000000000000069",
		Brand:       "visa",
		Scenario:    ScenarioExpiredCard,
		Description: "Visa — Expired card",
		ExpectedResult: "failed",
	},
	{
		Number:      "4000000000000127",
		Brand:       "visa",
		Scenario:    ScenarioIncorrectCVC,
		Description: "Visa — Incorrect CVC",
		ExpectedResult: "failed",
	},
	{
		Number:      "4000000000000119",
		Brand:       "visa",
		Scenario:    ScenarioProcessingError,
		Description: "Visa — Processing error",
		ExpectedResult: "failed",
	},
	{
		Number:      "4000000000004954",
		Brand:       "visa",
		Scenario:    ScenarioFraudBlocked,
		Description: "Visa — Fraudulent transaction blocked",
		ExpectedResult: "failed",
	},

	// 3DS challenge
	{
		Number:      "4000000000003220",
		Brand:       "visa",
		Scenario:    Scenario3DSChallenge,
		Description: "Visa — 3D Secure authentication required",
		ExpectedResult: "pending",
	},

	// Slow approval (simulates network delay)
	{
		Number:      "4000000000007726",
		Brand:       "visa",
		Scenario:    ScenarioSlowApproval,
		Description: "Visa — Slow approval (3s processing time)",
		ExpectedResult: "paid",
	},
}

// FindTestCard looks up a test card by its number (digits only).
// Returns nil if the card number doesn't match any test card.
func FindTestCard(digits string) *TestCard {
	for i := range TestCards {
		if TestCards[i].Number == digits {
			return &TestCards[i]
		}
	}
	return nil
}

// ScenarioMessage returns a user-facing message for a test scenario.
func ScenarioMessage(s TestScenario) string {
	switch s {
	case ScenarioSuccess:
		return "Payment processed successfully"
	case ScenarioDeclined:
		return "Your card was declined."
	case ScenarioInsufficientFunds:
		return "Your card has insufficient funds."
	case ScenarioExpiredCard:
		return "Your card has expired."
	case ScenarioIncorrectCVC:
		return "Your card's security code is incorrect."
	case ScenarioProcessingError:
		return "An error occurred while processing your card."
	case Scenario3DSChallenge:
		return "3D Secure authentication required. (Demo: auto-approved)"
	case ScenarioFraudBlocked:
		return "Transaction blocked by fraud detection."
	case ScenarioSlowApproval:
		return "Payment approved (after delay)"
	case ScenarioRefund:
		return "Payment processed, then refunded"
	default:
		return fmt.Sprintf("Unknown scenario: %s", s)
	}
}

// ScenarioDelay returns the simulated processing delay for a scenario.
func ScenarioDelay(s TestScenario) Duration {
	switch s {
	case ScenarioSuccess:
		return 800 * Millisecond
	case ScenarioDeclined, ScenarioInsufficientFunds, ScenarioExpiredCard, ScenarioIncorrectCVC:
		return 600 * Millisecond
	case ScenarioProcessingError:
		return 1200 * Millisecond
	case Scenario3DSChallenge:
		return 2000 * Millisecond
	case ScenarioFraudBlocked:
		return 400 * Millisecond
	case ScenarioSlowApproval:
		return 3000 * Millisecond
	case ScenarioRefund:
		return 1000 * Millisecond
	default:
		return 800 * Millisecond
	}
}

// IsTestMode returns true if the payment system is running in test mode.
// Test mode is active when APP_ENV is not "production".
func IsTestMode() bool {
	return strings.ToLower(envOr("APP_ENV", "development")) != "production"
}

// envOr is a helper to read an env var with a fallback.
func envOr(key, fallback string) string {
	if v := osGetenv(key); v != "" {
		return v
	}
	return fallback
}

// ProcessTestCard simulates processing a test card and returns the result.
// This is used by the mock card gateway.
func ProcessTestCard(scenario TestScenario, ctx context.Context) (*PaymentResult, error) {
	delay := ScenarioDelay(scenario)

	select {
	case <-after(delay):
	case <-ctxDone(ctx):
		return nil, ctxErr(ctx)
	}

	msg := ScenarioMessage(scenario)

	switch scenario {
	case ScenarioSuccess, ScenarioSlowApproval:
		return &PaymentResult{
			Success:       true,
			Status:        "paid",
			TransactionID: fmt.Sprintf("test_txn_%d", nowNano()),
			Message:       msg,
		}, nil

	case Scenario3DSChallenge:
		// In demo mode, 3DS is auto-approved
		return &PaymentResult{
			Success:       true,
			Status:        "paid",
			TransactionID: fmt.Sprintf("test_3ds_%d", nowNano()),
			Message:       msg,
		}, nil

	case ScenarioRefund:
		return &PaymentResult{
			Success:       true,
			Status:        "paid",
			TransactionID: fmt.Sprintf("test_txn_%d", nowNano()),
			Message:       msg + " (demo: refund not actually processed)",
		}, nil

	case ScenarioDeclined, ScenarioInsufficientFunds, ScenarioExpiredCard,
		ScenarioIncorrectCVC, ScenarioProcessingError, ScenarioFraudBlocked:
		return &PaymentResult{
			Success: false,
			Status:  "failed",
			Message: msg,
		}, nil

	default:
		return &PaymentResult{
			Success:       true,
			Status:        "paid",
			TransactionID: fmt.Sprintf("test_txn_%d", nowNano()),
			Message:       msg,
		}, nil
	}
}
