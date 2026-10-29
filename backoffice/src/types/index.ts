export type UUID = string;

export type UserRole = "superadmin" | "business_admin" | "branch_manager" | "staff" | "customer" | "delivery_partner";

export interface User {
  id: UUID;
  tenant_id?: UUID;
  branch_id?: UUID;
  branch_name?: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  phone?: string;
  marketing_consent?: boolean;
  admin_notes?: string;
  last_login_at?: string;
  created_at: string;
  /** Delivery partner branch allocations (delivery_partner role only). */
  branch_ids?: UUID[];
  branch_names?: string[];
  /** Partner's in-flight deliveries (ready+shipped) — partners list only. */
  active_deliveries?: number;
}

export interface UserStats {
  total: number;
  customers: number;
  staff: number;
  admins: number;
  delivery_partners: number;
  active: number;
  inactive: number;
}

export interface Permission {
  id: UUID;
  code: string;
  module: string;
  action: string;
  description: string;
  created_at: string;
}

export interface RolePermission {
  id: UUID;
  tenant_id: UUID;
  role: UserRole;
  permission_id: UUID;
  granted: boolean;
  created_at: string;
  permission_code?: string;
  permission_module?: string;
  permission_description?: string;
}

export interface Address {
  id: UUID;
  user_id: UUID;
  tenant_id: UUID;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code?: string;
  country: string;
  phone?: string;
  is_default: boolean;
  created_at: string;
}

export interface CustomerDetail extends User {
  order_count: number;
  total_spent: number;
  addresses: Address[];
}

export interface CustomerStats {
  total_customers: number;
  active_customers: number;
  new_this_month: number;
  total_spent: number;
  avg_order_value: number;
}

export interface Tenant {
  id: UUID;
  slug: string;
  name: string;
  description: string;
  is_active: boolean;
  contact_email: string;
  contact_phone: string;
  country: string;
  city: string;
  address: string;
  plan: string;
  commission_rate: number;
  created_at: string;
  updated_at: string;
}

export interface StoreStats {
  product_count: number;
  order_count: number;
  customer_count: number;
  staff_count: number;
  vendor_count: number;
  revenue: number;
}

export interface Vendor {
  id: UUID;
  tenant_id: UUID;
  name: string;
  slug: string;
  email: string;
  phone: string;
  address: string;
  contact_person: string;
  commission_rate: number;
  status: string;
  notes: string;
  product_count?: number;
  created_at: string;
  updated_at: string;
}

export interface TenantSettings {
  tenant_id: UUID;
  default_currency_id?: UUID;
  default_currency_code?: string; // used in update requests (resolved to ID by backend)
  default_language: string;
  supported_languages: string[];
  brand_color: string;
  logo_url: string;
  landing_page_enabled: boolean;
  landing_page_content?: LandingPageContent;
  anonymous_checkout?: boolean;
  returns_enabled?: boolean;
  return_period_days?: number;
  refund_period_days?: number;
  replacement_period_days?: number;
  meta_title?: string;
  meta_description?: string;
  og_image?: string;
  site_url?: string;
  social_links?: string[];
  service_area?: ServiceArea;
}

// ServiceArea configures where the store delivers. A customer location is
// serviceable when it falls inside the circle (center + radius) or matches
// one of the named areas.
export interface ServiceArea {
  enabled: boolean;
  label: string;
  state: string;
  country: string;
  center_lat: number;
  center_lng: number;
  radius_km: number;
  areas: string[];
}

export interface Currency {
  id: UUID;
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  is_active: boolean;
  /** USD->code exchange rate (units of this currency per 1 USD). */
  rate?: number;
}

export interface Language {
  code: string;
  name: string;
  is_active: boolean;
}

