package mcp

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// RegisterStorefrontTools registers public storefront MCP tools.
func RegisterStorefrontTools(s *server.MCPServer, c *Client) {
	s.AddTool(mcp.NewTool("get_storefront_bootstrap",
		mcp.WithDescription("Get storefront bootstrap data (settings, currencies, languages, categories, attributes) for a tenant. Public endpoint."),
		mcp.WithString("tenant", mcp.Required(), mcp.Description("Tenant slug")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, fmt.Sprintf("/api/t/%s/bootstrap", argString(args, "tenant")), nil)
	})

	s.AddTool(mcp.NewTool("list_storefront_products",
		mcp.WithDescription("List storefront products with filters (only active products). Public endpoint."),
		mcp.WithString("tenant", mcp.Required(), mcp.Description("Tenant slug")),
		mcp.WithString("category", mcp.Description("Category slug filter")),
		mcp.WithString("search", mcp.Description("Search query")),
		mcp.WithNumber("min_price", mcp.Description("Min price filter")),
		mcp.WithNumber("max_price", mcp.Description("Max price filter")),
		mcp.WithString("currency", mcp.Description("Display currency code")),
		mcp.WithArray("attr", mcp.Description("Attribute filters as array of 'name:value' strings")),
		mcp.WithNumber("limit", mcp.Description("Page size")),
		mcp.WithNumber("offset", mcp.Description("Page offset")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		tenant := argString(args, "tenant")
		q := buildQuery(args, "category", "search", "min_price", "max_price", "currency", "limit", "offset")
		// attr is an array — handle separately
		if attrs := argArray(args, "attr"); attrs != nil {
			for _, a := range attrs {
				if s, ok := a.(string); ok {
					q.Add("attr", s)
				}
			}
		}
		return callGet(ctx, c, fmt.Sprintf("/api/t/%s/products", tenant), q)
	})

	s.AddTool(mcp.NewTool("get_storefront_product",
		mcp.WithDescription("Get a storefront product by slug with variants and attributes. Public endpoint."),
		mcp.WithString("tenant", mcp.Required(), mcp.Description("Tenant slug")),
		mcp.WithString("slug", mcp.Required(), mcp.Description("Product slug")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, fmt.Sprintf("/api/t/%s/products/%s", argString(args, "tenant"), argString(args, "slug")), nil)
	})

	s.AddTool(mcp.NewTool("get_tenant_public_info",
		mcp.WithDescription("Get public tenant info (name, logo, brand color, description). Public endpoint."),
		mcp.WithString("tenant", mcp.Required(), mcp.Description("Tenant slug")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, fmt.Sprintf("/api/t/%s/info", argString(args, "tenant")), nil)
	})

	s.AddTool(mcp.NewTool("list_storefront_currencies",
		mcp.WithDescription("List currencies supported by the tenant. Public endpoint."),
		mcp.WithString("tenant", mcp.Required(), mcp.Description("Tenant slug")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, fmt.Sprintf("/api/t/%s/currencies", argString(args, "tenant")), nil)
	})

	s.AddTool(mcp.NewTool("list_storefront_languages",
		mcp.WithDescription("List languages supported by the tenant. Public endpoint."),
		mcp.WithString("tenant", mcp.Required(), mcp.Description("Tenant slug")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, fmt.Sprintf("/api/t/%s/languages", argString(args, "tenant")), nil)
	})

	s.AddTool(mcp.NewTool("list_payment_methods",
		mcp.WithDescription("List available payment methods/gateways for a tenant. Public endpoint."),
		mcp.WithString("tenant", mcp.Required(), mcp.Description("Tenant slug")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, fmt.Sprintf("/api/t/%s/payment/methods", argString(args, "tenant")), nil)
	})
}

// RegisterReviewTools registers product review MCP tools.
func RegisterReviewTools(s *server.MCPServer, c *Client) {
	s.AddTool(mcp.NewTool("list_reviews",
		mcp.WithDescription("List reviews for a product. Public endpoint."),
		mcp.WithString("product_id", mcp.Required(), mcp.Description("Product UUID")),
		mcp.WithNumber("limit", mcp.Description("Page size")),
		mcp.WithNumber("offset", mcp.Description("Page offset")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQuery(args, "limit", "offset")
		return callGet(ctx, c, c.TenantPath(fmt.Sprintf("/reviews/%s", argString(args, "product_id"))), q)
	})

	s.AddTool(mcp.NewTool("get_review_summary",
		mcp.WithDescription("Get rating summary (average, count, distribution) for a product. Public endpoint."),
		mcp.WithString("product_id", mcp.Required(), mcp.Description("Product UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.TenantPath(fmt.Sprintf("/reviews/%s/summary", argString(args, "product_id"))), nil)
	})

	s.AddTool(mcp.NewTool("create_review",
		mcp.WithDescription("Create a review for a product. Public endpoint (auth optional for verified buyers)."),
		mcp.WithString("product_id", mcp.Required(), mcp.Description("Product UUID")),
		mcp.WithObject("review", mcp.Required(), mcp.Description("Review with rating (1-5), title, body, images (array of image URLs)")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "review")
		return callPost(ctx, c, c.TenantPath(fmt.Sprintf("/reviews/%s", argString(args, "product_id"))), body)
	})

	s.AddTool(mcp.NewTool("get_my_review",
		mcp.WithDescription("Get the current user's review for a product. Requires authentication."),
		mcp.WithString("product_id", mcp.Required(), mcp.Description("Product UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.TenantPath(fmt.Sprintf("/reviews/%s/my", argString(args, "product_id"))), nil)
	})

	s.AddTool(mcp.NewTool("list_my_reviews",
		mcp.WithDescription("List all reviews written by the current user. Requires authentication."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.TenantPath("/me/reviews"), nil)
	})

	s.AddTool(mcp.NewTool("list_purchased_products",
		mcp.WithDescription("List products the current user has purchased (eligible for review). Requires authentication."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.TenantPath("/me/purchased-products"), nil)
	})
}

// RegisterCartTools registers shopping cart MCP tools.
func RegisterCartTools(s *server.MCPServer, c *Client) {
	s.AddTool(mcp.NewTool("get_cart",
		mcp.WithDescription("Get the current shopping cart contents. Uses session cookie or user ID if authenticated."),
		mcp.WithString("session_id", mcp.Description("Session ID for guest carts")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQuery(args, "session_id")
		return callGet(ctx, c, c.TenantPath("/cart"), q)
	})

	s.AddTool(mcp.NewTool("add_cart_item",
		mcp.WithDescription("Add an item to the cart."),
		mcp.WithString("product_id", mcp.Required(), mcp.Description("Product UUID")),
		mcp.WithString("variant_id", mcp.Description("Variant UUID (required for products with variants)")),
		mcp.WithNumber("quantity", mcp.Required(), mcp.Description("Quantity")),
		mcp.WithString("session_id", mcp.Description("Session ID for guest carts")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := bodyFromArgs(args, "product_id", "variant_id", "quantity", "session_id")
		return callPost(ctx, c, c.TenantPath("/cart/items"), body)
	})

	s.AddTool(mcp.NewTool("update_cart_item",
		mcp.WithDescription("Update the quantity of a cart item."),
		mcp.WithString("item_id", mcp.Required(), mcp.Description("Cart item UUID")),
		mcp.WithNumber("quantity", mcp.Required(), mcp.Description("New quantity")),
		mcp.WithString("session_id", mcp.Description("Session ID for guest carts")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := bodyFromArgs(args, "quantity", "session_id")
		return callPut(ctx, c, c.TenantPath(fmt.Sprintf("/cart/items/%s", argString(args, "item_id"))), body)
	})

	s.AddTool(mcp.NewTool("remove_cart_item",
		mcp.WithDescription("Remove an item from the cart."),
		mcp.WithString("item_id", mcp.Required(), mcp.Description("Cart item UUID")),
		mcp.WithString("session_id", mcp.Description("Session ID for guest carts")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQuery(args, "session_id")
		return callDelete(ctx, c, c.TenantPath(fmt.Sprintf("/cart/items/%s?%s", argString(args, "item_id"), q.Encode())))
	})

	s.AddTool(mcp.NewTool("clear_cart",
		mcp.WithDescription("Clear all items from the cart."),
		mcp.WithString("session_id", mcp.Description("Session ID for guest carts")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQuery(args, "session_id")
		return callDelete(ctx, c, c.TenantPath(fmt.Sprintf("/cart?%s", q.Encode())))
	})

	s.AddTool(mcp.NewTool("get_cart_count",
		mcp.WithDescription("Get the number of items in the cart."),
		mcp.WithString("session_id", mcp.Description("Session ID for guest carts")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQuery(args, "session_id")
		return callGet(ctx, c, c.TenantPath("/cart/count"), q)
	})
}

// RegisterWishlistTools registers wishlist MCP tools.
func RegisterWishlistTools(s *server.MCPServer, c *Client) {
	s.AddTool(mcp.NewTool("get_wishlist",
		mcp.WithDescription("Get the current user's wishlist."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.TenantPath("/wishlist"), nil)
	})

	s.AddTool(mcp.NewTool("add_wishlist_item",
		mcp.WithDescription("Add a product to the wishlist."),
		mcp.WithString("product_id", mcp.Required(), mcp.Description("Product UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := bodyFromArgs(args, "product_id")
		return callPost(ctx, c, c.TenantPath("/wishlist/items"), body)
	})

	s.AddTool(mcp.NewTool("remove_wishlist_item",
		mcp.WithDescription("Remove an item from the wishlist by item ID."),
		mcp.WithString("item_id", mcp.Required(), mcp.Description("Wishlist item UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callDelete(ctx, c, c.TenantPath(fmt.Sprintf("/wishlist/items/%s", argString(args, "item_id"))))
	})

	s.AddTool(mcp.NewTool("remove_wishlist_product",
		mcp.WithDescription("Remove a product from the wishlist by product ID."),
		mcp.WithString("product_id", mcp.Required(), mcp.Description("Product UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callDelete(ctx, c, c.TenantPath(fmt.Sprintf("/wishlist/product/%s", argString(args, "product_id"))))
	})

	s.AddTool(mcp.NewTool("clear_wishlist",
		mcp.WithDescription("Clear all items from the wishlist."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callDelete(ctx, c, c.TenantPath("/wishlist"))
	})

	s.AddTool(mcp.NewTool("check_wishlist_product",
		mcp.WithDescription("Check if a product is in the wishlist."),
		mcp.WithString("product_id", mcp.Required(), mcp.Description("Product UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.TenantPath(fmt.Sprintf("/wishlist/check/%s", argString(args, "product_id"))), nil)
	})
}
