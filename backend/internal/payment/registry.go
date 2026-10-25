// Package payment provides a pluggable payment gateway registry.
//
// Architecture:
//
//	Each gateway is a self-contained file (e.g. mock_card.go, mock_paypal.go)
//	that implements the Gateway interface and registers itself via init().
//
// Adding a new gateway:
//  1. Create a new file in this package (e.g. stripe.go)
//  2. Implement the Gateway interface
//  3. Call Default.Register(&MyGateway{}) in init()
//
// No changes to handlers, main.go, or any other file are needed.
package payment

import "context"

// GatewayInfo is the public metadata for a payment gateway.
// This is what gets returned to the frontend via GET /payment/methods.
type GatewayInfo struct {
	ID              string                 `json:"id"`
	Name            string                 `json:"name"`
	Description     string                 `json:"description"`
	Icon            string                 `json:"icon"`              // emoji or icon identifier
	Group           string                 `json:"group"`             // "card", "wallet", "bank", "cash", "crypto"
	RequiresRedirect bool                   `json:"requires_redirect"` // true if gateway redirects to external URL
	IsActive        bool                   `json:"is_active"`
	SortOrder       int                    `json:"sort_order"`
	PublicConfig    map[string]interface{} `json:"public_config,omitempty"` // public config safe to expose to frontend (e.g. key_id)
}

// PaymentRequest is passed to a gateway when processing a payment.
type PaymentRequest struct {
	Amount       float64                  // grand total in the order currency
	Currency     string                   // ISO 4217 currency code
	OrderRef     string                   // internal order/cart reference
	CustomerName string                   // customer's full name
	CustomerEmail string                  // customer's email
	Details      map[string]interface{}   // gateway-specific raw fields from the frontend
	Config       map[string]interface{}   // resolved gateway config from the store (credentials etc.); gateways fall back to env vars when empty
}

// PaymentResult is returned by a gateway after processing.
type PaymentResult struct {
	Success       bool   `json:"success"`
	Status        string `json:"status"`          // "paid", "pending", "failed", "authorized"
	TransactionID string `json:"transaction_id"`  // gateway transaction/reference ID
	RedirectURL   string `json:"redirect_url,omitempty"` // for redirect-based gateways
	Message       string `json:"message,omitempty"`      // user-facing message
}

// Gateway is the interface that every payment gateway must implement.
type Gateway interface {
	// Info returns the gateway's metadata for listing available methods.
	Info() GatewayInfo

	// ProcessPayment attempts to charge/authorize the payment.
	// For mock gateways this is synchronous. For real gateways this may
	// return a RedirectURL for 3DS/OAuth flows.
	ProcessPayment(ctx context.Context, req PaymentRequest) (*PaymentResult, error)
}

// OrderCreator is an optional interface for gateways that need server-side
// order creation before the frontend can open the checkout flow (e.g. Razorpay).
// Gateways that don't need this simply don't implement it.
type OrderCreator interface {
	// CreateOrder creates a gateway-side order and returns its ID.
	CreateOrder(ctx context.Context, req CreateOrderRequest) (*CreateOrderResult, error)
}

// CreateOrderRequest is passed to OrderCreator.CreateOrder.
type CreateOrderRequest struct {
	Amount       float64 // in major currency units (e.g. dollars)
	Currency     string  // ISO 4217
	Receipt      string  // internal reference (cart ID etc.)
	CustomerName string
	CustomerEmail string
	Config       map[string]interface{} // resolved gateway config from the store (credentials etc.)
}

// CreateOrderResult is returned by OrderCreator.CreateOrder.
type CreateOrderResult struct {
	GatewayOrderID string `json:"gateway_order_id"` // e.g. razorpay_order_id
	Amount         int64  `json:"amount"`           // amount in smallest unit (paise/cents)
	Currency       string `json:"currency"`
	KeyID          string `json:"key_id,omitempty"` // public key for frontend checkout
}

// Registry holds all registered payment gateways.
type Registry struct {
	gateways map[string]Gateway
	order    []string // preserves registration order for stable listing
}

// NewRegistry creates an empty registry.
func NewRegistry() *Registry {
	return &Registry{gateways: make(map[string]Gateway)}
}

// Register adds a gateway to the registry. Called from each gateway's init().
func (r *Registry) Register(g Gateway) {
	id := g.Info().ID
	if _, exists := r.gateways[id]; !exists {
		r.order = append(r.order, id)
	}
	r.gateways[id] = g
}

// Get retrieves a gateway by ID.
func (r *Registry) Get(id string) (Gateway, bool) {
	g, ok := r.gateways[id]
	return g, ok
}

// List returns metadata for all registered gateways, sorted by SortOrder then registration order.
func (r *Registry) List() []GatewayInfo {
	out := make([]GatewayInfo, 0, len(r.order))
	for _, id := range r.order {
		info := r.gateways[id].Info()
		if info.IsActive {
			out = append(out, info)
		}
	}
	// Sort by SortOrder (stable sort preserves registration order for ties)
	for i := 1; i < len(out); i++ {
		for j := i; j > 0 && out[j].SortOrder < out[j-1].SortOrder; j-- {
			out[j], out[j-1] = out[j-1], out[j]
		}
	}
	return out
}

// Default is the global registry that all gateways self-register into via init().
var Default = NewRegistry()
