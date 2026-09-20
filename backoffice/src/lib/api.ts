import type {
  AuthResponse,
  Attribute,
  Category,
  CreateFirstTenantRequest,
  Currency,
  CustomerDetail,
  CustomerStats,
  CustomerWallet,
  DashboardStats,
  DeveloperSettings,
  DiscountCode,
  DiscountStats,
  Language,
  NotificationEvent,
  NotificationEventReq,
  NotificationLog,
  NotificationLogsResponse,
  NotificationPreviewReq,
  NotificationPreviewResult,
  NotificationSendReq,
  NotificationSendResult,
  NotificationTemplate,
  NotificationTemplateReq,
  Offer,
  Order,
  OrderCountsResponse,
  OrderListResponse,
  OrderReturn,
  OrderWithDetails,
  ReturnCountsResponse,
  ReturnListResponse,
  CreateReturnRequest,
  UpdateReturnStatusRequest,
  InventoryItem,
  InventoryStats,
  StockMovement,
  Permission,
  PaymentGatewayConfig,
  PaymentStats,
  PaymentTransaction,
  PlatformHealth,
  PlatformStats,
  Product,
  RefundRequest,
  RolePermission,
  SetupCompleteRequest,
  SetupStatus,
  ShippingMethod,
  ShippingRate,
  ShippingZone,
  ShippingProvider,
  Shipment,
  TrackingResponse,
  ProviderTestResult,
  SMTPSettings,
  StoreStats,
  TaxClass,
  TaxRate,
  UUID,
  TaxZone,
  Tenant,
  TenantSettings,
  UpdateOrderStatusRequest,
  User,
  UserStats,
  Vendor,
  WalletStats,
  WalletTransaction,
  WalletTransactionListResponse,
  StorePage,
  StorePageRequest,
  ExportJob,
  ExportRequest,
  ExportTypeMeta,
} from "@/types";

// Use relative paths so requests go through the Vite dev server proxy.
// This avoids CORS issues and works regardless of where the browser is running.
const API_BASE = "";

const TOKEN_KEY = "tc_access_token";
const USER_KEY = "tc_user";
const LANG_KEY = "tc_backoffice_lang";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function getLang(): string {
  return localStorage.getItem(LANG_KEY) || "en";
}
export function setLang(l: string) {
  localStorage.setItem(LANG_KEY, l);
}
export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}
export function setStoredUser(u: User) {
  localStorage.setItem(USER_KEY, JSON.stringify(u));
}
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("tc_tenant_name");
}

// Generate a UUID v4 idempotency key for safe retry of mutation requests.
export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 11);
}

async function req<T>(path: string, init?: RequestInit & { idempotencyKey?: string }): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept-Language": getLang(),
    ...(init?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (init?.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 401) {
    clearAuth();
    window.location.href = "/backoffice/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Upload a single image file (multipart/form-data)
export async function uploadImage(tenant: string, file: Blob, filename?: string): Promise<{ url: string; filename: string; size: number; type: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file, filename || "upload.png");
  const res = await fetch(`/api/t/${tenant}/upload/image`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `upload failed (${res.status})`);
  }
  return res.json();
}

// Download a binary file (e.g. CSV export) with auth, triggering a browser download.
export async function downloadFile(path: string, fallbackName = "download.csv"): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401) {
    clearAuth();
    window.location.href = "/backoffice/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `download failed: ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const cd = res.headers.get("Content-Disposition") || "";
  const m = cd.match(/filename="?([^"]+)"?/);
  a.download = m ? m[1] : fallbackName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- Auth ----
