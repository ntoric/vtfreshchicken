export type UUID = string;

export interface Tenant {
  id: UUID;
  slug: string;
  name: string;
  description: string;
  is_active: boolean;
}

export interface TenantSettings {
  tenant_id: UUID;
  default_currency_id?: UUID;
  default_language: string;
  supported_languages: string[];
  brand_color: string;
  logo_url: string;
  landing_page_enabled: boolean;
  landing_page_content?: LandingPageContent;
  anonymous_checkout?: boolean;
  return_period_days?: number;
  refund_period_days?: number;
  replacement_period_days?: number;
  meta_title?: string;
  meta_description?: string;
  og_image?: string;
  site_url?: string;
  social_links?: string[];
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

export interface Currency {
  id: UUID;
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  is_active: boolean;
}

export interface Language {
  code: string;
  name: string;
  is_active: boolean;
}

export interface Category {
  id: UUID;
  tenant_id: UUID;
  parent_id?: UUID;
  slug: string;
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
  meta_title?: string;
  meta_description?: string;
}

export interface AttributeOption {
  id: UUID;
  attribute_id: UUID;
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
  options?: AttributeOption[];
}

export interface VariantAttr {
  attribute_slug: string;
  attribute_name: string;
  option_value: string;
  option_label: string;
}

export interface Variant {
  id: UUID;
  product_id: UUID;
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
  attribute_slug: string;
  attribute_name: string;
  value_text?: string;
  value_number?: number;
  value_bool?: boolean;
  option_id?: UUID;
  option_label?: string;
}

export interface ProductImage {
  id: UUID;
  product_id: UUID;
  url: string;
  alt: string;
  sort_order: number;
}

export interface Product {
  id: UUID;
  tenant_id: UUID;
  category_id?: UUID;
  category_slug?: string;
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
  low_stock_threshold?: number;
  track_inventory?: boolean;
  requires_shipping?: boolean;
  weight?: number;       // kilograms
  length?: number;       // centimeters
  width?: number;        // centimeters
  height?: number;       // centimeters
  free_shipping?: boolean;
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
  created_at: string;
  updated_at: string;
  effective_price?: number;
  discounted_price?: number;
  discount_pct?: number;
}

export interface ProductListResponse {
  items: Product[] | null;
  total: number;
  limit: number;
  offset: number;
  currency: string;
  language: string;
}

export interface Offer {
  id: UUID;
  tenant_id: UUID;
  name: string;
  description: string;
  offer_type: string; // "percentage" | "fixed"
  value: number;
  starts_at?: string;
  ends_at?: string;
  is_active: boolean;
}

export interface BootstrapResponse {
  settings: TenantSettings;
  store_name?: string;
  currencies: Currency[];
  languages: Language[];
  categories: Category[];
  attributes: Attribute[];
  offers?: Offer[];
  shipping_methods?: ShippingMethod[];
}

export interface CartItem {
  id: UUID;
  product_id: UUID;
  variant_id?: UUID;
  product_name: string;
  variant_name?: string;
  image_url: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  tax_class_id?: UUID;
  requires_shipping?: boolean;
  weight?: number;        // per-unit weight in kg
  free_shipping?: boolean;
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

export interface TaxCalculationResult {
  tax_total: number;
  breakdown: TaxBreakdownLine[];
  tax_inclusive: boolean;
}

// ---------------- Shipping Module ----------------

export interface ShippingMethod {
  id: UUID;
  tenant_id: UUID;
  name: string;
  code: string;
  description?: string;
  base_rate: number;
  weight_rate?: number; // additional rate per kg
  currency_code: string;
  min_days?: number;
  max_days?: number;
  free_shipping_threshold?: number;
  is_active: boolean;
  sort_order: number;
}

export interface ShippingOption {
  method_id: UUID;
  code: string;
  name: string;
  description: string;
  rate: number;
  currency_code: string;
  min_days?: number;
  max_days?: number;
  is_free: boolean;
  estimated_delivery?: string;
}

export interface ShippingCalculationItem {
  product_id: UUID;
  quantity: number;
  line_total: number;
  requires_shipping: boolean;
  weight: number;
  free_shipping: boolean;
}

export interface ShippingCalculationResult {
  options: ShippingOption[];
  // Per-item shipping options (split-shipment support)
  per_item_options?: ItemShippingOptions[];
}

// ItemShippingOptions lists the shipping options available for a single cart item.
export interface ItemShippingOptions {
  product_id: UUID;
  options: ShippingOption[];
}

export interface Shipment {
  id: UUID;
  tenant_id: UUID;
  order_id: UUID;
  provider_code: string;
  tracking_number: string;
  carrier: string;
  awb_url: string;
  status: string;
  pickup_scheduled_at?: string;
  picked_up_at?: string;
  delivered_at?: string;
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
  product_name?: string;
  product_id?: UUID;
  sku?: string;
  unit_price?: number;
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

export interface Cart {
  id: UUID;
  tenant_id: UUID;
  user_id?: UUID;
  session_id: string;
  currency_code: string;
  items: CartItem[];
  updated_at: string;
}

export interface CartResponse {
  cart: Cart;
  subtotal: number;
  item_count: number;
}

export interface WishlistItem {
  id: UUID;
  product_id: UUID;
  variant_id?: UUID;
  product_name: string;
  image_url: string;
  slug: string;
  base_price: number;
  added_at: string;
}

export interface Wishlist {
  id: UUID;
  tenant_id: UUID;
  user_id?: UUID;
  session_id: string;
  items?: WishlistItem[];
}

export interface WishlistResponse {
  wishlist: Wishlist;
  item_count: number;
}

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
}

export interface PurchasedProduct {
  product_id: UUID;
  slug: string;
  name: string;
  image_url: string;
  order_id: UUID;
  order_date: string;
  order_status: string;
  has_reviewed: boolean;
  delivered_at?: string;
  return_eligible: boolean;
  refund_eligible: boolean;
  replacement_eligible: boolean;
  return_expires_at?: string;
  refund_expires_at?: string;
  replacement_expires_at?: string;
  return_allowed: boolean;
  refund_allowed: boolean;
  replacement_allowed: boolean;
}

export interface OrderReturnEligibility {
  delivered_at?: string;
  return_eligible: boolean;
  refund_eligible: boolean;
  replacement_eligible: boolean;
  return_expires_at?: string;
  refund_expires_at?: string;
  replacement_expires_at?: string;
  return_allowed: boolean;
  refund_allowed: boolean;
  replacement_allowed: boolean;
}

export interface ReviewSummary {
  rating: number;
  total_reviews: number;
  distribution: Record<number, number>;
}

export interface ReviewsResponse {
  items: Review[];
  summary: ReviewSummary;
  total: number;
}

// ============================================================
// Address, Checkout, Orders
// ============================================================

export interface Address {
  id: UUID;
  user_id: UUID;
  tenant_id: UUID;
  label: string;
  first_name: string;
  last_name: string;
  email: string;
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

export interface PaymentDetails {
  card_number?: string;
  card_name?: string;
  card_last4?: string;
  card_brand?: string;
  card_expiry?: string;
  card_cvv?: string;
  paypal_email?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
}

export interface PaymentGatewayInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  group: string;
  requires_redirect?: boolean;
  is_active: boolean;
  sort_order: number;
  public_config?: Record<string, unknown>;
}

export type TestScenario =
  | "success"
  | "declined"
  | "insufficient_funds"
  | "expired_card"
  | "incorrect_cvc"
  | "processing_error"
  | "3ds_challenge"
  | "fraud_blocked"
  | "slow_approval"
  | "refund";

export interface TestCard {
  number: string;
  brand: string;
  scenario: TestScenario;
  description: string;
  expected_result: "paid" | "failed" | "pending";
}

export interface TestTransaction {
  id: string;
  gateway: string;
  amount: number;
  currency: string;
  scenario: TestScenario;
  card_number: string;
  card_brand: string;
  success: boolean;
  status: string;
  transaction_id: string;
  message: string;
  customer_name: string;
  customer_email: string;
  timestamp: string;
  duration_ms: number;
}

export interface CheckoutRequest {
  shipping_address: AddressInput;
  billing_address?: AddressInput;
  payment_method: string;
  payment_details?: PaymentDetails;
  currency_code: string;
  discount_code?: string;
  shipping_method?: string;
  notes?: string;
  // Per-item shipping methods (split-shipment support)
  item_shipping_methods?: ItemShippingMethod[];
}

// ItemShippingMethod assigns a shipping method to a specific cart item at checkout.
export interface ItemShippingMethod {
  cart_item_index: number;
  method_code: string;
}

export interface OrderItem {
  id: UUID;
  product_id: UUID;
  variant_id?: UUID;
  name: string;
  sku: string;
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

export interface Order {
  id: UUID;
  tenant_id: UUID;
  user_id?: UUID;
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
  shipping_address?: AddressInput;
  billing_address?: AddressInput;
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
}

export interface OrderResponse {
  order: Order;
  shipping_address: AddressInput;
  billing_address: AddressInput;
  payment_method: string;
  payment_details?: PaymentDetails;
  shipping_method: string;
  transaction_id?: string;
}

// ---- Customer Auth ----

export interface CustomerUser {
  id: UUID;
  tenant_id?: UUID;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  phone?: string;
  marketing_consent?: boolean;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: CustomerUser;
}

// ---- Wallet ----

export interface Wallet {
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

export interface WalletTopupResponse {
  wallet: WalletTransaction;
  payment_txn_id: UUID;
  transaction_id: string;
  message: string;
}

// ===== Returns / Replacements / Refunds =====

export interface ReturnStatusEvent {
  status: string;
  timestamp: string;
  actor: string;
  note?: string;
}

export interface OrderReturnItem {
  id: UUID;
  return_id: UUID;
  order_item_id: UUID;
  product_id?: UUID;
  variant_id?: UUID;
  name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  reason: string;
}

export interface OrderReturn {
  id: UUID;
  tenant_id: UUID;
  order_id: UUID;
  return_number: string;
  type: "refund" | "replacement" | "exchange";
  status: "requested" | "approved" | "rejected" | "completed" | "cancelled";
  reason: string;
  refund_amount: number;
  refund_method: "original" | "wallet" | "store_credit" | "none";
  restock: boolean;
  status_history: ReturnStatusEvent[];
  items?: OrderReturnItem[];
  created_by?: UUID;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  order_status?: string;
  customer_name?: string;
  customer_email?: string;
}

export interface ReturnRequestItem {
  order_item_id: UUID;
  quantity: number;
  reason: string;
}

export interface CreateReturnRequest {
  type: "refund" | "replacement" | "exchange";
  reason: string;
  refund_method?: "original" | "wallet" | "store_credit" | "none";
  restock?: boolean;
  items: ReturnRequestItem[];
}

export interface ReturnListResponse {
  items: OrderReturn[];
  total: number;
  limit: number;
  offset: number;
}

export const RETURN_STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const RETURN_TYPE_LABELS: Record<string, string> = {
  refund: "Refund",
  replacement: "Replacement",
  exchange: "Exchange",
};

export const REFUND_METHOD_LABELS: Record<string, string> = {
  original: "Original Payment Method",
  wallet: "Store Wallet",
  store_credit: "Store Credit",
  none: "No Refund",
};

// ===== Store Pages (Page Builder) =====

export interface PageBlock {
  id: string;
  type: string;
  props: Record<string, any>;
}

export interface StorePage {
  id: string;
  tenant_id: string;
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
