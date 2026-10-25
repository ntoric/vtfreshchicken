package mcp

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// RegisterCustomerTools registers customer and user/staff MCP tools.
func RegisterCustomerTools(s *server.MCPServer, c *Client) {
	// ---- Customers ----
	s.AddTool(mcp.NewTool("list_customers",
		mcp.WithDescription("List customers with search and status filter. Requires customers.view permission."),
		mcp.WithString("search", mcp.Description("Search by name, email, or phone")),
		mcp.WithString("status", mcp.Description("Filter by status (active, inactive)")),
		mcp.WithNumber("limit", mcp.Description("Page size")),
		mcp.WithNumber("offset", mcp.Description("Page offset")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQueryFromArgs(args)
		return callGet(ctx, c, c.APIPath("/customers"), q)
	})

	s.AddTool(mcp.NewTool("get_customer",
		mcp.WithDescription("Get a customer by ID with order stats and addresses. Requires customers.view permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Customer UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.APIPath(fmt.Sprintf("/customers/%s", argString(args, "id"))), nil)
	})

	s.AddTool(mcp.NewTool("get_customer_stats",
		mcp.WithDescription("Get customer summary statistics (total, active, new this month, etc.). Requires customers.view permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.APIPath("/customers/stats"), nil)
	})

	s.AddTool(mcp.NewTool("update_customer",
		mcp.WithDescription("Update a customer (name, phone, active, marketing consent, admin notes). Requires customers.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Customer UUID")),
		mcp.WithObject("customer", mcp.Required(), mcp.Description("Customer fields to update")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "customer")
		return callPut(ctx, c, c.APIPath(fmt.Sprintf("/customers/%s", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("delete_customer",
		mcp.WithDescription("Hard-delete a customer. Requires customers.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Customer UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callDelete(ctx, c, c.APIPath(fmt.Sprintf("/customers/%s", argString(args, "id"))))
	})

	// ---- Users / Staff ----
	s.AddTool(mcp.NewTool("list_users",
		mcp.WithDescription("List all tenant users with roles and status. Requires users.view permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.APIPath("/users"), nil)
	})

	s.AddTool(mcp.NewTool("get_user",
		mcp.WithDescription("Get a single user by ID. Requires users.view permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("User UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.APIPath(fmt.Sprintf("/users/%s", argString(args, "id"))), nil)
	})

	s.AddTool(mcp.NewTool("get_user_stats",
		mcp.WithDescription("Get user summary statistics. Requires users.view permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.APIPath("/users/stats"), nil)
	})

	s.AddTool(mcp.NewTool("create_staff",
		mcp.WithDescription("Create a new staff user. Requires users.manage permission."),
		mcp.WithObject("staff", mcp.Required(), mcp.Description("Staff object with email, password, full_name, role (staff, business_admin), phone")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "staff")
		return callPost(ctx, c, c.APIPath("/users/staff"), body)
	})

	s.AddTool(mcp.NewTool("update_user",
		mcp.WithDescription("Update a user. Requires users.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("User UUID")),
		mcp.WithObject("user", mcp.Required(), mcp.Description("User fields to update")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "user")
		return callPut(ctx, c, c.APIPath(fmt.Sprintf("/users/%s", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("set_user_active",
		mcp.WithDescription("Activate or deactivate a user. Requires users.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("User UUID")),
		mcp.WithBoolean("is_active", mcp.Required(), mcp.Description("True to activate, false to deactivate")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := bodyFromArgs(args, "is_active")
		return callPut(ctx, c, c.APIPath(fmt.Sprintf("/users/%s/active", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("reset_user_password",
		mcp.WithDescription("Reset a user's password. Requires users.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("User UUID")),
		mcp.WithString("password", mcp.Required(), mcp.Description("New password")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := bodyFromArgs(args, "password")
		return callPut(ctx, c, c.APIPath(fmt.Sprintf("/users/%s/password", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("delete_user",
		mcp.WithDescription("Delete a user. Requires users.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("User UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callDelete(ctx, c, c.APIPath(fmt.Sprintf("/users/%s", argString(args, "id"))))
	})
}

// RegisterInventoryTools registers inventory management MCP tools.
func RegisterInventoryTools(s *server.MCPServer, c *Client) {
	s.AddTool(mcp.NewTool("list_inventory",
		mcp.WithDescription("List current stock levels for all products and variants. Requires inventory.view permission."),
		mcp.WithString("search", mcp.Description("Search by product name or SKU")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQuery(args, "search")
		return callGet(ctx, c, c.APIPath("/inventory"), q)
	})

	s.AddTool(mcp.NewTool("get_inventory_stats",
		mcp.WithDescription("Get inventory statistics (total products, low stock, out of stock, etc.). Requires inventory.view permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.APIPath("/inventory/stats"), nil)
	})

	s.AddTool(mcp.NewTool("adjust_stock",
		mcp.WithDescription("Adjust stock for a product/variant. Requires inventory.adjust permission."),
		mcp.WithString("product_id", mcp.Required(), mcp.Description("Product UUID")),
		mcp.WithString("variant_id", mcp.Description("Variant UUID (optional for products without variants)")),
		mcp.WithNumber("quantity", mcp.Required(), mcp.Description("Quantity change (positive for increase, negative for decrease)")),
		mcp.WithString("reason", mcp.Required(), mcp.Description("Reason for adjustment")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := bodyFromArgs(args, "product_id", "variant_id", "quantity", "reason")
		return callPost(ctx, c, c.APIPath("/inventory/adjust"), body)
	})

	s.AddTool(mcp.NewTool("list_stock_movements",
		mcp.WithDescription("List stock movement history with filters. Requires inventory.view permission."),
		mcp.WithString("movement_type", mcp.Description("Filter by movement type (in, out, adjustment)")),
		mcp.WithString("search", mcp.Description("Search by product name")),
		mcp.WithString("from", mcp.Description("Date range start")),
		mcp.WithString("to", mcp.Description("Date range end")),
		mcp.WithNumber("limit", mcp.Description("Page size")),
		mcp.WithNumber("offset", mcp.Description("Page offset")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQueryFromArgs(args)
		return callGet(ctx, c, c.APIPath("/inventory/movements"), q)
	})
}
