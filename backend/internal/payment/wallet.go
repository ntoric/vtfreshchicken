package payment

import (
	"context"
	"fmt"
)

// WalletGateway represents the internal wallet as a payment method.
// It is registered so it appears in the payment methods list, but the actual
// balance check and debit happen in the checkout handler (which has the
// authenticated user ID from context). ProcessPayment is not called directly
// for wallet payments — the checkout handler special-cases "wallet" and calls
// the wallet service instead.
type WalletGateway struct{}

func (g *WalletGateway) Info() GatewayInfo {
	return GatewayInfo{
		ID:          "wallet",
		Name:        "Store Wallet",
		Description: "Pay using your store wallet balance",
		Icon:        "👛",
		Group:       "wallet",
		IsActive:    true,
		SortOrder:   5, // show before cards
	}
}

// ProcessPayment is a fallback that should not be reached for wallet payments.
// The checkout handler intercepts "wallet" before calling the gateway and
// performs the debit via the wallet service with the authenticated user ID.
func (g *WalletGateway) ProcessPayment(ctx context.Context, req PaymentRequest) (*PaymentResult, error) {
	return nil, fmt.Errorf("wallet payment must be processed via the checkout flow")
}

func init() {
	Default.Register(&WalletGateway{})
}
