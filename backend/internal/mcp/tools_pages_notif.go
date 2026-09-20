package mcp

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// RegisterPagesTools registers store page builder MCP tools.
func RegisterPagesTools(s *server.MCPServer, c *Client) {
	s.AddTool(mcp.NewTool("list_pages",
		mcp.WithDescription("List all store pages. Requires settings.view permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.TenantPath("/pages"), nil)
	})

	s.AddTool(mcp.NewTool("get_page",
		mcp.WithDescription("Get a single store page by ID. Requires settings.view permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Page UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.TenantPath(fmt.Sprintf("/pages/%s", argString(args, "id"))), nil)
	})

	s.AddTool(mcp.NewTool("create_page",
		mcp.WithDescription("Create a store page. Requires settings.manage permission."),
		mcp.WithObject("page", mcp.Required(), mcp.Description("Page object with title, slug, content, status (draft, published), meta_title, meta_description")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "page")
		return callPost(ctx, c, c.TenantPath("/pages"), body)
	})

	s.AddTool(mcp.NewTool("update_page",
		mcp.WithDescription("Update a store page. Requires settings.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Page UUID")),
		mcp.WithObject("page", mcp.Required(), mcp.Description("Page fields to update")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "page")
		return callPut(ctx, c, c.TenantPath(fmt.Sprintf("/pages/%s", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("delete_page",
		mcp.WithDescription("Delete a store page. Requires settings.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Page UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callDelete(ctx, c, c.TenantPath(fmt.Sprintf("/pages/%s", argString(args, "id"))))
	})

	s.AddTool(mcp.NewTool("get_public_page",
		mcp.WithDescription("Get a published store page by slug (public endpoint)."),
		mcp.WithString("slug", mcp.Required(), mcp.Description("Page slug")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.TenantPath(fmt.Sprintf("/page/%s", argString(args, "slug"))), nil)
	})
}

// RegisterNotificationTools registers notification event, template, and log MCP tools.
func RegisterNotificationTools(s *server.MCPServer, c *Client) {
	// ---- Events ----
	s.AddTool(mcp.NewTool("list_notification_events",
		mcp.WithDescription("List notification events. Requires settings.manage permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.TenantPath("/notifications/events"), nil)
	})

	s.AddTool(mcp.NewTool("create_notification_event",
		mcp.WithDescription("Create a notification event. Requires settings.manage permission."),
		mcp.WithObject("event", mcp.Required(), mcp.Description("Event object with name, code, description, channels (email, sms)")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "event")
		return callPost(ctx, c, c.TenantPath("/notifications/events"), body)
	})

	s.AddTool(mcp.NewTool("update_notification_event",
		mcp.WithDescription("Update a notification event. Requires settings.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Event UUID")),
		mcp.WithObject("event", mcp.Required(), mcp.Description("Event fields to update")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "event")
		return callPut(ctx, c, c.TenantPath(fmt.Sprintf("/notifications/events/%s", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("delete_notification_event",
		mcp.WithDescription("Delete a notification event. Requires settings.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Event UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callDelete(ctx, c, c.TenantPath(fmt.Sprintf("/notifications/events/%s", argString(args, "id"))))
	})

	// ---- Templates ----
	s.AddTool(mcp.NewTool("list_notification_templates",
		mcp.WithDescription("List notification templates. Requires settings.manage permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.TenantPath("/notifications/templates"), nil)
	})

	s.AddTool(mcp.NewTool("get_notification_template",
		mcp.WithDescription("Get a notification template by ID. Requires settings.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Template UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.TenantPath(fmt.Sprintf("/notifications/templates/%s", argString(args, "id"))), nil)
	})

	s.AddTool(mcp.NewTool("create_notification_template",
		mcp.WithDescription("Create a notification template. Requires settings.manage permission."),
		mcp.WithObject("template", mcp.Required(), mcp.Description("Template with event_id, channel, subject, body, is_active")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "template")
		return callPost(ctx, c, c.TenantPath("/notifications/templates"), body)
	})

	s.AddTool(mcp.NewTool("update_notification_template",
		mcp.WithDescription("Update a notification template. Requires settings.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Template UUID")),
		mcp.WithObject("template", mcp.Required(), mcp.Description("Template fields to update")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "template")
		return callPut(ctx, c, c.TenantPath(fmt.Sprintf("/notifications/templates/%s", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("delete_notification_template",
		mcp.WithDescription("Delete a notification template. Requires settings.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Template UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callDelete(ctx, c, c.TenantPath(fmt.Sprintf("/notifications/templates/%s", argString(args, "id"))))
	})

	// ---- Preview, Send, Logs ----
	s.AddTool(mcp.NewTool("preview_notification",
		mcp.WithDescription("Preview a notification template with sample data. Requires settings.manage permission."),
		mcp.WithString("template_id", mcp.Required(), mcp.Description("Template UUID")),
		mcp.WithObject("data", mcp.Description("Sample data for template variables")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := bodyFromArgs(args, "template_id", "data")
		return callPost(ctx, c, c.TenantPath("/notifications/preview"), body)
	})

	s.AddTool(mcp.NewTool("send_notification",
		mcp.WithDescription("Send a notification manually. Requires settings.manage permission."),
		mcp.WithString("event_code", mcp.Required(), mcp.Description("Event code")),
		mcp.WithString("recipient", mcp.Required(), mcp.Description("Recipient email or phone")),
		mcp.WithObject("data", mcp.Description("Data for template variables")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := bodyFromArgs(args, "event_code", "recipient", "data")
		return callPost(ctx, c, c.TenantPath("/notifications/send"), body)
	})

	s.AddTool(mcp.NewTool("list_notification_logs",
		mcp.WithDescription("List notification delivery logs. Requires settings.manage permission."),
		mcp.WithNumber("limit", mcp.Description("Page size")),
		mcp.WithNumber("offset", mcp.Description("Page offset")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQuery(args, "limit", "offset")
		return callGet(ctx, c, c.TenantPath("/notifications/logs"), q)
	})
}

// RegisterVendorTools registers vendor management MCP tools.
func RegisterVendorTools(s *server.MCPServer, c *Client) {
	s.AddTool(mcp.NewTool("list_vendors",
		mcp.WithDescription("List all vendors. Requires vendors.view permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.TenantPath("/vendors"), nil)
	})

	s.AddTool(mcp.NewTool("get_vendor",
		mcp.WithDescription("Get a vendor by ID. Requires vendors.view permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Vendor UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.TenantPath(fmt.Sprintf("/vendors/%s", argString(args, "id"))), nil)
	})

	s.AddTool(mcp.NewTool("create_vendor",
		mcp.WithDescription("Create a vendor. Requires vendors.manage permission."),
		mcp.WithObject("vendor", mcp.Required(), mcp.Description("Vendor with name, email, phone, address, is_active")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "vendor")
		return callPost(ctx, c, c.TenantPath("/vendors"), body)
	})

	s.AddTool(mcp.NewTool("update_vendor",
		mcp.WithDescription("Update a vendor. Requires vendors.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Vendor UUID")),
		mcp.WithObject("vendor", mcp.Required(), mcp.Description("Vendor fields to update")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "vendor")
		return callPut(ctx, c, c.TenantPath(fmt.Sprintf("/vendors/%s", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("delete_vendor",
		mcp.WithDescription("Delete a vendor. Requires vendors.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Vendor UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callDelete(ctx, c, c.TenantPath(fmt.Sprintf("/vendors/%s", argString(args, "id"))))
	})
}
