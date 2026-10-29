package mcp

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// RegisterOrderTools registers order and return MCP tools.
func RegisterOrderTools(s *server.MCPServer, c *Client) {
	// ---- Orders (admin) ----
	s.AddTool(mcp.NewTool("list_orders",
		mcp.WithDescription("List orders in the admin view with filters. Requires orders.view permission."),
		mcp.WithString("status", mcp.Description("Filter by order status")),
		mcp.WithString("search", mcp.Description("Search by order ID, customer name, or email")),
		mcp.WithString("from", mcp.Description("Date range start (ISO date or RFC3339)")),
		mcp.WithString("to", mcp.Description("Date range end (ISO date or RFC3339)")),
		mcp.WithNumber("limit", mcp.Description("Page size (default 50)")),
		mcp.WithNumber("offset", mcp.Description("Page offset (default 0)")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQueryFromArgs(args)
		return callGet(ctx, c, c.APIPath("/orders/admin"), q)
	})

	s.AddTool(mcp.NewTool("get_order",
		mcp.WithDescription("Get a single order by ID with full details. Requires orders.view permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Order UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.APIPath(fmt.Sprintf("/orders/admin/%s", argString(args, "id"))), nil)
	})

	s.AddTool(mcp.NewTool("get_order_counts",
		mcp.WithDescription("Get order counts grouped by status. Requires orders.view permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.APIPath("/orders/counts"), nil)
	})

	s.AddTool(mcp.NewTool("update_order_status",
		mcp.WithDescription("Update the status of an order. Requires orders.update permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Order UUID")),
		mcp.WithString("status", mcp.Required(), mcp.Description("New status (pending, paid, processing, ready, shipped, delivered, cancelled, refunded)")),
		mcp.WithString("note", mcp.Description("Optional status change note")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := bodyFromArgs(args, "status", "note")
		return callPut(ctx, c, c.APIPath(fmt.Sprintf("/orders/admin/%s/status", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("update_order_notes",
		mcp.WithDescription("Update internal notes for an order. Requires orders.update permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Order UUID")),
		mcp.WithString("notes", mcp.Required(), mcp.Description("Internal notes")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := bodyFromArgs(args, "notes")
		return callPut(ctx, c, c.APIPath(fmt.Sprintf("/orders/admin/%s/notes", argString(args, "id"))), body)
	})

	// ---- Returns (admin) ----
	s.AddTool(mcp.NewTool("list_returns",
		mcp.WithDescription("List returns/replacements/exchanges with filters. Requires orders.view permission."),
		mcp.WithString("status", mcp.Description("Filter by return status")),
		mcp.WithString("type", mcp.Description("Filter by return type (refund, replacement, exchange)")),
		mcp.WithString("search", mcp.Description("Search by return number, order number, customer name/email")),
		mcp.WithString("from", mcp.Description("Date range start")),
		mcp.WithString("to", mcp.Description("Date range end")),
		mcp.WithNumber("limit", mcp.Description("Page size")),
		mcp.WithNumber("offset", mcp.Description("Page offset")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQueryFromArgs(args)
		return callGet(ctx, c, c.APIPath("/returns"), q)
	})

	s.AddTool(mcp.NewTool("get_return",
		mcp.WithDescription("Get a single return by ID with items. Requires orders.view permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Return UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.APIPath(fmt.Sprintf("/returns/%s", argString(args, "id"))), nil)
	})

	s.AddTool(mcp.NewTool("get_return_counts",
		mcp.WithDescription("Get return counts grouped by status. Requires orders.view permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.APIPath("/returns/counts"), nil)
	})

	s.AddTool(mcp.NewTool("list_order_returns",
		mcp.WithDescription("List returns for a specific order. Requires orders.view permission."),
		mcp.WithString("order_id", mcp.Required(), mcp.Description("Order UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.APIPath(fmt.Sprintf("/orders/admin/%s/returns", argString(args, "order_id"))), nil)
	})

	s.AddTool(mcp.NewTool("create_return",
		mcp.WithDescription("Create a return/replacement/exchange request for an order. Requires orders.update permission."),
		mcp.WithString("order_id", mcp.Required(), mcp.Description("Order UUID")),
		mcp.WithObject("return", mcp.Required(), mcp.Description("Return object with type (refund, replacement, exchange), reason, items (array of {order_item_id, quantity})")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "return")
		return callPost(ctx, c, c.APIPath(fmt.Sprintf("/orders/admin/%s/returns", argString(args, "order_id"))), body)
	})

	s.AddTool(mcp.NewTool("update_return_status",
		mcp.WithDescription("Transition a return's status (approve, reject, complete, cancel). Requires orders.update permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Return UUID")),
		mcp.WithString("status", mcp.Required(), mcp.Description("New status (approved, rejected, completed, cancelled)")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := bodyFromArgs(args, "status")
		return callPut(ctx, c, c.APIPath(fmt.Sprintf("/returns/%s/status", argString(args, "id"))), body)
	})
}