export interface SMTPSettings {
  tenant_id: UUID;
  host: string;
  port: number;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  encryption: string; // "none" | "ssl" | "starttls"
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LandingPageContent {
  hero_title: string;
  hero_subtitle: string;
  hero_button_text: string;
  hero_image_url: string;
  features: LandingFeature[];
  promo_title: string;
  promo_text: string;
  promo_image_url: string;
  testimonials: LandingTestimonial[];
  cta_title: string;
  cta_text: string;
  cta_button_text: string;
  show_features: boolean;
  show_promo: boolean;
  show_testimonials: boolean;
  show_cta: boolean;
  show_featured_products: boolean;
  // Extended CMS sections
  show_marquee: boolean;
  marquee_brands: string[];
  show_philosophy: boolean;
  philosophy_title: string;
  philosophy_text1: string;
  philosophy_text2: string;
  philosophy_badge: string;
  show_brand_story: boolean;
  brand_story?: BrandStoryContent;
  show_lookbook: boolean;
  lookbook?: LookbookContent;
  show_trend_report: boolean;
  trend_report?: TrendReportContent;
  show_sustainability: boolean;
  sustainability?: SustainabilityContent;
  show_style_guide: boolean;
  style_guide?: StyleGuideContent;
  show_stats: boolean;
  stats?: StatsContent;
  show_journal: boolean;
  journal?: JournalContent;
  show_instagram: boolean;
  instagram?: InstagramContent;
  show_faq: boolean;
  faq?: FAQContent;
  show_newsletter: boolean;
  newsletter?: NewsletterContent;
  show_trust_badges: boolean;
  trust_badges?: TrustBadgeContent[];
  splash?: SplashContent;
}

export interface SplashContent {
  enabled: boolean;
  style: "rings" | "spinner" | "pulse" | "dots" | "bars";
  background: "waves" | "orbs" | "none";
  subtitle: string;
  show_logo: boolean;
  show_progress: boolean;
  show_dots: boolean;
}

export interface LandingFeature {
  icon: string;
  title: string;
  text: string;
}

export interface LandingTestimonial {
  name: string;
  role: string;
  text: string;
  rating: number;
}

export interface BrandStoryContent {
  title: string;
  text1: string;
  text2: string;
  image_url: string;
  stat_value: string;
  stat_label: string;
  tags: string[];
}

export interface LookbookContent {
  title: string;
  subtitle: string;
  items: LookbookItem[];
}

export interface LookbookItem {
  image_url: string;
  category: string;
  title: string;
}

export interface TrendReportContent {
  title: string;
  subtitle: string;
  trends: TrendItem[];
}

export interface TrendItem {
  number: string;
  title: string;
  text: string;
}

export interface SustainabilityContent {
  title: string;
  subtitle: string;
  values: SustainabilityValue[];
}

export interface SustainabilityValue {
  icon: string;
  title: string;
  text: string;
}

export interface StyleGuideContent {
  title: string;
  subtitle: string;
  articles: StyleGuideArticle[];
}

export interface StyleGuideArticle {
  image_url: string;
  category: string;
  title: string;
  text1: string;
  text2: string;
}

export interface StatsContent {
  title: string;
  items: StatsItem[];
}

export interface StatsItem {
  value: number;
  suffix: string;
  label: string;
}

export interface JournalContent {
  title: string;
  subtitle: string;
  articles: JournalArticle[];
}

export interface JournalArticle {
  image_url: string;
  category: string;
  read_time: string;
  title: string;
  text: string;
  featured: boolean;
}

export interface InstagramContent {
  handle: string;
  title: string;
  subtitle: string;
  images: string[];
}

export interface FAQContent {
  title: string;
  subtitle: string;
  items: FAQItem[];
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface NewsletterContent {
  badge: string;
  title: string;
  subtitle: string;
  placeholder: string;
  button_text: string;
  disclaimer: string;
}

export interface TrustBadgeContent {
  icon: string;
  title: string;
  subtext: string;
}

export interface Category {
  id: UUID;
  tenant_id: UUID;
  parent_id?: UUID;
  parent_name?: string;
  slug: string;
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
  meta_title?: string;
  meta_description?: string;
}

export interface AttributeOption {
  id?: UUID;
  attribute_id?: UUID;
  value: string;
  label: string;
  sort_order: number;
}

export interface Attribute {
  id: UUID;
  tenant_id: UUID;
  slug: string;
  name: string;
  type: string;
  is_filterable: boolean;
  is_variant: boolean;
  is_batch: boolean;
  is_internal: boolean;
  options?: AttributeOption[];
}

export interface VariantAttr {
  attribute_slug: string;
  attribute_name: string;
  option_value: string;
  option_label: string;
}

export interface Variant {
  id?: UUID;
  product_id?: UUID;
  sku: string;
  name: string;
  price: number;
  stock: number;
  image_url: string;
  is_active: boolean;
  attributes?: VariantAttr[];
}

export interface ProductAttributeValue {
  attribute_id: UUID;
  attribute_slug?: string;
  attribute_name?: string;
  value_text?: string;
  value_number?: number;
  value_bool?: boolean;
  option_id?: UUID;
  option_label?: string;
}

export interface Product {
  id: UUID;
  tenant_id: UUID;
  category_id?: UUID;
  category_slug?: string;
  branch_id?: UUID;    // unset = available at all branches
  branch_name?: string; // joined for admin display
  slug: string;
  name: string;
  description: string;
  sku: string;
  status: string;
  base_price: number;
  currency_code: string;
  is_featured: boolean;
  rating: number;
  stock: number;
  low_stock_threshold: number;
  track_inventory: boolean;
  requires_shipping: boolean;
  weight: number;        // kilograms
  length: number;        // centimeters
  width: number;         // centimeters
  height: number;        // centimeters
  free_shipping: boolean;
  vendor_id?: UUID;
  image_url: string;
  images?: ProductImage[];
  variants?: Variant[];
  attributes?: ProductAttributeValue[];
  return_period_days?: number | null;
  refund_period_days?: number | null;
  replacement_period_days?: number | null;
  return_enabled?: boolean | null;
  refund_enabled?: boolean | null;
  replacement_enabled?: boolean | null;
  meta_title?: string;
  meta_description?: string;
  og_image?: string;
  tax_class_id?: UUID | null;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id?: UUID;
  product_id?: UUID;
  url: string;
  alt: string;
  sort_order: number;
}

export interface OfferTarget {
  target_type: "all" | "product" | "category";
  target_id?: UUID;
}

export interface Offer {
  id: UUID;
  tenant_id: UUID;
  name: string;
  description: string;
  offer_type: string;
  value: number;
  is_active: boolean;
  starts_at?: string;
  ends_at?: string;
  targets?: OfferTarget[];
}

export interface DiscountCode {
  id: UUID;
  tenant_id: UUID;
  code: string;
  description: string;
  discount_type: string;
  value: number;
  min_subtotal: number;
  max_uses?: number;
  used_count: number;
  starts_at?: string;
  ends_at?: string;
  is_active: boolean;
}

export interface DiscountStats {
  total_codes: number;
  active_codes: number;
  total_redemptions: number;
  total_discount: number;
}

export interface DashboardStats {
  products: number;
  orders: number;
  revenue: number;
  avg_order_value: number;
  customers: number;
  new_customers: number;
  currency: string;
  orders_by_status: Record<string, number>;
  today?: { orders: number; revenue: number };
  yesterday?: { orders: number; revenue: number };
  week?: { orders: number; revenue: number };
  prev_week?: { orders: number; revenue: number };
  comparison?: { orders: number; revenue: number; avg_order_value: number };
  revenue_series?: Array<{ date: string; revenue: number; orders: number }>;
  top_products?: Array<{ product_id?: UUID; name: string; slug: string; image: string; qty: number; revenue: number }>;
  top_categories?: Array<{ name: string; revenue: number; qty: number }>;
  payment_methods?: Array<{ method: string; orders: number; revenue: number }>;
  inventory?: InventoryStats;
  low_stock_items?: Array<{ product_id: UUID; name: string; variant: string; stock: number; threshold: number }>;
  pending_returns: number;
  active_offers: number;
  active_discounts: number;
  avg_rating: number;
  reviews: number;
  unread_messages: number;
  recent_orders?: Array<{
    id: UUID;
    status: string;
    total: number;
    currency: string;
    customer_name?: string;
    created_at: string;
  }>;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
  tenant_name?: string;
  tenant_slug?: string;
}

// ---- Reviews ----

export interface ReviewImage {
  id: UUID;
  review_id: UUID;
  url: string;
  alt: string;
  sort_order: number;
}

export interface Review {
  id: UUID;
  tenant_id: UUID;
  product_id: UUID;
  user_id?: UUID;
  author_name: string;
  rating: number;
  title: string;
  body: string;
  is_verified: boolean;
  is_approved: boolean;
  created_at: string;
  images?: ReviewImage[];
  product_name?: string;
  product_slug?: string;
  product_image?: string;
}

export interface ReviewStats {
  total: number;
  approved: number;
  pending: number;
  avg_rating: number;
}

export interface ReviewListResponse {
  items: Review[];
  total: number;
  stats?: ReviewStats;
}

// ---- Orders ----

export interface OrderItem {
  id: UUID;
  product_id: UUID;
  variant_id?: UUID;
  name: string;
  sku: string;
  image_url?: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  tax_amount?: number;
  tax_rate?: number;
  tax_class_id?: UUID;
  // Per-item shipping (split-shipment support)
  shipping_method?: string;
  shipping_cost?: number;
  shipping_weight?: number;
}

export interface OrderStatusEvent {
  status: string;
  timestamp: string;
  note?: string;
  actor?: string;
}

export interface TaxBreakdownLine {
  tax_rate_id: UUID;
  tax_class_name: string;
  tax_zone_name: string;
  rate_name: string;
  rate: number;
  taxable_amount: number;
  tax_amount: number;
  compound: boolean;
}

export interface OrderHandoff {
  id: UUID;
  order_id: UUID;
  from_branch_id: UUID;
  from_branch_name?: string;
  to_branch_id: UUID;
  to_branch_name?: string;
  item_ids?: UUID[];      // empty = whole order
  status: string;         // pending | accepted | rejected | cancelled
  note: string;
  created_at: string;
}

export interface Order {
  id: UUID;
  tenant_id: UUID;
  user_id?: UUID;
  branch_id?: UUID;
  branch_name?: string;
  status: string;
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  tax_total: number;
  grand_total: number;
  currency_code: string;
  items?: OrderItem[];
  created_at: string;
  updated_at: string;
  tracking_number?: string;
  carrier?: string;
  shipped_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
  cancel_reason?: string;
  internal_notes?: string;
  payment_method?: string;
  transaction_id?: string;
  shipping_method?: string;
  shipping_weight?: number; // total physical item weight in kg
  customer_email?: string;
  customer_name?: string;
  status_history?: OrderStatusEvent[];
  replaces_order_id?: UUID;
  return_id?: UUID;
  order_tag?: string; // 'replacement', 'exchange', or empty for normal orders
  tax_breakdown?: TaxBreakdownLine[];
  // Local-delivery partner assignment
  delivery_partner_id?: UUID;
  delivery_partner_name?: string;
  delivery_assigned_at?: string;
}

export interface OrderWithDetails extends Order {
  shipping_address?: AddressInput;
  billing_address?: AddressInput;
}

export interface AddressInput {
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code?: string;
  country: string;
  phone?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

export interface OrderListResponse {
  items: Order[];
  total: number;
  limit: number;
  offset: number;
}

export interface OrderCountsResponse {
  counts: Record<string, number>;
}

export interface UpdateOrderStatusRequest {
  status: string;
  note?: string;
  tracking_number?: string;
  carrier?: string;
}

// Valid order status transitions
export const ORDER_STATUSES = [
  "pending", "paid", "processing", "ready", "shipped", "delivered", "fulfilled", "cancelled", "refunded", "failed",
] as const;

export const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["paid", "cancelled"],
  paid: ["processing", "cancelled", "refunded"],
  processing: ["ready", "shipped", "delivered", "cancelled"],
  ready: ["shipped", "processing", "cancelled"],
  shipped: ["delivered"],
  delivered: ["fulfilled"],
  fulfilled: [],
  cancelled: [],
  refunded: [],
  failed: [],
};

export const ORDER_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "text-amber-700", bg: "bg-amber-100" },
  paid: { label: "Paid", color: "text-emerald-700", bg: "bg-emerald-100" },
  processing: { label: "Processing", color: "text-blue-700", bg: "bg-blue-100" },
  ready: { label: "Ready", color: "text-indigo-700", bg: "bg-indigo-100" },
  shipped: { label: "Shipped", color: "text-red-700", bg: "bg-red-100" },
  delivered: { label: "Delivered", color: "text-emerald-700", bg: "bg-emerald-100" },
  fulfilled: { label: "Fulfilled", color: "text-cyan-700", bg: "bg-cyan-100" },
  cancelled: { label: "Cancelled", color: "text-rose-700", bg: "bg-rose-100" },
  refunded: { label: "Refunded", color: "text-purple-700", bg: "bg-purple-100" },
  failed: { label: "Failed", color: "text-rose-700", bg: "bg-rose-100" },
};

