import type {
  OrderHandoff,
  AuthResponse,
  Attribute,
  Category,
  Currency,
  CustomerDetail,
  CustomerStats,
  CustomerWallet,
  DashboardStats,
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
  Product,
  RefundRequest,
  Review,
  ReviewListResponse,
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
  TaxClass,
  TaxRate,
  UUID,
  TaxZone,
  TenantSettings,
  UpdateOrderStatusRequest,
  User,
  UserStats,
  Vendor,
  WalletStats,
  WalletTransaction,
  WalletTransactionListResponse,
  StoreModule,
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
const BRANCH_KEY = "tc_branch_id";

export function getBranchId(): string | null {
  return localStorage.getItem(BRANCH_KEY);
}
export function setBranchId(id: string | null) {
  if (id) localStorage.setItem(BRANCH_KEY, id);
  else localStorage.removeItem(BRANCH_KEY);
}

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

// Query params shared by server-side paginated list endpoints. Extra keys
// (search, status, type, ...) are passed through as query params; empty values
// are omitted. Omitting limit returns the full list.
export interface PageParams {
  limit?: number;
  offset?: number;
  [k: string]: string | number | undefined;
}

function pageQuery(p?: PageParams): string {
  if (!p) return "";
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
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
  const branchId = getBranchId();
  if (branchId) headers["X-Branch-Id"] = branchId;
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
  return normalizeListItems(await res.json()) as T;
}

// The backend serializes empty Go slices as null. Normalize "items" list
// envelopes to [] so callers can safely use .length/.map on them.
function normalizeListItems(value: unknown): unknown {
  if (Array.isArray(value)) {
    for (const v of value) normalizeListItems(v);
  } else if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (key === "items" && obj[key] === null) obj[key] = [];
      else normalizeListItems(obj[key]);
    }
  }
  return value;
}

