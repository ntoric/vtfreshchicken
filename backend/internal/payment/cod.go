package payment

import (
	"context"
	"fmt"
	"time"
)

// CodGateway handles Cash on Delivery — no online payment is processed.
// The order is created in "pending" status and payment is collected on delivery.
type CodGateway struct{}

func (g *CodGateway) Info() GatewayInfo {
	return GatewayInfo{
		ID:          "cod",
		Name:        "Cash on Delivery",
		Description: "Pay with cash or card when your order arrives",
		Icon:        "💵",
		Group:       "cash",
		IsActive:    true,
		SortOrder:   90,
	}
}

func (g *CodGateway) ProcessPayment(ctx context.Context, req PaymentRequest) (*PaymentResult, error) {
	// No processing needed — payment is collected on delivery.
	// We just simulate a brief confirmation.
	select {
	case <-time.After(300 * time.Millisecond):
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	return &PaymentResult{
		Success:       true,
		Status:        "pending",
		TransactionID: fmt.Sprintf("cod_%d", time.Now().UnixNano()),
		Message:       "Order placed. Payment will be collected on delivery.",
	}, nil
}

func init() {
	Default.Register(&CodGateway{})
}
