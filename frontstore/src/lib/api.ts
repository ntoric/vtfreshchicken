import type { BootstrapResponse, CartResponse, Product, ProductListResponse, Review, ReviewsResponse, WishlistResponse, CheckoutRequest, OrderResponse, Order, Address, PaymentGatewayInfo, TestCard, TestTransaction, TaxCalculationResult, ShippingCalculationResult, ShippingCalculationItem, Wallet, WalletTransaction, WalletTransactionListResponse, WalletTopupResponse, PaymentDetails, OrderReturn, CreateReturnRequest, ReturnListResponse, StorePage, PurchasedProduct, OrderReturnEligibility, Shipment, TrackingResponse } from "@/types";

// Server-side (RSC/SSR) runs inside the container and uses the docker service name.
// Client-side uses a relative path so requests go through the Next.js rewrite proxy
// (avoids CORS and browser not being able to reach the backend directly).
const SERVER_API_BASE =
  process.env.INTERNAL_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://backend:8080";
const CLIENT_API_BASE = "";

function apiBase(): string {
  return typeof window === "undefined" ? SERVER_API_BASE : CLIENT_API_BASE;
}

export function tenantApiBase(tenant: string) {
  return `${apiBase()}/api/t/${tenant}`;
}

// ---- Auth token helpers (used by fetchJson and auth-protected calls) ----

const TOKEN_KEY = "tc_customer_token";
const USER_KEY = "tc_customer_user";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
export function getStoredCustomer(): { id: string; email: string; full_name: string; role: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Generate a UUID v4 idempotency key for safe retry of mutation requests.
export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 11);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init?.headers as Record<string, string> || {}) },
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) {
    // Auto-logout on 401 (expired/invalid token) — dispatch a global event
    // that the AuthProvider listens for to clear state and redirect to login.
    if (res.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("tc-auth-expired"));
    }
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchBootstrap(tenant: string): Promise<BootstrapResponse> {
  return fetchJson<BootstrapResponse>(`${tenantApiBase(tenant)}/bootstrap`);
}

export interface ProductQuery {
  category?: string;
  search?: string;
  min_price?: number;
  max_price?: number;
  currency?: string;
  featured?: boolean;
  exclude?: string; // product ID to exclude (for "similar products")
  product_ids?: string[]; // comma-separated product IDs for page builder product picker
  limit?: number;
  offset?: number;
  attrs?: Record<string, string[]>;
}

export async function fetchProducts(
  tenant: string,
  query: ProductQuery,
  lang?: string
): Promise<ProductListResponse> {
  const params = new URLSearchParams();
  if (query.category) params.set("category", query.category);
  if (query.search) params.set("search", query.search);
  if (query.min_price != null) params.set("min_price", String(query.min_price));
  if (query.max_price != null) params.set("max_price", String(query.max_price));
  if (query.currency) params.set("currency", query.currency);
  if (query.featured) params.set("featured", "true");
  if (query.exclude) params.set("exclude", query.exclude);
  if (query.product_ids && query.product_ids.length > 0) params.set("product_ids", query.product_ids.join(","));
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.offset != null) params.set("offset", String(query.offset));
  if (query.attrs) {
    for (const [slug, vals] of Object.entries(query.attrs)) {
      for (const v of vals) params.append("attr", `${slug}:${v}`);
    }
  }
  const headers: Record<string, string> = {};
  if (lang) headers["Accept-Language"] = lang;
  return fetchJson<ProductListResponse>(`${tenantApiBase(tenant)}/products?${params}`, { headers });
}

export async function fetchProduct(
  tenant: string,
  slug: string,
  currency?: string,
  lang?: string
): Promise<{ product: Product; currency: string; language: string }> {
  const params = new URLSearchParams();
  if (currency) params.set("currency", currency);
  const headers: Record<string, string> = {};
  if (lang) headers["Accept-Language"] = lang;
  return fetchJson(`${tenantApiBase(tenant)}/products/${slug}?${params}`, { headers });
}

// ---- Cart ----
export async function fetchCart(tenant: string, currency?: string): Promise<CartResponse> {
  const params = new URLSearchParams();
  if (currency) params.set("currency", currency);
  return fetchJson<CartResponse>(`${tenantApiBase(tenant)}/cart?${params}`, { credentials: "include" });
}

export async function addToCart(
  tenant: string,
  body: { product_id: string; variant_id?: string; quantity: number; unit_price?: number; currency?: string }
): Promise<CartResponse> {
  return fetchJson<CartResponse>(`${tenantApiBase(tenant)}/cart/items`, {
    method: "POST",
    body: JSON.stringify(body),
    credentials: "include",
  });
}