// ---------------- Returns / Replacements / Refunds ----------------

export interface OrderReturnItem {
  id: UUID;
  return_id: UUID;
  order_item_id: UUID;
  product_id?: UUID;
  variant_id?: UUID;
  name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  reason: string;
}

export interface ReturnStatusEvent {
  status: string;
  timestamp: string;
  note?: string;
  actor?: string;
}

export interface OrderReturn {
  id: UUID;
  tenant_id: UUID;
  order_id: UUID;
  return_number: string;
  type: string; // refund, replacement, exchange
  status: string; // requested, approved, rejected, completed, cancelled
  reason: string;
  refund_amount: number;
  refund_method: string; // original, wallet, store_credit, none
  restock: boolean;
  items?: OrderReturnItem[];
  status_history?: ReturnStatusEvent[];
  created_by?: UUID;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  order_number?: string;
  order_status?: string;
  customer_name?: string;
  customer_email?: string;
}

export interface ReturnRequestItem {
  order_item_id: string;
  quantity: number;
  reason?: string;
}

export interface CreateReturnRequest {
  type: string;
  reason: string;
  refund_method: string;
  restock: boolean;
  items: ReturnRequestItem[];
}

export interface UpdateReturnStatusRequest {
  status: string;
  note?: string;
}

export interface ReturnListResponse {
  items: OrderReturn[];
  total: number;
  limit: number;
  offset: number;
}