// Upload a single image file (multipart/form-data)
export async function uploadImage(file: Blob, filename?: string): Promise<{ url: string; filename: string; size: number; type: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file, filename || "upload.png");
  const res = await fetch(`/api/upload/image`, {
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
  storeLogin: (email: string, password: string) =>
    req<AuthResponse>(`/api/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => req<User>("/api/me"),

  // ---- Modules & Features ----
  // Public list — used to gate menus/pages for every role.
  listModules: () => req<{ items: StoreModule[]; modules: Record<string, boolean> }>(`/api/modules`),
  // Superadmin-only toggle (Developer → Modules & Features).
  updateModule: (tenant: string, code: string, isEnabled: boolean) =>
    req<StoreModule>(`/api/developer/modules/${code}`, {
      method: "PUT",
      body: JSON.stringify({ is_enabled: isEnabled }),
    }),

  // ---- Branches ----
  listBranches: (tenant: string, params?: PageParams) =>
    req<{ items: import("@/types").Branch[]; total: number }>(`/api/branches${pageQuery(params)}`),
  getBranch: (tenant: string, id: string) => req<import("@/types").Branch>(`/api/branches/${id}`),
  createBranch: (tenant: string, body: any, idempotencyKey?: string) =>
    req(`/api/branches`, { method: "POST", body: JSON.stringify(body), idempotencyKey }),
  updateBranch: (tenant: string, id: string, body: any) =>
    req(`/api/branches/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteBranch: (tenant: string, id: string) =>
    req(`/api/branches/${id}`, { method: "DELETE" }),
  setDefaultBranch: (tenant: string, id: string) =>
    req(`/api/branches/${id}/default`, { method: "PUT" }),

  // ---- Vendors ----
  listVendors: (tenant: string, params?: PageParams) =>
    req<{ items: Vendor[]; total: number }>(`/api/vendors${pageQuery(params)}`),
  getVendor: (tenant: string, id: string) => req<Vendor>(`/api/vendors/${id}`),
  createVendor: (tenant: string, body: any) =>
    req(`/api/vendors`, { method: "POST", body: JSON.stringify(body) }),
  updateVendor: (tenant: string, id: string, body: any) =>
    req(`/api/vendors/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteVendor: (tenant: string, id: string) =>
    req(`/api/vendors/${id}`, { method: "DELETE" }),

  // ---- Tenant Settings ----
  getSettings: (tenant: string) =>
    req<TenantSettings>(`/api/settings`),
  updateSettings: (tenant: string, body: Partial<TenantSettings>) =>
    req<TenantSettings>(`/api/settings`, { method: "PUT", body: JSON.stringify(body) }),

  // ---- Currencies ----
  listCurrencies: (tenant: string) =>
    req<{ items: Currency[] }>(`/api/currencies`).then((r) => r.items),

  // ---- Languages ----
  listLanguages: (tenant: string) =>
    req<{ items: Language[] }>(`/api/languages`).then((r) => r.items),

  // ---- SMTP Settings ----
  getSMTPSettings: (tenant: string) =>
    req<SMTPSettings>(`/api/settings/smtp`),
  updateSMTPSettings: (tenant: string, body: Partial<SMTPSettings>) =>
    req<SMTPSettings>(`/api/settings/smtp`, { method: "PUT", body: JSON.stringify(body) }),
  testSMTPSettings: (tenant: string, to: string) =>
    req<{ message: string }>(`/api/settings/smtp/test`, { method: "POST", body: JSON.stringify({ to }) }),

  // ---- Dashboard ----
  dashboardStats: (tenant: string, from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const q = qs.toString();
    return req<DashboardStats>(`/api/dashboard/stats${q ? `?${q}` : ""}`);
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
    return req<OrderListResponse>(`/api/orders/admin${q ? `?${q}` : ""}`);
  },
  orderCounts: (tenant: string) =>
    req<OrderCountsResponse>(`/api/orders/counts`),
  getOrder: (tenant: string, orderId: string) =>
    req<{ order: OrderWithDetails }>(`/api/orders/admin/${orderId}`),
  updateOrderStatus: (tenant: string, orderId: string, body: UpdateOrderStatusRequest, idempotencyKey?: string) =>
    req<{ order: Order; message: string }>(`/api/orders/admin/${orderId}/status`, {
      method: "PUT",
      body: JSON.stringify(body),
      idempotencyKey,
    }),
  updateOrderNotes: (tenant: string, orderId: string, notes: string) =>
    req<{ updated: boolean; notes: string }>(`/api/orders/admin/${orderId}/notes`, {
      method: "PUT",
      body: JSON.stringify({ notes }),
    }),

  // ---- Delivery (partner portal + staff assignment) ----
  listDeliveryBranches: () =>
    req<{ items: import("@/types").Branch[] }>(`/api/delivery/branches`),
  listDeliveryOrders: (tenant: string, params?: { view?: "queue" | "active" | "history"; partner_id?: string; unassigned?: boolean; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.view) qs.set("view", params.view);
    if (params?.partner_id) qs.set("partner_id", params.partner_id);
    if (params?.unassigned) qs.set("unassigned", "true");
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const q = qs.toString();
    return req<{ items: OrderWithDetails[]; total: number; limit: number; offset: number }>(
      `/api/delivery/orders${q ? `?${q}` : ""}`
    );
  },
  listDeliveryPartners: (tenant: string, branchId?: string) =>
    req<{ items: User[] }>(`/api/delivery/partners${branchId ? `?branch_id=${branchId}` : ""}`),
  assignDeliveryPartner: (tenant: string, orderId: string, partnerId: string | null, idempotencyKey?: string) =>
    req<{ order: OrderWithDetails; message: string }>(`/api/delivery/orders/${orderId}/assign`, {
      method: "PUT",
      body: JSON.stringify({ partner_id: partnerId ?? "" }),
      idempotencyKey,
    }),
  claimDeliveryOrder: (orderId: string, idempotencyKey?: string) =>
    req<{ order: OrderWithDetails; message: string }>(`/api/delivery/orders/${orderId}/claim`, {
      method: "POST",
      idempotencyKey,
    }),
  startDeliveryOrder: (orderId: string, idempotencyKey?: string) =>
    req<{ order: OrderWithDetails; message: string }>(`/api/delivery/orders/${orderId}/start`, {
      method: "POST",
      idempotencyKey,
    }),
  completeDeliveryOrder: (orderId: string, idempotencyKey?: string) =>
    req<{ order: OrderWithDetails; message: string }>(`/api/delivery/orders/${orderId}/deliver`, {
      method: "POST",
      idempotencyKey,
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
    return req<ReturnListResponse>(`/api/returns${q ? `?${q}` : ""}`);
  },
  returnCounts: (tenant: string) =>
    req<ReturnCountsResponse>(`/api/returns/counts`),
  getReturn: (tenant: string, id: string) =>
    req<OrderReturn>(`/api/returns/${id}`),
  listOrderReturns: (tenant: string, orderId: string) =>
    req<{ items: OrderReturn[] }>(`/api/orders/admin/${orderId}/returns`),
  createReturn: (tenant: string, orderId: string, body: CreateReturnRequest, idempotencyKey?: string) =>
    req<OrderReturn>(`/api/orders/admin/${orderId}/returns`, {
      method: "POST",
      body: JSON.stringify(body),
      idempotencyKey,
    }),
  updateReturnStatus: (tenant: string, id: string, body: UpdateReturnStatusRequest, idempotencyKey?: string) =>
    req<OrderReturn>(`/api/returns/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(body),
      idempotencyKey,
    }),

  // ---- Categories ----
  listCategories: (tenant: string, params?: PageParams) =>
    req<{ items: Category[]; total: number }>(`/api/categories${pageQuery(params)}`),
  createCategory: (tenant: string, body: Partial<Category>) =>
    req(`/api/categories`, { method: "POST", body: JSON.stringify(body) }),
  updateCategory: (tenant: string, id: string, body: Partial<Category>) =>
    req(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteCategory: (tenant: string, id: string) =>
    req(`/api/categories/${id}`, { method: "DELETE" }),

  // ---- Attributes ----
  listAttributes: (tenant: string, params?: PageParams) =>
    req<{ items: Attribute[]; total: number }>(`/api/attributes${pageQuery(params)}`),
  createAttribute: (tenant: string, body: Partial<Attribute>) =>
    req(`/api/attributes`, { method: "POST", body: JSON.stringify(body) }),
  updateAttribute: (tenant: string, id: string, body: Partial<Attribute>) =>
    req(`/api/attributes/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteAttribute: (tenant: string, id: string) =>
    req(`/api/attributes/${id}`, { method: "DELETE" }),

  // ---- Products ----
  listProductsAdmin: (tenant: string, params?: PageParams) =>
    req<{ items: Product[]; total: number }>(`/api/products/admin${pageQuery(params)}`),
  getProductById: (tenant: string, id: string) =>
    req<Product>(`/api/products/admin/${id}`),
  getProduct: (tenant: string, slug: string) =>
    req<Product>(`/api/products/slug/${slug}`),
  createProduct: (tenant: string, body: any) =>
    req(`/api/products`, { method: "POST", body: JSON.stringify(body) }),
  updateProduct: (tenant: string, id: string, body: any) =>
    req(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteProduct: (tenant: string, id: string) =>
    req(`/api/products/${id}`, { method: "DELETE" }),

  // ---- Reviews ----
  listReviews: (
    tenant: string,
    params?: { product_id?: string; rating?: number; status?: string; search?: string; limit?: number; offset?: number }
  ) => {
    const qs = new URLSearchParams();
    if (params?.product_id) qs.set("product_id", params.product_id);
    if (params?.rating) qs.set("rating", String(params.rating));
    if (params?.status && params.status !== "all") qs.set("status", params.status);
    if (params?.search) qs.set("search", params.search);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const q = qs.toString();
    return req<ReviewListResponse>(`/api/reviews${q ? `?${q}` : ""}`);
  },
  updateReview: (tenant: string, id: string, is_approved: boolean) =>
    req<Review>(`/api/reviews/${id}`, { method: "PUT", body: JSON.stringify({ is_approved }) }),
  deleteReview: (tenant: string, id: string) =>
    req<{ ok: boolean }>(`/api/reviews/${id}`, { method: "DELETE" }),

  // ---- Offers ----
  listOffers: (tenant: string, params?: PageParams) =>
    req<{ items: Offer[]; total: number }>(`/api/offers${pageQuery(params)}`),
  getOffer: (tenant: string, id: string) => req<Offer>(`/api/offers/${id}`),
  createOffer: (tenant: string, body: any) =>
    req(`/api/offers`, { method: "POST", body: JSON.stringify(body) }),
  updateOffer: (tenant: string, id: string, body: any) =>
    req(`/api/offers/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteOffer: (tenant: string, id: string) =>
    req(`/api/offers/${id}`, { method: "DELETE" }),

  // ---- Discounts ----
  listDiscounts: (tenant: string, params?: PageParams) =>
    req<{ items: DiscountCode[]; total: number }>(`/api/discounts${pageQuery(params)}`),
  getDiscount: (tenant: string, id: string) =>
    req<DiscountCode>(`/api/discounts/${id}`),
  createDiscount: (tenant: string, body: any) =>
    req(`/api/discounts`, { method: "POST", body: JSON.stringify(body) }),
  updateDiscount: (tenant: string, id: string, body: any) =>
    req(`/api/discounts/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteDiscount: (tenant: string, id: string) =>
    req(`/api/discounts/${id}`, { method: "DELETE" }),
  discountStats: (tenant: string) =>
    req<DiscountStats>(`/api/discounts/stats`),

  // ---- Inventory ----
  listInventory: (tenant: string, params?: PageParams) =>
    req<{ items: InventoryItem[]; total: number }>(`/api/inventory${pageQuery(params)}`),
  inventoryStats: (tenant: string) =>
    req<InventoryStats>(`/api/inventory/stats`),
  adjustStock: (tenant: string, body: any, idempotencyKey?: string) =>
    req(`/api/inventory/adjust`, { method: "POST", body: JSON.stringify(body), idempotencyKey }),
  listStockMovements: (tenant: string, params?: { limit?: number; offset?: number; movement_type?: string; search?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    if (params?.movement_type) qs.set("movement_type", params.movement_type);
    if (params?.search) qs.set("search", params.search);
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    const q = qs.toString();
    return req<{ items: StockMovement[]; total: number }>(`/api/inventory/movements${q ? `?${q}` : ""}`);
  },

  // ---- Users ----
  listUsers: (tenant: string, params?: PageParams) =>
    req<{ items: User[]; total: number }>(`/api/users${pageQuery(params)}`),
  userStats: (tenant: string) => req<UserStats>(`/api/users/stats`),
  getUser: (tenant: string, id: string) => req<User>(`/api/users/${id}`),
  createStaff: (tenant: string, body: any, idempotencyKey?: string) =>
    req(`/api/users/staff`, { method: "POST", body: JSON.stringify(body), idempotencyKey }),
  updateUser: (tenant: string, id: string, body: any) =>
    req<User>(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  setUserActive: (tenant: string, id: string, isActive: boolean) =>
    req(`/api/users/${id}/active`, { method: "PUT", body: JSON.stringify({ is_active: isActive }) }),
  resetUserPassword: (tenant: string, id: string, password: string) =>
    req(`/api/users/${id}/password`, { method: "PUT", body: JSON.stringify({ password }) }),
  deleteUser: (tenant: string, id: string) =>
    req(`/api/users/${id}`, { method: "DELETE" }),

  // ---- Permissions ----
  listPermissions: (tenant: string) => req<{ items: Permission[] }>(`/api/permissions`),
  listRolePermissions: (tenant: string) => req<{ items: RolePermission[] }>(`/api/permissions/roles`),
  getRolePermissions: (tenant: string, role: string) =>
    req<{ items: RolePermission[] }>(`/api/permissions/roles/${role}`),
  setRolePermissions: (tenant: string, role: string, permissionIds: string[]) =>
    req(`/api/permissions/roles/${role}`, { method: "PUT", body: JSON.stringify({ permission_ids: permissionIds }) }),
  togglePermission: (tenant: string, role: string, permissionId: string, granted: boolean) =>
    req(`/api/permissions/roles/${role}/toggle`, { method: "PUT", body: JSON.stringify({ permission_id: permissionId, granted }) }),
  seedDefaultPermissions: (tenant: string) =>
    req(`/api/permissions/seed`, { method: "POST" }),
  myPermissions: (tenant: string) => req<{ permissions: string[]; role: string }>(`/api/me/permissions`),

  // ---- Customers ----
  listCustomers: (tenant: string, search?: string, status?: string, limit = 20, offset = 0) => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    return req<{ items: User[]; total: number }>(`/api/customers?${params}`);
  },
  getCustomer: (tenant: string, id: string) =>
    req<CustomerDetail>(`/api/customers/${id}`),
  updateCustomer: (tenant: string, id: string, body: any) =>
    req(`/api/customers/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteCustomer: (tenant: string, id: string) =>
    req(`/api/customers/${id}`, { method: "DELETE" }),
  customerStats: (tenant: string, from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const q = qs.toString();
    return req<CustomerStats>(`/api/customers/stats${q ? `?${q}` : ""}`);
  },

  // ---- Tax Classes ----
  listTaxClasses: (tenant: string, params?: PageParams) =>
    req<{ items: TaxClass[]; total: number }>(`/api/tax/classes${pageQuery(params)}`),
  createTaxClass: (tenant: string, body: Partial<TaxClass>) =>
    req<TaxClass>(`/api/tax/classes`, { method: "POST", body: JSON.stringify(body) }),
  updateTaxClass: (tenant: string, id: string, body: Partial<TaxClass>) =>
    req<TaxClass>(`/api/tax/classes/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTaxClass: (tenant: string, id: string) =>
    req<{ deleted: boolean }>(`/api/tax/classes/${id}`, { method: "DELETE" }),

  // ---- Tax Zones ----
  listTaxZones: (tenant: string, params?: PageParams) =>
    req<{ items: TaxZone[]; total: number }>(`/api/tax/zones${pageQuery(params)}`),
  createTaxZone: (tenant: string, body: Partial<TaxZone>) =>
    req<TaxZone>(`/api/tax/zones`, { method: "POST", body: JSON.stringify(body) }),
  updateTaxZone: (tenant: string, id: string, body: Partial<TaxZone>) =>
    req<TaxZone>(`/api/tax/zones/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTaxZone: (tenant: string, id: string) =>
    req<{ deleted: boolean }>(`/api/tax/zones/${id}`, { method: "DELETE" }),

  // ---- Tax Rates ----
  listTaxRates: (tenant: string, params?: PageParams) =>
    req<{ items: TaxRate[]; total: number }>(`/api/tax/rates${pageQuery(params)}`),
  createTaxRate: (tenant: string, body: Partial<TaxRate>) =>
    req<TaxRate>(`/api/tax/rates`, { method: "POST", body: JSON.stringify(body) }),
  updateTaxRate: (tenant: string, id: string, body: Partial<TaxRate>) =>
    req<TaxRate>(`/api/tax/rates/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTaxRate: (tenant: string, id: string) =>
    req<{ deleted: boolean }>(`/api/tax/rates/${id}`, { method: "DELETE" }),

  // ---- Shipping Methods ----
  listShippingMethods: (tenant: string, params?: PageParams) =>
    req<{ items: ShippingMethod[]; total: number }>(`/api/shipping/methods${pageQuery(params)}`),
  createShippingMethod: (tenant: string, body: Partial<ShippingMethod>) =>
    req<ShippingMethod>(`/api/shipping/methods`, { method: "POST", body: JSON.stringify(body) }),
  updateShippingMethod: (tenant: string, id: string, body: Partial<ShippingMethod>) =>
    req<ShippingMethod>(`/api/shipping/methods/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteShippingMethod: (tenant: string, id: string) =>
    req<{ deleted: boolean }>(`/api/shipping/methods/${id}`, { method: "DELETE" }),

  // ---- Shipping Zones ----
  listShippingZones: (tenant: string, params?: PageParams) =>
    req<{ items: ShippingZone[]; total: number }>(`/api/shipping/zones${pageQuery(params)}`),
  createShippingZone: (tenant: string, body: Partial<ShippingZone>) =>
    req<ShippingZone>(`/api/shipping/zones`, { method: "POST", body: JSON.stringify(body) }),
  updateShippingZone: (tenant: string, id: string, body: Partial<ShippingZone>) =>
    req<ShippingZone>(`/api/shipping/zones/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteShippingZone: (tenant: string, id: string) =>
    req<{ deleted: boolean }>(`/api/shipping/zones/${id}`, { method: "DELETE" }),

  // ---- Shipping Rates ----
  listShippingRates: (tenant: string, params?: PageParams) =>
    req<{ items: ShippingRate[]; total: number }>(`/api/shipping/rates${pageQuery(params)}`),
  createShippingRate: (tenant: string, body: Partial<ShippingRate>) =>
    req<ShippingRate>(`/api/shipping/rates`, { method: "POST", body: JSON.stringify(body) }),
  updateShippingRate: (tenant: string, id: string, body: Partial<ShippingRate>) =>
    req<ShippingRate>(`/api/shipping/rates/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteShippingRate: (tenant: string, id: string) =>
    req<{ deleted: boolean }>(`/api/shipping/rates/${id}`, { method: "DELETE" }),

  // ---- Shipping Providers ----
  listShippingProviders: (tenant: string) =>
    req<{ items: ShippingProvider[] }>(`/api/shipping/providers`),
  createShippingProvider: (tenant: string, body: Partial<ShippingProvider>) =>
    req<ShippingProvider>(`/api/shipping/providers`, { method: "POST", body: JSON.stringify(body) }),
  updateShippingProvider: (tenant: string, id: string, body: Partial<ShippingProvider>) =>
    req<ShippingProvider>(`/api/shipping/providers/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteShippingProvider: (tenant: string, id: string) =>
    req<{ deleted: boolean }>(`/api/shipping/providers/${id}`, { method: "DELETE" }),
  testShippingProvider: (tenant: string, id: string) =>
    req<ProviderTestResult>(`/api/shipping/providers/${id}/test`, { method: "POST" }),

  // ---- Shipments ----
  listOrderHandoffs: (tenant: string, orderId: string) =>
    req<{ items: OrderHandoff[] }>(`/api/orders/admin/${orderId}/handoffs`),
  createOrderHandoff: (tenant: string, orderId: string, body: { to_branch_id?: string; item_ids?: string[]; note?: string }) =>
    req<OrderHandoff>(`/api/orders/admin/${orderId}/handoffs`, { method: "POST", body: JSON.stringify(body) }),
  listIncomingHandoffs: (tenant: string) =>
    req<{ items: OrderHandoff[] }>(`/api/handoffs`),
  respondToHandoff: (tenant: string, id: string, action: "accept" | "reject" | "cancel") =>
    req<{ updated: boolean; status: string }>(`/api/handoffs/${id}/respond`, { method: "POST", body: JSON.stringify({ action }) }),
  listOrderShipments: (tenant: string, orderId: string) =>
    req<{ items: Shipment[] }>(`/api/shipping/orders/${orderId}/shipments`),
  createOrderShipment: (tenant: string, orderId: string, providerCode: string, estimatedDelivery?: string, idempotencyKey?: string) =>
    req<{ shipment: Shipment }>(`/api/shipping/orders/${orderId}/shipments`, {
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
    req<{ shipment: Shipment }>(`/api/shipping/orders/${orderId}/shipments`, {
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
    req<TrackingResponse>(`/api/shipping/shipments/${shipmentId}/track`, { method: "POST" }),

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
      `/api/payments/transactions${q ? "?" + q : ""}`,
    );
  },
  getPaymentTransaction: (tenant: string, id: string) =>
    req<PaymentTransaction>(`/api/payments/transactions/${id}`),
  listOrderPaymentTransactions: (tenant: string, orderId: string) =>
    req<{ items: PaymentTransaction[] }>(`/api/payments/orders/${orderId}/transactions`),
  refundPaymentTransaction: (tenant: string, id: string, body: RefundRequest, idempotencyKey?: string) =>
    req<PaymentTransaction>(`/api/payments/transactions/${id}/refund`, {
      method: "POST",
      body: JSON.stringify(body),
      idempotencyKey,
    }),

  // ---- Payments: Gateway Configs ----
  listPaymentGatewayConfigs: (tenant: string) =>
    req<{ items: PaymentGatewayConfig[] }>(`/api/payments/gateways`),
  updatePaymentGatewayConfig: (tenant: string, id: string, body: Partial<PaymentGatewayConfig>) =>
    req<PaymentGatewayConfig>(`/api/payments/gateways/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // ---- Storefront payment methods (public) ----
  listPaymentMethods: () =>
    req<{ methods: { id: string; name: string; is_active: boolean; sort_order: number }[]; total: number; test_mode: boolean }>(
      `/api/payment/methods`,
    ),

  // ---- Payments: Stats ----
  paymentStats: (tenant: string, from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const q = qs.toString();
    return req<PaymentStats>(`/api/payments/stats${q ? `?${q}` : ""}`);
  },

  // ---- Setup / Installation ----
  getSetupStatus: () => req<SetupStatus>("/api/setup/status"),
  completeSetup: (body: SetupCompleteRequest) =>
    req("/api/setup/complete", { method: "POST", body: JSON.stringify(body) }),

  // ---- Wallet (admin) ----
  walletStats: (tenant: string) => req<WalletStats>(`/api/wallet/stats`),
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
    return req<WalletTransactionListResponse>(`/api/wallet/all?${qs.toString()}`);
  },
  customerWallet: (tenant: string, userId: string) =>
    req<CustomerWallet>(`/api/wallet/${userId}`),
  customerWalletTransactions: (tenant: string, userId: string, limit = 20, offset = 0) =>
    req<WalletTransactionListResponse>(`/api/wallet/${userId}/transactions?limit=${limit}&offset=${offset}`),
  adjustCustomerWallet: (tenant: string, userId: string, amount: number, description?: string, idempotencyKey?: string) =>
    req<WalletTransaction>(`/api/wallet/${userId}/adjust`, {
      method: "POST",
      body: JSON.stringify({ amount, description }),
      idempotencyKey,
    }),

  // ---- Notifications ----
  listNotificationEvents: (tenant: string, params?: PageParams) =>
    req<{ items: NotificationEvent[]; total: number }>(`/api/notifications/events${pageQuery(params)}`),
  createNotificationEvent: (tenant: string, body: NotificationEventReq) =>
    req<NotificationEvent>(`/api/notifications/events`, { method: "POST", body: JSON.stringify(body) }),
  updateNotificationEvent: (tenant: string, id: string, body: NotificationEventReq) =>
    req<NotificationEvent>(`/api/notifications/events/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteNotificationEvent: (tenant: string, id: string) =>
    req<{ ok: boolean }>(`/api/notifications/events/${id}`, { method: "DELETE" }),

  listNotificationTemplates: (tenant: string, eventId?: string, params?: PageParams) =>
    req<{ items: NotificationTemplate[]; total: number }>(`/api/notifications/templates${pageQuery({ event_id: eventId, ...params })}`),
  getNotificationTemplate: (tenant: string, id: string) =>
    req<NotificationTemplate>(`/api/notifications/templates/${id}`),
  createNotificationTemplate: (tenant: string, body: NotificationTemplateReq) =>
    req<NotificationTemplate>(`/api/notifications/templates`, { method: "POST", body: JSON.stringify(body) }),
  updateNotificationTemplate: (tenant: string, id: string, body: NotificationTemplateReq) =>
    req<NotificationTemplate>(`/api/notifications/templates/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteNotificationTemplate: (tenant: string, id: string) =>
    req<{ ok: boolean }>(`/api/notifications/templates/${id}`, { method: "DELETE" }),

  previewNotification: (tenant: string, body: NotificationPreviewReq) =>
    req<NotificationPreviewResult>(`/api/notifications/preview`, { method: "POST", body: JSON.stringify(body) }),
  sendNotification: (tenant: string, body: NotificationSendReq) =>
    req<NotificationSendResult>(`/api/notifications/send`, { method: "POST", body: JSON.stringify(body) }),

  listNotificationLogs: (tenant: string, limit = 50, offset = 0) =>
    req<NotificationLogsResponse>(`/api/notifications/logs?limit=${limit}&offset=${offset}`),

  // ===== Store Pages (Page Builder) =====
  listPages: (tenant: string, params?: PageParams) =>
    req<{ items: StorePage[]; total: number }>(`/api/pages${pageQuery(params)}`),
  getPage: (tenant: string, id: string) =>
    req<StorePage>(`/api/pages/${id}`),
  createPage: (tenant: string, body: StorePageRequest) =>
    req<StorePage>(`/api/pages`, { method: "POST", body: JSON.stringify(body) }),
  updatePage: (tenant: string, id: string, body: StorePageRequest) =>
    req<StorePage>(`/api/pages/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deletePage: (tenant: string, id: string) =>
    req<void>(`/api/pages/${id}`, { method: "DELETE" }),

  // ===== Contact Submissions =====
  // status: "unread" | "read" ("" = all)
  listContactSubmissions: (tenant: string, params?: PageParams) =>
    req<{ items: import("@/types").ContactSubmission[]; total: number }>(`/api/contact/submissions${pageQuery(params)}`),
  markContactSubmissionRead: (tenant: string, id: string) =>
    req<{ message: string }>(`/api/contact/submissions/${id}/read`, { method: "PUT", body: JSON.stringify({}) }),
  deleteContactSubmission: (tenant: string, id: string) =>
    req<void>(`/api/contact/submissions/${id}`, { method: "DELETE" }),

  // ===== Bulk Export =====
  listExportTypes: (tenant: string) =>
    req<{ types: ExportTypeMeta[] }>(`/api/exports/types`).then((r) => r.types),
  estimateExportSize: (tenant: string, params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return req<{ type: string; estimated_rows: number }>(`/api/exports/estimate${qs ? `?${qs}` : ""}`);
  },
  createExport: (tenant: string, body: ExportRequest) =>
    req<ExportJob>(`/api/exports`, { method: "POST", body: JSON.stringify(body), idempotencyKey: generateIdempotencyKey() }),
  listExports: (tenant: string, limit = 50, offset = 0) =>
    req<{ items: ExportJob[]; total: number; limit: number; offset: number }>(`/api/exports?limit=${limit}&offset=${offset}`),
  getExport: (tenant: string, id: string) =>
    req<ExportJob>(`/api/exports/${id}`),
  downloadExport: (tenant: string, id: string, fallbackName = "export.csv") =>
    downloadFile(`/api/exports/download/${id}`, fallbackName),
};
