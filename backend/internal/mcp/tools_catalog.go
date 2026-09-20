package mcp

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// RegisterCatalogTools registers product, category, attribute, offer, and discount MCP tools.
func RegisterCatalogTools(s *server.MCPServer, c *Client) {
	// ---- Products (admin) ----
	s.AddTool(mcp.NewTool("list_products_admin",
		mcp.WithDescription("List products in the admin view (all statuses). Requires products.view permission."),
		mcp.WithString("search", mcp.Description("Search by name, SKU, or slug")),
		mcp.WithString("status", mcp.Description("Filter by status (draft, active, archived)")),
		mcp.WithNumber("limit", mcp.Description("Page size (default 50)")),
		mcp.WithNumber("offset", mcp.Description("Page offset (default 0)")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQueryFromArgs(args)
		return callGet(ctx, c, c.TenantPath("/products/admin"), q)
	})

	s.AddTool(mcp.NewTool("get_product_admin",
		mcp.WithDescription("Get a product by ID with full details (variants, attributes, images). Requires products.view permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Product UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.TenantPath(fmt.Sprintf("/products/admin/%s", argString(args, "id"))), nil)
	})

	s.AddTool(mcp.NewTool("get_product_by_slug",
		mcp.WithDescription("Get a product by slug. Requires products.view permission."),
		mcp.WithString("slug", mcp.Required(), mcp.Description("Product slug")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.TenantPath(fmt.Sprintf("/products/slug/%s", argString(args, "slug"))), nil)
	})

	s.AddTool(mcp.NewTool("create_product",
		mcp.WithDescription("Create a new product. Requires products.create permission. Pass all product fields including variants, attributes, and images as a JSON object in the 'product' parameter."),
		mcp.WithObject("product", mcp.Required(), mcp.Description("Product object with name, slug, description, status, base_price, currency_code, category_id, variants, attributes, images, etc.")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "product")
		if body == nil {
			return errorResult(fmt.Errorf("product parameter is required")), nil
		}
		return callPost(ctx, c, c.TenantPath("/products"), body)
	})

	s.AddTool(mcp.NewTool("update_product",
		mcp.WithDescription("Update a product. Requires products.update permission. Pass all product fields to sync."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Product UUID")),
		mcp.WithObject("product", mcp.Required(), mcp.Description("Product object with fields to update")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "product")
		if body == nil {
			return errorResult(fmt.Errorf("product parameter is required")), nil
		}
		return callPut(ctx, c, c.TenantPath(fmt.Sprintf("/products/%s", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("delete_product",
		mcp.WithDescription("Delete a product. Requires products.delete permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Product UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callDelete(ctx, c, c.TenantPath(fmt.Sprintf("/products/%s", argString(args, "id"))))
	})

	// ---- Categories ----
	s.AddTool(mcp.NewTool("list_categories",
		mcp.WithDescription("List all categories for the tenant (public endpoint)."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.TenantPath("/categories"), nil)
	})

	s.AddTool(mcp.NewTool("create_category",
		mcp.WithDescription("Create a new category. Requires categories.manage permission."),
		mcp.WithObject("category", mcp.Required(), mcp.Description("Category object with name, slug, parent_id, description, image_url")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "category")
		return callPost(ctx, c, c.TenantPath("/categories"), body)
	})

	s.AddTool(mcp.NewTool("update_category",
		mcp.WithDescription("Update a category. Requires categories.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Category UUID")),
		mcp.WithObject("category", mcp.Required(), mcp.Description("Category object with fields to update")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "category")
		return callPut(ctx, c, c.TenantPath(fmt.Sprintf("/categories/%s", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("delete_category",
		mcp.WithDescription("Delete a category. Requires categories.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Category UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callDelete(ctx, c, c.TenantPath(fmt.Sprintf("/categories/%s", argString(args, "id"))))
	})

	// ---- Attributes ----
	s.AddTool(mcp.NewTool("list_attributes",
		mcp.WithDescription("List all attributes for the tenant (public endpoint)."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.TenantPath("/attributes"), nil)
	})

	s.AddTool(mcp.NewTool("create_attribute",
		mcp.WithDescription("Create a new attribute. Requires attributes.manage permission."),
		mcp.WithObject("attribute", mcp.Required(), mcp.Description("Attribute object with name, slug, type (text, number, boolean, select), is_filterable, is_variant_defining, options")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "attribute")
		return callPost(ctx, c, c.TenantPath("/attributes"), body)
	})

	s.AddTool(mcp.NewTool("update_attribute",
		mcp.WithDescription("Update an attribute. Requires attributes.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Attribute UUID")),
		mcp.WithObject("attribute", mcp.Required(), mcp.Description("Attribute object with fields to update")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "attribute")
		return callPut(ctx, c, c.TenantPath(fmt.Sprintf("/attributes/%s", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("delete_attribute",
		mcp.WithDescription("Delete an attribute. Requires attributes.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Attribute UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callDelete(ctx, c, c.TenantPath(fmt.Sprintf("/attributes/%s", argString(args, "id"))))
	})

	// ---- Offers ----
	s.AddTool(mcp.NewTool("list_offers",
		mcp.WithDescription("List all promotional offers. Requires offers.view permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.TenantPath("/offers"), nil)
	})

	s.AddTool(mcp.NewTool("get_offer",
		mcp.WithDescription("Get a single offer by ID. Requires offers.view permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Offer UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.TenantPath(fmt.Sprintf("/offers/%s", argString(args, "id"))), nil)
	})

	s.AddTool(mcp.NewTool("create_offer",
		mcp.WithDescription("Create a new promotional offer. Requires offers.manage permission."),
		mcp.WithObject("offer", mcp.Required(), mcp.Description("Offer object with name, description, offer_type (percentage, fixed), value, target_type (all, category, product), target_id, is_active, starts_at, ends_at")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "offer")
		return callPost(ctx, c, c.TenantPath("/offers"), body)
	})

	s.AddTool(mcp.NewTool("update_offer",
		mcp.WithDescription("Update an offer. Requires offers.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Offer UUID")),
		mcp.WithObject("offer", mcp.Required(), mcp.Description("Offer object with fields to update")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "offer")
		return callPut(ctx, c, c.TenantPath(fmt.Sprintf("/offers/%s", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("delete_offer",
		mcp.WithDescription("Delete an offer. Requires offers.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Offer UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callDelete(ctx, c, c.TenantPath(fmt.Sprintf("/offers/%s", argString(args, "id"))))
	})

	// ---- Discounts ----
	s.AddTool(mcp.NewTool("list_discounts",
		mcp.WithDescription("List all discount codes. Requires discounts.view permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.TenantPath("/discounts"), nil)
	})

	s.AddTool(mcp.NewTool("get_discount",
		mcp.WithDescription("Get a single discount code by ID. Requires discounts.view permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Discount UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callGet(ctx, c, c.TenantPath(fmt.Sprintf("/discounts/%s", argString(args, "id"))), nil)
	})

	s.AddTool(mcp.NewTool("get_discount_stats",
		mcp.WithDescription("Get discount code statistics (total, active, used, expired). Requires discounts.view permission."),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return callGet(ctx, c, c.TenantPath("/discounts/stats"), nil)
	})

	s.AddTool(mcp.NewTool("create_discount",
		mcp.WithDescription("Create a new discount code. Requires discounts.manage permission."),
		mcp.WithObject("discount", mcp.Required(), mcp.Description("Discount object with code, description, discount_type (percentage, fixed), value, min_subtotal, max_uses, used_count, is_active, starts_at, ends_at")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "discount")
		return callPost(ctx, c, c.TenantPath("/discounts"), body)
	})

	s.AddTool(mcp.NewTool("update_discount",
		mcp.WithDescription("Update a discount code. Requires discounts.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Discount UUID")),
		mcp.WithObject("discount", mcp.Required(), mcp.Description("Discount object with fields to update")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		body := argMap(args, "discount")
		return callPut(ctx, c, c.TenantPath(fmt.Sprintf("/discounts/%s", argString(args, "id"))), body)
	})

	s.AddTool(mcp.NewTool("delete_discount",
		mcp.WithDescription("Delete a discount code. Requires discounts.manage permission."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Discount UUID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		return callDelete(ctx, c, c.TenantPath(fmt.Sprintf("/discounts/%s", argString(args, "id"))))
	})

	s.AddTool(mcp.NewTool("validate_discount",
		mcp.WithDescription("Validate a discount code against a subtotal (public endpoint)."),
		mcp.WithString("code", mcp.Required(), mcp.Description("Discount code")),
		mcp.WithNumber("subtotal", mcp.Required(), mcp.Description("Cart subtotal")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		q := buildQuery(args, "code", "subtotal")
		return callGet(ctx, c, c.TenantPath("/discount/validate"), q)
	})
}