export interface ReturnCountsResponse {
  [status: string]: number;
}

export const RETURN_TYPES = ["refund", "replacement", "exchange"] as const;

export const RETURN_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  refund: { label: "Refund", color: "text-purple-700", bg: "bg-purple-100" },
  replacement: { label: "Replacement", color: "text-blue-700", bg: "bg-blue-100" },
  exchange: { label: "Exchange", color: "text-amber-700", bg: "bg-amber-100" },
};

export const RETURN_STATUSES = [
  "requested", "approved", "rejected", "completed", "cancelled",
] as const;

export const RETURN_STATUS_TRANSITIONS: Record<string, string[]> = {
  requested: ["approved", "rejected", "cancelled"],
  approved: ["completed", "cancelled"],
  rejected: [],
  completed: [],
  cancelled: [],
};

export const RETURN_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  requested: { label: "Requested", color: "text-amber-700", bg: "bg-amber-100" },
  approved: { label: "Approved", color: "text-blue-700", bg: "bg-blue-100" },
  rejected: { label: "Rejected", color: "text-rose-700", bg: "bg-rose-100" },
  completed: { label: "Completed", color: "text-emerald-700", bg: "bg-emerald-100" },
  cancelled: { label: "Cancelled", color: "text-neutral-700", bg: "bg-neutral-100" },
};

export const REFUND_METHODS = ["original", "wallet", "store_credit", "none"] as const;

export const REFUND_METHOD_LABELS: Record<string, string> = {
  original: "Original Payment Method",
  wallet: "Customer Wallet",
  store_credit: "Store Credit",
  none: "No Refund (Replacement/Exchange)",
};

// ---------------- Tax module ----------------