export async function updateCartItem(
  tenant: string,
  itemId: string,
  quantity: number
): Promise<CartResponse> {
  return fetchJson<CartResponse>(`${tenantApiBase(tenant)}/cart/items/${itemId}`, {
    method: "PUT",
    body: JSON.stringify({ quantity }),
    credentials: "include",
  });
}

export async function removeCartItem(tenant: string, itemId: string): Promise<CartResponse> {
  return fetchJson<CartResponse>(`${tenantApiBase(tenant)}/cart/items/${itemId}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function clearCart(tenant: string): Promise<CartResponse> {
  return fetchJson<CartResponse>(`${tenantApiBase(tenant)}/cart`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function fetchCartCount(tenant: string): Promise<{ count: number }> {
  return fetchJson<{ count: number }>(`${tenantApiBase(tenant)}/cart/count`, { credentials: "include" });
}

// ---- Wishlist ----
export async function fetchWishlist(tenant: string): Promise<WishlistResponse> {
  return fetchJson<WishlistResponse>(`${tenantApiBase(tenant)}/wishlist`, { credentials: "include" });
}

export async function addToWishlist(
  tenant: string,
  productId: string,
  variantId?: string
): Promise<WishlistResponse> {
  return fetchJson<WishlistResponse>(`${tenantApiBase(tenant)}/wishlist/items`, {
    method: "POST",
    body: JSON.stringify({ product_id: productId, variant_id: variantId || "" }),
    credentials: "include",
  });
}

export async function removeFromWishlist(tenant: string, itemId: string): Promise<WishlistResponse> {
  return fetchJson<WishlistResponse>(`${tenantApiBase(tenant)}/wishlist/items/${itemId}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function removeProductFromWishlist(tenant: string, productId: string): Promise<WishlistResponse> {
  return fetchJson<WishlistResponse>(`${tenantApiBase(tenant)}/wishlist/product/${productId}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function clearWishlist(tenant: string): Promise<WishlistResponse> {
  return fetchJson<WishlistResponse>(`${tenantApiBase(tenant)}/wishlist`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function checkWishlist(tenant: string, productId: string): Promise<{ in_wishlist: boolean }> {
  return fetchJson<{ in_wishlist: boolean }>(`${tenantApiBase(tenant)}/wishlist/check/${productId}`, { credentials: "include" });
}

// ---- Reviews ----
export async function fetchReviews(tenant: string, productId: string): Promise<ReviewsResponse> {
  return fetchJson<ReviewsResponse>(`${tenantApiBase(tenant)}/reviews/${productId}`, { credentials: "include" });
}

export async function createReview(
  tenant: string,
  productId: string,
  data: { rating: number; title: string; body: string; author_name?: string; images?: { url: string; alt?: string }[] }
): Promise<Review> {
  return fetchJson<Review>(`${tenantApiBase(tenant)}/reviews/${productId}`, {
    method: "POST",
    body: JSON.stringify(data),
    credentials: "include",
  });
}

export async function fetchPurchasedProducts(tenant: string): Promise<{ items: PurchasedProduct[]; total: number }> {
  return fetchJson(`${tenantApiBase(tenant)}/me/purchased-products`, { credentials: "include" });
}

export async function fetchMyReview(tenant: string, productId: string): Promise<{ review: Review | null }> {
  return fetchJson(`${tenantApiBase(tenant)}/reviews/${productId}/my`, { credentials: "include" });
}

export async function fetchMyReviews(tenant: string): Promise<{ items: Review[]; total: number }> {
  return fetchJson(`${tenantApiBase(tenant)}/me/reviews`, { credentials: "include" });
}

export interface UploadedImage {
  url: string;
  filename: string;
  size: number;
  type: string;
}

export async function uploadReviewImages(tenant: string, files: File[]): Promise<{ uploaded: UploadedImage[]; errors: { filename: string; error: string }[]; total: number }> {
  const fd = new FormData();
  for (const f of files) {
    fd.append("files", f);
  }
  const res = await fetch(`${tenantApiBase(tenant)}/upload/images`, {
    method: "POST",
    body: fd,
    credentials: "include",
    headers: authHeaders(),
  });
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("tc-auth-expired"));
    }
    const txt = await res.text();
    throw new Error(txt || `upload failed (${res.status})`);
  }
  return res.json();
}

// ---- Checkout ----
export async function placeOrder(tenant: string, data: CheckoutRequest, idempotencyKey?: string): Promise<OrderResponse> {
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  return fetchJson<OrderResponse>(`${tenantApiBase(tenant)}/checkout`, {
    method: "POST",
    body: JSON.stringify(data),
    credentials: "include",
    headers,
  });
}

export async function fetchPaymentMethods(tenant: string): Promise<{ methods: PaymentGatewayInfo[]; total: number; test_mode: boolean }> {
  return fetchJson(`${tenantApiBase(tenant)}/payment/methods`, { credentials: "include" });
}

export async function fetchTestCards(tenant: string): Promise<{ cards: TestCard[]; total: number }> {
  return fetchJson(`${tenantApiBase(tenant)}/payment/test/cards`, { credentials: "include" });
}

export async function fetchTestTransactions(tenant: string): Promise<{ transactions: TestTransaction[]; total: number }> {
  return fetchJson(`${tenantApiBase(tenant)}/payment/test/transactions`, { credentials: "include" });
}

export async function clearTestTransactions(tenant: string): Promise<void> {
  await fetchJson(`${tenantApiBase(tenant)}/payment/test/transactions`, {
    method: "DELETE",
    credentials: "include",
  });
}

export interface GatewayOrderResult {
  gateway_order_id: string;
  amount: number;
  currency: string;
  key_id?: string;
}

export async function createGatewayOrder(
  tenant: string,
  gatewayId: string,
  data: { amount: number; currency?: string; receipt?: string; customer_name?: string; customer_email?: string }
): Promise<GatewayOrderResult> {
  return fetchJson<GatewayOrderResult>(`${tenantApiBase(tenant)}/payment/${gatewayId}/create-order`, {
    method: "POST",
    body: JSON.stringify(data),
    credentials: "include",
  });
}

export async function fetchOrder(tenant: string, orderId: string): Promise<{ order: Order }> {
  return fetchJson<{ order: Order }>(`${tenantApiBase(tenant)}/orders/${orderId}`, {
    credentials: "include",
  });
}

export async function fetchMyOrders(
  tenant: string,
  params?: { status?: string; limit?: number; offset?: number }
): Promise<{ items: Order[]; total: number; limit: number; offset: number }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  const q = qs.toString();
  return fetchJson(`${tenantApiBase(tenant)}/orders${q ? `?${q}` : ""}`, { credentials: "include" });
}

// ---- Addresses (authenticated) ----
export async function fetchAddresses(tenant: string): Promise<{ items: Address[]; total: number }> {
  return fetchJson(`${tenantApiBase(tenant)}/addresses`, { credentials: "include" });
}

export async function saveAddress(
  tenant: string,
  addr: Partial<Address> & { line1: string; city: string; country: string }
): Promise<Address> {
  return fetchJson<Address>(`${tenantApiBase(tenant)}/addresses`, {
    method: "POST",
    body: JSON.stringify(addr),
    credentials: "include",
  });
}

export async function deleteAddress(tenant: string, addressId: string): Promise<{ deleted: boolean }> {
  return fetchJson(`${tenantApiBase(tenant)}/addresses/${addressId}`, {
    method: "DELETE",
    credentials: "include",
  });
}

// ---- Auth (customer) ----

export async function customerLogin(tenant: string, email: string, password: string) {
  const res = await fetch(`${tenantApiBase(tenant)}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || "Login failed");
  }
  const data = await res.json();
  setAuthToken(data.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
}

export async function customerRegister(tenant: string, email: string, password: string, fullName: string, phone?: string, marketingConsent?: boolean, idempotencyKey?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`${tenantApiBase(tenant)}/auth/register`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password, full_name: fullName, phone: phone || "", marketing_consent: marketingConsent || false }),
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || "Registration failed");
  }
  const data = await res.json();
  setAuthToken(data.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
}

