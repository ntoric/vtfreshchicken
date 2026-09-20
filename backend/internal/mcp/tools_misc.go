package mcp

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// RegisterContactTools registers contact form MCP tools.
func RegisterContactTools(s *server.MCPServer, c *Client) {
	s.AddTool(mcp.NewTool("submit_contact",
		mcp.WithDescription("Submit a contact form message (public endpoint)."),
		mcp.WithObject("message", mcp.Required(), mcp.Description("Message with name, email, subject, body")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "message")
		return callPost(ctx, c, c.TenantPath("/contact"), body)
	})

	s.AddTool(mcp.NewTool("list_contact_submissions",
		mcp.WithDescription("List contact form submissions. Requires settings.view permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.TenantPath("/contact/submissions"), nil)
	})

	s.AddTool(mcp.NewTool("mark_contact_read",
		mcp.WithDescription("Mark a contact submission as read. Requires settings.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Submission UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callPut(ctx, c, c.TenantPath(fmt.Sprintf("/contact/submissions/%s/read", argString(args, "id"))), nil)
	})

	s.AddTool(mcp.NewTool("delete_contact_submission",
		mcp.WithDescription("Delete a contact submission. Requires settings.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Submission UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callDelete(ctx, c, c.TenantPath(fmt.Sprintf("/contact/submissions/%s", argString(args, "id"))))
	})
}

// RegisterSettingsTools registers tenant settings and SMTP MCP tools.
func RegisterSettingsTools(s *server.MCPServer, c *Client) {
	s.AddTool(mcp.NewTool("get_tenant_settings",
		mcp.WithDescription("Get tenant settings (brand, contact, currency, languages, SEO). Requires authentication."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.TenantPath("/settings"), nil)
	})

	s.AddTool(mcp.NewTool("update_tenant_settings",
		mcp.WithDescription("Update tenant settings. Requires authentication."),
		mcp.WithObject("settings", mcp.Required(), mcp.Description("Settings fields to update")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "settings")
		return callPut(ctx, c, c.TenantPath("/settings"), body)
	})

	// ---- SMTP ----
	s.AddTool(mcp.NewTool("get_smtp_settings",
		mcp.WithDescription("Get SMTP/email server settings. Requires settings.manage permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.TenantPath("/settings/smtp"), nil)
	})

	s.AddTool(mcp.NewTool("update_smtp_settings",
		mcp.WithDescription("Update SMTP/email server settings. Requires settings.manage permission."),
		mcp.WithObject("smtp", mcp.Required(), mcp.Description("SMTP settings with host, port, username, password, from_email, from_name, encryption")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "smtp")
		return callPut(ctx, c, c.TenantPath("/settings/smtp"), body)
	})

	s.AddTool(mcp.NewTool("test_smtp_settings",
		mcp.WithDescription("Send a test email to verify SMTP configuration. Requires settings.manage permission."),
		mcp.WithString("to_email", mcp.Required(), mcp.Description("Recipient email for the test")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := bodyFromArgs(args, "to_email")
		return callPost(ctx, c, c.TenantPath("/settings/smtp/test"), body)
	})
}

// RegisterPermissionTools registers permission and role MCP tools.
func RegisterPermissionTools(s *server.MCPServer, c *Client) {
	s.AddTool(mcp.NewTool("list_permissions",
		mcp.WithDescription("List all available permissions. Requires business_admin or superadmin."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.TenantPath("/permissions"), nil)
	})

	s.AddTool(mcp.NewTool("list_role_permissions",
		mcp.WithDescription("List permissions grouped by role. Requires business_admin or superadmin."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.TenantPath("/permissions/roles"), nil)
	})

	s.AddTool(mcp.NewTool("get_role_permissions",
		mcp.WithDescription("Get permissions for a specific role. Requires business_admin or superadmin."),
		mcp.WithString("role", mcp.Required(), mcp.Description("Role name (staff, business_admin)")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.TenantPath(fmt.Sprintf("/permissions/roles/%s", argString(args, "role"))), nil)
	})

	s.AddTool(mcp.NewTool("set_role_permissions",
		mcp.WithDescription("Set permissions for a role. Requires permissions.manage permission."),
		mcp.WithString("role", mcp.Required(), mcp.Description("Role name")),
		mcp.WithArray("permissions", mcp.Required(), mcp.Description("Array of permission codes to grant")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := bodyFromArgs(args, "permissions")
		return callPut(ctx, c, c.TenantPath(fmt.Sprintf("/permissions/roles/%s", argString(args, "role"))), body)
	})

	s.AddTool(mcp.NewTool("toggle_permission",
		mcp.WithDescription("Toggle a single permission for a role. Requires permissions.manage permission."),
		mcp.WithString("role", mcp.Required(), mcp.Description("Role name")),
		mcp.WithString("permission", mcp.Required(), mcp.Description("Permission code")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := bodyFromArgs(args, "permission")
		return callPut(ctx, c, c.TenantPath(fmt.Sprintf("/permissions/roles/%s/toggle", argString(args, "role"))), body)
	})

	s.AddTool(mcp.NewTool("seed_default_permissions",
		mcp.WithDescription("Seed default permissions for all roles. Requires business_admin or superadmin."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callPost(ctx, c, c.TenantPath("/permissions/seed"), nil)
	})
}

// RegisterPlatformTools registers platform/superadmin and tenant management MCP tools.
func RegisterPlatformTools(s *server.MCPServer, c *Client) {
	s.AddTool(mcp.NewTool("list_tenants",
		mcp.WithDescription("List all tenants on the platform. Requires superadmin auth."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, "/api/platform/tenants", nil)
	})

	s.AddTool(mcp.NewTool("get_tenant",
		mcp.WithDescription("Get a tenant by ID. Requires superadmin auth."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Tenant UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, fmt.Sprintf("/api/platform/tenants/%s", argString(args, "id")), nil)
	})

	s.AddTool(mcp.NewTool("create_tenant",
		mcp.WithDescription("Create a new tenant with a business admin. Requires superadmin auth."),
		mcp.WithObject("tenant", mcp.Required(), mcp.Description("Tenant with slug, name, brand_color, admin_email, admin_password, admin_full_name")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "tenant")
		return callPost(ctx, c, "/api/platform/tenants", body)
	})

	s.AddTool(mcp.NewTool("update_tenant",
		mcp.WithDescription("Update a tenant. Requires superadmin auth."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Tenant UUID")),
		mcp.WithObject("tenant", mcp.Required(), mcp.Description("Tenant fields to update")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "tenant")
		return callPut(ctx, c, fmt.Sprintf("/api/platform/tenants/%s", argString(args, "id")), body)
	})

	s.AddTool(mcp.NewTool("set_tenant_active",
		mcp.WithDescription("Activate or deactivate a tenant. Requires superadmin auth."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Tenant UUID")),
		mcp.WithBoolean("is_active", mcp.Required(), mcp.Description("True to activate, false to deactivate")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := bodyFromArgs(args, "is_active")
		return callPut(ctx, c, fmt.Sprintf("/api/platform/tenants/%s/active", argString(args, "id")), body)
	})

	s.AddTool(mcp.NewTool("get_tenant_store_stats",
		mcp.WithDescription("Get store statistics for a tenant (orders, products, customers). Requires superadmin auth."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Tenant UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, fmt.Sprintf("/api/platform/tenants/%s/stats", argString(args, "id")), nil)
	})

	s.AddTool(mcp.NewTool("list_all_users",
		mcp.WithDescription("List all users across all tenants. Requires superadmin auth."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, "/api/platform/users", nil)
	})

	s.AddTool(mcp.NewTool("get_platform_stats",
		mcp.WithDescription("Get platform-wide statistics (tenants, users, revenue). Requires superadmin auth."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, "/api/platform/stats", nil)
	})

	s.AddTool(mcp.NewTool("get_developer_settings",
		mcp.WithDescription("Get developer/system settings. Requires superadmin auth."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, "/api/platform/dev-settings", nil)
	})

	s.AddTool(mcp.NewTool("get_platform_health",
		mcp.WithDescription("Get platform health check (DB, Redis, services). Requires superadmin auth."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, "/api/platform/health", nil)
	})

	s.AddTool(mcp.NewTool("get_setup_status",
		mcp.WithDescription("Check platform setup status (needs_setup, needs_tenant, has_superadmin, has_tenants). Public endpoint."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, "/api/setup/status", nil)
	})

	s.AddTool(mcp.NewTool("complete_setup",
		mcp.WithDescription("Complete platform setup (create superadmin + first tenant + admin). Only works when setup is needed. Public endpoint."),
		mcp.WithObject("setup", mcp.Required(), mcp.Description("Setup data with superadmin_email, superadmin_password, superadmin_full_name, tenant_slug, tenant_name, tenant_brand_color, admin_email, admin_password, admin_full_name")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "setup")
		return callPost(ctx, c, "/api/setup/complete", body)
	})
}

// RegisterCheckoutTools registers checkout and order placement MCP tools.
func RegisterCheckoutTools(s *server.MCPServer, c *Client) {
	s.AddTool(mcp.NewTool("place_order",
		mcp.WithDescription("Place an order from the current cart. Public endpoint (uses session cookie or user ID if authenticated)."),
		mcp.WithObject("checkout", mcp.Required(), mcp.Description("Checkout data with shipping_address, billing_address, shipping_method_id, payment_method, payment_details, discount_code, session_id")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "checkout")
		return callPost(ctx, c, c.TenantPath("/checkout"), body)
	})

	s.AddTool(mcp.NewTool("list_my_orders",
		mcp.WithDescription("List the current user's orders. Public endpoint (uses session cookie or user ID)."),
		mcp.WithNumber("limit", mcp.Description("Page size")),
		mcp.WithNumber("offset", mcp.Description("Page offset")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQuery(args, "limit", "offset")
		return callGet(ctx, c, c.TenantPath("/orders"), q)
	})

	s.AddTool(mcp.NewTool("get_my_order",
		mcp.WithDescription("Get a single order by ID (customer view). Public endpoint (uses session cookie or user ID)."),
		mcp.WithString("order_id", mcp.Required(), mcp.Description("Order UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.TenantPath(fmt.Sprintf("/orders/%s", argString(args, "order_id"))), nil)
	})

	s.AddTool(mcp.NewTool("list_my_order_shipments",
		mcp.WithDescription("List shipments for the current user's order. Public endpoint with optional auth."),
		mcp.WithString("order_id", mcp.Required(), mcp.Description("Order UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.TenantPath(fmt.Sprintf("/orders/%s/shipments", argString(args, "order_id"))), nil)
	})

	s.AddTool(mcp.NewTool("track_my_shipment",
		mcp.WithDescription("Track a shipment for the current user's order. Public endpoint with optional auth."),
		mcp.WithString("order_id", mcp.Required(), mcp.Description("Order UUID")),
		mcp.WithString("shipment_id", mcp.Required(), mcp.Description("Shipment UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callPost(ctx, c, c.TenantPath(fmt.Sprintf("/orders/%s/shipments/%s/track", argString(args, "order_id"), argString(args, "shipment_id"))), nil)
	})

	s.AddTool(mcp.NewTool("list_my_returns",
		mcp.WithDescription("List the current user's returns across all orders. Requires authentication."),
		mcp.WithNumber("limit", mcp.Description("Page size")),
		mcp.WithNumber("offset", mcp.Description("Page offset")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQuery(args, "limit", "offset")
		return callGet(ctx, c, c.TenantPath("/my-returns"), q)
	})

	s.AddTool(mcp.NewTool("list_my_order_returns",
		mcp.WithDescription("List returns for the current user's order. Public endpoint with optional auth."),
		mcp.WithString("order_id", mcp.Required(), mcp.Description("Order UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.TenantPath(fmt.Sprintf("/orders/%s/returns", argString(args, "order_id"))), nil)
	})

	s.AddTool(mcp.NewTool("get_my_return_eligibility",
		mcp.WithDescription("Check return eligibility for the current user's order. Public endpoint with optional auth."),
		mcp.WithString("order_id", mcp.Required(), mcp.Description("Order UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.TenantPath(fmt.Sprintf("/orders/%s/return-eligibility", argString(args, "order_id"))), nil)
	})

	s.AddTool(mcp.NewTool("create_my_return",
		mcp.WithDescription("Create a return request for the current user's own order. Public endpoint with optional auth."),
		mcp.WithString("order_id", mcp.Required(), mcp.Description("Order UUID")),
		mcp.WithObject("return", mcp.Required(), mcp.Description("Return with type, reason, items")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "return")
		return callPost(ctx, c, c.TenantPath(fmt.Sprintf("/orders/%s/returns", argString(args, "order_id"))), body)
	})

	s.AddTool(mcp.NewTool("create_payment_order",
		mcp.WithDescription("Create a gateway order (for gateways like Razorpay that need server-side order creation). Public endpoint."),
		mcp.WithString("gateway_id", mcp.Required(), mcp.Description("Gateway ID")),
		mcp.WithNumber("amount", mcp.Required(), mcp.Description("Order amount")),
		mcp.WithString("currency", mcp.Description("Currency code (default: tenant default)")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := bodyFromArgs(args, "amount", "currency")
		return callPost(ctx, c, c.TenantPath(fmt.Sprintf("/payment/%s/create-order", argString(args, "gateway_id"))), body)
	})
}

// RegisterAddressTools registers address management MCP tools.
func RegisterAddressTools(s *server.MCPServer, c *Client) {
	s.AddTool(mcp.NewTool("list_addresses",
		mcp.WithDescription("List the current user's saved addresses. Requires authentication."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.TenantPath("/addresses"), nil)
	})

	s.AddTool(mcp.NewTool("save_address",
		mcp.WithDescription("Save a new address or update an existing one. Requires authentication."),
		mcp.WithObject("address", mcp.Required(), mcp.Description("Address with label, full_name, phone, line1, line2, city, state, postal_code, country, is_default")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "address")
		return callPost(ctx, c, c.TenantPath("/addresses"), body)
	})

	s.AddTool(mcp.NewTool("delete_address",
		mcp.WithDescription("Delete a saved address. Requires authentication."),
		mcp.WithString("address_id", mcp.Required(), mcp.Description("Address UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callDelete(ctx, c, c.TenantPath(fmt.Sprintf("/addresses/%s", argString(args, "address_id"))))
	})
}