export interface TaxClass {
  id: UUID;
  tenant_id: UUID;
  name: string;
  description?: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaxZone {
  id: UUID;
  tenant_id: UUID;
  name: string;
  country_code?: string;
  state_code?: string;
  city?: string;
  postal_code_pattern?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaxRate {
  id: UUID;
  tenant_id: UUID;
  tax_class_id: UUID;
  tax_zone_id: UUID;
  name: string;
  rate: number;
  compound: boolean;
  priority: number;
  is_active: boolean;
  effective_from?: string;
  effective_to?: string;
  created_at: string;
  updated_at: string;
  tax_class_name?: string;
  tax_zone_name?: string;
}

// ---------------- Shipping module ----------------

export interface ShippingMethod {
  id: UUID;
  tenant_id: UUID;
  name: string;
  code: string;
  description?: string;
  base_rate: number;
  weight_rate: number; // additional rate per kg (0 = flat rate)
  currency_code: string;
  min_days?: number;
  max_days?: number;
  free_shipping_threshold?: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ShippingZone {
  id: UUID;
  tenant_id: UUID;
  name: string;
  country_code?: string;
  state_code?: string;
  city?: string;
  postal_code_pattern?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShippingRate {
  id: UUID;
  tenant_id: UUID;
  shipping_method_id: UUID;
  shipping_zone_id: UUID;
  rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  shipping_method_name?: string;
  shipping_zone_name?: string;
}

// ---------------- Shipping Providers Module ----------------

export interface ShippingProvider {
  id: UUID;
  tenant_id: UUID;
  provider_code: string; // e.g. "delhivery"
  display_name: string;
  api_key: string;
  api_base_url: string; // override; empty = provider default
  is_enabled: boolean;
  is_test_mode: boolean;
  config?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Shipment {
  id: UUID;
  tenant_id: UUID;
  order_id: UUID;
  provider_code: string;
  tracking_number: string;
  carrier: string;
  awb_url: string;
  status: string; // pending|booked|picked_up|in_transit|out_for_delivery|delivered|cancelled|failed
  pickup_scheduled_at?: string;
  picked_up_at?: string;
  delivered_at?: string;
  estimated_delivery?: string;
  raw_metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Split-shipment: items linked to this shipment
  items?: ShipmentItem[];
}

// ShipmentItem links a shipment to a specific order item with a quantity.
export interface ShipmentItem {
  id: UUID;
  shipment_id: UUID;
  order_item_id: UUID;
  quantity: number;
  // Joined display fields
  product_name?: string;
  product_id?: UUID;
  sku?: string;
  unit_price?: number;
}

// ShipmentCreateRequest is the body for creating a shipment (split-shipment support).
export interface ShipmentCreateRequest {
  provider_code: string;
  item_ids?: UUID[];
  item_quantities?: { order_item_id: UUID; quantity: number }[];
  estimated_delivery?: string;
}

export interface TrackingEvent {
  status: string;
  location?: string;
  description?: string;
  timestamp?: string;
}

export interface TrackingResponse {
  tracking_number: string;
  carrier: string;
  status: string;
  estimated_delivery?: string;
  events?: TrackingEvent[];
  shipment?: Shipment;
}

export interface ProviderTestResult {
  ok: boolean;
  message: string;
}

export const SHIPMENT_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "text-neutral-700", bg: "bg-neutral-100" },
  booked: { label: "Booked", color: "text-blue-700", bg: "bg-blue-100" },
  picked_up: { label: "Picked Up", color: "text-red-700", bg: "bg-red-100" },
  in_transit: { label: "In Transit", color: "text-amber-700", bg: "bg-amber-100" },
  out_for_delivery: { label: "Out for Delivery", color: "text-orange-700", bg: "bg-orange-100" },
  delivered: { label: "Delivered", color: "text-emerald-700", bg: "bg-emerald-100" },
  cancelled: { label: "Cancelled", color: "text-neutral-500", bg: "bg-neutral-100" },
  failed: { label: "Failed", color: "text-rose-700", bg: "bg-rose-100" },
};

export const SUPPORTED_SHIPPING_PROVIDERS = [
  { code: "delhivery", name: "Delhivery" },
  { code: "ekart", name: "EKart" },
  { code: "fedex", name: "FedEx" },
  { code: "shiprocket", name: "Shiprocket" },
];

// ---------------- Payments Module ----------------

export interface PaymentTransaction {
  id: UUID;
  tenant_id: UUID;
  order_id: UUID;
  user_id?: UUID;
  gateway: string;
  gateway_txn_id?: string;
  type: string;              // capture, authorize, refund, void
  status: string;            // pending, success, failed, refunded, partial_refund
  amount: number;
  currency_code: string;
  refunded_amount: number;
  gateway_response?: Record<string, any>;
  failure_reason?: string;
  customer_email?: string;
  customer_name?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  order_number?: string;
  order_grand_total?: number;
  order_status?: string;
}

export interface PaymentGatewayConfig {
  id: UUID;
  tenant_id: UUID;
  gateway_code: string;
  display_name: string;
  is_enabled: boolean;
  is_test_mode: boolean;
  sort_order: number;
  config?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Store module / feature flag managed under Developer → Modules & Features.
export interface StoreModule {
  id: UUID;
  tenant_id: UUID;
  module_code: string;
  display_name: string;
  description: string;
  is_enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface RefundRequest {
  amount: number;
  reason?: string;
}

export interface GatewaySummary {
  gateway: string;
  count: number;
  total_amount: number;
  refunded_amount: number;
}

export interface PaymentStats {
  total_collected: number;
  total_refunded: number;
  net_revenue: number;
  transaction_count: number;
  refund_count: number;
  pending_count: number;
  failed_count: number;
  by_gateway: GatewaySummary[];
}

export interface InventoryItem {
  product_id: UUID;
  product_name: string;
  product_slug: string;
  sku: string;
  variant_id?: UUID;
  variant_name?: string;
  stock: number;
  branch_managed?: boolean;
  low_stock_threshold: number;
  track_inventory: boolean;
  is_low_stock: boolean;
  is_out_of_stock: boolean;
}

export interface InventoryStats {
  total_skus: number;
  out_of_stock: number;
  low_stock: number;
  in_stock: number;
  total_stock_value: number;
}

export interface StockMovement {
  id: UUID;
  tenant_id: UUID;
  product_id: UUID;
  product_name: string;
  variant_id?: UUID;
  variant_name?: string;
  movement_type: string;
  quantity: number;
  reason?: string;
  reference?: string;
  created_by?: UUID;
  created_at: string;
}

// ---- Setup / Installation ----

export interface SetupStatus {
  needs_setup: boolean;
  has_store: boolean;
  has_superadmin: boolean;
  superadmin_count: number;
  tenant_count: number;
  setup_complete: boolean;
}

export interface SetupCompleteRequest {
  store_name: string;
  store_slug?: string;
  store_description?: string;
  admin_email: string;
  admin_password: string;
  admin_name: string;
  default_language?: string;
  supported_languages?: string[];
  brand_color?: string;
}

// ---- Platform (superadmin) types ----

export interface PlatformStats {
  tenant_count: number;
  active_tenants: number;
  inactive_tenants: number;
  total_products: number;
  total_orders: number;
  total_customers: number;
  total_staff: number;
  total_vendors: number;
  total_revenue: number;
  orders_by_status: Record<string, number>;
  tenants_by_plan: Record<string, number>;
  top_tenants: TenantKPI[];
  recent_orders: PlatformOrder[];
  new_tenants_this_month: number;
}

export interface TenantKPI {
  tenant_id: UUID;
  slug: string;
  name: string;
  is_active: boolean;
  plan: string;
  orders: number;
  products: number;
  customers: number;
  revenue: number;
}

export interface PlatformOrder {
  id: UUID;
  tenant_id: UUID;
  tenant_slug: string;
  tenant_name: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
}

export interface DeveloperSettings {
  system: {
    app_env: string;
    app_name: string;
    port: string;
    version: string;
    commit?: string;
    build_date?: string;
    go_version: string;
    uptime: string;
    started_at: string;
    num_cpu: number;
    goroutines: number;
  };
  logging: {
    log_level: string;
    log_format: string;
  };
  database: {
    max_conns: number;
    min_conns: number;
    max_conn_lifetime: string;
    max_conn_idle_time: string;
  };
  redis: {
    addr: string;
    db: number;
    has_password: boolean;
  };
  jwt: {
    access_ttl: string;
    refresh_ttl: string;
    secret_set: boolean;
    secret_len: number;
  };
  cors: {
    allowed_origins: string[];
    max_age: string;
  };
  http: {
    read_timeout: string;
    write_timeout: string;
    idle_timeout: string;
    shutdown_timeout: string;
  };
  rate_limiting: {
    enabled: boolean;
    requests: number;
    window: string;
    burst: number;
  };
  cookie: {
    secure: boolean;
    same_site: string;
    domain: string;
  };
  uploads: {
    max_size: number;
    allowed_types: string[];
  };
  smtp: {
    host: string;
    port: number;
    user: string;
    from: string;
    from_name: string;
    has_password: boolean;
    enabled: boolean;
  };
  payments: {
    test_payments_enabled: boolean;
    razorpay_key_id: string;
    has_razorpay_secret: boolean;
  };
  currency: {
    cache_ttl: string;
  };
}

export interface PlatformHealth {
  status: string;
  uptime: string;
  goroutines: number;
  memory: {
    alloc_mb: number;
    total_alloc_mb: number;
    sys_mb: number;
    gc_count: number;
  };
  cpu: {
    num_cpu: number;
  };
}

// ---- Wallet ----

export interface CustomerWallet {
  id: UUID;
  tenant_id: UUID;
  user_id: UUID;
  balance: number;
  currency_code: string;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: UUID;
  tenant_id: UUID;
  wallet_id: UUID;
  user_id: UUID;
  order_id?: UUID;
  payment_txn_id?: UUID;
  type: "credit" | "debit";
  source: "topup" | "purchase" | "refund" | "admin_adjustment";
  amount: number;
  balance_after: number;
  currency_code: string;
  description: string;
  reference?: string;
  created_at: string;
}

export interface WalletTransactionListResponse {
  items: WalletTransaction[];
  total: number;
  limit: number;
  offset: number;
}

export interface WalletStats {
  wallet_count: number;
  total_balance: number;
  total_topups: number;
  total_purchases: number;
}

// ---------------- Notifications ----------------

export interface NotificationEvent {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
  is_instant: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationTemplateParameter {
  key: string;
  label: string;
  required: boolean;
}

export interface NotificationRecipient {
  id?: string;
  tenant_id?: string;
  template_id?: string;
  name: string;
  email: string;
  phone: string;
  created_at?: string;
}

export interface NotificationTemplate {
  id: string;
  tenant_id: string;
  event_id: string;
  event_code?: string;
  event_name?: string;
  name: string;
  medium: "email" | "sms" | "push";
  subject: string;
  body_html: string;
  body_text: string;
  parameters: NotificationTemplateParameter[];
  recipient_type: "customer" | "staff" | "business_admin" | "all_staff" | "all_customers" | "specific_emails";
  is_active: boolean;
  recipients?: NotificationRecipient[];
  created_at: string;
  updated_at: string;
}

export interface NotificationTemplateReq {
  event_id: string;
  name: string;
  medium: string;
  subject: string;
  body_html: string;
  body_text: string;
  parameters: NotificationTemplateParameter[];
  recipient_type: string;
  is_active: boolean;
  recipients: { name: string; email: string; phone: string }[];
}

export interface NotificationEventReq {
  code: string;
  name: string;
  description: string;
  is_instant: boolean;
  is_active: boolean;
}

export interface NotificationPreviewReq {
  template_id?: string;
  subject: string;
  body_html: string;
  body_text: string;
  parameters: Record<string, string>;
}

export interface NotificationPreviewResult {
  subject: string;
  body_html: string;
  body_text: string;
}

export interface NotificationSendReq {
  template_id: string;
  to: string[];
  parameters: Record<string, string>;
}

export interface NotificationSendResult {
  results: { recipient: string; status: string; error?: string }[];
}

export interface NotificationLog {
  id: string;
  tenant_id: string;
  template_id?: string;
  event_id?: string;
  medium: string;
  recipient: string;
  subject: string;
  body: string;
  status: "pending" | "sent" | "failed";
  error?: string;
  sent_at: string;
  created_at: string;
}

export interface NotificationLogsResponse {
  items: NotificationLog[];
  total: number;
  limit: number;
  offset: number;
}

// ===== Store Pages (Page Builder) =====

export interface PageBlock {
  id: string;
  type: string;
  props: Record<string, any>;
}

export interface StorePage {
  id: UUID;
  tenant_id: UUID;
  slug: string;
  title: string;
  page_type: string;
  status: string;
  blocks: PageBlock[];
  meta_title: string;
  meta_description: string;
  is_system: boolean;
  is_customized: boolean;
  created_at: string;
  updated_at: string;
}

export interface StorePageRequest {
  slug: string;
  title: string;
  page_type: string;
  status: string;
  blocks: PageBlock[];
  meta_title: string;
  meta_description: string;
}

export const PAGE_TYPES: { value: string; label: string }[] = [
  { value: "home", label: "Home / Landing" },
  { value: "about", label: "About Us" },
  { value: "contact", label: "Contact Us" },
  { value: "privacy", label: "Privacy Policy" },
  { value: "terms", label: "Terms & Conditions" },
  { value: "custom", label: "Custom Page" },
];

export const PAGE_STATUSES: { value: string; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
];

export const BLOCK_TYPES: {
  type: string;
  label: string;
  icon: string;
  category: string;
  defaultProps: Record<string, any>;
}[] = [
  // Core blocks
  { type: "hero", label: "Hero Section", icon: "Image", category: "Core", defaultProps: { title: "Welcome to our store", subtitle: "Discover amazing products", buttonText: "Shop Now", buttonLink: "", backgroundImage: "", align: "center", textColor: "#ffffff", backgroundColor: "#dc2626" } },
  { type: "rich_text", label: "Rich Text", icon: "FileText", category: "Core", defaultProps: { content: "<p>Edit this text block.</p>" } },
  { type: "image", label: "Image", icon: "Image", category: "Core", defaultProps: { src: "", alt: "", width: "full", rounded: true, caption: "" } },
  { type: "gallery", label: "Image Gallery", icon: "Images", category: "Core", defaultProps: { title: "", images: [], columns: 3 } },
  { type: "cta", label: "Call to Action", icon: "MousePointerClick", category: "Core", defaultProps: { title: "Ready to shop?", buttonText: "Get Started", buttonLink: "", align: "center", backgroundColor: "#dc2626", textColor: "#ffffff" } },
  { type: "spacer", label: "Spacer", icon: "Minus", category: "Core", defaultProps: { height: 48 } },
  { type: "divider", label: "Divider", icon: "Minus", category: "Core", defaultProps: { style: "solid", color: "#e5e7eb" } },
  { type: "banner", label: "Banner / Promo", icon: "Megaphone", category: "Core", defaultProps: { title: "Special Offer!", subtitle: "Limited time only", buttonText: "Shop Now", buttonLink: "", backgroundColor: "#f59e0b", textColor: "#ffffff" } },
  // Commerce blocks
  { type: "featured_products", label: "Featured Products", icon: "Package", category: "Commerce", defaultProps: { title: "Featured Products", source: "featured", product_ids: [], category: "", limit: 8, columns: 4 } },
  { type: "category_showcase", label: "Category Showcase", icon: "Grid3x3", category: "Commerce", defaultProps: { title: "Shop by Category", source: "all", category_ids: [], limit: 6, columns: 3 } },
  { type: "product_carousel", label: "Product Carousel", icon: "GalleryHorizontalEnd", category: "Commerce", defaultProps: { title: "New Arrivals", source: "all", product_ids: [], category: "", limit: 10 } },
  { type: "testimonials", label: "Testimonials", icon: "Quote", category: "Commerce", defaultProps: { title: "What Our Customers Say", items: [{ name: "John D.", text: "Great products and fast shipping!", rating: 5 }, { name: "Jane S.", text: "Best online shopping experience.", rating: 5 }] } },
  { type: "reviews", label: "Reviews", icon: "Star", category: "Commerce", defaultProps: { title: "Customer Reviews", limit: 6 } },
  // Info blocks
  { type: "faq", label: "FAQ Accordion", icon: "HelpCircle", category: "Info", defaultProps: { title: "Frequently Asked Questions", items: [{ question: "How long does shipping take?", answer: "Typically 3-5 business days." }, { question: "What is your return policy?", answer: "We accept returns within 30 days." }] } },
  { type: "contact_form", label: "Contact Form", icon: "Mail", category: "Info", defaultProps: { title: "Contact Us", subtitle: "We'd love to hear from you", email: "", showMap: false, fields: { name: true, email: true, phone: false, subject: true, message: true }, buttonText: "Send Message", successMessage: "Thank you! Your message has been sent.", backgroundColor: "" } },
  { type: "map", label: "Map / Location", icon: "MapPin", category: "Info", defaultProps: { title: "Our Location", address: "", latitude: 0, longitude: 0, zoom: 14 } },
  { type: "team", label: "Team Members", icon: "Users", category: "Info", defaultProps: { title: "Our Team", members: [{ name: "John Doe", role: "CEO", bio: "", image: "" }, { name: "Jane Smith", role: "CTO", bio: "", image: "" }] } },
  { type: "stats", label: "Stats / Counters", icon: "BarChart3", category: "Info", defaultProps: { title: "", items: [{ label: "Customers", value: "10K+", icon: "Users" }, { label: "Products", value: "500+", icon: "Package" }, { label: "Countries", value: "25", icon: "Globe" }] } },
  { type: "timeline", label: "Timeline", icon: "GitCommit", category: "Info", defaultProps: { title: "Our Journey", items: [{ year: "2020", title: "Founded", description: "Started with a vision" }, { year: "2023", title: "Growth", description: "Expanded globally" }] } },
  // Layout blocks
  { type: "columns", label: "Columns", icon: "Columns3", category: "Layout", defaultProps: { columns: 2, gap: 4, items: [{ content: "<p>Column 1</p>" }, { content: "<p>Column 2</p>" }] } },
  { type: "feature_grid", label: "Feature Grid", icon: "LayoutGrid", category: "Layout", defaultProps: { title: "Why Choose Us", columns: 3, features: [{ icon: "Truck", title: "Free Shipping", text: "On orders over $50" }, { icon: "RotateCcw", title: "Easy Returns", text: "30-day return policy" }, { icon: "ShieldCheck", title: "Secure Payment", text: "100% secure checkout" }] } },
  { type: "custom_html", label: "Custom HTML/CSS/JS", icon: "Code2", category: "Layout", defaultProps: { title: "", html: "", css: "", js: "", height: 300 } },
  { type: "footer", label: "Footer", icon: "PanelBottom", category: "Layout", defaultProps: { backgroundColor: "#1e293b", textColor: "#cbd5e1", columns: [{ title: "Shop", links: [{ label: "All Products", url: "/demo" }, { label: "Featured", url: "/demo" }] }, { title: "Company", links: [{ label: "About Us", url: "/demo/about" }, { label: "Contact", url: "/demo/contact" }] }, { title: "Legal", links: [{ label: "Privacy Policy", url: "/demo/privacy-policy" }, { label: "Terms", url: "/demo/terms" }] }], social: { facebook: "", twitter: "", instagram: "", youtube: "", linkedin: "" }, showSocial: true, copyright: "© 2024 TruCommerce. All rights reserved.", showPayment: true } },
];

// ===== Bulk Export =====
export interface ExportJob {
  id: UUID;
  tenant_id: UUID;
  user_id: UUID;
  type: string;
  format: string;
  filters: Record<string, unknown>;
  email: string;
  status: "pending" | "running" | "completed" | "failed";
  file_path?: string;
  file_name?: string;
  file_size: number;
  rows_total: number;
  rows_done: number;
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface ExportRequest {
  type: string;
  format?: string;
  filters?: Record<string, string>;
  email?: string;
}

export interface ExportTypeMeta {
  key: string;
  name: string;
  description: string;
}

// ServiceZone is one concentric delivery ring of a branch's service area.
// charge_type "free" | "flat" | "per_km" — charge is the flat amount or the
// per-km rate (per_km applies to the distance beyond the previous ring).
export interface ServiceZone {
  radius_km: number;
  charge_type: "free" | "flat" | "per_km";
  charge: number;
  label?: string;
}

// Branch is a store outlet with its own delivery service area.
export interface Branch {
  id: UUID;
  tenant_id: UUID;
  name: string;
  slug: string;
  phone?: string;
  email?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  center_lat: number;
  center_lng: number;
  radius_km: number;
  service_zones?: ServiceZone[];
  areas: string[];
  is_active: boolean;
  is_default?: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}