// Register a customer from a completed guest order. Links prior guest orders
// from the same session to the new account.
export async function customerRegisterFromOrder(
  tenant: string,
  email: string,
  password: string,
  fullName: string,
  phone?: string,
  marketingConsent?: boolean,
  idempotencyKey?: string,
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`${tenantApiBase(tenant)}/auth/register-from-order`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password, full_name: fullName, phone: phone || "", marketing_consent: marketingConsent || false }),
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || "Registration failed");
  }
  const data = await res.json();
  setAuthToken(data.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
}

// GDPR — Data export (Art. 15 / Art. 20)
export async function exportMyData(tenant: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${tenantApiBase(tenant)}/me/export`, {
    headers: { ...authHeaders() },
    credentials: "include",
  });
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("tc-auth-expired"));
    }
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Export failed: ${res.status}`);
  }
  return res.json();
}

// GDPR — Account deletion (Art. 17)
export async function deleteMyAccount(tenant: string, password: string): Promise<{ message: string; deleted: boolean }> {
  const res = await fetch(`${tenantApiBase(tenant)}/me/delete`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ password }),
    credentials: "include",
  });
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("tc-auth-expired"));
    }
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Deletion failed: ${res.status}`);
  }
  clearAuthToken();
  return res.json();
}

// Discount validation — preview discount for a code + subtotal
export async function validateDiscountCode(
  tenant: string,
  code: string,
  subtotal: number,
): Promise<{ valid: boolean; discount: number; discount_type: string; value: number; new_subtotal: number; error?: string }> {
  const res = await fetch(`${tenantApiBase(tenant)}/discount/validate?code=${encodeURIComponent(code)}&subtotal=${subtotal}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { valid: false, discount: 0, discount_type: "", value: 0, new_subtotal: subtotal, error: (body as { error?: string }).error || "Invalid code" };
  }
  return body as { valid: boolean; discount: number; discount_type: string; value: number; new_subtotal: number };
}

