package mcp

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// RegisterPaymentTools registers payment transaction, gateway, and wallet MCP tools.
func RegisterPaymentTools(s *server.MCPServer, c *Client) {
	// ---- Payment Transactions ----
	s.AddTool(mcp.NewTool("list_payment_transactions",
		mcp.WithDescription("List payment transactions with filters. Requires payments.view permission."),
		mcp.WithString("status", mcp.Description("Filter by status")),
		mcp.WithString("gateway", mcp.Description("Filter by gateway")),
		mcp.WithString("type", mcp.Description("Filter by type (capture, refund)")),
		mcp.WithString("search", mcp.Description("Search by transaction ID, order ID, customer email")),
		mcp.WithString("from", mcp.Description("Date range start")),
		mcp.WithString("to", mcp.Description("Date range end")),
		mcp.WithNumber("limit", mcp.Description("Page size")),
		mcp.WithNumber("offset", mcp.Description("Page offset")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQueryFromArgs(args)
		return callGet(ctx, c, c.APIPath("/payments/transactions"), q)
	})

	s.AddTool(mcp.NewTool("get_payment_transaction",
		mcp.WithDescription("Get a single payment transaction by ID. Requires payments.view permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Transaction UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.APIPath(fmt.Sprintf("/payments/transactions/%s", argString(args, "id"))), nil)
	})

	s.AddTool(mcp.NewTool("list_order_transactions",
		mcp.WithDescription("List payment transactions for a specific order. Requires payments.view permission."),
		mcp.WithString("order_id", mcp.Required(), mcp.Description("Order UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.APIPath(fmt.Sprintf("/payments/orders/%s/transactions", argString(args, "order_id"))), nil)
	})

	s.AddTool(mcp.NewTool("refund_transaction",
		mcp.WithDescription("Refund a payment transaction (full or partial). Requires payments.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Transaction UUID")),
		mcp.WithNumber("amount", mcp.Description("Refund amount (omit for full refund)")),
		mcp.WithString("reason", mcp.Description("Refund reason")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := bodyFromArgs(args, "amount", "reason")
		return callPost(ctx, c, c.APIPath(fmt.Sprintf("/payments/transactions/%s/refund", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("list_payment_gateways",
		mcp.WithDescription("List payment gateway configurations. Requires payments.view permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.APIPath("/payments/gateways"), nil)
	})

	s.AddTool(mcp.NewTool("update_payment_gateway",
		mcp.WithDescription("Update a payment gateway configuration. Requires payments.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Gateway config UUID")),
		mcp.WithObject("gateway", mcp.Required(), mcp.Description("Gateway config fields (enabled, test_mode, display_name)")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "gateway")
		return callPut(ctx, c, c.APIPath(fmt.Sprintf("/payments/gateways/%s", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("get_payment_stats",
		mcp.WithDescription("Get payment statistics (collected, refunded, net revenue, by gateway). Requires payments.view permission."),
		mcp.WithString("from", mcp.Description("Date range start")),
		mcp.WithString("to", mcp.Description("Date range end")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQuery(args, "from", "to")
		return callGet(ctx, c, c.APIPath("/payments/stats"), q)
	})

	// ---- Wallet (customer) ----
	s.AddTool(mcp.NewTool("get_my_wallet",
		mcp.WithDescription("Get the current user's wallet balance."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.APIPath("/wallet"), nil)
	})

	s.AddTool(mcp.NewTool("topup_wallet",
		mcp.WithDescription("Top up the current user's wallet via a payment gateway."),
		mcp.WithNumber("amount", mcp.Required(), mcp.Description("Top-up amount")),
		mcp.WithString("payment_method", mcp.Required(), mcp.Description("Payment method/gateway ID")),
		mcp.WithObject("payment_details", mcp.Description("Payment details (card info, etc.)")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := bodyFromArgs(args, "amount", "payment_method", "payment_details")
		return callPost(ctx, c, c.APIPath("/wallet/topup"), body)
	})

	s.AddTool(mcp.NewTool("list_my_wallet_transactions",
		mcp.WithDescription("List the current user's wallet transactions."),
		mcp.WithNumber("limit", mcp.Description("Page size")),
		mcp.WithNumber("offset", mcp.Description("Page offset")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQuery(args, "limit", "offset")
		return callGet(ctx, c, c.APIPath("/wallet/transactions"), q)
	})

	// ---- Wallet (admin) ----
	s.AddTool(mcp.NewTool("get_wallet_stats",
		mcp.WithDescription("Get aggregate wallet statistics (wallet count, total balance, topups, purchases). Requires payments.view permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.APIPath("/wallet/stats"), nil)
	})

	s.AddTool(mcp.NewTool("list_all_wallet_transactions",
		mcp.WithDescription("List all wallet transactions in the tenant. Requires payments.view permission."),
		mcp.WithString("type", mcp.Description("Filter by type (credit, debit)")),
		mcp.WithString("source", mcp.Description("Filter by source")),
		mcp.WithString("search", mcp.Description("Search by user email")),
		mcp.WithString("from", mcp.Description("Date range start")),
		mcp.WithString("to", mcp.Description("Date range end")),
		mcp.WithNumber("limit", mcp.Description("Page size")),
		mcp.WithNumber("offset", mcp.Description("Page offset")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQueryFromArgs(args)
		return callGet(ctx, c, c.APIPath("/wallet/all"), q)
	})

	s.AddTool(mcp.NewTool("get_customer_wallet",
		mcp.WithDescription("Get a customer's wallet. Requires customers.view permission."),
		mcp.WithString("user_id", mcp.Required(), mcp.Description("Customer UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.APIPath(fmt.Sprintf("/wallet/%s", argString(args, "user_id"))), nil)
	})

	s.AddTool(mcp.NewTool("list_customer_wallet_transactions",
		mcp.WithDescription("List a customer's wallet transactions. Requires customers.view permission."),
		mcp.WithString("user_id", mcp.Required(), mcp.Description("Customer UUID")),
		mcp.WithNumber("limit", mcp.Description("Page size")),
		mcp.WithNumber("offset", mcp.Description("Page offset")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQuery(args, "limit", "offset")
		return callGet(ctx, c, c.APIPath(fmt.Sprintf("/wallet/%s/transactions", argString(args, "user_id"))), q)
	})

	s.AddTool(mcp.NewTool("adjust_customer_wallet",
		mcp.WithDescription("Admin credit/debit a customer's wallet. Requires customers.manage permission."),
		mcp.WithString("user_id", mcp.Required(), mcp.Description("Customer UUID")),
		mcp.WithNumber("amount", mcp.Required(), mcp.Description("Amount (positive for credit, negative for debit)")),
		mcp.WithString("description", mcp.Required(), mcp.Description("Description for the adjustment")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := bodyFromArgs(args, "amount", "description")
		return callPost(ctx, c, c.APIPath(fmt.Sprintf("/wallet/%s/adjust", argString(args, "user_id"))), body)
	})
}

// RegisterShippingTools registers shipping method, zone, rate, provider, and shipment MCP tools.
func RegisterShippingTools(s *server.MCPServer, c *Client) {
	// ---- Shipping Methods ----
	s.AddTool(mcp.NewTool("list_shipping_methods",
		mcp.WithDescription("List all shipping methods. Requires shipping.view permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.APIPath("/shipping/methods"), nil)
	})

	s.AddTool(mcp.NewTool("create_shipping_method",
		mcp.WithDescription("Create a shipping method. Requires shipping.manage permission."),
		mcp.WithObject("method", mcp.Required(), mcp.Description("Shipping method with name, code, description, base_rate, weight_rate, currency_code, min_days, max_days, free_shipping_threshold, is_active, sort_order")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "method")
		return callPost(ctx, c, c.APIPath("/shipping/methods"), body)
	})

	s.AddTool(mcp.NewTool("update_shipping_method",
		mcp.WithDescription("Update a shipping method. Requires shipping.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Method UUID")),
		mcp.WithObject("method", mcp.Required(), mcp.Description("Method fields to update")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "method")
		return callPut(ctx, c, c.APIPath(fmt.Sprintf("/shipping/methods/%s", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("delete_shipping_method",
		mcp.WithDescription("Delete a shipping method. Requires shipping.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Method UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callDelete(ctx, c, c.APIPath(fmt.Sprintf("/shipping/methods/%s", argString(args, "id"))))
	})

	// ---- Shipping Zones ----
	s.AddTool(mcp.NewTool("list_shipping_zones",
		mcp.WithDescription("List all shipping zones. Requires shipping.view permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.APIPath("/shipping/zones"), nil)
	})

	s.AddTool(mcp.NewTool("create_shipping_zone",
		mcp.WithDescription("Create a shipping zone. Requires shipping.manage permission."),
		mcp.WithObject("zone", mcp.Required(), mcp.Description("Shipping zone with name, country_code, state_code, city, postal_code_pattern, is_active")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "zone")
		return callPost(ctx, c, c.APIPath("/shipping/zones"), body)
	})

	s.AddTool(mcp.NewTool("update_shipping_zone",
		mcp.WithDescription("Update a shipping zone. Requires shipping.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Zone UUID")),
		mcp.WithObject("zone", mcp.Required(), mcp.Description("Zone fields to update")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "zone")
		return callPut(ctx, c, c.APIPath(fmt.Sprintf("/shipping/zones/%s", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("delete_shipping_zone",
		mcp.WithDescription("Delete a shipping zone. Requires shipping.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Zone UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callDelete(ctx, c, c.APIPath(fmt.Sprintf("/shipping/zones/%s", argString(args, "id"))))
	})

	// ---- Shipping Rates ----
	s.AddTool(mcp.NewTool("list_shipping_rates",
		mcp.WithDescription("List all shipping rates. Requires shipping.view permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.APIPath("/shipping/rates"), nil)
	})

	s.AddTool(mcp.NewTool("create_shipping_rate",
		mcp.WithDescription("Create a shipping rate. Requires shipping.manage permission."),
		mcp.WithObject("rate", mcp.Required(), mcp.Description("Shipping rate with shipping_method_id, shipping_zone_id, rate, is_active")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "rate")
		return callPost(ctx, c, c.APIPath("/shipping/rates"), body)
	})

	s.AddTool(mcp.NewTool("update_shipping_rate",
		mcp.WithDescription("Update a shipping rate. Requires shipping.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Rate UUID")),
		mcp.WithObject("rate", mcp.Required(), mcp.Description("Rate fields to update")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "rate")
		return callPut(ctx, c, c.APIPath(fmt.Sprintf("/shipping/rates/%s", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("delete_shipping_rate",
		mcp.WithDescription("Delete a shipping rate. Requires shipping.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Rate UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callDelete(ctx, c, c.APIPath(fmt.Sprintf("/shipping/rates/%s", argString(args, "id"))))
	})

	// ---- Shipping Providers ----
	s.AddTool(mcp.NewTool("list_shipping_providers",
		mcp.WithDescription("List shipping providers (Delhivery, etc.). Requires shipping.view permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.APIPath("/shipping/providers"), nil)
	})

	s.AddTool(mcp.NewTool("create_shipping_provider",
		mcp.WithDescription("Create a shipping provider. Requires shipping.manage permission."),
		mcp.WithObject("provider", mcp.Required(), mcp.Description("Provider with name, code, api_key, api_url, is_active")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "provider")
		return callPost(ctx, c, c.APIPath("/shipping/providers"), body)
	})

	s.AddTool(mcp.NewTool("update_shipping_provider",
		mcp.WithDescription("Update a shipping provider. Requires shipping.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Provider UUID")),
		mcp.WithObject("provider", mcp.Required(), mcp.Description("Provider fields to update")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "provider")
		return callPut(ctx, c, c.APIPath(fmt.Sprintf("/shipping/providers/%s", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("delete_shipping_provider",
		mcp.WithDescription("Delete a shipping provider. Requires shipping.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Provider UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callDelete(ctx, c, c.APIPath(fmt.Sprintf("/shipping/providers/%s", argString(args, "id"))))
	})

	s.AddTool(mcp.NewTool("test_shipping_provider",
		mcp.WithDescription("Test a shipping provider's API connection. Requires shipping.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Provider UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callPost(ctx, c, c.APIPath(fmt.Sprintf("/shipping/providers/%s/test", argString(args, "id"))), nil)
	})

	// ---- Shipments ----
	s.AddTool(mcp.NewTool("list_order_shipments",
		mcp.WithDescription("List shipments for an order. Requires shipping.view permission."),
		mcp.WithString("order_id", mcp.Required(), mcp.Description("Order UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.APIPath(fmt.Sprintf("/shipping/orders/%s/shipments", argString(args, "order_id"))), nil)
	})

	s.AddTool(mcp.NewTool("create_order_shipment",
		mcp.WithDescription("Create a shipment for an order (split shipment support). Requires shipping.manage permission."),
		mcp.WithString("order_id", mcp.Required(), mcp.Description("Order UUID")),
		mcp.WithObject("shipment", mcp.Required(), mcp.Description("Shipment with provider_id, items (array of {order_item_id, quantity}), tracking_number")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "shipment")
		return callPost(ctx, c, c.APIPath(fmt.Sprintf("/shipping/orders/%s/shipments", argString(args, "order_id"))), body)
	})

	s.AddTool(mcp.NewTool("track_shipment",
		mcp.WithDescription("Track a shipment. Requires shipping.view permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Shipment UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callPost(ctx, c, c.APIPath(fmt.Sprintf("/shipping/shipments/%s/track", argString(args, "id"))), nil)
	})

	// ---- Shipping Calculation (public) ----
	s.AddTool(mcp.NewTool("calculate_shipping",
		mcp.WithDescription("Calculate available shipping options for a subtotal and address (public endpoint)."),
		mcp.WithNumber("subtotal", mcp.Required(), mcp.Description("Cart subtotal")),
		mcp.WithObject("shipping_address", mcp.Required(), mcp.Description("Shipping address with country, state, city, postal_code")),
		mcp.WithArray("items", mcp.Description("Cart items for per-item shipping calculation")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := bodyFromArgs(args, "subtotal", "shipping_address", "items")
		return callPost(ctx, c, c.APIPath("/shipping/calculate"), body)
	})
}
