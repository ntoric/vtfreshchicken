package mcp

import (
	"github.com/mark3labs/mcp-go/server"
)

// NewMCPServer creates a new MCP server with all TruCommerce tools registered.
// The client is used by all tool handlers to call the backend API.
func NewMCPServer(c *Client) *server.MCPServer {
	s := server.NewMCPServer("trucommerce", "1.0.0",
		server.WithInstructions(`TruCommerce MCP Server — exposes all platform functionalities for AI integration.

USAGE FLOW:
1. Authenticate first:
   - For store operations: call `+"`store_login`"+` with user credentials (business_admin, staff, or customer).
   - For internal superadmin access: call `+"`platform_login`"+` with superadmin credentials.
2. All store-scoped tools (list_orders, list_products_admin, etc.) operate on the single store.
3. Public storefront tools (list_storefront_products, get_storefront_product, etc.) need no authentication.
4. Tool results are JSON text. Errors are returned with isError=true.

TOOL CATEGORIES:
- Auth: store_login, platform_login, register_customer, get_me, get_my_permissions, refresh_token, export_my_data, delete_my_account
- Setup: get_setup_status, complete_setup
- Catalog: list_products_admin, get_product_admin, get_product_by_slug, create_product, update_product, delete_product, list_categories, create_category, update_category, delete_category, list_attributes, create_attribute, update_attribute, delete_attribute
- Offers: list_offers, get_offer, create_offer, update_offer, delete_offer
- Discounts: list_discounts, get_discount, get_discount_stats, create_discount, update_discount, delete_discount, validate_discount
- Orders: list_orders, get_order, get_order_counts, update_order_status, update_order_notes
- Returns: list_returns, get_return, get_return_counts, list_order_returns, create_return, update_return_status
- Customers: list_customers, get_customer, get_customer_stats, update_customer, delete_customer
- Users/Staff: list_users, get_user, get_user_stats, create_staff, update_user, set_user_active, reset_user_password, delete_user
- Inventory: list_inventory, get_inventory_stats, adjust_stock, list_stock_movements
- Payments: list_payment_transactions, get_payment_transaction, list_order_transactions, refund_transaction, list_payment_gateways, update_payment_gateway, get_payment_stats
- Wallet: get_my_wallet, topup_wallet, list_my_wallet_transactions, get_wallet_stats, list_all_wallet_transactions, get_customer_wallet, list_customer_wallet_transactions, adjust_customer_wallet
- Shipping: list_shipping_methods, create_shipping_method, update_shipping_method, delete_shipping_method, list_shipping_zones, create_shipping_zone, update_shipping_zone, delete_shipping_zone, list_shipping_rates, create_shipping_rate, update_shipping_rate, delete_shipping_rate, list_shipping_providers, create_shipping_provider, update_shipping_provider, delete_shipping_provider, test_shipping_provider, list_order_shipments, create_order_shipment, track_shipment, calculate_shipping
- Tax: list_tax_classes, create_tax_class, update_tax_class, delete_tax_class, list_tax_zones, create_tax_zone, update_tax_zone, delete_tax_zone, list_tax_rates, create_tax_rate, update_tax_rate, delete_tax_rate, calculate_tax
- Dashboard: get_dashboard_stats
- Exports: list_export_types, estimate_export_size, create_export, list_exports, get_export
- Pages: list_pages, get_page, create_page, update_page, delete_page, get_public_page
- Notifications: list_notification_events, create_notification_event, update_notification_event, delete_notification_event, list_notification_templates, get_notification_template, create_notification_template, update_notification_template, delete_notification_template, preview_notification, send_notification, list_notification_logs
- Vendors: list_vendors, get_vendor, create_vendor, update_vendor, delete_vendor
- Storefront (public): get_storefront_bootstrap, list_storefront_products, get_storefront_product, get_store_public_info, list_storefront_currencies, list_storefront_languages, list_payment_methods
- Reviews: list_reviews, get_review_summary, create_review, get_my_review, list_my_reviews, list_purchased_products
- Cart: get_cart, add_cart_item, update_cart_item, remove_cart_item, clear_cart, get_cart_count
- Wishlist: get_wishlist, add_wishlist_item, remove_wishlist_item, remove_wishlist_product, clear_wishlist, check_wishlist_product
- Checkout: place_order, list_my_orders, get_my_order, list_my_order_shipments, track_my_shipment, list_my_returns, list_my_order_returns, get_my_return_eligibility, create_my_return, create_payment_order
- Addresses: list_addresses, save_address, delete_address
- Contact: submit_contact, list_contact_submissions, mark_contact_read, delete_contact_submission
- Settings: get_store_settings, update_store_settings, get_smtp_settings, update_smtp_settings, test_smtp_settings
- Permissions: list_permissions, list_role_permissions, get_role_permissions, set_role_permissions, toggle_permission, seed_default_permissions
`),
	)

	// Register all tool groups
	RegisterAuthTools(s, c)
	RegisterSetupTools(s, c)
	RegisterCatalogTools(s, c)
	RegisterOrderTools(s, c)
	RegisterCustomerTools(s, c)
	RegisterInventoryTools(s, c)
	RegisterPaymentTools(s, c)
	RegisterShippingTools(s, c)
	RegisterTaxTools(s, c)
	RegisterDashboardTools(s, c)
	RegisterExportTools(s, c)
	RegisterPagesTools(s, c)
	RegisterNotificationTools(s, c)
	RegisterVendorTools(s, c)
	RegisterStorefrontTools(s, c)
	RegisterReviewTools(s, c)
	RegisterCartTools(s, c)
	RegisterWishlistTools(s, c)
	RegisterCheckoutTools(s, c)
	RegisterAddressTools(s, c)
	RegisterContactTools(s, c)
	RegisterSettingsTools(s, c)
	RegisterPermissionTools(s, c)

	return s
}
