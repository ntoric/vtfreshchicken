package mcp

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// RegisterAuthTools registers authentication-related MCP tools.
func RegisterAuthTools(s *server.MCPServer, c *Client) {
	// platform_login — login as superadmin
	s.AddTool(mcp.NewTool("platform_login",
		mcp.WithDescription("Login as a platform superadmin to get an access token for platform-level operations."),
		mcp.WithString("email", mcp.Required(), mcp.Description("Superadmin email")),
		mcp.WithString("password", mcp.Required(), mcp.Description("Superadmin password")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		if err := c.Login(ctx, argString(args, "email"), argString(args, "password")); err != nil {
			return errorResult(err), nil
		}
		return textResult(map[string]any{"status": "ok", "message": "logged in as superadmin"}, nil)
	})

	// tenant_login — login as a tenant user
	s.AddTool(mcp.NewTool("tenant_login",
		mcp.WithDescription("Login as a tenant user (business_admin, staff, or customer) to get an access token for tenant-scoped operations."),
		mcp.WithString("tenant", mcp.Required(), mcp.Description("Tenant slug")),
		mcp.WithString("email", mcp.Required(), mcp.Description("User email")),
		mcp.WithString("password", mcp.Required(), mcp.Description("User password")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		tenant := argString(args, "tenant")
		if err := c.TenantLogin(ctx, tenant, argString(args, "email"), argString(args, "password")); err != nil {
			return errorResult(err), nil
		}
		c.Tenant = tenant
		return textResult(map[string]any{"status": "ok", "message": fmt.Sprintf("logged in to tenant %s", tenant)}, nil)
	})

	// register_customer — register a new customer account
	s.AddTool(mcp.NewTool("register_customer",
		mcp.WithDescription("Register a new customer account on a tenant."),
		mcp.WithString("tenant", mcp.Required(), mcp.Description("Tenant slug")),
		mcp.WithString("email", mcp.Required(), mcp.Description("Customer email")),
		mcp.WithString("password", mcp.Required(), mcp.Description("Customer password")),
		mcp.WithString("full_name", mcp.Description("Customer full name")),
		mcp.WithString("phone", mcp.Description("Customer phone number")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		tenant := argString(args, "tenant")
		body := bodyFromArgs(args, "email", "password", "full_name", "phone")
		return callPost(ctx, c, fmt.Sprintf("/api/t/%s/auth/register", tenant), body)
	})

	// get_me — get current user info
	s.AddTool(mcp.NewTool("get_me",
		mcp.WithDescription("Get the current authenticated user's profile information."),
		mcp.WithString("tenant", mcp.Description("Tenant slug (empty for platform/superadmin)")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		tenant := argString(args, "tenant")
		var path string
		if tenant != "" {
			path = fmt.Sprintf("/api/t/%s/me", tenant)
		} else {
			path = "/api/platform/me"
		}
		return callGet(ctx, c, path, nil)
	})

	// get_my_permissions — get current user's permissions
	s.AddTool(mcp.NewTool("get_my_permissions",
		mcp.WithDescription("Get the current authenticated user's permissions for the configured tenant."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.TenantPath("/me/permissions"), nil)
	})

	// refresh_token — refresh the access token
	s.AddTool(mcp.NewTool("refresh_token",
		mcp.WithDescription("Refresh the access token using a refresh token."),
		mcp.WithString("tenant", mcp.Description("Tenant slug (empty for platform)")),
		mcp.WithString("refresh_token", mcp.Required(), mcp.Description("Refresh token")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		tenant := argString(args, "tenant")
		body := bodyFromArgs(args, "refresh_token")
		var path string
		if tenant != "" {
			path = fmt.Sprintf("/api/t/%s/auth/refresh", tenant)
		} else {
			path = "/api/platform/auth/refresh"
		}
		return callPost(ctx, c, path, body)
	})

	// export_my_data — GDPR data export
	s.AddTool(mcp.NewTool("export_my_data",
		mcp.WithDescription("Export all personal data for the current user (GDPR data subject right)."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.TenantPath("/me/export"), nil)
	})

	// delete_my_account — GDPR account deletion
	s.AddTool(mcp.NewTool("delete_my_account",
		mcp.WithDescription("Delete the current user's account and all associated data (GDPR data subject right)."),
		mcp.WithString("confirm", mcp.Required(), mcp.Description("Type 'yes' to confirm deletion")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		if argString(args, "confirm") != "yes" {
			return errorResult(fmt.Errorf("confirmation required: set confirm to 'yes'")), nil
		}
		return callDelete(ctx, c, c.TenantPath("/me/delete"))
	})
}
