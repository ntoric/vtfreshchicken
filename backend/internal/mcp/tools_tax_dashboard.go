package mcp

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// RegisterTaxTools registers tax class, zone, and rate MCP tools.
func RegisterTaxTools(s *server.MCPServer, c *Client) {
	// ---- Tax Classes ----
	s.AddTool(mcp.NewTool("list_tax_classes",
		mcp.WithDescription("List all tax classes. Requires tax.view permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.APIPath("/tax/classes"), nil)
	})

	s.AddTool(mcp.NewTool("create_tax_class",
		mcp.WithDescription("Create a tax class. Requires tax.manage permission."),
		mcp.WithObject("tax_class", mcp.Required(), mcp.Description("Tax class with name, description")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "tax_class")
		return callPost(ctx, c, c.APIPath("/tax/classes"), body)
	})

	s.AddTool(mcp.NewTool("update_tax_class",
		mcp.WithDescription("Update a tax class. Requires tax.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Tax class UUID")),
		mcp.WithObject("tax_class", mcp.Required(), mcp.Description("Tax class fields to update")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "tax_class")
		return callPut(ctx, c, c.APIPath(fmt.Sprintf("/tax/classes/%s", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("delete_tax_class",
		mcp.WithDescription("Delete a tax class. Requires tax.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Tax class UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callDelete(ctx, c, c.APIPath(fmt.Sprintf("/tax/classes/%s", argString(args, "id"))))
	})

	// ---- Tax Zones ----
	s.AddTool(mcp.NewTool("list_tax_zones",
		mcp.WithDescription("List all tax zones. Requires tax.view permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.APIPath("/tax/zones"), nil)
	})

	s.AddTool(mcp.NewTool("create_tax_zone",
		mcp.WithDescription("Create a tax zone. Requires tax.manage permission."),
		mcp.WithObject("tax_zone", mcp.Required(), mcp.Description("Tax zone with name, country_code, state_code, postal_code_pattern")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "tax_zone")
		return callPost(ctx, c, c.APIPath("/tax/zones"), body)
	})

	s.AddTool(mcp.NewTool("update_tax_zone",
		mcp.WithDescription("Update a tax zone. Requires tax.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Tax zone UUID")),
		mcp.WithObject("tax_zone", mcp.Required(), mcp.Description("Tax zone fields to update")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "tax_zone")
		return callPut(ctx, c, c.APIPath(fmt.Sprintf("/tax/zones/%s", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("delete_tax_zone",
		mcp.WithDescription("Delete a tax zone. Requires tax.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Tax zone UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callDelete(ctx, c, c.APIPath(fmt.Sprintf("/tax/zones/%s", argString(args, "id"))))
	})

	// ---- Tax Rates ----
	s.AddTool(mcp.NewTool("list_tax_rates",
		mcp.WithDescription("List all tax rates. Requires tax.view permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.APIPath("/tax/rates"), nil)
	})

	s.AddTool(mcp.NewTool("create_tax_rate",
		mcp.WithDescription("Create a tax rate. Requires tax.manage permission."),
		mcp.WithObject("tax_rate", mcp.Required(), mcp.Description("Tax rate with tax_class_id, tax_zone_id, rate")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "tax_rate")
		return callPost(ctx, c, c.APIPath("/tax/rates"), body)
	})

	s.AddTool(mcp.NewTool("update_tax_rate",
		mcp.WithDescription("Update a tax rate. Requires tax.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Tax rate UUID")),
		mcp.WithObject("tax_rate", mcp.Required(), mcp.Description("Tax rate fields to update")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "tax_rate")
		return callPut(ctx, c, c.APIPath(fmt.Sprintf("/tax/rates/%s", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("delete_tax_rate",
		mcp.WithDescription("Delete a tax rate. Requires tax.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Tax rate UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callDelete(ctx, c, c.APIPath(fmt.Sprintf("/tax/rates/%s", argString(args, "id"))))
	})

	// ---- Tax Calculation (public) ----
	s.AddTool(mcp.NewTool("calculate_tax",
		mcp.WithDescription("Calculate tax for cart items and a shipping address (public endpoint)."),
		mcp.WithArray("items", mcp.Required(), mcp.Description("Cart items with product_id, quantity, unit_price")),
		mcp.WithObject("shipping_address", mcp.Required(), mcp.Description("Shipping address with country, state, city, postal_code")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := bodyFromArgs(args, "items", "shipping_address")
		return callPost(ctx, c, c.APIPath("/tax/calculate"), body)
	})
}

// RegisterDashboardTools registers dashboard MCP tools.
func RegisterDashboardTools(s *server.MCPServer, c *Client) {
	s.AddTool(mcp.NewTool("get_dashboard_stats",
		mcp.WithDescription("Get dashboard statistics (revenue, orders, customers, etc.). Requires dashboard.view permission."),
		mcp.WithString("from", mcp.Description("Date range start")),
		mcp.WithString("to", mcp.Description("Date range end")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQuery(args, "from", "to")
		return callGet(ctx, c, c.APIPath("/dashboard/stats"), q)
	})
}

// RegisterExportTools registers bulk export MCP tools.
func RegisterExportTools(s *server.MCPServer, c *Client) {
	s.AddTool(mcp.NewTool("list_export_types",
		mcp.WithDescription("List all available export types with CSV headers and descriptions."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.APIPath("/exports/types"), nil)
	})

	s.AddTool(mcp.NewTool("estimate_export_size",
		mcp.WithDescription("Estimate the row count for an export type with given filters."),
		mcp.WithString("type", mcp.Required(), mcp.Description("Export type (orders, products, customers, transactions, stock_movements, wallet_transactions, returns, discounts, offers, users, inventory)")),
		mcp.WithObject("filters", mcp.Description("Filter parameters as key-value pairs")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQueryFromArgs(args)
		// Override 'type' since buildQueryFromArgs uses it directly
		if t := argString(args, "type"); t != "" {
			q.Set("type", t)
		}
		filters := argMap(args, "filters")
		for k, v := range filters {
			if s, ok := v.(string); ok && s != "" {
				q.Set(k, s)
			}
		}
		return callGet(ctx, c, c.APIPath("/exports/estimate"), q)
	})

	s.AddTool(mcp.NewTool("create_export",
		mcp.WithDescription("Create a bulk export job (asynchronous CSV generation). For large exports (>5000 rows), an email address is required."),
		mcp.WithString("type", mcp.Required(), mcp.Description("Export type (orders, products, customers, transactions, stock_movements, wallet_transactions, returns, discounts, offers, users, inventory)")),
		mcp.WithString("format", mcp.Description("Export format (default: csv)")),
		mcp.WithString("email", mcp.Description("Email address for large exports (required if >5000 rows)")),
		mcp.WithObject("filters", mcp.Description("Filter parameters as key-value pairs")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := map[string]any{
			"type":    argString(args, "type"),
			"format":  argString(args, "format"),
			"email":   argString(args, "email"),
			"filters": argMap(args, "filters"),
		}
		if body["format"] == "" {
			body["format"] = "csv"
		}
		return callPost(ctx, c, c.APIPath("/exports"), body)
	})

	s.AddTool(mcp.NewTool("list_exports",
		mcp.WithDescription("List export jobs for the tenant."),
		mcp.WithNumber("limit", mcp.Description("Page size (default 50)")),
		mcp.WithNumber("offset", mcp.Description("Page offset")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQuery(args, "limit", "offset")
		return callGet(ctx, c, c.APIPath("/exports"), q)
	})

	s.AddTool(mcp.NewTool("get_export",
		mcp.WithDescription("Get a single export job by ID (for progress polling)."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Export job UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.APIPath(fmt.Sprintf("/exports/%s", argString(args, "id"))), nil)
	})
}