export const api = {
  platformLogin: (email: string, password: string) =>
    req<AuthResponse>("/api/platform/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  tenantLogin: (tenant: string, email: string, password: string) =>
    req<AuthResponse>(`/api/t/${tenant}/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: (tenant?: string) =>
    tenant ? req<User>(`/api/t/${tenant}/me`) : req<User>("/api/platform/me"),

  // ---- Tenants (superadmin) ----
  listTenants: () => req<{ items: Tenant[] }>("/api/platform/tenants"),
  createTenant: (body: {
    slug: string;
    name: string;
    description?: string;
    admin_email: string;
    admin_password: string;
    admin_name: string;
  }) => req("/api/platform/tenants", { method: "POST", body: JSON.stringify(body) }),
  getTenant: (id: string) => req<Tenant>(`/api/platform/tenants/${id}`),
  updateTenant: (id: string, body: Partial<Tenant>) =>
    req<Tenant>(`/api/platform/tenants/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  setTenantActive: (id: string, isActive: boolean) =>
    req(`/api/platform/tenants/${id}/active`, { method: "PUT", body: JSON.stringify({ is_active: isActive }) }),
  tenantStoreStats: (id: string) => req<StoreStats>(`/api/platform/tenants/${id}/stats`),

  // ---- Vendors ----
  listVendors: (tenant: string) => req<{ items: Vendor[] }>(`/api/t/${tenant}/vendors`),
  getVendor: (tenant: string, id: string) => req<Vendor>(`/api/t/${tenant}/vendors/${id}`),
  createVendor: (tenant: string, body: any) =>
    req(`/api/t/${tenant}/vendors`, { method: "POST", body: JSON.stringify(body) }),
  updateVendor: (tenant: string, id: string, body: any) =>
    req(`/api/t/${tenant}/vendors/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteVendor: (tenant: string, id: string) =>
    req(`/api/t/${tenant}/vendors/${id}`, { method: "DELETE" }),

  // ---- Tenant Settings ----
  getSettings: (tenant: string) =>
    req<TenantSettings>(`/api/t/${tenant}/settings`),
  updateSettings: (tenant: string, body: Partial<TenantSettings>) =>
    req<TenantSettings>(`/api/t/${tenant}/settings`, { method: "PUT", body: JSON.stringify(body) }),

  // ---- Currencies ----
  listCurrencies: (tenant: string) =>
    req<{ items: Currency[] }>(`/api/t/${tenant}/currencies`).then((r) => r.items),

  // ---- Languages ----
  listLanguages: (tenant: string) =>
    req<{ items: Language[] }>(`/api/t/${tenant}/languages`).then((r) => r.items),

  // ---- SMTP Settings ----
  getSMTPSettings: (tenant: string) =>
    req<SMTPSettings>(`/api/t/${tenant}/settings/smtp`),
  updateSMTPSettings: (tenant: string, body: Partial<SMTPSettings>) =>
    req<SMTPSettings>(`/api/t/${tenant}/settings/smtp`, { method: "PUT", body: JSON.stringify(body) }),
  testSMTPSettings: (tenant: string, to: string) =>
    req<{ message: string }>(`/api/t/${tenant}/settings/smtp/test`, { method: "POST", body: JSON.stringify({ to }) }),

  // ---- Dashboard ----
  dashboardStats: (tenant: string, from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const q = qs.toString();
    return req<DashboardStats>(`/api/t/${tenant}/dashboard/stats${q ? `?${q}` : ""}`);
  },

  // ---- Orders ----
  listOrders: (tenant: string, params?: { status?: string; search?: string; limit?: number; offset?: number; from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.search) qs.set("search", params.search);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    const q = qs.toString();
    return req<OrderListResponse>(`/api/t/${tenant}/orders/admin${q ? `?${q}` : ""}`);
  },
  orderCounts: (tenant: string) =>
    req<OrderCountsResponse>(`/api/t/${tenant}/orders/counts`),
  getOrder: (tenant: string, orderId: string) =>
    req<{ order: OrderWithDetails }>(`/api/t/${tenant}/orders/admin/${orderId}`),
  updateOrderStatus: (tenant: string, orderId: string, body: UpdateOrderStatusRequest, idempotencyKey?: string) =>
    req<{ order: Order; message: string }>(`/api/t/${tenant}/orders/admin/${orderId}/status`, {
      method: "PUT",
      body: JSON.stringify(body),
      idempotencyKey,
    }),
  updateOrderNotes: (tenant: string, orderId: string, notes: string) =>
    req<{ updated: boolean; notes: string }>(`/api/t/${tenant}/orders/admin/${orderId}/notes`, {
      method: "PUT",
      body: JSON.stringify({ notes }),
    }),

  // ---- Returns / Replacements / Refunds ----
  listReturns: (tenant: string, params?: { status?: string; type?: string; search?: string; limit?: number; offset?: number; from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.type) qs.set("type", params.type);
    if (params?.search) qs.set("search", params.search);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    const q = qs.toString();
    return req<ReturnListResponse>(`/api/t/${tenant}/returns${q ? `?${q}` : ""}`);
  },
  returnCounts: (tenant: string) =>
    req<ReturnCountsResponse>(`/api/t/${tenant}/returns/counts`),
  getReturn: (tenant: string, id: string) =>
    req<OrderReturn>(`/api/t/${tenant}/returns/${id}`),
  listOrderReturns: (tenant: string, orderId: string) =>
    req<{ items: OrderReturn[] }>(`/api/t/${tenant}/orders/admin/${orderId}/returns`),
  createReturn: (tenant: string, orderId: string, body: CreateReturnRequest, idempotencyKey?: string) =>
    req<OrderReturn>(`/api/t/${tenant}/orders/admin/${orderId}/returns`, {
      method: "POST",
      body: JSON.stringify(body),
      idempotencyKey,
    }),
  updateReturnStatus: (tenant: string, id: string, body: UpdateReturnStatusRequest, idempotencyKey?: string) =>
    req<OrderReturn>(`/api/t/${tenant}/returns/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(body),
      idempotencyKey,
    }),

  // ---- Categories ----
  listCategories: (tenant: string) =>
    req<{ items: Category[] }>(`/api/t/${tenant}/categories`),
  createCategory: (tenant: string, body: Partial<Category>) =>
    req(`/api/t/${tenant}/categories`, { method: "POST", body: JSON.stringify(body) }),
  updateCategory: (tenant: string, id: string, body: Partial<Category>) =>
    req(`/api/t/${tenant}/categories/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteCategory: (tenant: string, id: string) =>
    req(`/api/t/${tenant}/categories/${id}`, { method: "DELETE" }),

  // ---- Attributes ----
  listAttributes: (tenant: string) =>
    req<{ items: Attribute[] }>(`/api/t/${tenant}/attributes`),
  createAttribute: (tenant: string, body: Partial<Attribute>) =>
    req(`/api/t/${tenant}/attributes`, { method: "POST", body: JSON.stringify(body) }),
  updateAttribute: (tenant: string, id: string, body: Partial<Attribute>) =>
    req(`/api/t/${tenant}/attributes/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteAttribute: (tenant: string, id: string) =>
    req(`/api/t/${tenant}/attributes/${id}`, { method: "DELETE" }),

  // ---- Products ----
  listProductsAdmin: (tenant: string, search?: string, status?: string) => {
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    if (status) qs.set("status", status);
    const q = qs.toString();
    return req<{ items: Product[]; total: number }>(
      `/api/t/${tenant}/products/admin${q ? `?${q}` : ""}`
    );
  },
  getProductById: (tenant: string, id: string) =>
    req<Product>(`/api/t/${tenant}/products/admin/${id}`),
  getProduct: (tenant: string, slug: string) =>
    req<Product>(`/api/t/${tenant}/products/slug/${slug}`),
  createProduct: (tenant: string, body: any) =>
    req(`/api/t/${tenant}/products`, { method: "POST", body: JSON.stringify(body) }),
  updateProduct: (tenant: string, id: string, body: any) =>
    req(`/api/t/${tenant}/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteProduct: (tenant: string, id: string) =>
    req(`/api/t/${tenant}/products/${id}`, { method: "DELETE" }),

  // ---- Offers ----
  listOffers: (tenant: string) => req<{ items: Offer[] }>(`/api/t/${tenant}/offers`),
  getOffer: (tenant: string, id: string) => req<Offer>(`/api/t/${tenant}/offers/${id}`),
  createOffer: (tenant: string, body: any) =>
    req(`/api/t/${tenant}/offers`, { method: "POST", body: JSON.stringify(body) }),
  updateOffer: (tenant: string, id: string, body: any) =>
    req(`/api/t/${tenant}/offers/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteOffer: (tenant: string, id: string) =>
    req(`/api/t/${tenant}/offers/${id}`, { method: "DELETE" }),

  // ---- Discounts ----
  listDiscounts: (tenant: string) =>
    req<{ items: DiscountCode[] }>(`/api/t/${tenant}/discounts`),
  getDiscount: (tenant: string, id: string) =>
    req<DiscountCode>(`/api/t/${tenant}/discounts/${id}`),
  createDiscount: (tenant: string, body: any) =>
    req(`/api/t/${tenant}/discounts`, { method: "POST", body: JSON.stringify(body) }),
  updateDiscount: (tenant: string, id: string, body: any) =>
    req(`/api/t/${tenant}/discounts/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteDiscount: (tenant: string, id: string) =>
    req(`/api/t/${tenant}/discounts/${id}`, { method: "DELETE" }),
  discountStats: (tenant: string) =>
    req<DiscountStats>(`/api/t/${tenant}/discounts/stats`),

  // ---- Inventory ----
  listInventory: (tenant: string, filter?: string) =>
    req<{ items: InventoryItem[] }>(`/api/t/${tenant}/inventory${filter ? `?filter=${filter}` : ""}`),
  inventoryStats: (tenant: string) =>
    req<InventoryStats>(`/api/t/${tenant}/inventory/stats`),
  adjustStock: (tenant: string, body: any, idempotencyKey?: string) =>
    req(`/api/t/${tenant}/inventory/adjust`, { method: "POST", body: JSON.stringify(body), idempotencyKey }),
  listStockMovements: (tenant: string, params?: { limit?: number; offset?: number; movement_type?: string; search?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    if (params?.movement_type) qs.set("movement_type", params.movement_type);
    if (params?.search) qs.set("search", params.search);
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    const q = qs.toString();
    return req<{ items: StockMovement[]; total: number }>(`/api/t/${tenant}/inventory/movements${q ? `?${q}` : ""}`);
  },

  // ---- Users ----
  listUsers: (tenant: string) => req<{ items: User[] }>(`/api/t/${tenant}/users`),
  userStats: (tenant: string) => req<UserStats>(`/api/t/${tenant}/users/stats`),
  getUser: (tenant: string, id: string) => req<User>(`/api/t/${tenant}/users/${id}`),
  createStaff: (tenant: string, body: any, idempotencyKey?: string) =>
    req(`/api/t/${tenant}/users/staff`, { method: "POST", body: JSON.stringify(body), idempotencyKey }),
  updateUser: (tenant: string, id: string, body: any) =>
    req<User>(`/api/t/${tenant}/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  setUserActive: (tenant: string, id: string, isActive: boolean) =>
    req(`/api/t/${tenant}/users/${id}/active`, { method: "PUT", body: JSON.stringify({ is_active: isActive }) }),
  resetUserPassword: (tenant: string, id: string, password: string) =>
    req(`/api/t/${tenant}/users/${id}/password`, { method: "PUT", body: JSON.stringify({ password }) }),
  deleteUser: (tenant: string, id: string) =>
    req(`/api/t/${tenant}/users/${id}`, { method: "DELETE" }),

  // ---- Platform Users (superadmin) ----
  listAllUsers: () => req<{ items: User[] }>("/api/platform/users"),

  // ---- Platform Dashboard & Developer Settings (superadmin) ----
  platformStats: () => req<PlatformStats>("/api/platform/stats"),
  platformDevSettings: () => req<DeveloperSettings>("/api/platform/dev-settings"),
  platformHealth: () => req<PlatformHealth>("/api/platform/health"),

  // ---- Permissions ----
  listPermissions: (tenant: string) => req<{ items: Permission[] }>(`/api/t/${tenant}/permissions`),
  listRolePermissions: (tenant: string) => req<{ items: RolePermission[] }>(`/api/t/${tenant}/permissions/roles`),
  getRolePermissions: (tenant: string, role: string) =>
    req<{ items: RolePermission[] }>(`/api/t/${tenant}/permissions/roles/${role}`),
  setRolePermissions: (tenant: string, role: string, permissionIds: string[]) =>
    req(`/api/t/${tenant}/permissions/roles/${role}`, { method: "PUT", body: JSON.stringify({ permission_ids: permissionIds }) }),
  togglePermission: (tenant: string, role: string, permissionId: string, granted: boolean) =>
    req(`/api/t/${tenant}/permissions/roles/${role}/toggle`, { method: "PUT", body: JSON.stringify({ permission_id: permissionId, granted }) }),
  seedDefaultPermissions: (tenant: string) =>
    req(`/api/t/${tenant}/permissions/seed`, { method: "POST" }),
  myPermissions: (tenant: string) => req<{ permissions: string[]; role: string }>(`/api/t/${tenant}/me/permissions`),

  // ---- Customers ----
  listCustomers: (tenant: string, search?: string, status?: string, limit = 20, offset = 0) => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    return req<{ items: User[]; total: number }>(`/api/t/${tenant}/customers?${params}`);
  },
  getCustomer: (tenant: string, id: string) =>
    req<CustomerDetail>(`/api/t/${tenant}/customers/${id}`),
  updateCustomer: (tenant: string, id: string, body: any) =>
    req(`/api/t/${tenant}/customers/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteCustomer: (tenant: string, id: string) =>
    req(`/api/t/${tenant}/customers/${id}`, { method: "DELETE" }),
  customerStats: (tenant: string, from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const q = qs.toString();
    return req<CustomerStats>(`/api/t/${tenant}/customers/stats${q ? `?${q}` : ""}`);
  },

  // ---- Tax Classes ----
  listTaxClasses: (tenant: string) =>
    req<{ items: TaxClass[] }>(`/api/t/${tenant}/tax/classes`),
  createTaxClass: (tenant: string, body: Partial<TaxClass>) =>
    req<TaxClass>(`/api/t/${tenant}/tax/classes`, { method: "POST", body: JSON.stringify(body) }),
  updateTaxClass: (tenant: string, id: string, body: Partial<TaxClass>) =>
    req<TaxClass>(`/api/t/${tenant}/tax/classes/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTaxClass: (tenant: string, id: string) =>
    req<{ deleted: boolean }>(`/api/t/${tenant}/tax/classes/${id}`, { method: "DELETE" }),

  // ---- Tax Zones ----
  listTaxZones: (tenant: string) =>
    req<{ items: TaxZone[] }>(`/api/t/${tenant}/tax/zones`),
  createTaxZone: (tenant: string, body: Partial<TaxZone>) =>
    req<TaxZone>(`/api/t/${tenant}/tax/zones`, { method: "POST", body: JSON.stringify(body) }),
  updateTaxZone: (tenant: string, id: string, body: Partial<TaxZone>) =>
    req<TaxZone>(`/api/t/${tenant}/tax/zones/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTaxZone: (tenant: string, id: string) =>
    req<{ deleted: boolean }>(`/api/t/${tenant}/tax/zones/${id}`, { method: "DELETE" }),

  // ---- Tax Rates ----
  listTaxRates: (tenant: string) =>
    req<{ items: TaxRate[] }>(`/api/t/${tenant}/tax/rates`),
  createTaxRate: (tenant: string, body: Partial<TaxRate>) =>
    req<TaxRate>(`/api/t/${tenant}/tax/rates`, { method: "POST", body: JSON.stringify(body) }),
  updateTaxRate: (tenant: string, id: string, body: Partial<TaxRate>) =>
    req<TaxRate>(`/api/t/${tenant}/tax/rates/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTaxRate: (tenant: string, id: string) =>
    req<{ deleted: boolean }>(`/api/t/${tenant}/tax/rates/${id}`, { method: "DELETE" }),

  // ---- Shipping Methods ----
  listShippingMethods: (tenant: string) =>
    req<{ items: ShippingMethod[] }>(`/api/t/${tenant}/shipping/methods`),
  createShippingMethod: (tenant: string, body: Partial<ShippingMethod>) =>
    req<ShippingMethod>(`/api/t/${tenant}/shipping/methods`, { method: "POST", body: JSON.stringify(body) }),
  updateShippingMethod: (tenant: string, id: string, body: Partial<ShippingMethod>) =>
    req<ShippingMethod>(`/api/t/${tenant}/shipping/methods/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteShippingMethod: (tenant: string, id: string) =>
    req<{ deleted: boolean }>(`/api/t/${tenant}/shipping/methods/${id}`, { method: "DELETE" }),

  // ---- Shipping Zones ----
  listShippingZones: (tenant: string) =>
    req<{ items: ShippingZone[] }>(`/api/t/${tenant}/shipping/zones`),
  createShippingZone: (tenant: string, body: Partial<ShippingZone>) =>
    req<ShippingZone>(`/api/t/${tenant}/shipping/zones`, { method: "POST", body: JSON.stringify(body) }),
  updateShippingZone: (tenant: string, id: string, body: Partial<ShippingZone>) =>
    req<ShippingZone>(`/api/t/${tenant}/shipping/zones/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteShippingZone: (tenant: string, id: string) =>
    req<{ deleted: boolean }>(`/api/t/${tenant}/shipping/zones/${id}`, { method: "DELETE" }),

  // ---- Shipping Rates ----
  listShippingRates: (tenant: string) =>
    req<{ items: ShippingRate[] }>(`/api/t/${tenant}/shipping/rates`),
  createShippingRate: (tenant: string, body: Partial<ShippingRate>) =>
    req<ShippingRate>(`/api/t/${tenant}/shipping/rates`, { method: "POST", body: JSON.stringify(body) }),
  updateShippingRate: (tenant: string, id: string, body: Partial<ShippingRate>) =>
    req<ShippingRate>(`/api/t/${tenant}/shipping/rates/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteShippingRate: (tenant: string, id: string) =>
    req<{ deleted: boolean }>(`/api/t/${tenant}/shipping/rates/${id}`, { method: "DELETE" }),

  // ---- Shipping Providers ----
  listShippingProviders: (tenant: string) =>
    req<{ items: ShippingProvider[] }>(`/api/t/${tenant}/shipping/providers`),
  createShippingProvider: (tenant: string, body: Partial<ShippingProvider>) =>
    req<ShippingProvider>(`/api/t/${tenant}/shipping/providers`, { method: "POST", body: JSON.stringify(body) }),
  updateShippingProvider: (tenant: string, id: string, body: Partial<ShippingProvider>) =>
    req<ShippingProvider>(`/api/t/${tenant}/shipping/providers/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteShippingProvider: (tenant: string, id: string) =>
    req<{ deleted: boolean }>(`/api/t/${tenant}/shipping/providers/${id}`, { method: "DELETE" }),
  testShippingProvider: (tenant: string, id: string) =>
    req<ProviderTestResult>(`/api/t/${tenant}/shipping/providers/${id}/test`, { method: "POST" }),

  // ---- Shipments ----
  listOrderShipments: (tenant: string, orderId: string) =>
    req<{ items: Shipment[] }>(`/api/t/${tenant}/shipping/orders/${orderId}/shipments`),
  createOrderShipment: (tenant: string, orderId: string, providerCode: string, estimatedDelivery?: string, idempotencyKey?: string) =>
    req<{ shipment: Shipment }>(`/api/t/${tenant}/shipping/orders/${orderId}/shipments`, {
      method: "POST",
      body: JSON.stringify({ provider_code: providerCode, estimated_delivery: estimatedDelivery || undefined }),
      idempotencyKey,
    }),
  createOrderShipmentWithItems: (
    tenant: string,
    orderId: string,
    providerCode: string,
    itemIds: UUID[],
    itemQuantities?: { order_item_id: UUID; quantity: number }[],
    estimatedDelivery?: string,
    idempotencyKey?: string,
  ) =>
    req<{ shipment: Shipment }>(`/api/t/${tenant}/shipping/orders/${orderId}/shipments`, {
      method: "POST",
      body: JSON.stringify({
        provider_code: providerCode,
        item_ids: itemIds,
        item_quantities: itemQuantities,
        estimated_delivery: estimatedDelivery || undefined,
      }),
      idempotencyKey,
    }),
  trackShipment: (tenant: string, shipmentId: string) =>
    req<TrackingResponse>(`/api/t/${tenant}/shipping/shipments/${shipmentId}/track`, { method: "POST" }),

  // ---- Payments: Transactions ----
  listPaymentTransactions: (tenant: string, params?: { limit?: number; offset?: number; status?: string; gateway?: string; type?: string; search?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    if (params?.status) qs.set("status", params.status);
    if (params?.gateway) qs.set("gateway", params.gateway);
    if (params?.type) qs.set("type", params.type);
    if (params?.search) qs.set("search", params.search);
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    const q = qs.toString();
    return req<{ items: PaymentTransaction[]; total: number; limit: number; offset: number }>(
      `/api/t/${tenant}/payments/transactions${q ? "?" + q : ""}`,
    );
  },
  getPaymentTransaction: (tenant: string, id: string) =>
    req<PaymentTransaction>(`/api/t/${tenant}/payments/transactions/${id}`),
  listOrderPaymentTransactions: (tenant: string, orderId: string) =>
    req<{ items: PaymentTransaction[] }>(`/api/t/${tenant}/payments/orders/${orderId}/transactions`),
  refundPaymentTransaction: (tenant: string, id: string, body: RefundRequest, idempotencyKey?: string) =>
    req<PaymentTransaction>(`/api/t/${tenant}/payments/transactions/${id}/refund`, {
      method: "POST",
      body: JSON.stringify(body),
      idempotencyKey,
    }),

  // ---- Payments: Gateway Configs ----
  listPaymentGatewayConfigs: (tenant: string) =>
    req<{ items: PaymentGatewayConfig[] }>(`/api/t/${tenant}/payments/gateways`),
  updatePaymentGatewayConfig: (tenant: string, id: string, body: Partial<PaymentGatewayConfig>) =>
    req<PaymentGatewayConfig>(`/api/t/${tenant}/payments/gateways/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // ---- Payments: Stats ----
  paymentStats: (tenant: string, from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const q = qs.toString();
    return req<PaymentStats>(`/api/t/${tenant}/payments/stats${q ? `?${q}` : ""}`);
  },

  // ---- Setup / Installation ----
  getSetupStatus: () => req<SetupStatus>("/api/setup/status"),
  completeSetup: (body: SetupCompleteRequest) =>
    req("/api/setup/complete", { method: "POST", body: JSON.stringify(body) }),
  createFirstTenant: (body: CreateFirstTenantRequest) =>
    req("/api/platform/setup/create-tenant", { method: "POST", body: JSON.stringify(body) }),

  // ---- Wallet (admin) ----
  walletStats: (tenant: string) => req<WalletStats>(`/api/t/${tenant}/wallet/stats`),
  walletAllTransactions: (tenant: string, params?: { limit?: number; offset?: number; type?: string; source?: string; search?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    const limit = params?.limit ?? 20;
    const offset = params?.offset ?? 0;
    qs.set("limit", String(limit));
    qs.set("offset", String(offset));
    if (params?.type) qs.set("type", params.type);
    if (params?.source) qs.set("source", params.source);
    if (params?.search) qs.set("search", params.search);
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    return req<WalletTransactionListResponse>(`/api/t/${tenant}/wallet/all?${qs.toString()}`);
  },
  customerWallet: (tenant: string, userId: string) =>
    req<CustomerWallet>(`/api/t/${tenant}/wallet/${userId}`),
  customerWalletTransactions: (tenant: string, userId: string, limit = 20, offset = 0) =>
    req<WalletTransactionListResponse>(`/api/t/${tenant}/wallet/${userId}/transactions?limit=${limit}&offset=${offset}`),
  adjustCustomerWallet: (tenant: string, userId: string, amount: number, description?: string, idempotencyKey?: string) =>
    req<WalletTransaction>(`/api/t/${tenant}/wallet/${userId}/adjust`, {
      method: "POST",
      body: JSON.stringify({ amount, description }),
      idempotencyKey,
    }),

  // ---- Notifications ----
  listNotificationEvents: (tenant: string) =>
    req<{ items: NotificationEvent[] }>(`/api/t/${tenant}/notifications/events`).then((r) => r.items),
  createNotificationEvent: (tenant: string, body: NotificationEventReq) =>
    req<NotificationEvent>(`/api/t/${tenant}/notifications/events`, { method: "POST", body: JSON.stringify(body) }),
  updateNotificationEvent: (tenant: string, id: string, body: NotificationEventReq) =>
    req<NotificationEvent>(`/api/t/${tenant}/notifications/events/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteNotificationEvent: (tenant: string, id: string) =>
    req<{ ok: boolean }>(`/api/t/${tenant}/notifications/events/${id}`, { method: "DELETE" }),

  listNotificationTemplates: (tenant: string, eventId?: string) =>
    req<{ items: NotificationTemplate[] }>(`/api/t/${tenant}/notifications/templates${eventId ? `?event_id=${eventId}` : ""}`).then((r) => r.items),
  getNotificationTemplate: (tenant: string, id: string) =>
    req<NotificationTemplate>(`/api/t/${tenant}/notifications/templates/${id}`),
  createNotificationTemplate: (tenant: string, body: NotificationTemplateReq) =>
    req<NotificationTemplate>(`/api/t/${tenant}/notifications/templates`, { method: "POST", body: JSON.stringify(body) }),
  updateNotificationTemplate: (tenant: string, id: string, body: NotificationTemplateReq) =>
    req<NotificationTemplate>(`/api/t/${tenant}/notifications/templates/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteNotificationTemplate: (tenant: string, id: string) =>
    req<{ ok: boolean }>(`/api/t/${tenant}/notifications/templates/${id}`, { method: "DELETE" }),

  previewNotification: (tenant: string, body: NotificationPreviewReq) =>
    req<NotificationPreviewResult>(`/api/t/${tenant}/notifications/preview`, { method: "POST", body: JSON.stringify(body) }),
  sendNotification: (tenant: string, body: NotificationSendReq) =>
    req<NotificationSendResult>(`/api/t/${tenant}/notifications/send`, { method: "POST", body: JSON.stringify(body) }),

  listNotificationLogs: (tenant: string, limit = 50, offset = 0) =>
    req<NotificationLogsResponse>(`/api/t/${tenant}/notifications/logs?limit=${limit}&offset=${offset}`),

  // ===== Store Pages (Page Builder) =====
  listPages: (tenant: string) =>
    req<{ items: StorePage[] }>(`/api/t/${tenant}/pages`),
  getPage: (tenant: string, id: string) =>
    req<StorePage>(`/api/t/${tenant}/pages/${id}`),
  createPage: (tenant: string, body: StorePageRequest) =>
    req<StorePage>(`/api/t/${tenant}/pages`, { method: "POST", body: JSON.stringify(body) }),
  updatePage: (tenant: string, id: string, body: StorePageRequest) =>
    req<StorePage>(`/api/t/${tenant}/pages/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deletePage: (tenant: string, id: string) =>
    req<void>(`/api/t/${tenant}/pages/${id}`, { method: "DELETE" }),

  // ===== Bulk Export =====
  listExportTypes: (tenant: string) =>
    req<{ types: ExportTypeMeta[] }>(`/api/t/${tenant}/exports/types`).then((r) => r.types),
  estimateExportSize: (tenant: string, params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return req<{ type: string; estimated_rows: number }>(`/api/t/${tenant}/exports/estimate${qs ? `?${qs}` : ""}`);
  },
  createExport: (tenant: string, body: ExportRequest) =>
    req<ExportJob>(`/api/t/${tenant}/exports`, { method: "POST", body: JSON.stringify(body), idempotencyKey: generateIdempotencyKey() }),
  listExports: (tenant: string, limit = 50, offset = 0) =>
    req<{ items: ExportJob[]; total: number; limit: number; offset: number }>(`/api/t/${tenant}/exports?limit=${limit}&offset=${offset}`),
  getExport: (tenant: string, id: string) =>
    req<ExportJob>(`/api/t/${tenant}/exports/${id}`),
  downloadExport: (tenant: string, id: string, fallbackName = "export.csv") =>
    downloadFile(`/api/t/${tenant}/exports/download/${id}`, fallbackName),
};