// Tax calculation — preview tax for a cart + shipping address
export async function calculateTax(
  tenant: string,
  items: { product_id: string; product_name: string; quantity: number; unit_price: number; line_total: number; tax_class_id?: string }[],
  shippingAddress: { line1: string; city: string; state?: string; postal_code?: string; country: string },
  shippingTotal: number,
  discountTotal: number = 0,
): Promise<TaxCalculationResult> {
  return fetchJson<TaxCalculationResult>(`${tenantApiBase(tenant)}/tax/calculate`, {
    method: "POST",
    body: JSON.stringify({
      items,
      shipping_address: shippingAddress,
      shipping_total: shippingTotal,
      discount_total: discountTotal,
    }),
  });
}

// Shipping calculation — get available shipping options for a cart + shipping address
export async function calculateShipping(
  tenant: string,
  subtotal: number,
  shippingAddress: { line1: string; city: string; state?: string; postal_code?: string; country: string },
  currencyCode?: string,
  items?: ShippingCalculationItem[],
): Promise<ShippingCalculationResult> {
  return fetchJson<ShippingCalculationResult>(`${tenantApiBase(tenant)}/shipping/calculate`, {
    method: "POST",
    body: JSON.stringify({
      subtotal,
      shipping_address: shippingAddress,
      currency_code: currencyCode || "USD",
      items: items || [],
    }),
  });
}

// Shipment tracking — list shipments for an order and fetch live tracking
export async function listOrderShipments(tenant: string, orderId: string): Promise<{ items: Shipment[] }> {
  return fetchJson<{ items: Shipment[] }>(`${tenantApiBase(tenant)}/orders/${orderId}/shipments`);
}

export async function trackShipment(tenant: string, orderId: string, shipmentId: string): Promise<TrackingResponse> {
  return fetchJson<TrackingResponse>(`${tenantApiBase(tenant)}/orders/${orderId}/shipments/${shipmentId}/track`, {
    method: "POST",
  });
}

// ---- Wallet ----

export async function getWallet(tenant: string): Promise<Wallet> {
  return fetchJson<Wallet>(`${tenantApiBase(tenant)}/wallet`);
}

export async function topUpWallet(
  tenant: string,
  data: { amount: number; payment_method: string; payment_details?: PaymentDetails; currency_code?: string },
  idempotencyKey?: string,
): Promise<WalletTopupResponse> {
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  return fetchJson<WalletTopupResponse>(`${tenantApiBase(tenant)}/wallet/topup`, {
    method: "POST",
    body: JSON.stringify(data),
    headers,
  });
}

export async function listWalletTransactions(
  tenant: string,
  limit = 20,
  offset = 0,
): Promise<WalletTransactionListResponse> {
  return fetchJson<WalletTransactionListResponse>(
    `${tenantApiBase(tenant)}/wallet/transactions?limit=${limit}&offset=${offset}`,
  );
}

// ===== Returns / Replacements / Refunds =====

export async function listMyReturns(
  tenant: string,
  limit = 20,
  offset = 0,
): Promise<ReturnListResponse> {
  return fetchJson<ReturnListResponse>(
    `${tenantApiBase(tenant)}/my-returns?limit=${limit}&offset=${offset}`,
  );
}

export async function listOrderReturns(
  tenant: string,
  orderId: string,
): Promise<{ items: OrderReturn[] }> {
  return fetchJson<{ items: OrderReturn[] }>(
    `${tenantApiBase(tenant)}/orders/${orderId}/returns`,
  );
}

export async function createReturn(
  tenant: string,
  orderId: string,
  body: CreateReturnRequest,
  idempotencyKey?: string,
): Promise<OrderReturn> {
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  return fetchJson<OrderReturn>(
    `${tenantApiBase(tenant)}/orders/${orderId}/returns`,
    { method: "POST", body: JSON.stringify(body), headers },
  );
}

export async function fetchOrderReturnEligibility(
  tenant: string,
  orderId: string,
): Promise<OrderReturnEligibility> {
  return fetchJson<OrderReturnEligibility>(
    `${tenantApiBase(tenant)}/orders/${orderId}/return-eligibility`,
    { credentials: "include" },
  );
}

export async function fetchStorePage(tenant: string, slug: string): Promise<StorePage> {
  return fetchJson<StorePage>(`${tenantApiBase(tenant)}/page/${slug}`);
}
