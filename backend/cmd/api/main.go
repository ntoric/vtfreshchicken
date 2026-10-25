package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"github.com/trucommerce/backend/internal/auth"
	"github.com/trucommerce/backend/internal/config"
	"github.com/trucommerce/backend/internal/currency"
	"github.com/trucommerce/backend/internal/db"
	"github.com/trucommerce/backend/internal/handlers"
	"github.com/trucommerce/backend/internal/middleware"
	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/payment"
	"github.com/trucommerce/backend/internal/redis"
	"github.com/trucommerce/backend/internal/services"
)

// Build-time variables. Override with:
//   go build -ldflags "-X main.Version=1.2.3 -X main.Commit=$(git rev-parse --short HEAD) -X main.BuildDate=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
var (
	Version   = "dev"
	Commit    = "unknown"
	BuildDate = "unknown"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("config load failed", "err", err)
		os.Exit(1)
	}

	// Configure structured logging based on config
	var level slog.Level
	switch strings.ToLower(cfg.LogLevel) {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}
	var handler slog.Handler
	if strings.ToLower(cfg.LogFormat) == "json" {
		handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})
	} else {
		handler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: level})
	}
	slog.SetDefault(slog.New(handler))

	slog.Info("starting application",
		"env", cfg.AppEnv,
		"port", cfg.Port,
		"app", cfg.AppName,
	)

	if cfg.IsProd() {
		gin.SetMode(gin.ReleaseMode)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pool, err := db.NewPool(ctx, cfg.PostgresDSN, db.PoolConfig{
		MaxConns:        cfg.DBMaxConns,
		MinConns:        cfg.DBMinConns,
		MaxConnLifetime: cfg.DBMaxConnLifetime,
		MaxConnIdleTime: cfg.DBMaxConnIdleTime,
	})
	if err != nil {
		slog.Error("postgres connect failed", "err", err)
		os.Exit(1)
	}
	defer pool.Close()
	slog.Info("postgres connected",
		"max_conns", cfg.DBMaxConns,
		"min_conns", cfg.DBMinConns,
	)

	if err := db.Migrate(ctx, pool); err != nil {
		slog.Error("migrate failed", "err", err)
		os.Exit(1)
	}
	slog.Info("database migrations complete")

	rdb, err := redis.New(redis.Config{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})
	if err != nil {
		slog.Error("redis connect failed", "err", err)
		os.Exit(1)
	}
	defer rdb.Close()
	slog.Info("redis connected", "addr", cfg.RedisAddr)

	store := services.NewStore(pool)
	idemStore := services.NewIdempotencyStore(pool)
	authSvc := auth.NewService(cfg.JWTSecret, cfg.JWTAccessTTL, cfg.JWTRefreshTTL, rdb)
	curSvc := currency.New(pool)

	// Bootstrap superadmin if none exists AND seed credentials are explicitly configured.
	// When SEED_SUPERADMIN_EMAIL is empty, the interactive setup wizard handles creation.
	if cfg.SeedSuperAdminEmail != "" {
		if n, _ := store.CountSuperAdmins(ctx); n == 0 {
			hash, err := auth.HashPassword(cfg.SeedSuperAdminPwd)
			if err == nil {
				if _, err := store.CreateSuperAdmin(ctx, cfg.SeedSuperAdminEmail, "Super Admin", hash); err != nil {
					slog.Error("superadmin bootstrap failed", "err", err)
				} else {
					slog.Info("superadmin created", "email", cfg.SeedSuperAdminEmail)
				}
			}
		}
	}

	// Single-store resolution: STORE_SLUG pins the store to a specific tenant;
	// otherwise the first (and only) tenant is used.
	storeLoader := func(ctx context.Context) (*models.Tenant, error) {
		if cfg.StoreSlug != "" {
			return store.GetTenantBySlug(ctx, cfg.StoreSlug)
		}
		return store.GetFirstTenant(ctx)
	}

	authH := handlers.NewAuthHandler(store, authSvc)
	tenantH := handlers.NewTenantHandler(store)
	catalogH := handlers.NewCatalogHandler(store)
	inventoryH := handlers.NewInventoryHandler(store)
	vendorH := handlers.NewVendorHandler(store)
	storeH := handlers.NewStorefrontHandler(store, curSvc)
	dashH := handlers.NewDashboardHandler(store)
	cartH := handlers.NewCartHandler(store, cfg)
	wishlistH := handlers.NewWishlistHandler(store)
	reviewH := handlers.NewReviewHandler(store)
	emailH := handlers.NewEmailHandler(store, cfg)
	checkoutH := handlers.NewCheckoutHandler(store, payment.Default, emailH)
	addressH := handlers.NewAddressHandler(store)
	paymentH := handlers.NewPaymentHandler(payment.Default, store)
	orderH := handlers.NewOrderHandler(store)
	taxH := handlers.NewTaxHandler(store)
	shippingH := handlers.NewShippingHandler(store)
	shippingProviderH := handlers.NewShippingProviderHandler(store)
	paymentsH := handlers.NewPaymentsHandler(store)
	permH := handlers.NewPermissionHandler(store)
	setupH := handlers.NewSetupHandler(store, auth.HashPassword)
	walletH := handlers.NewWalletHandler(store, payment.Default)
	uploadH := handlers.NewUploadHandler("/app/uploads", cfg.UploadMaxSize, cfg.UploadAllowedTypes)
	notifH := handlers.NewNotificationHandler(store, emailH)
	returnsH := handlers.NewReturnsHandler(store)
	pagesH := handlers.NewPagesHandler(store)
	exportH := handlers.NewExportHandler(store, cfg, emailH)
	contactH := handlers.NewContactHandler(store, emailH)
	branchH := handlers.NewBranchHandler(store)

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(gin.LoggerWithConfig(gin.LoggerConfig{SkipPaths: []string{"/health"}}))
	// In development, allow all origins (for LAN access from other machines).
	// In production, use the explicit allowed origins list.
	var corsConfig cors.Config
	if cfg.AppEnv == "development" && len(cfg.CORSAllowedOrigins) > 0 {
		corsConfig = cors.Config{
			AllowOriginFunc:  func(origin string) bool { return true },
			AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
			AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Accept-Language", "Idempotency-Key", "X-Branch-Id"},
			ExposeHeaders:    []string{"Content-Length"},
			AllowCredentials: true,
			MaxAge:           cfg.CORSMaxAge,
		}
	} else {
		corsConfig = cors.Config{
			AllowOrigins:     cfg.CORSAllowedOrigins,
			AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
			AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Accept-Language", "Idempotency-Key", "X-Branch-Id"},
			ExposeHeaders:    []string{"Content-Length"},
			AllowCredentials: true,
			MaxAge:           cfg.CORSMaxAge,
		}
	}
	r.Use(cors.New(corsConfig))

	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	// Serve uploaded files statically
	r.Static("/uploads", "/app/uploads")

	// Store resolution middleware applied globally; it loads the single store's
	// tenant record for every /api route (setup + platform auth are exempt).
	r.Use(middleware.ResolveStore(storeLoader))

	api := r.Group("/api")

	// Setup / installation flow (public — only works when setup is needed)
	setup := api.Group("/setup")
	{
		setup.GET("/status", setupH.Status)
		setup.POST("/complete", middleware.Idempotency(idemStore, "setup"), setupH.Complete)
	}

	// Platform login (internal superadmin only — there is no platform UI).
	// Exempt from store resolution so a superadmin can authenticate even
	// before the store exists.
	api.POST("/platform/auth/login", authH.Login)

	// Store-scoped routes: /api/... (single store resolved from the database)
	storeAPI := api.Group("")

	// Public storefront endpoints (no auth)
	storeAPI.GET("/bootstrap", storeH.Bootstrap)
	storeAPI.GET("/products", storeH.ListProducts)
	storeAPI.GET("/products/:slug", storeH.GetProduct)
	storeAPI.GET("/discount/validate", storeH.ValidateDiscount)
	storeAPI.GET("/categories", catalogH.ListCategories)
	storeAPI.GET("/attributes", catalogH.ListAttributes)
	storeAPI.GET("/currencies", catalogH.ListCurrencies)
	storeAPI.GET("/languages", catalogH.ListLanguages)
	storeAPI.GET("/info", tenantH.PublicInfo)

	// Cart (public — uses session cookie or user ID if authenticated)
	// OptionalAuth sets user context if a token is present (associates cart with user)
	storeAPI.GET("/cart", middleware.OptionalAuth(authSvc), cartH.GetCart)
	storeAPI.POST("/cart/items", middleware.OptionalAuth(authSvc), cartH.AddItem)
	storeAPI.PUT("/cart/items/:itemId", middleware.OptionalAuth(authSvc), cartH.UpdateItem)
	storeAPI.DELETE("/cart/items/:itemId", middleware.OptionalAuth(authSvc), cartH.RemoveItem)
	storeAPI.DELETE("/cart", middleware.OptionalAuth(authSvc), cartH.ClearCart)
	storeAPI.GET("/cart/count", middleware.OptionalAuth(authSvc), cartH.CartCount)

	// Wishlist (public — uses session cookie or user ID if authenticated)
	storeAPI.GET("/wishlist", wishlistH.GetWishlist)
	storeAPI.POST("/wishlist/items", wishlistH.AddItem)
	storeAPI.DELETE("/wishlist/items/:itemId", wishlistH.RemoveItem)
	storeAPI.DELETE("/wishlist/product/:productId", wishlistH.RemoveByProduct)
	storeAPI.DELETE("/wishlist", wishlistH.ClearWishlist)
	storeAPI.GET("/wishlist/check/:productId", wishlistH.CheckProduct)

	// Reviews (public read, public write for now)
	storeAPI.GET("/reviews/:productId", reviewH.ListReviews)
	storeAPI.POST("/reviews/:productId", reviewH.CreateReview)
	storeAPI.GET("/reviews/:productId/summary", reviewH.GetSummary)

	// Checkout (public — uses session cookie or user ID if authenticated)
	// OptionalAuth sets user context if a token is present (needed for wallet payment)
	storeAPI.POST("/checkout", middleware.OptionalAuth(authSvc), middleware.Idempotency(idemStore, "checkout"), checkoutH.PlaceOrder)
	storeAPI.GET("/orders", middleware.OptionalAuth(authSvc), checkoutH.ListMyOrders)
	storeAPI.GET("/orders/:orderId", checkoutH.GetOrder)
	// Shipment tracking for a specific order (customer-facing — uses optional auth for guest orders)
	storeAPI.GET("/orders/:orderId/shipments", middleware.OptionalAuth(authSvc), shippingProviderH.ListOrderShipments)
	storeAPI.POST("/orders/:orderId/shipments/:id/track", middleware.OptionalAuth(authSvc), shippingProviderH.TrackShipment)
	// Returns for a specific order (public with optional auth — guest orders accessible via order ID)
	storeAPI.GET("/orders/:orderId/returns", middleware.OptionalAuth(authSvc), returnsH.CustomerListOrderReturns)
	storeAPI.GET("/orders/:orderId/return-eligibility", middleware.OptionalAuth(authSvc), returnsH.CustomerGetReturnEligibility)
	storeAPI.POST("/orders/:orderId/returns", middleware.OptionalAuth(authSvc), middleware.Idempotency(idemStore, "return_create"), returnsH.CustomerCreateReturn)
	// Store pages (public — published pages for storefront rendering)
	storeAPI.GET("/page/:slug", pagesH.PublicGetPage)
	// Contact form submission (public — used by storefront contact form widget)
	storeAPI.POST("/contact", contactH.SubmitContact)
	// Tax calculation (public — used by frontstore checkout to preview tax)
	storeAPI.POST("/tax/calculate", taxH.CalculateTax)
	// Shipping calculation (public — used by frontstore checkout to get shipping options)
	storeAPI.POST("/shipping/calculate", shippingH.CalculateShipping)

	// Delivery availability check (public — which branch serves a location)
	storeAPI.GET("/delivery/check", branchH.DeliveryCheck)

	// Payment methods (public — lists available gateways from the registry)
	storeAPI.GET("/payment/methods", paymentH.ListMethods)
	// Create gateway order (for gateways like Razorpay that need server-side order creation)
	storeAPI.POST("/payment/:gatewayId/create-order", paymentH.CreateOrder)

	// Test payment system (only active in non-production mode)
	storeAPI.GET("/payment/test/cards", paymentH.ListTestCards)
	storeAPI.GET("/payment/test/transactions", paymentH.ListTestTransactions)
	storeAPI.DELETE("/payment/test/transactions", paymentH.ClearTestTransactions)

	// Auth (tenant-scoped)
	storeAPI.POST("/auth/login", authH.Login)
	storeAPI.POST("/auth/register", middleware.Idempotency(idemStore, "register"), authH.Register)
	storeAPI.POST("/auth/register-from-order", middleware.Idempotency(idemStore, "register"), authH.RegisterFromOrder)
	storeAPI.POST("/auth/refresh", authH.Refresh)

	// Authenticated tenant routes
	authed := storeAPI.Group("")
	authed.Use(middleware.RequireAuth(authSvc))
	authed.Use(middleware.RequireTenantMatch())
	{
		authed.GET("/me", authH.Me)
		authed.GET("/me/permissions", permH.MyPermissions)
		authed.GET("/settings", tenantH.GetSettings)
		authed.PUT("/settings", tenantH.UpdateSettings)

		// GDPR — Data subject rights
		authed.GET("/me/export", authH.ExportMyData)
		authed.DELETE("/me/delete", authH.DeleteMyAccount)

		// Addresses (authenticated users)
		authed.GET("/addresses", addressH.List)
		authed.POST("/addresses", addressH.Save)
		authed.DELETE("/addresses/:addressId", addressH.Delete)

		// Wallet (authenticated customers)
		authed.GET("/wallet", walletH.GetWallet)
		authed.POST("/wallet/topup", middleware.Idempotency(idemStore, "wallet_topup"), walletH.TopUp)
		authed.GET("/wallet/transactions", walletH.ListTransactions)

		// Returns (authenticated customers — list all their returns across orders)
		authed.GET("/my-returns", returnsH.CustomerListReturns)

		// Reviews (authenticated customers)
		authed.GET("/me/purchased-products", reviewH.ListPurchasedProducts)
		authed.GET("/me/reviews", reviewH.ListMyReviews)
		authed.GET("/reviews/:productId/my", reviewH.GetMyReview)
		// Customer image upload (for review photos)
		authed.POST("/upload/images", uploadH.UploadImages)

		// Admin (business_admin + branch_manager + staff) + superadmin
		admin := authed.Group("")
		admin.Use(middleware.RequireRole(models.RoleSuperAdmin, models.RoleBusinessAdmin, models.RoleBranchManager, models.RoleStaff))
		{
			// Branches — readable by all admin roles (branch switcher, scoped views)
			admin.GET("/branches", middleware.RequirePermission(store, "branches.view"), branchH.List)
			admin.GET("/branches/:id", middleware.RequirePermission(store, "branches.view"), branchH.Get)
			// Dashboard
			admin.GET("/dashboard/stats", middleware.RequirePermission(store, "dashboard.view"), dashH.Stats)

			// SMTP / Email settings (business admin only)
			admin.GET("/settings/smtp", middleware.RequirePermission(store, "settings.manage"), emailH.GetSMTPSettings)
			admin.PUT("/settings/smtp", middleware.RequirePermission(store, "settings.manage"), emailH.UpdateSMTPSettings)
			admin.POST("/settings/smtp/test", middleware.RequirePermission(store, "settings.manage"), emailH.TestSMTPSettings)

			// Notifications
			admin.GET("/notifications/events", middleware.RequirePermission(store, "settings.manage"), notifH.ListEvents)
			admin.POST("/notifications/events", middleware.RequirePermission(store, "settings.manage"), notifH.CreateEvent)
			admin.PUT("/notifications/events/:id", middleware.RequirePermission(store, "settings.manage"), notifH.UpdateEvent)
			admin.DELETE("/notifications/events/:id", middleware.RequirePermission(store, "settings.manage"), notifH.DeleteEvent)
			admin.GET("/notifications/templates", middleware.RequirePermission(store, "settings.manage"), notifH.ListTemplates)
			admin.GET("/notifications/templates/:id", middleware.RequirePermission(store, "settings.manage"), notifH.GetTemplate)
			admin.POST("/notifications/templates", middleware.RequirePermission(store, "settings.manage"), notifH.CreateTemplate)
			admin.PUT("/notifications/templates/:id", middleware.RequirePermission(store, "settings.manage"), notifH.UpdateTemplate)
			admin.DELETE("/notifications/templates/:id", middleware.RequirePermission(store, "settings.manage"), notifH.DeleteTemplate)
			admin.POST("/notifications/preview", middleware.RequirePermission(store, "settings.manage"), notifH.Preview)
			admin.POST("/notifications/send", middleware.RequirePermission(store, "settings.manage"), notifH.Send)
			admin.GET("/notifications/logs", middleware.RequirePermission(store, "settings.manage"), notifH.ListLogs)

			// Orders
			admin.GET("/orders/admin", middleware.RequirePermission(store, "orders.view"), orderH.ListOrders)
			admin.GET("/orders/counts", middleware.RequirePermission(store, "orders.view"), orderH.OrderCounts)
			admin.GET("/orders/admin/:orderId", middleware.RequirePermission(store, "orders.view"), orderH.GetOrder)
			admin.PUT("/orders/admin/:orderId/status", middleware.RequirePermission(store, "orders.update"), middleware.Idempotency(idemStore, "order_status"), orderH.UpdateStatus)
			admin.PUT("/orders/admin/:orderId/notes", middleware.RequirePermission(store, "orders.update"), orderH.UpdateNotes)

			// Returns / Replacements / Refunds
			admin.GET("/returns", middleware.RequirePermission(store, "orders.view"), returnsH.ListReturns)
			admin.GET("/returns/counts", middleware.RequirePermission(store, "orders.view"), returnsH.ReturnCounts)
			admin.GET("/returns/:id", middleware.RequirePermission(store, "orders.view"), returnsH.GetReturn)
			admin.GET("/orders/admin/:orderId/returns", middleware.RequirePermission(store, "orders.view"), returnsH.ListOrderReturns)
			admin.POST("/orders/admin/:orderId/returns", middleware.RequirePermission(store, "orders.update"), middleware.Idempotency(idemStore, "return_create"), returnsH.CreateReturn)
			admin.PUT("/returns/:id/status", middleware.RequirePermission(store, "orders.update"), middleware.Idempotency(idemStore, "return_status"), returnsH.UpdateReturnStatus)

			// Store Pages (Page Builder)
			admin.GET("/pages", middleware.RequirePermission(store, "settings.view"), pagesH.ListPages)
			admin.GET("/pages/:id", middleware.RequirePermission(store, "settings.view"), pagesH.GetPage)
			admin.POST("/pages", middleware.RequirePermission(store, "settings.manage"), pagesH.CreatePage)
			admin.PUT("/pages/:id", middleware.RequirePermission(store, "settings.manage"), pagesH.UpdatePage)
			admin.DELETE("/pages/:id", middleware.RequirePermission(store, "settings.manage"), pagesH.DeletePage)

			// Contact submissions (admin)
			admin.GET("/contact/submissions", middleware.RequirePermission(store, "settings.view"), contactH.ListSubmissions)
			admin.PUT("/contact/submissions/:id/read", middleware.RequirePermission(store, "settings.manage"), contactH.MarkRead)
			admin.DELETE("/contact/submissions/:id", middleware.RequirePermission(store, "settings.manage"), contactH.DeleteSubmission)

			// Users (view)
			admin.GET("/users", middleware.RequirePermission(store, "users.view"), authH.ListUsers)
			admin.GET("/users/stats", middleware.RequirePermission(store, "users.view"), authH.UserStats)

			// Customers
			admin.GET("/customers", middleware.RequirePermission(store, "customers.view"), authH.ListCustomers)
			admin.GET("/customers/stats", middleware.RequirePermission(store, "customers.view"), authH.CustomerStats)
			admin.GET("/customers/:id", middleware.RequirePermission(store, "customers.view"), authH.GetCustomer)
			admin.PUT("/customers/:id", middleware.RequirePermission(store, "customers.manage"), authH.UpdateCustomer)
			admin.DELETE("/customers/:id", middleware.RequirePermission(store, "customers.manage"), authH.DeleteCustomer)

			// Products
			admin.GET("/products/admin", middleware.RequirePermission(store, "products.view"), catalogH.ListProductsAdmin)
			admin.GET("/products/admin/:id", middleware.RequirePermission(store, "products.view"), catalogH.GetProductByID)
			admin.POST("/products", middleware.RequirePermission(store, "products.create"), catalogH.CreateProduct)
			admin.GET("/products/slug/:slug", middleware.RequirePermission(store, "products.view"), catalogH.GetProduct)
			admin.PUT("/products/:id", middleware.RequirePermission(store, "products.update"), catalogH.UpdateProduct)
			admin.DELETE("/products/:id", middleware.RequirePermission(store, "products.delete"), catalogH.DeleteProduct)

			// Categories
			admin.POST("/categories", middleware.RequirePermission(store, "categories.manage"), catalogH.CreateCategory)
			admin.PUT("/categories/:id", middleware.RequirePermission(store, "categories.manage"), catalogH.UpdateCategory)
			admin.DELETE("/categories/:id", middleware.RequirePermission(store, "categories.manage"), catalogH.DeleteCategory)

			// Attributes
			admin.POST("/attributes", middleware.RequirePermission(store, "attributes.manage"), catalogH.CreateAttribute)
			admin.PUT("/attributes/:id", middleware.RequirePermission(store, "attributes.manage"), catalogH.UpdateAttribute)
			admin.DELETE("/attributes/:id", middleware.RequirePermission(store, "attributes.manage"), catalogH.DeleteAttribute)

			// Offers
			admin.GET("/offers", middleware.RequirePermission(store, "offers.view"), catalogH.ListOffers)
			admin.GET("/offers/:id", middleware.RequirePermission(store, "offers.view"), catalogH.GetOffer)
			admin.POST("/offers", middleware.RequirePermission(store, "offers.manage"), catalogH.CreateOffer)
			admin.PUT("/offers/:id", middleware.RequirePermission(store, "offers.manage"), catalogH.UpdateOffer)
			admin.DELETE("/offers/:id", middleware.RequirePermission(store, "offers.manage"), catalogH.DeleteOffer)

			// Discounts
			admin.GET("/discounts", middleware.RequirePermission(store, "discounts.view"), catalogH.ListDiscountCodes)
			admin.GET("/discounts/stats", middleware.RequirePermission(store, "discounts.view"), catalogH.DiscountStats)
			admin.GET("/discounts/:id", middleware.RequirePermission(store, "discounts.view"), catalogH.GetDiscountCode)
			admin.POST("/discounts", middleware.RequirePermission(store, "discounts.manage"), catalogH.CreateDiscountCode)
			admin.PUT("/discounts/:id", middleware.RequirePermission(store, "discounts.manage"), catalogH.UpdateDiscountCode)
			admin.DELETE("/discounts/:id", middleware.RequirePermission(store, "discounts.manage"), catalogH.DeleteDiscountCode)

			// Inventory management
			admin.GET("/inventory", middleware.RequirePermission(store, "inventory.view"), inventoryH.ListInventory)
			admin.GET("/inventory/stats", middleware.RequirePermission(store, "inventory.view"), inventoryH.Stats)
			admin.POST("/inventory/adjust", middleware.RequirePermission(store, "inventory.adjust"), middleware.Idempotency(idemStore, "inventory_adjust"), inventoryH.AdjustStock)
			admin.GET("/inventory/movements", middleware.RequirePermission(store, "inventory.view"), inventoryH.ListStockMovements)

			// Vendor management
			admin.GET("/vendors", middleware.RequirePermission(store, "vendors.view"), vendorH.List)
			admin.GET("/vendors/:id", middleware.RequirePermission(store, "vendors.view"), vendorH.Get)
			admin.POST("/vendors", middleware.RequirePermission(store, "vendors.manage"), vendorH.Create)
			admin.PUT("/vendors/:id", middleware.RequirePermission(store, "vendors.manage"), vendorH.Update)
			admin.DELETE("/vendors/:id", middleware.RequirePermission(store, "vendors.manage"), vendorH.Delete)

			// Tax management
			admin.GET("/tax/classes", middleware.RequirePermission(store, "tax.view"), taxH.ListTaxClasses)
			admin.POST("/tax/classes", middleware.RequirePermission(store, "tax.manage"), taxH.CreateTaxClass)
			admin.PUT("/tax/classes/:classId", middleware.RequirePermission(store, "tax.manage"), taxH.UpdateTaxClass)
			admin.DELETE("/tax/classes/:classId", middleware.RequirePermission(store, "tax.manage"), taxH.DeleteTaxClass)
			admin.GET("/tax/zones", middleware.RequirePermission(store, "tax.view"), taxH.ListTaxZones)
			admin.POST("/tax/zones", middleware.RequirePermission(store, "tax.manage"), taxH.CreateTaxZone)
			admin.PUT("/tax/zones/:zoneId", middleware.RequirePermission(store, "tax.manage"), taxH.UpdateTaxZone)
			admin.DELETE("/tax/zones/:zoneId", middleware.RequirePermission(store, "tax.manage"), taxH.DeleteTaxZone)
			admin.GET("/tax/rates", middleware.RequirePermission(store, "tax.view"), taxH.ListTaxRates)
			admin.POST("/tax/rates", middleware.RequirePermission(store, "tax.manage"), taxH.CreateTaxRate)
			admin.PUT("/tax/rates/:rateId", middleware.RequirePermission(store, "tax.manage"), taxH.UpdateTaxRate)
			admin.DELETE("/tax/rates/:rateId", middleware.RequirePermission(store, "tax.manage"), taxH.DeleteTaxRate)

			// Shipping management
			admin.GET("/shipping/methods", middleware.RequirePermission(store, "shipping.view"), shippingH.ListShippingMethods)
			admin.POST("/shipping/methods", middleware.RequirePermission(store, "shipping.manage"), shippingH.CreateShippingMethod)
			admin.PUT("/shipping/methods/:methodId", middleware.RequirePermission(store, "shipping.manage"), shippingH.UpdateShippingMethod)
			admin.DELETE("/shipping/methods/:methodId", middleware.RequirePermission(store, "shipping.manage"), shippingH.DeleteShippingMethod)
			admin.GET("/shipping/zones", middleware.RequirePermission(store, "shipping.view"), shippingH.ListShippingZones)
			admin.POST("/shipping/zones", middleware.RequirePermission(store, "shipping.manage"), shippingH.CreateShippingZone)
			admin.PUT("/shipping/zones/:zoneId", middleware.RequirePermission(store, "shipping.manage"), shippingH.UpdateShippingZone)
			admin.DELETE("/shipping/zones/:zoneId", middleware.RequirePermission(store, "shipping.manage"), shippingH.DeleteShippingZone)
			admin.GET("/shipping/rates", middleware.RequirePermission(store, "shipping.view"), shippingH.ListShippingRates)
			admin.POST("/shipping/rates", middleware.RequirePermission(store, "shipping.manage"), shippingH.CreateShippingRate)
			admin.PUT("/shipping/rates/:rateId", middleware.RequirePermission(store, "shipping.manage"), shippingH.UpdateShippingRate)
			admin.DELETE("/shipping/rates/:rateId", middleware.RequirePermission(store, "shipping.manage"), shippingH.DeleteShippingRate)

			// Shipping provider management (Delhivery, etc.)
			admin.GET("/shipping/providers", middleware.RequirePermission(store, "shipping.view"), shippingProviderH.ListProviders)
			admin.POST("/shipping/providers", middleware.RequirePermission(store, "shipping.manage"), shippingProviderH.CreateProvider)
			admin.PUT("/shipping/providers/:id", middleware.RequirePermission(store, "shipping.manage"), shippingProviderH.UpdateProvider)
			admin.DELETE("/shipping/providers/:id", middleware.RequirePermission(store, "shipping.manage"), shippingProviderH.DeleteProvider)
			admin.POST("/shipping/providers/:id/test", middleware.RequirePermission(store, "shipping.manage"), shippingProviderH.TestProvider)
			admin.GET("/shipping/orders/:orderId/shipments", middleware.RequirePermission(store, "shipping.view"), shippingProviderH.ListOrderShipments)
			admin.POST("/shipping/orders/:orderId/shipments", middleware.RequirePermission(store, "shipping.manage"), middleware.Idempotency(idemStore, "shipment"), shippingProviderH.CreateOrderShipment)
			admin.POST("/shipping/shipments/:id/track", middleware.RequirePermission(store, "shipping.view"), shippingProviderH.TrackShipment)

			// Payment management
			admin.GET("/payments/transactions", middleware.RequirePermission(store, "payments.view"), paymentsH.ListTransactions)
			admin.GET("/payments/transactions/:txnId", middleware.RequirePermission(store, "payments.view"), paymentsH.GetTransaction)
			admin.GET("/payments/orders/:orderId/transactions", middleware.RequirePermission(store, "payments.view"), paymentsH.ListOrderTransactions)
			admin.POST("/payments/transactions/:txnId/refund", middleware.RequirePermission(store, "payments.manage"), middleware.Idempotency(idemStore, "refund"), paymentsH.RefundTransaction)
			admin.GET("/payments/gateways", middleware.RequirePermission(store, "payments.view"), paymentsH.ListGatewayConfigs)
			admin.PUT("/payments/gateways/:configId", middleware.RequirePermission(store, "payments.manage"), paymentsH.UpdateGatewayConfig)
			admin.GET("/payments/stats", middleware.RequirePermission(store, "payments.view"), paymentsH.Stats)

			// Wallet management (admin view of customer wallets)
			admin.GET("/wallet/stats", middleware.RequirePermission(store, "payments.view"), walletH.AdminStats)
			admin.GET("/wallet/all", middleware.RequirePermission(store, "payments.view"), walletH.AdminListAllTransactions)
			admin.GET("/wallet/:userId", middleware.RequirePermission(store, "customers.view"), walletH.AdminGetWallet)
			admin.GET("/wallet/:userId/transactions", middleware.RequirePermission(store, "customers.view"), walletH.AdminListTransactions)
			admin.POST("/wallet/:userId/adjust", middleware.RequirePermission(store, "customers.manage"), middleware.Idempotency(idemStore, "wallet_adjust"), walletH.AdminAdjust)

			// Bulk exports (async, CSV)
			admin.GET("/exports", exportH.ListExports)
			admin.GET("/exports/types", exportH.ListExportTypes)
			admin.GET("/exports/estimate", exportH.EstimateExportSize)
			admin.POST("/exports", middleware.Idempotency(idemStore, "export_create"), exportH.CreateExport)
			admin.GET("/exports/:id", exportH.GetExport)
			admin.GET("/exports/download/:id", exportH.DownloadExport)

			// Image upload (admin/staff)
			// Note: /upload/images is registered on the `authed` group (above) for
			// customer review photos and is accessible to admin/staff too, since the
			// admin group is a subset of authed. Only the singular /upload/image is
			// admin-only here.
			admin.POST("/upload/image", uploadH.UploadImage)

			// Permission management (business_admin + superadmin only)
			adminPerm := admin.Group("")
			adminPerm.Use(middleware.RequireRole(models.RoleSuperAdmin, models.RoleBusinessAdmin))
			{
				adminPerm.GET("/permissions", permH.ListPermissions)
				adminPerm.GET("/permissions/roles", permH.ListRolePermissions)
				adminPerm.GET("/permissions/roles/:role", permH.GetRolePermissions)
				adminPerm.PUT("/permissions/roles/:role", middleware.RequirePermission(store, "permissions.manage"), permH.SetRolePermissions)
				adminPerm.PUT("/permissions/roles/:role/toggle", middleware.RequirePermission(store, "permissions.manage"), permH.TogglePermission)
				adminPerm.POST("/permissions/seed", permH.SeedDefaults)
			}

			// Only business_admin + superadmin can manage staff/users/branches
			adminOnly := admin.Group("")
			adminOnly.Use(middleware.RequireRole(models.RoleSuperAdmin, models.RoleBusinessAdmin))
			{
				adminOnly.POST("/branches", middleware.RequirePermission(store, "branches.manage"), middleware.Idempotency(idemStore, "branch"), branchH.Create)
				adminOnly.PUT("/branches/:id", middleware.RequirePermission(store, "branches.manage"), branchH.Update)
				adminOnly.DELETE("/branches/:id", middleware.RequirePermission(store, "branches.manage"), branchH.Delete)
				adminOnly.PUT("/branches/:id/default", middleware.RequirePermission(store, "branches.manage"), branchH.SetDefault)

				adminOnly.POST("/users/staff", middleware.RequirePermission(store, "users.manage"), middleware.Idempotency(idemStore, "create_staff"), authH.CreateStaff)
				adminOnly.GET("/users/:id", middleware.RequirePermission(store, "users.view"), authH.GetUser)
				adminOnly.PUT("/users/:id", middleware.RequirePermission(store, "users.manage"), authH.UpdateUser)
				adminOnly.PUT("/users/:id/active", middleware.RequirePermission(store, "users.manage"), authH.SetUserActive)
				adminOnly.PUT("/users/:id/password", middleware.RequirePermission(store, "users.manage"), authH.ResetPassword)
				adminOnly.DELETE("/users/:id", middleware.RequirePermission(store, "users.manage"), authH.DeleteUser)
			}
		}
	}

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
		IdleTimeout:  cfg.IdleTimeout,
	}

	// Background goroutine: periodically auto-fulfill delivered orders whose
	// return periods have expired and have no active returns.
	go func() {
		ticker := time.NewTicker(6 * time.Hour)
		defer ticker.Stop()
		// Run once on startup, then periodically
		for {
			func() {
				ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
				defer cancel()
				if n, err := store.FulfillDeliveredOrders(ctx); err != nil {
					slog.Warn("auto-fulfill sweep failed", "err", err)
				} else if n > 0 {
					slog.Info("auto-fulfill sweep completed", "orders_fulfilled", n)
				}
			}()
			select {
			case <-ticker.C:
				continue
			case <-ctx.Done():
				return
			}
		}
	}()

	// Background goroutine: export worker — polls for pending export jobs and processes them.
	go func() {
		workerCtx := context.Background()
		store.StartExportWorker(workerCtx, cfg, emailH)
	}()

	go func() {
		slog.Info("server starting", "port", cfg.Port, "env", cfg.AppEnv)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server failed", "err", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.Info("shutting down...", "timeout", cfg.ShutdownTimeout)
	shutCtx, shutCancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer shutCancel()
	_ = srv.Shutdown(shutCtx)
	slog.Info("server stopped gracefully")
}
