package models

import (
	"time"

	"github.com/google/uuid"
)

type UUID = uuid.UUID

// Tenant
type Tenant struct {
	ID            UUID      `json:"id"`
	Slug          string    `json:"slug"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	IsActive      bool      `json:"is_active"`
	ContactEmail  string    `json:"contact_email"`
	ContactPhone  string    `json:"contact_phone"`
	Country       string    `json:"country"`
	City          string    `json:"city"`
	Address       string    `json:"address"`
	Plan          string    `json:"plan"`
	CommissionRate float64  `json:"commission_rate"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// Vendor represents a supplier/vendor associated with a tenant.
type Vendor struct {
	ID             UUID      `json:"id"`
	TenantID       UUID      `json:"tenant_id"`
	Name           string    `json:"name"`
	Slug           string    `json:"slug"`
	Email          string    `json:"email"`
	Phone          string    `json:"phone"`
	Address        string    `json:"address"`
	ContactPerson  string    `json:"contact_person"`
	CommissionRate float64   `json:"commission_rate"`
	Status         string    `json:"status"`
	Notes          string    `json:"notes"`
	ProductCount   int       `json:"product_count,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// StoreStats holds summary statistics for a tenant store (superadmin view).
type StoreStats struct {
	ProductCount  int     `json:"product_count"`
	OrderCount    int     `json:"order_count"`
	CustomerCount int     `json:"customer_count"`
	StaffCount    int     `json:"staff_count"`
	VendorCount   int     `json:"vendor_count"`
	Revenue       float64 `json:"revenue"`
}

// PlatformStats holds aggregate KPIs across all tenants (superadmin dashboard).
type PlatformStats struct {
	TenantCount       int            `json:"tenant_count"`
	ActiveTenants     int            `json:"active_tenants"`
	InactiveTenants   int            `json:"inactive_tenants"`
	TotalProducts     int            `json:"total_products"`
	TotalOrders       int            `json:"total_orders"`
	TotalCustomers    int            `json:"total_customers"`
	TotalStaff        int            `json:"total_staff"`
	TotalVendors      int            `json:"total_vendors"`
	TotalRevenue      float64        `json:"total_revenue"`
	OrdersByStatus    map[string]int  `json:"orders_by_status"`
	TenantsByPlan     map[string]int  `json:"tenants_by_plan"`
	TopTenants        []TenantKPI     `json:"top_tenants"`
	RecentOrders      []PlatformOrder `json:"recent_orders"`
	NewTenantsThisMonth int           `json:"new_tenants_this_month"`
}

// TenantKPI is a per-tenant KPI snapshot for the platform dashboard.
type TenantKPI struct {
	TenantID   uuid.UUID `json:"tenant_id"`
	Slug       string    `json:"slug"`
	Name       string    `json:"name"`
	IsActive   bool      `json:"is_active"`
	Plan       string    `json:"plan"`
	Orders     int       `json:"orders"`
	Products   int       `json:"products"`
	Customers  int       `json:"customers"`
	Revenue    float64   `json:"revenue"`
}

// PlatformOrder is a cross-tenant recent order for the platform dashboard.
type PlatformOrder struct {
	ID         uuid.UUID `json:"id"`
	TenantID   uuid.UUID `json:"tenant_id"`
	TenantSlug string    `json:"tenant_slug"`
	TenantName string    `json:"tenant_name"`
	Status     string    `json:"status"`
	Total      float64   `json:"total"`
	Currency   string    `json:"currency"`
	CreatedAt  time.Time `json:"created_at"`
}

// CustomerWallet holds the wallet balance for a customer in a tenant.
type CustomerWallet struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	UserID      uuid.UUID `json:"user_id"`
	Balance     float64   `json:"balance"`
	CurrencyCode string   `json:"currency_code"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// WalletTransaction records a single credit or debit on a customer wallet.
type WalletTransaction struct {
	ID           uuid.UUID  `json:"id"`
	TenantID     uuid.UUID  `json:"tenant_id"`
	WalletID     uuid.UUID  `json:"wallet_id"`
	UserID       uuid.UUID  `json:"user_id"`
	OrderID      *uuid.UUID `json:"order_id,omitempty"`
	PaymentTxnID *uuid.UUID `json:"payment_txn_id,omitempty"`
	Type         string     `json:"type"`       // "credit" | "debit"
	Source       string     `json:"source"`     // "topup" | "purchase" | "refund" | "admin_adjustment"
	Amount       float64    `json:"amount"`
	BalanceAfter float64    `json:"balance_after"`
	CurrencyCode string     `json:"currency_code"`
	Description  string     `json:"description"`
	Reference    string     `json:"reference,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}

// WalletTopupRequest is the request body for topping up a wallet via a payment gateway.
type WalletTopupRequest struct {
	Amount         float64         `json:"amount" binding:"required"`
	PaymentMethod  string          `json:"payment_method" binding:"required"`
	PaymentDetails *PaymentDetails `json:"payment_details,omitempty"`
	CurrencyCode   string          `json:"currency_code,omitempty"`
}

// WalletAdjustRequest is the request body for an admin wallet adjustment.
type WalletAdjustRequest struct {
	Amount      float64 `json:"amount" binding:"required"` // positive = credit, negative = debit
	Description string  `json:"description,omitempty"`
}

type TenantSettings struct {
	TenantID            UUID   `json:"tenant_id"`
	DefaultCurrencyID   *UUID  `json:"default_currency_id,omitempty"`
	DefaultLanguage     string `json:"default_language"`
	SupportedLanguages  []string `json:"supported_languages"`
	BrandColor          string `json:"brand_color"`
	LogoURL             string `json:"logo_url"`
	LandingPageEnabled  bool   `json:"landing_page_enabled"`
	LandingPageContent  *LandingPageContent `json:"landing_page_content,omitempty"`
	// Tax settings
	TaxInclusive        bool   `json:"tax_inclusive"`
	TaxShipping         bool   `json:"tax_shipping"`
	DefaultTaxClassID   *UUID  `json:"default_tax_class_id,omitempty"`
	// Checkout settings
	AnonymousCheckout   bool   `json:"anonymous_checkout"`
	// Return / refund / replacement policy switch + validity (days from delivery)
	ReturnsEnabled        bool `json:"returns_enabled"`
	ReturnPeriodDays      int `json:"return_period_days"`
	RefundPeriodDays      int `json:"refund_period_days"`
	ReplacementPeriodDays int `json:"replacement_period_days"`

	// SEO / AEO store-level defaults
	MetaTitle       string   `json:"meta_title"`
	MetaDescription string   `json:"meta_description"`
	OGImage         string   `json:"og_image"`
	SiteURL         string   `json:"site_url"`
	SocialLinks     []string `json:"social_links"`

	// Delivery service area — circle range + named areas, configurable in the backoffice.
	ServiceArea *ServiceArea `json:"service_area,omitempty"`
}

// ServiceArea configures where the store delivers. A customer location is
// serviceable when it falls inside the circle (center + radius) or matches
// one of the named areas.
type ServiceArea struct {
	Enabled   bool     `json:"enabled"`
	Label     string   `json:"label"`
	State     string   `json:"state"`
	Country   string   `json:"country"`
	CenterLat float64  `json:"center_lat"`
	CenterLng float64  `json:"center_lng"`
	RadiusKm  float64  `json:"radius_km"`
	Areas     []string `json:"areas"`
}

// ServiceZone is one concentric delivery ring of a branch's service area.
// Zones are stored sorted by RadiusKm ascending; a delivery at distance d is
// charged by the first zone whose RadiusKm >= d. ChargeType is "free", "flat"
// or "per_km"; Charge is the flat amount or the per-km rate (for per_km, the
// rate applies to the distance beyond the previous zone's outer radius).
type ServiceZone struct {
	RadiusKm   float64 `json:"radius_km"`
	ChargeType string  `json:"charge_type"` // free | flat | per_km
	Charge     float64 `json:"charge"`
	Label      string  `json:"label,omitempty"`
}

// Branch is a physical outlet of the store. Each branch defines its own
// delivery service area (a circle plus a list of named areas). When at least
// one active branch exists, orders are only accepted inside a branch's
// service area and are assigned to the nearest covering branch.
type Branch struct {
	ID           UUID          `json:"id"`
	TenantID     UUID          `json:"tenant_id"`
	Name         string        `json:"name"`
	Slug         string        `json:"slug"`
	Phone        string        `json:"phone"`
	Email        string        `json:"email"`
	Line1        string        `json:"line1"`
	Line2        string        `json:"line2"`
	City         string        `json:"city"`
	State        string        `json:"state"`
	PostalCode   string        `json:"postal_code"`
	Country      string        `json:"country"`
	CenterLat    float64       `json:"center_lat"`
	CenterLng    float64       `json:"center_lng"`
	RadiusKm     float64       `json:"radius_km"`
	ServiceZones []ServiceZone `json:"service_zones"`
	Areas        []string      `json:"areas"`
	IsActive     bool          `json:"is_active"`
	IsDefault    bool          `json:"is_default"`
	SortOrder    int           `json:"sort_order"`
	CreatedAt    time.Time     `json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
}

// BranchStock is the optional per-branch stock overlay for a product or
// variant. When a row exists for (branch, product[, variant]) it is enforced
// at checkout; otherwise the item draws from shared store-level stock.
type BranchStock struct {
	ID         UUID      `json:"id"`
	TenantID   UUID      `json:"tenant_id"`
	BranchID   UUID      `json:"branch_id"`
	ProductID  UUID      `json:"product_id"`
	VariantID  *UUID     `json:"variant_id,omitempty"`
	Stock      int       `json:"stock"`
	UpdatedAt  time.Time `json:"updated_at"`
	// Joined fields for admin display
	ProductName string `json:"product_name,omitempty"`
	VariantName string `json:"variant_name,omitempty"`
}

// TenantSMTPSettings holds per-tenant SMTP configuration for transactional emails.
// When Enabled is false or Host is empty, the platform-level SMTP env vars are used.
type TenantSMTPSettings struct {
	TenantID   UUID   `json:"tenant_id"`
	Host       string `json:"host"`
	Port       int    `json:"port"`
	Username   string `json:"username"`
	Password   string `json:"password,omitempty"` // masked in GET responses unless ?include_secrets=true
	FromEmail  string `json:"from_email"`
	FromName   string `json:"from_name"`
	Encryption string `json:"encryption"` // none | ssl | starttls
	Enabled    bool   `json:"enabled"`
	CreatedAt  string `json:"created_at"`
	UpdatedAt  string `json:"updated_at"`
}

// LandingPageContent holds configurable content for the store landing page.
type LandingPageContent struct {
	// Hero section
	HeroTitle       string `json:"hero_title"`
	HeroSubtitle    string `json:"hero_subtitle"`
	HeroButtonText  string `json:"hero_button_text"`
	HeroImageURL    string `json:"hero_image_url"`

	// Features section (up to 6 features)
	Features []LandingFeature `json:"features"`

	// Promo/banner section
	PromoTitle    string `json:"promo_title"`
	PromoText     string `json:"promo_text"`
	PromoImageURL string `json:"promo_image_url"`

	// Testimonials section
	Testimonials []LandingTestimonial `json:"testimonials"`

	// CTA section
	CTATitle      string `json:"cta_title"`
	CTAText       string `json:"cta_text"`
	CTAButtonText string `json:"cta_button_text"`

	// Section visibility toggles
	ShowFeatures         bool `json:"show_features"`
	ShowPromo            bool `json:"show_promo"`
	ShowTestimonials     bool `json:"show_testimonials"`
	ShowCTA              bool `json:"show_cta"`
	ShowFeaturedProducts bool `json:"show_featured_products"`

	// ---- Extended CMS sections ----

	// Brand marquee
	ShowMarquee bool     `json:"show_marquee"`
	MarqueeBrands []string `json:"marquee_brands"`

	// Fashion philosophy
	ShowPhilosophy    bool   `json:"show_philosophy"`
	PhilosophyTitle   string `json:"philosophy_title"`
	PhilosophyText1   string `json:"philosophy_text1"`
	PhilosophyText2   string `json:"philosophy_text2"`
	PhilosophyBadge   string `json:"philosophy_badge"`

	// Brand story
	ShowBrandStory    bool              `json:"show_brand_story"`
	BrandStory        *BrandStoryContent `json:"brand_story,omitempty"`

	// Lookbook
	ShowLookbook  bool                 `json:"show_lookbook"`
	Lookbook      *LookbookContent     `json:"lookbook,omitempty"`

	// Trend report
	ShowTrendReport bool               `json:"show_trend_report"`
	TrendReport     *TrendReportContent `json:"trend_report,omitempty"`

	// Sustainability
	ShowSustainability bool                   `json:"show_sustainability"`
	Sustainability     *SustainabilityContent `json:"sustainability,omitempty"`

	// Style guide
	ShowStyleGuide bool               `json:"show_style_guide"`
	StyleGuide     *StyleGuideContent `json:"style_guide,omitempty"`

	// Stats
	ShowStats bool             `json:"show_stats"`
	Stats     *StatsContent    `json:"stats,omitempty"`

	// Fashion journal
	ShowJournal bool              `json:"show_journal"`
	Journal     *JournalContent   `json:"journal,omitempty"`

	// Instagram gallery
	ShowInstagram bool               `json:"show_instagram"`
	Instagram     *InstagramContent `json:"instagram,omitempty"`

	// FAQ
	ShowFAQ bool         `json:"show_faq"`
	FAQ     *FAQContent  `json:"faq,omitempty"`

	// Newsletter
	ShowNewsletter bool               `json:"show_newsletter"`
	Newsletter     *NewsletterContent `json:"newsletter,omitempty"`

	// Trust badges
	ShowTrustBadges bool                 `json:"show_trust_badges"`
	TrustBadges     []TrustBadgeContent  `json:"trust_badges,omitempty"`

	// Loading splash / animation shown while the landing page boots
	Splash *SplashContent `json:"splash,omitempty"`
}

// SplashContent configures the landing page loading animation.
type SplashContent struct {
	Enabled       bool   `json:"enabled"`
	Style         string `json:"style"`          // rings | spinner | pulse | dots | bars
	Background    string `json:"background"`     // waves | orbs | none
	Subtitle      string `json:"subtitle"`       // text shown under store name
	ShowLogo      bool   `json:"show_logo"`      // show store initials tile
	ShowProgress  bool   `json:"show_progress"`  // show progress bar
	ShowDots      bool   `json:"show_dots"`      // show bouncing dots
}

type BrandStoryContent struct {
	Title     string   `json:"title"`
	Text1     string   `json:"text1"`
	Text2     string   `json:"text2"`
	ImageURL  string   `json:"image_url"`
	StatValue string   `json:"stat_value"`
	StatLabel string   `json:"stat_label"`
	Tags      []string `json:"tags"`
}

type LookbookContent struct {
	Title    string             `json:"title"`
	Subtitle string             `json:"subtitle"`
	Items    []LookbookItem     `json:"items"`
}

type LookbookItem struct {
	ImageURL string `json:"image_url"`
	Category string `json:"category"`
	Title    string `json:"title"`
}

type TrendReportContent struct {
	Title    string         `json:"title"`
	Subtitle string         `json:"subtitle"`
	Trends   []TrendItem    `json:"trends"`
}

type TrendItem struct {
	Number string `json:"number"`
	Title  string `json:"title"`
	Text   string `json:"text"`
}

type SustainabilityContent struct {
	Title    string            `json:"title"`
	Subtitle string            `json:"subtitle"`
	Values   []SustainabilityValue `json:"values"`
}

type SustainabilityValue struct {
	Icon  string `json:"icon"`
	Title string `json:"title"`
	Text  string `json:"text"`
}

type StyleGuideContent struct {
	Title    string             `json:"title"`
	Subtitle string             `json:"subtitle"`
	Articles []StyleGuideArticle `json:"articles"`
}

type StyleGuideArticle struct {
	ImageURL  string `json:"image_url"`
	Category  string `json:"category"`
	Title     string `json:"title"`
	Text1     string `json:"text1"`
	Text2     string `json:"text2"`
}

type StatsContent struct {
	Title string       `json:"title"`
	Items []StatsItem  `json:"items"`
}

type StatsItem struct {
	Value  int    `json:"value"`
	Suffix string `json:"suffix"`
	Label  string `json:"label"`
}

type JournalContent struct {
	Title    string           `json:"title"`
	Subtitle string           `json:"subtitle"`
	Articles []JournalArticle `json:"articles"`
}

type JournalArticle struct {
	ImageURL  string `json:"image_url"`
	Category  string `json:"category"`
	ReadTime  string `json:"read_time"`
	Title     string `json:"title"`
	Text      string `json:"text"`
	Featured  bool   `json:"featured"`
}

type InstagramContent struct {
	Handle   string   `json:"handle"`
	Title    string   `json:"title"`
	Subtitle string   `json:"subtitle"`
	Images   []string `json:"images"`
}

type FAQContent struct {
	Title    string     `json:"title"`
	Subtitle string     `json:"subtitle"`
	Items    []FAQItem  `json:"items"`
}

type FAQItem struct {
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

type NewsletterContent struct {
	Badge       string `json:"badge"`
	Title       string `json:"title"`
	Subtitle    string `json:"subtitle"`
	Placeholder string `json:"placeholder"`
	ButtonText  string `json:"button_text"`
	Disclaimer  string `json:"disclaimer"`
}

type TrustBadgeContent struct {
	Icon    string `json:"icon"`
	Title   string `json:"title"`
	Subtext string `json:"subtext"`
}

type LandingFeature struct {
	Icon  string `json:"icon"`
	Title string `json:"title"`
	Text  string `json:"text"`
}

type LandingTestimonial struct {
	Name   string `json:"name"`
	Role   string `json:"role"`
	Text   string `json:"text"`
	Rating int    `json:"rating"`
}

type Currency struct {
	ID        UUID     `json:"id"`
	Code      string   `json:"code"`
	Name      string   `json:"name"`
	Symbol    string   `json:"symbol"`
	Decimals  int      `json:"decimals"`
	IsActive  bool     `json:"is_active"`
	// Rate is the USD->code exchange rate (units of this currency per 1 USD).
	// Convert an amount in currency A to currency B with: amount / A.rate * B.rate.
	Rate      float64  `json:"rate"`
}

type ExchangeRate struct {
	BaseCode  string    `json:"base_code"`
	QuoteCode string    `json:"quote_code"`
	Rate      float64   `json:"rate"`
	FetchedAt time.Time `json:"fetched_at"`
}

type Language struct {
	Code     string `json:"code"`
	Name     string `json:"name"`
	IsActive bool   `json:"is_active"`
}

// Auth
type UserRole string

const (
	RoleSuperAdmin      UserRole = "superadmin"
	RoleBusinessAdmin   UserRole = "business_admin"
	RoleBranchManager   UserRole = "branch_manager"
	RoleStaff           UserRole = "staff"
	RoleCustomer        UserRole = "customer"
	RoleDeliveryPartner UserRole = "delivery_partner"
)

type User struct {
	ID               UUID       `json:"id"`
	TenantID         *UUID      `json:"tenant_id,omitempty"`
	BranchID         *UUID      `json:"branch_id,omitempty"`
	BranchName       string     `json:"branch_name,omitempty"` // joined for admin lists
	Email            string     `json:"email"`
	PasswordHash     string     `json:"-"`
	FullName         string     `json:"full_name"`
	Role             UserRole   `json:"role"`
	IsActive         bool       `json:"is_active"`
	Phone            string     `json:"phone"`
	MarketingConsent bool       `json:"marketing_consent"`
	AdminNotes       string     `json:"admin_notes"`
	LastLoginAt      *time.Time `json:"last_login_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	// Delivery partner branch allocations (delivery_partner_branches join
	// table). Populated for delivery_partner users on user read/list calls.
	BranchIDs   []UUID   `json:"branch_ids,omitempty"`
	BranchNames []string `json:"branch_names,omitempty"`
	// ActiveDeliveries counts the partner's in-flight orders (ready+shipped).
	// Populated by ListDeliveryPartners only.
	ActiveDeliveries int `json:"active_deliveries"`
}

// UserStats holds role-based user counts for a tenant.
type UserStats struct {
	Total            int `json:"total"`
	Customers        int `json:"customers"`
	Staff            int `json:"staff"`
	Admins           int `json:"admins"`
	DeliveryPartners int `json:"delivery_partners"`
	Active           int `json:"active"`
	Inactive         int `json:"inactive"`
}

// Permission represents a granular permission in the catalog.
type Permission struct {
	ID          UUID      `json:"id"`
	Code        string    `json:"code"`
	Module      string    `json:"module"`
	Action      string    `json:"action"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

// RolePermission maps a role to a permission for a specific tenant.
type RolePermission struct {
	ID           UUID      `json:"id"`
	TenantID     UUID      `json:"tenant_id"`
	Role         UserRole  `json:"role"`
	PermissionID UUID      `json:"permission_id"`
	Granted      bool      `json:"granted"`
	CreatedAt    time.Time `json:"created_at"`
	// Joined fields for convenience
	PermissionCode        string `json:"permission_code,omitempty"`
	PermissionModule      string `json:"permission_module,omitempty"`
	PermissionDescription string `json:"permission_description,omitempty"`
}

// CustomerDetail is a customer with aggregated data for the backoffice.
type CustomerDetail struct {
	User
	OrderCount    int      `json:"order_count"`
	TotalSpent    float64  `json:"total_spent"`
	Addresses     []Address `json:"addresses"`
}

// CustomerStats holds summary statistics for the backoffice dashboard.
type CustomerStats struct {
	TotalCustomers  int     `json:"total_customers"`
	ActiveCustomers int     `json:"active_customers"`
	NewThisMonth    int     `json:"new_this_month"`
	TotalSpent      float64 `json:"total_spent"`
	AvgOrderValue   float64 `json:"avg_order_value"`
}

type StaffRole struct {
	ID         UUID     `json:"id"`
	TenantID   UUID     `json:"tenant_id"`
	UserID     UUID     `json:"user_id"`
	RoleName   string   `json:"role_name"`
	Permissions []string `json:"permissions"`
}

// Catalog
type Category struct {
	ID          UUID      `json:"id"`
	TenantID    UUID      `json:"tenant_id"`
	ParentID    *UUID     `json:"parent_id,omitempty"`
	ParentName  string    `json:"parent_name,omitempty"` // joined display name (paginated admin list)
	Slug        string    `json:"slug"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	SortOrder   int       `json:"sort_order"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Children    []Category `json:"children,omitempty"`

	// SEO / AEO fields (empty → fall back to name/description)
	MetaTitle       string `json:"meta_title"`
	MetaDescription string `json:"meta_description"`
}

type Attribute struct {
	ID           UUID               `json:"id"`
	TenantID     UUID               `json:"tenant_id"`
	Slug         string             `json:"slug"`
	Name         string             `json:"name"`
	Type         string             `json:"type"`
	IsFilterable bool               `json:"is_filterable"`
	IsVariant    bool               `json:"is_variant"`
	IsBatch      bool               `json:"is_batch"`
	IsInternal   bool               `json:"is_internal"`
	Options      []AttributeOption  `json:"options,omitempty"`
}

type AttributeOption struct {
	ID          UUID   `json:"id"`
	AttributeID UUID   `json:"attribute_id"`
	Value       string `json:"value"`
	Label       string `json:"label"`
	SortOrder   int    `json:"sort_order"`
}

type ProductAttributeValue struct {
	AttributeID  UUID    `json:"attribute_id"`
	AttributeSlug string `json:"attribute_slug"`
	AttributeName string `json:"attribute_name"`
	ValueText    *string `json:"value_text,omitempty"`
	ValueNumber  *float64 `json:"value_number,omitempty"`
	ValueBool    *bool   `json:"value_bool,omitempty"`
	OptionID     *UUID   `json:"option_id,omitempty"`
	OptionLabel  *string `json:"option_label,omitempty"`
}

type ProductImage struct {
	ID        UUID   `json:"id"`
	ProductID UUID   `json:"product_id"`
	URL       string `json:"url"`
	Alt       string `json:"alt"`
	SortOrder int    `json:"sort_order"`
}

type Variant struct {
	ID        UUID      `json:"id"`
	ProductID UUID      `json:"product_id"`
	SKU       string    `json:"sku"`
	Name      string    `json:"name"`
	Price     float64   `json:"price"`
	Stock     int       `json:"stock"`
	ImageURL  string    `json:"image_url"`
	IsActive  bool      `json:"is_active"`
	Attributes []VariantAttr `json:"attributes,omitempty"`
}

type VariantAttr struct {
	AttributeSlug string `json:"attribute_slug"`
	AttributeName string `json:"attribute_name"`
	OptionValue   string `json:"option_value"`
	OptionLabel   string `json:"option_label"`
}

type Product struct {
	ID           UUID      `json:"id"`
	TenantID     UUID      `json:"tenant_id"`
	CategoryID   *UUID     `json:"category_id,omitempty"`
	CategorySlug string    `json:"category_slug,omitempty"`
	// BranchID scopes the product to a single branch; NULL = all branches.
	BranchID     *UUID     `json:"branch_id,omitempty"`
	BranchName   string    `json:"branch_name,omitempty"` // joined for admin display
	Slug         string    `json:"slug"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	SKU          string    `json:"sku"`
	Status       string    `json:"status"`
	BasePrice    float64   `json:"base_price"`
	CurrencyCode string    `json:"currency_code"`
	IsFeatured   bool      `json:"is_featured"`
	Rating       float64   `json:"rating"`
	Stock        int       `json:"stock"`
	LowStockThreshold int  `json:"low_stock_threshold"`
	TrackInventory  bool   `json:"track_inventory"`
	RequiresShipping bool  `json:"requires_shipping"`
	VendorID      *UUID     `json:"vendor_id,omitempty"`
	ImageURL     string    `json:"image_url"`
	Images       []ProductImage `json:"images,omitempty"`
	Variants     []Variant `json:"variants,omitempty"`
	Attributes   []ProductAttributeValue `json:"attributes,omitempty"`
	TaxClassID   *UUID     `json:"tax_class_id,omitempty"`
	// Per-product shipping settings
	Weight       float64 `json:"weight"`        // kilograms
	Length       float64 `json:"length"`        // centimeters
	Width        float64 `json:"width"`         // centimeters
	Height       float64 `json:"height"`        // centimeters
	FreeShipping bool    `json:"free_shipping"` // per-product free shipping override
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`

	// Per-product return / refund / replacement period overrides (nullable → tenant default)
	ReturnPeriodDays      *int `json:"return_period_days,omitempty"`
	RefundPeriodDays      *int `json:"refund_period_days,omitempty"`
	ReplacementPeriodDays *int `json:"replacement_period_days,omitempty"`

	// Per-product return type toggles (nullable → default: enabled)
	ReturnEnabled      *bool `json:"return_enabled,omitempty"`
	RefundEnabled      *bool `json:"refund_enabled,omitempty"`
	ReplacementEnabled *bool `json:"replacement_enabled,omitempty"`

	// SEO / AEO fields (empty → fall back to name/description/image_url)
	MetaTitle       string `json:"meta_title"`
	MetaDescription string `json:"meta_description"`
	OGImage         string `json:"og_image"`

	// Computed for storefront
	EffectivePrice float64 `json:"effective_price,omitempty"`
	DiscountedPrice float64 `json:"discounted_price,omitempty"`
	DiscountPct    float64 `json:"discount_pct,omitempty"`
}

// StockMovement records a change in stock for a product or variant.
type StockMovement struct {
	ID           UUID      `json:"id"`
	TenantID     UUID      `json:"tenant_id"`
	ProductID    UUID      `json:"product_id"`
	ProductName  string    `json:"product_name"`
	VariantID    *UUID     `json:"variant_id,omitempty"`
	VariantName  string    `json:"variant_name,omitempty"`
	MovementType string    `json:"movement_type"`
	Quantity     int       `json:"quantity"`
	Reason       string    `json:"reason,omitempty"`
	Reference    string    `json:"reference,omitempty"`
	CreatedBy    *UUID     `json:"created_by,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

// InventoryItem represents a stock record for the inventory management view.
type InventoryItem struct {
	ProductID         UUID   `json:"product_id"`
	ProductName       string `json:"product_name"`
	ProductSlug       string `json:"product_slug"`
	SKU               string `json:"sku"`
	VariantID         *UUID  `json:"variant_id,omitempty"`
	VariantName       string `json:"variant_name,omitempty"`
	Stock             int    `json:"stock"`
	BranchManaged     bool   `json:"branch_managed,omitempty"` // stock comes from a branch_stock row
	LowStockThreshold int    `json:"low_stock_threshold"`
	TrackInventory    bool   `json:"track_inventory"`
	IsLowStock        bool   `json:"is_low_stock"`
	IsOutOfStock      bool   `json:"is_out_of_stock"`
}

// InventoryStats holds summary statistics for the inventory dashboard.
type InventoryStats struct {
	TotalSKUs      int `json:"total_skus"`
	OutOfStock     int `json:"out_of_stock"`
	LowStock       int `json:"low_stock"`
	InStock        int `json:"in_stock"`
	TotalStockValue float64 `json:"total_stock_value"`
}

// Offers & discounts
type Offer struct {
	ID          UUID       `json:"id"`
	TenantID    UUID       `json:"tenant_id"`
	BranchID    *UUID      `json:"branch_id,omitempty"` // NULL = applies at all branches
	Name        string     `json:"name"`
	Description string     `json:"description"`
	OfferType   string     `json:"offer_type"`
	Value       float64    `json:"value"`
	StartsAt    *time.Time `json:"starts_at,omitempty"`
	EndsAt      *time.Time `json:"ends_at,omitempty"`
	IsActive    bool       `json:"is_active"`
	Targets     []OfferTarget `json:"targets,omitempty"`
}

type OfferTarget struct {
	TargetType string `json:"target_type"`
	TargetID   *UUID  `json:"target_id,omitempty"`
}

type DiscountCode struct {
	ID           UUID       `json:"id"`
	TenantID     UUID       `json:"tenant_id"`
	BranchID     *UUID      `json:"branch_id,omitempty"` // NULL = valid at all branches
	Code         string     `json:"code"`
	Description  string     `json:"description"`
	DiscountType string     `json:"discount_type"`
	Value        float64    `json:"value"`
	MinSubtotal  float64    `json:"min_subtotal"`
	MaxUses      *int       `json:"max_uses,omitempty"`
	UsedCount    int        `json:"used_count"`
	StartsAt     *time.Time `json:"starts_at,omitempty"`
	EndsAt       *time.Time `json:"ends_at,omitempty"`
	IsActive     bool       `json:"is_active"`
}

// ---------------- Tax module ----------------

type TaxClass struct {
	ID          UUID      `json:"id"`
	TenantID    UUID      `json:"tenant_id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	IsDefault   bool      `json:"is_default"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type TaxZone struct {
	ID                UUID      `json:"id"`
	TenantID          UUID      `json:"tenant_id"`
	Name              string    `json:"name"`
	CountryCode       string    `json:"country_code,omitempty"`
	StateCode         string    `json:"state_code,omitempty"`
	City              string    `json:"city,omitempty"`
	PostalCodePattern string    `json:"postal_code_pattern,omitempty"`
	IsActive          bool      `json:"is_active"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type TaxRate struct {
	ID            UUID       `json:"id"`
	TenantID      UUID       `json:"tenant_id"`
	TaxClassID    UUID       `json:"tax_class_id"`
	TaxZoneID     UUID       `json:"tax_zone_id"`
	Name          string     `json:"name"`
	Rate          float64    `json:"rate"` // percentage, e.g., 7.25 = 7.25%
	Compound      bool       `json:"compound"`
	Priority      int        `json:"priority"`
	IsActive      bool       `json:"is_active"`
	EffectiveFrom *time.Time `json:"effective_from,omitempty"`
	EffectiveTo   *time.Time `json:"effective_to,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	// Joined fields (optional, for display)
	TaxClassName string `json:"tax_class_name,omitempty"`
	TaxZoneName  string `json:"tax_zone_name,omitempty"`
}

// TaxBreakdownLine represents one line of a calculated tax breakdown.
type TaxBreakdownLine struct {
	TaxRateID    UUID    `json:"tax_rate_id"`
	TaxClassName string  `json:"tax_class_name"`
	TaxZoneName  string  `json:"tax_zone_name"`
	RateName     string  `json:"rate_name"`
	Rate         float64 `json:"rate"`
	TaxableAmount float64 `json:"taxable_amount"`
	TaxAmount    float64 `json:"tax_amount"`
	Compound     bool    `json:"compound"`
}

// TaxCalculationResult holds the result of a tax calculation for a cart/checkout.
type TaxCalculationResult struct {
	TaxTotal   float64            `json:"tax_total"`
	Breakdown  []TaxBreakdownLine  `json:"breakdown"`
	TaxInclusive bool             `json:"tax_inclusive"`
}

// TaxCalculationRequest is the input for tax calculation.
type TaxCalculationRequest struct {
	Items          []TaxCalculationItem `json:"items"`
	ShippingAddress AddressInput         `json:"shipping_address"`
	ShippingTotal  float64              `json:"shipping_total"`
	DiscountTotal  float64              `json:"discount_total"`
}

// TaxCalculationItem represents a single line item for tax calculation.
type TaxCalculationItem struct {
	ProductID   UUID    `json:"product_id"`
	ProductName string  `json:"product_name"`
	Quantity    int     `json:"quantity"`
	UnitPrice   float64 `json:"unit_price"`
	LineTotal   float64 `json:"line_total"`
	TaxClassID  *UUID   `json:"tax_class_id,omitempty"`
}

// Cart & orders
type Cart struct {
	ID           UUID       `json:"id"`
	TenantID     UUID       `json:"tenant_id"`
	UserID       *UUID      `json:"user_id,omitempty"`
	SessionID    string     `json:"session_id"`
	CurrencyCode string     `json:"currency_code"`
	Items        []CartItem `json:"items,omitempty"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type CartItem struct {
	ID         UUID    `json:"id"`
	ProductID  UUID    `json:"product_id"`
	VariantID  *UUID   `json:"variant_id,omitempty"`
	ProductName string `json:"product_name"`
	VariantName string `json:"variant_name,omitempty"`
	ImageURL   string  `json:"image_url"`
	Quantity   int     `json:"quantity"`
	UnitPrice  float64 `json:"unit_price"`
	LineTotal  float64 `json:"line_total"`
	TaxClassID *UUID   `json:"tax_class_id,omitempty"`
	// Shipping-related fields (populated from product)
	RequiresShipping bool    `json:"requires_shipping"`
	Weight           float64 `json:"weight"`        // per-unit weight in kg
	FreeShipping     bool    `json:"free_shipping"` // per-product free shipping override
}

// Wishlist
type Wishlist struct {
	ID        UUID            `json:"id"`
	TenantID  UUID            `json:"tenant_id"`
	UserID    *UUID           `json:"user_id,omitempty"`
	SessionID string          `json:"session_id"`
	Items     []WishlistItem  `json:"items,omitempty"`
}

type WishlistItem struct {
	ID         UUID    `json:"id"`
	ProductID  UUID    `json:"product_id"`
	VariantID  *UUID   `json:"variant_id,omitempty"`
	ProductName string `json:"product_name"`
	ImageURL   string  `json:"image_url"`
	Slug       string  `json:"slug"`
	BasePrice  float64 `json:"base_price"`
	AddedAt    time.Time `json:"added_at"`
}

// Review
type Review struct {
	ID          UUID          `json:"id"`
	TenantID    UUID          `json:"tenant_id"`
	ProductID   UUID          `json:"product_id"`
	UserID      *UUID         `json:"user_id,omitempty"`
	AuthorName  string        `json:"author_name"`
	Rating      int           `json:"rating"`
	Title       string        `json:"title"`
	Body        string        `json:"body"`
	IsVerified  bool          `json:"is_verified"`
	IsApproved  bool          `json:"is_approved"`
	CreatedAt   time.Time     `json:"created_at"`
	Images      []ReviewImage `json:"images,omitempty"`
	// Populated by admin listings via a products join (not stored on the row).
	ProductName  string `json:"product_name,omitempty"`
	ProductSlug  string `json:"product_slug,omitempty"`
	ProductImage string `json:"product_image,omitempty"`
}

type ReviewImage struct {
	ID        UUID   `json:"id"`
	ReviewID  UUID   `json:"review_id"`
	URL       string `json:"url"`
	Alt       string `json:"alt"`
	SortOrder int    `json:"sort_order"`
}

// PurchasedProduct is a product the customer has bought, with review status.
type PurchasedProduct struct {
	ProductID    UUID       `json:"product_id"`
	Slug         string     `json:"slug"`
	Name         string     `json:"name"`
	ImageURL     string     `json:"image_url"`
	OrderID      UUID       `json:"order_id"`
	OrderDate    time.Time  `json:"order_date"`
	OrderStatus  string     `json:"order_status"`
	HasReviewed  bool       `json:"has_reviewed"`
	// Return eligibility (computed from delivered_at + product/tenant period settings)
	DeliveredAt          *time.Time `json:"delivered_at,omitempty"`
	ReturnEligible       bool       `json:"return_eligible"`
	RefundEligible       bool       `json:"refund_eligible"`
	ReplacementEligible  bool       `json:"replacement_eligible"`
	ReturnExpiresAt      *time.Time `json:"return_expires_at,omitempty"`
	RefundExpiresAt      *time.Time `json:"refund_expires_at,omitempty"`
	ReplacementExpiresAt *time.Time `json:"replacement_expires_at,omitempty"`
	// Return type allowed flags (from product config, default: all true)
	ReturnAllowed      bool `json:"return_allowed"`
	RefundAllowed      bool `json:"refund_allowed"`
	ReplacementAllowed bool `json:"replacement_allowed"`
}

type ReviewSummary struct {
	Rating      float64 `json:"rating"`
	TotalReviews int    `json:"total_reviews"`
	Distribution map[int]int `json:"distribution"`
}

type Order struct {
	ID              UUID       `json:"id"`
	TenantID        UUID       `json:"tenant_id"`
	UserID          *UUID      `json:"user_id,omitempty"`
	BranchID        *UUID      `json:"branch_id,omitempty"`
	BranchName      string     `json:"branch_name,omitempty"` // joined for admin display
	Status          string     `json:"status"`
	Subtotal        float64    `json:"subtotal"`
	DiscountTotal   float64    `json:"discount_total"`
	ShippingTotal   float64    `json:"shipping_total"`
	TaxTotal        float64    `json:"tax_total"`
	GrandTotal      float64    `json:"grand_total"`
	CurrencyCode    string     `json:"currency_code"`
	Items           []OrderItem `json:"items,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	// Workflow fields
	TrackingNumber  string             `json:"tracking_number,omitempty"`
	Carrier         string             `json:"carrier,omitempty"`
	ShippedAt       *time.Time         `json:"shipped_at,omitempty"`
	DeliveredAt     *time.Time         `json:"delivered_at,omitempty"`
	CancelledAt     *time.Time         `json:"cancelled_at,omitempty"`
	CancelReason    string             `json:"cancel_reason,omitempty"`
	InternalNotes   string             `json:"internal_notes,omitempty"`
	PaymentMethod   string             `json:"payment_method,omitempty"`
	TransactionID   string             `json:"transaction_id,omitempty"`
	ShippingMethod  string             `json:"shipping_method,omitempty"`
	ShippingWeight  float64            `json:"shipping_weight"` // total physical item weight in kg
	CustomerEmail   string             `json:"customer_email,omitempty"`
	CustomerName    string             `json:"customer_name,omitempty"`
	StatusHistory   []OrderStatusEvent `json:"status_history,omitempty"`
	UpdatedAt       time.Time          `json:"updated_at"`
	// Replacement / exchange order linking
	ReplacesOrderID *UUID  `json:"replaces_order_id,omitempty"`
	ReturnID        *UUID  `json:"return_id,omitempty"`
	OrderTag        string `json:"order_tag,omitempty"` // 'replacement', 'exchange', or empty for normal orders
	// Return status reflects the active return state (null when no active return)
	ReturnStatus    *string `json:"return_status,omitempty"`
	// Tax breakdown captured at purchase time (JSONB array of TaxBreakdownLine)
	TaxBreakdown []TaxBreakdownLine `json:"tax_breakdown,omitempty"`
	// Delivery partner assignment (local-delivery orders)
	DeliveryPartnerID   *UUID      `json:"delivery_partner_id,omitempty"`
	DeliveryPartnerName string     `json:"delivery_partner_name,omitempty"` // joined for display
	DeliveryAssignedAt  *time.Time `json:"delivery_assigned_at,omitempty"`
}

// OrderStatusEvent represents a single entry in the order status history timeline.
type OrderStatusEvent struct {
	Status    string     `json:"status"`
	Timestamp time.Time  `json:"timestamp"`
	Note      string     `json:"note,omitempty"`
	Actor     string     `json:"actor,omitempty"` // user ID or "system"
}

// OrderWithDetails is an order with shipping/billing addresses.
// Used by the order status pages (success, pending).
type OrderWithDetails struct {
	Order
	ShippingAddress AddressInput `json:"shipping_address,omitempty"`
	BillingAddress  AddressInput `json:"billing_address,omitempty"`
}

// OrderWorkflow defines the valid status transitions for the order workflow.
// pending → paid, cancelled
// paid → processing, cancelled, refunded
// processing → ready, shipped, delivered (delivered for no-shipping products), cancelled
// ready → shipped, processing, cancelled
// shipped → delivered
// delivered → fulfilled, refunded (refunded when a return is approved)
// fulfilled → (terminal)
// cancelled → (terminal)
// refunded → (terminal)
// failed → (terminal, set by payment gateway)
var ValidOrderTransitions = map[string][]string{
	"pending":    {"paid", "cancelled"},
	"paid":       {"processing", "cancelled", "refunded"},
	"processing": {"ready", "shipped", "delivered", "cancelled"},
	"ready":      {"shipped", "processing", "cancelled"},
	"shipped":    {"delivered"},
	"delivered":  {"fulfilled", "refunded"},
	"fulfilled":  {},
	"cancelled":  {},
	"refunded":   {},
	"failed":     {},
}

// IsValidOrderTransition checks whether transitioning from one status to another is allowed.
func IsValidOrderTransition(from, to string) bool {
	allowed, ok := ValidOrderTransitions[from]
	if !ok {
		return false
	}
	for _, s := range allowed {
		if s == to {
			return true
		}
	}
	return false
}

type OrderItem struct {
	ID         UUID    `json:"id"`
	ProductID  UUID    `json:"product_id"`
	VariantID  *UUID   `json:"variant_id,omitempty"`
	Name       string  `json:"name"`
	SKU        string  `json:"sku"`
	ImageURL   string  `json:"image_url,omitempty"`
	Quantity   int     `json:"quantity"`
	UnitPrice  float64 `json:"unit_price"`
	LineTotal  float64 `json:"line_total"`
	// Per-item tax fields (captured at purchase time for historical accuracy)
	TaxAmount  float64 `json:"tax_amount"`
	TaxRate    float64 `json:"tax_rate"`
	TaxClassID *UUID   `json:"tax_class_id,omitempty"`
	// BranchID overrides the fulfilling branch for this line (NULL = order's branch).
	BranchID   *UUID    `json:"branch_id,omitempty"`
	// Per-item shipping fields (split-shipment support)
	ShippingMethod string  `json:"shipping_method"`
	ShippingCost   float64 `json:"shipping_cost"`
	ShippingWeight float64 `json:"shipping_weight"`
}

// Address
type Address struct {
	ID         UUID      `json:"id"`
	UserID     UUID      `json:"user_id"`
	TenantID   UUID      `json:"tenant_id"`
	Label      string    `json:"label"`
	FirstName  string    `json:"first_name"`
	LastName   string    `json:"last_name"`
	Email      string    `json:"email"`
	Line1      string    `json:"line1"`
	Line2      string    `json:"line2,omitempty"`
	City       string    `json:"city"`
	State      string    `json:"state,omitempty"`
	PostalCode string    `json:"postal_code,omitempty"`
	Country    string    `json:"country"`
	Phone      string    `json:"phone,omitempty"`
	IsDefault  bool      `json:"is_default"`
	CreatedAt  time.Time `json:"created_at"`
}

// Checkout
type CheckoutRequest struct {
	ShippingAddress  AddressInput `json:"shipping_address"`
	BillingAddress   *AddressInput `json:"billing_address,omitempty"` // nil = same as shipping
	PaymentMethod    string       `json:"payment_method"` // card, paypal, cod, etc.
	PaymentDetails   *PaymentDetails `json:"payment_details,omitempty"`
	CurrencyCode     string       `json:"currency_code"`
	DiscountCode     string       `json:"discount_code,omitempty"`
	ShippingMethod   string       `json:"shipping_method,omitempty"` // standard, express
	Notes            string       `json:"notes,omitempty"`
	PaymentStatus    string       `json:"payment_status,omitempty"`    // set by gateway: paid, pending, failed
	TransactionID    string       `json:"transaction_id,omitempty"`    // set by gateway
	// Per-item shipping methods (split-shipment support). When present, each entry
	// overrides the order-level ShippingMethod for that cart item. The cart item
	// is identified by its index in the cart (0-based).
	ItemShippingMethods []ItemShippingMethod `json:"item_shipping_methods,omitempty"`
	// Delivery location used to resolve the fulfilling branch. Either the
	// coordinates (map pin) or a named delivery area must match a branch's
	// service area when branches are configured.
	DeliveryArea string   `json:"delivery_area,omitempty"`
	DeliveryLat  *float64 `json:"delivery_lat,omitempty"`
	DeliveryLng  *float64 `json:"delivery_lng,omitempty"`
	// BranchID is set server-side after branch resolution — client input ignored.
	BranchID *UUID `json:"-"`
}

// ItemShippingMethod assigns a shipping method to a specific cart item at checkout.
type ItemShippingMethod struct {
	CartItemIndex int    `json:"cart_item_index"`
	MethodCode    string `json:"method_code"`
}

type AddressInput struct {
	Label      string `json:"label,omitempty"`
	Line1      string `json:"line1" binding:"required"`
	Line2      string `json:"line2,omitempty"`
	City       string `json:"city" binding:"required"`
	State      string `json:"state,omitempty"`
	PostalCode string `json:"postal_code,omitempty"`
	Country    string `json:"country" binding:"required"`
	Phone      string `json:"phone,omitempty"`
	Email      string `json:"email,omitempty"`
	FirstName  string `json:"first_name,omitempty"`
	LastName   string `json:"last_name,omitempty"`
}

type PaymentDetails struct {
	// Card fields
	CardNumber  string `json:"card_number,omitempty"` // full number for mock processing; never stored
	CardName    string `json:"card_name,omitempty"`
	CardLast4   string `json:"card_last4,omitempty"`
	CardBrand   string `json:"card_brand,omitempty"`
	CardExpiry  string `json:"card_expiry,omitempty"`
	CardCVV     string `json:"card_cvv,omitempty"` // never stored
	// PayPal
	PaypalEmail string `json:"paypal_email,omitempty"`
	// Razorpay
	RazorpayOrderID   string `json:"razorpay_order_id,omitempty"`
	RazorpayPaymentID string `json:"razorpay_payment_id,omitempty"`
	RazorpaySignature string `json:"razorpay_signature,omitempty"`
}

type OrderResponse struct {
	Order            Order           `json:"order"`
	ShippingAddress  AddressInput    `json:"shipping_address"`
	BillingAddress   AddressInput    `json:"billing_address"`
	PaymentMethod    string          `json:"payment_method"`
	PaymentDetails   *PaymentDetails `json:"payment_details,omitempty"`
	ShippingMethod   string          `json:"shipping_method"`
	TransactionID    string          `json:"transaction_id,omitempty"`
}

// ---------------- Shipping Module ----------------

type ShippingMethod struct {
	ID                   UUID    `json:"id"`
	TenantID             UUID    `json:"tenant_id"`
	Name                 string  `json:"name"`
	Code                 string  `json:"code"`
	Description          string  `json:"description"`
	BaseRate             float64 `json:"base_rate"`
	WeightRate           float64 `json:"weight_rate"` // additional rate per kg (0 = flat rate)
	CurrencyCode         string  `json:"currency_code"`
	MinDays              *int    `json:"min_days,omitempty"`
	MaxDays              *int    `json:"max_days,omitempty"`
	FreeShippingThreshold *float64 `json:"free_shipping_threshold,omitempty"`
	IsActive             bool    `json:"is_active"`
	SortOrder            int     `json:"sort_order"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

type ShippingZone struct {
	ID                 UUID      `json:"id"`
	TenantID           UUID      `json:"tenant_id"`
	Name               string    `json:"name"`
	CountryCode        string    `json:"country_code,omitempty"`
	StateCode          string    `json:"state_code,omitempty"`
	City               string    `json:"city,omitempty"`
	PostalCodePattern  string    `json:"postal_code_pattern,omitempty"`
	IsActive           bool      `json:"is_active"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type ShippingRate struct {
	ID                UUID      `json:"id"`
	TenantID          UUID      `json:"tenant_id"`
	ShippingMethodID  UUID      `json:"shipping_method_id"`
	ShippingZoneID    UUID      `json:"shipping_zone_id"`
	Rate              float64   `json:"rate"`
	IsActive          bool      `json:"is_active"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
	// Joined fields for display
	ShippingMethodName string `json:"shipping_method_name,omitempty"`
	ShippingZoneName   string `json:"shipping_zone_name,omitempty"`
}

// ShippingOption is a calculated shipping option presented to the customer
type ShippingOption struct {
	MethodID        UUID     `json:"method_id"`
	Code            string   `json:"code"`
	Name            string   `json:"name"`
	Description     string   `json:"description"`
	Rate            float64  `json:"rate"`
	CurrencyCode    string   `json:"currency_code"`
	MinDays         *int     `json:"min_days,omitempty"`
	MaxDays         *int     `json:"max_days,omitempty"`
	IsFree          bool     `json:"is_free"`
	EstimatedDelivery string `json:"estimated_delivery,omitempty"`
}

// ShippingCalculationItem represents a cart item for shipping calculation.
type ShippingCalculationItem struct {
	ProductID        UUID    `json:"product_id"`
	Quantity         int     `json:"quantity"`
	LineTotal        float64 `json:"line_total"`
	RequiresShipping bool    `json:"requires_shipping"`
	Weight           float64 `json:"weight"`    // per-unit weight in kg
	FreeShipping     bool    `json:"free_shipping"`
}

// ShippingCalculationRequest is used to calculate available shipping options
type ShippingCalculationRequest struct {
	Subtotal         float64                `json:"subtotal"`
	ShippingAddress  AddressInput           `json:"shipping_address"`
	CurrencyCode     string                 `json:"currency_code,omitempty"`
	Items            []ShippingCalculationItem `json:"items,omitempty"`
}

// ShippingCalculationResult contains the available shipping options
type ShippingCalculationResult struct {
	Options []ShippingOption `json:"options"`
	// PerItemOptions provides shipping options for each cart item individually,
	// enabling split-shipment selection at checkout. The index aligns with the
	// request's Items slice.
	PerItemOptions []ItemShippingOptions `json:"per_item_options,omitempty"`
}

// ItemShippingOptions lists the shipping options available for a single cart item.
type ItemShippingOptions struct {
	ProductID UUID             `json:"product_id"`
	Options   []ShippingOption `json:"options"`
}

// ---------------- Shipping Providers Module ----------------

// ShippingProvider is a per-tenant configuration for an external shipping
// carrier (Delhivery, Shiprocket, etc.).
type ShippingProvider struct {
	ID          UUID       `json:"id"`
	TenantID    UUID       `json:"tenant_id"`
	ProviderCode string     `json:"provider_code"` // e.g. "delhivery"
	DisplayName string     `json:"display_name"`
	APIKey      string     `json:"api_key"`
	APIBaseURL  string     `json:"api_base_url"` // override; empty = provider default
	IsEnabled   bool       `json:"is_enabled"`
	IsTestMode  bool       `json:"is_test_mode"`
	Config      []byte     `json:"config,omitempty"` // JSONB provider-specific config
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// Shipment links an order to a carrier shipment with tracking info.
type Shipment struct {
	ID                UUID       `json:"id"`
	TenantID          UUID       `json:"tenant_id"`
	OrderID           UUID       `json:"order_id"`
	ProviderCode      string     `json:"provider_code"`
	TrackingNumber    string     `json:"tracking_number"`
	Carrier           string     `json:"carrier"`
	AWBURL            string     `json:"awb_url"`
	Status            string     `json:"status"` // pending|booked|picked_up|in_transit|out_for_delivery|delivered|cancelled|failed
	PickupScheduledAt *time.Time `json:"pickup_scheduled_at,omitempty"`
	PickedUpAt        *time.Time `json:"picked_up_at,omitempty"`
	DeliveredAt       *time.Time `json:"delivered_at,omitempty"`
	EstimatedDelivery *time.Time `json:"estimated_delivery,omitempty"`
	RawMetadata       []byte     `json:"raw_metadata,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
	// Items links this shipment to specific order items (split-shipment support).
	Items []ShipmentItem `json:"items,omitempty"`
}

// ShipmentItem links a shipment to a specific order item with a quantity.
type ShipmentItem struct {
	ID          UUID    `json:"id"`
	ShipmentID  UUID    `json:"shipment_id"`
	OrderItemID UUID    `json:"order_item_id"`
	Quantity    int     `json:"quantity"`
	// Joined fields for display convenience
	ProductName string  `json:"product_name,omitempty"`
	ProductID   UUID    `json:"product_id,omitempty"`
	SKU         string  `json:"sku,omitempty"`
	UnitPrice   float64 `json:"unit_price,omitempty"`
}

// ShipmentCreateRequest is the input for creating a shipment with a provider.
type ShipmentCreateRequest struct {
	ProviderCode string `json:"provider_code"`
	// ItemIDs restricts the shipment to a subset of order items (split-shipment).
	// When empty, the shipment covers all shippable order items (legacy behavior).
	ItemIDs []UUID `json:"item_ids,omitempty"`
	// ItemQuantities optionally limits the quantity per order item. When an item
	// ID is listed in ItemIDs but not here (or quantity is 0), the full remaining
	// unshipped quantity is used.
	ItemQuantities []ShipmentItemQuantity `json:"item_quantities,omitempty"`
	// EstimatedDelivery is an optional admin-set estimated delivery date
	// (ISO 8601 date or RFC 3339 datetime). Empty = not set.
	EstimatedDelivery *string `json:"estimated_delivery,omitempty"`
}

// ShipmentItemQuantity specifies the quantity to ship for a given order item.
type ShipmentItemQuantity struct {
	OrderItemID UUID `json:"order_item_id"`
	Quantity    int  `json:"quantity"`
}

// ShipmentCreateResponse is the result of creating a shipment.
type ShipmentCreateResponse struct {
	Shipment *Shipment `json:"shipment"`
}

// TrackingEvent is a single tracking scan/event from the carrier.
type TrackingEvent struct {
	Status      string `json:"status"`
	Location    string `json:"location,omitempty"`
	Description string `json:"description,omitempty"`
	Timestamp   string `json:"timestamp,omitempty"`
}

// TrackingResponse is the live tracking result for a shipment.
type TrackingResponse struct {
	TrackingNumber string           `json:"tracking_number"`
	Carrier        string           `json:"carrier"`
	Status         string           `json:"status"`
	EstimatedDelivery string         `json:"estimated_delivery,omitempty"`
	Events         []TrackingEvent  `json:"events,omitempty"`
	Shipment       *Shipment        `json:"shipment,omitempty"`
}

// ProviderTestResult is the result of testing a provider connection.
type ProviderTestResult struct {
	OK      bool   `json:"ok"`
	Message string `json:"message"`
}

// SupportedShippingProviders is the list of provider codes this platform supports.
var SupportedShippingProviders = []string{"delhivery", "ekart", "fedex", "shiprocket"}

// ---------------- Payments Module ----------------

type PaymentTransaction struct {
	ID              UUID       `json:"id"`
	TenantID        UUID       `json:"tenant_id"`
	OrderID         UUID       `json:"order_id"`
	UserID          *UUID      `json:"user_id,omitempty"`
	Gateway         string     `json:"gateway"`
	GatewayTxnID    string     `json:"gateway_txn_id,omitempty"`
	Type            string     `json:"type"`              // capture, authorize, refund, void
	Status          string     `json:"status"`            // pending, success, failed, refunded, partial_refund
	Amount          float64    `json:"amount"`
	CurrencyCode    string     `json:"currency_code"`
	RefundedAmount  float64    `json:"refunded_amount"`
	GatewayResponse map[string]interface{} `json:"gateway_response,omitempty"`
	FailureReason   string     `json:"failure_reason,omitempty"`
	CustomerEmail   string     `json:"customer_email,omitempty"`
	CustomerName    string     `json:"customer_name,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	// Joined fields for display
	OrderNumber      string  `json:"order_number,omitempty"`
	OrderGrandTotal  float64 `json:"order_grand_total,omitempty"`
	OrderStatus      string  `json:"order_status,omitempty"`
}

type PaymentGatewayConfig struct {
	ID           UUID                   `json:"id"`
	TenantID     UUID                   `json:"tenant_id"`
	GatewayCode  string                 `json:"gateway_code"`
	DisplayName  string                 `json:"display_name"`
	IsEnabled    bool                   `json:"is_enabled"`
	IsTestMode   bool                   `json:"is_test_mode"`
	SortOrder    int                    `json:"sort_order"`
	Config       map[string]interface{} `json:"config,omitempty"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}

// StoreModule is a per-store feature flag managed from Backoffice → Developer →
// Modules & Features. When a module is disabled, its related menus, pages,
// widgets, and components are hidden on both the frontstore and the backoffice.
type StoreModule struct {
	ID          UUID      `json:"id"`
	TenantID    UUID      `json:"tenant_id"`
	ModuleCode  string    `json:"module_code"`
	DisplayName string    `json:"display_name"`
	Description string    `json:"description"`
	IsEnabled   bool      `json:"is_enabled"`
	SortOrder   int       `json:"sort_order"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// RefundRequest is used to initiate a refund for a payment transaction.
type RefundRequest struct {
	Amount     float64 `json:"amount"`               // refund amount (0 = full refund)
	Reason     string  `json:"reason,omitempty"`     // refund reason
}

// PaymentStats holds aggregated payment statistics for the dashboard.
type PaymentStats struct {
	TotalCollected      float64 `json:"total_collected"`
	TotalRefunded       float64 `json:"total_refunded"`
	NetRevenue          float64 `json:"net_revenue"`
	TransactionCount    int     `json:"transaction_count"`
	RefundCount         int     `json:"refund_count"`
	PendingCount        int     `json:"pending_count"`
	FailedCount         int     `json:"failed_count"`
	ByGateway           []GatewaySummary `json:"by_gateway"`
}

type GatewaySummary struct {
	Gateway      string  `json:"gateway"`
	Count        int     `json:"count"`
	TotalAmount  float64 `json:"total_amount"`
	RefundedAmount float64 `json:"refunded_amount"`
}

// ---------------- Notifications Module ----------------

// NotificationEvent defines a triggerable event in the system.
type NotificationEvent struct {
	ID          UUID   `json:"id"`
	TenantID    UUID   `json:"tenant_id"`
	Code        string `json:"code"`         // e.g., order_placed, customer_registered
	Name        string `json:"name"`
	Description string `json:"description"`
	IsActive    bool   `json:"is_active"`
	IsInstant   bool   `json:"is_instant"`   // instant delivery vs scheduled digest
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

// NotificationTemplateParameter describes a template variable.
type NotificationTemplateParameter struct {
	Key      string `json:"key"`      // e.g., customer_name
	Label    string `json:"label"`    // e.g., Customer Name
	Required bool   `json:"required"`
}

// NotificationTemplate holds the content for a specific event + medium.
type NotificationTemplate struct {
	ID           UUID                         `json:"id"`
	TenantID     UUID                         `json:"tenant_id"`
	EventID      UUID                         `json:"event_id"`
	EventCode    string                       `json:"event_code,omitempty"`
	EventName    string                       `json:"event_name,omitempty"`
	Name         string                       `json:"name"`
	Medium       string                       `json:"medium"`        // email | sms | push
	Subject      string                       `json:"subject"`       // email subject
	BodyHTML     string                       `json:"body_html"`     // HTML body (email/push)
	BodyText     string                       `json:"body_text"`     // plain text (SMS/fallback)
	Parameters   []NotificationTemplateParameter `json:"parameters"`
	RecipientType string                      `json:"recipient_type"` // customer | staff | business_admin | all_staff | all_customers | specific_emails
	IsActive     bool                         `json:"is_active"`
	Recipients   []NotificationRecipient       `json:"recipients,omitempty"`
	CreatedAt    string                       `json:"created_at"`
	UpdatedAt    string                       `json:"updated_at"`
}

// NotificationRecipient is a specific email/phone target for a template.
type NotificationRecipient struct {
	ID        UUID   `json:"id"`
	TenantID  UUID   `json:"tenant_id"`
	TemplateID UUID  `json:"template_id"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	Phone     string `json:"phone"`
	CreatedAt string `json:"created_at"`
}

// NotificationLog records a sent notification.
type NotificationLog struct {
	ID         UUID   `json:"id"`
	TenantID   UUID   `json:"tenant_id"`
	TemplateID *UUID  `json:"template_id,omitempty"`
	EventID    *UUID  `json:"event_id,omitempty"`
	Medium     string `json:"medium"`
	Recipient  string `json:"recipient"`
	Subject    string `json:"subject,omitempty"`
	Body       string `json:"body,omitempty"`
	Status     string `json:"status"`        // pending | sent | failed
	Error      string `json:"error,omitempty"`
	SentAt     string `json:"sent_at,omitempty"`
	CreatedAt  string `json:"created_at"`
}

// NotificationTemplateReq is the request body for creating/updating a template.
type NotificationTemplateReq struct {
	EventID       UUID                           `json:"event_id"`
	Name          string                         `json:"name"`
	Medium        string                         `json:"medium"`
	Subject       string                         `json:"subject"`
	BodyHTML      string                         `json:"body_html"`
	BodyText      string                         `json:"body_text"`
	Parameters    []NotificationTemplateParameter `json:"parameters"`
	RecipientType string                         `json:"recipient_type"`
	IsActive      bool                           `json:"is_active"`
	Recipients    []NotificationRecipientInput   `json:"recipients"`
}

type NotificationRecipientInput struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	Phone string `json:"phone"`
}

// NotificationEventReq is the request body for creating/updating an event.
type NotificationEventReq struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
	IsInstant   bool   `json:"is_instant"`
	IsActive    bool   `json:"is_active"`
}

// NotificationPreviewReq is the request body for previewing a template.
type NotificationPreviewReq struct {
	TemplateID *UUID                     `json:"template_id,omitempty"`
	Subject    string                    `json:"subject"`
	BodyHTML   string                    `json:"body_html"`
	BodyText   string                    `json:"body_text"`
	Parameters map[string]string         `json:"parameters"`
}

// NotificationSendReq is the request body for manually sending a notification.
type NotificationSendReq struct {
	TemplateID UUID              `json:"template_id"`
	To         []string          `json:"to"`
	Parameters map[string]string `json:"parameters"`
}

// ---------------- Order Returns / Replacements / Refunds ----------------

// Return type constants
const (
	ReturnTypeRefund       = "refund"
	ReturnTypeReplacement  = "replacement"
	ReturnTypeExchange     = "exchange"
)

// Return status constants
const (
	ReturnStatusRequested = "requested"
	ReturnStatusApproved  = "approved"
	ReturnStatusRejected  = "rejected"
	ReturnStatusCompleted = "completed"
	ReturnStatusCancelled = "cancelled"
)

// ValidReturnTransitions defines allowed status transitions for returns.
var ValidReturnTransitions = map[string][]string{
	"requested": {"approved", "rejected", "cancelled"},
	"approved":  {"completed", "cancelled"},
	"rejected":  {},
	"completed": {},
	"cancelled": {},
}

func IsValidReturnTransition(from, to string) bool {
	allowed, ok := ValidReturnTransitions[from]
	if !ok {
		return false
	}
	for _, s := range allowed {
		if s == to {
			return true
		}
	}
	return false
}

// OrderReturn represents a return/replacement/refund request for an order.
type OrderReturn struct {
	ID            UUID               `json:"id"`
	TenantID      UUID               `json:"tenant_id"`
	OrderID       UUID               `json:"order_id"`
	ReturnNumber  string             `json:"return_number"`
	Type          string             `json:"type"`           // refund, replacement, exchange
	Status        string             `json:"status"`         // requested, approved, rejected, completed, cancelled
	Reason        string             `json:"reason"`
	RefundAmount  float64            `json:"refund_amount"`
	RefundMethod  string             `json:"refund_method"`  // original, wallet, store_credit, none
	Restock       bool               `json:"restock"`
	Items         []OrderReturnItem   `json:"items,omitempty"`
	StatusHistory []ReturnStatusEvent `json:"status_history,omitempty"`
	CreatedBy     *UUID              `json:"created_by,omitempty"`
	CreatedAt     time.Time          `json:"created_at"`
	UpdatedAt     time.Time          `json:"updated_at"`
	CompletedAt   *time.Time         `json:"completed_at,omitempty"`
	// Joined display fields
	OrderNumber   string             `json:"order_number,omitempty"`
	OrderStatus   string             `json:"order_status,omitempty"`
	CustomerName  string             `json:"customer_name,omitempty"`
	CustomerEmail string             `json:"customer_email,omitempty"`
}

// OrderReturnItem represents a line item in a return request.
type OrderReturnItem struct {
	ID          UUID   `json:"id"`
	ReturnID    UUID   `json:"return_id"`
	OrderItemID UUID   `json:"order_item_id"`
	ProductID   *UUID  `json:"product_id,omitempty"`
	VariantID   *UUID  `json:"variant_id,omitempty"`
	Name        string `json:"name"`
	SKU         string `json:"sku,omitempty"`
	Quantity    int    `json:"quantity"`
	UnitPrice   float64 `json:"unit_price"`
	LineTotal   float64 `json:"line_total"`
	Reason      string `json:"reason"`
}

// ReturnStatusEvent is a single status change event in the return lifecycle.
type ReturnStatusEvent struct {
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
	Note      string    `json:"note,omitempty"`
	Actor     string    `json:"actor,omitempty"`
}

// ReturnRequest is the request body for creating a return.
type ReturnRequest struct {
	Type         string             `json:"type"`          // refund, replacement, exchange
	Reason       string             `json:"reason"`
	RefundMethod string             `json:"refund_method"` // original, wallet, store_credit, none
	Restock      bool               `json:"restock"`
	Items        []ReturnRequestItem `json:"items"`
}

// ReturnRequestItem is a single item in a return creation request.
type ReturnRequestItem struct {
	OrderItemID string `json:"order_item_id"`
	Quantity    int    `json:"quantity"`
	Reason      string `json:"reason,omitempty"`
}

// ReturnStatusUpdate is the request body for updating a return's status.
type ReturnStatusUpdate struct {
	Status string `json:"status"`
	Note   string `json:"note,omitempty"`
}

// ===== Store Pages (Page Builder) =====

// StorePage represents a customizable storefront page.
type StorePage struct {
	ID              UUID            `json:"id"`
	TenantID        UUID            `json:"tenant_id"`
	Slug            string          `json:"slug"`
	Title           string          `json:"title"`
	PageType        string          `json:"page_type"` // home, about, contact, privacy, terms, custom
	Status          string          `json:"status"`    // draft, published
	Blocks          []PageBlock     `json:"blocks"`
	MetaTitle       string          `json:"meta_title"`
	MetaDescription string          `json:"meta_description"`
	IsSystem        bool            `json:"is_system"`
	IsCustomized    bool            `json:"is_customized"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

// PageBlock represents a single block/section in a store page.
type PageBlock struct {
	ID     string                 `json:"id"`
	Type   string                 `json:"type"`   // hero, rich_text, image, gallery, cta, spacer, divider, banner, featured_products, category_showcase, product_carousel, testimonials, reviews, faq, contact_form, map, team, stats, timeline, columns, tabs, accordion, feature_grid
	Props  map[string]interface{} `json:"props"`  // block-specific properties
}

// StorePageRequest is the request body for creating/updating a store page.
type StorePageRequest struct {
	Slug            string     `json:"slug"`
	Title           string     `json:"title"`
	PageType        string     `json:"page_type"`
	Status          string     `json:"status"`
	Blocks          []PageBlock `json:"blocks"`
	MetaTitle       string     `json:"meta_title"`
	MetaDescription string     `json:"meta_description"`
}

// ExportJob represents an async bulk export job.
type ExportJob struct {
	ID          uuid.UUID      `json:"id"`
	TenantID     uuid.UUID      `json:"tenant_id"`
	UserID      uuid.UUID      `json:"user_id"`
	Type        string         `json:"type"`
	Format      string         `json:"format"`
	Filters     map[string]any `json:"filters"`
	Email       string         `json:"email"`
	Status      string         `json:"status"`
	FilePath    string         `json:"file_path,omitempty"`
	FileName    string         `json:"file_name,omitempty"`
	FileSize    int64          `json:"file_size"`
	RowsTotal   int            `json:"rows_total"`
	RowsDone    int            `json:"rows_done"`
	Error       string         `json:"error,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	StartedAt   *time.Time     `json:"started_at,omitempty"`
	CompletedAt *time.Time     `json:"completed_at,omitempty"`
}

// ExportRequest is the request body for creating an export job.
type ExportRequest struct {
	Type    string            `json:"type"`
	Format  string            `json:"format"`
	Filters map[string]string `json:"filters"`
	Email   string            `json:"email"`
}

// OrderHandoff is a request to transfer an order (or specific items) to
// another branch. Pending until the receiving branch accepts or rejects.
type OrderHandoff struct {
	ID           UUID       `json:"id"`
	TenantID     UUID       `json:"tenant_id"`
	OrderID      UUID       `json:"order_id"`
	FromBranchID UUID       `json:"from_branch_id"`
	FromBranch   string     `json:"from_branch_name,omitempty"`
	ToBranchID   UUID       `json:"to_branch_id"`
	ToBranch     string     `json:"to_branch_name,omitempty"`
	ItemIDs      []UUID     `json:"item_ids"` // empty = whole order
	Status       string     `json:"status"`   // pending, accepted, rejected, cancelled
	Note         string     `json:"note"`
	CreatedBy    *UUID      `json:"created_by,omitempty"`
	RespondedBy  *UUID      `json:"responded_by,omitempty"`
	RespondedAt  *time.Time `json:"responded_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}
