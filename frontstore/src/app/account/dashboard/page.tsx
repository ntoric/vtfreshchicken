"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Wallet as WalletIcon,
  ShoppingBag,
  MapPin,
  Package,
  ChevronRight,
  ArrowRight,
  CheckCircle,
  Clock,
  Settings,
  XCircle,
  Undo2,
  Plus,
  ShieldCheck,
  Star,
  RotateCcw,
  RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { fetchBootstrap, fetchMyOrders, fetchAddresses, getWallet, getStoredCustomer, fetchPurchasedProducts } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { StorefrontSkeleton } from "@/components/Loaders";
import { ReviewFormModal } from "@/components/ReviewFormModal";
import { formatPrice, getCurrencySymbol } from "@/lib/format";
import { useCurrencyLang } from "@/lib/currency-lang";
import { useToast } from "@/components/Toast";
import type { Currency, Order, Address, PurchasedProduct } from "@/types";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: LucideIcon }> = {
  paid: { label: "Paid", color: "#059669", bg: "bg-emerald-50", border: "border-emerald-200", icon: CheckCircle },
  pending: { label: "Pending", color: "#d97706", bg: "bg-amber-50", border: "border-amber-200", icon: Clock },
  processing: { label: "Processing", color: "#2563eb", bg: "bg-blue-50", border: "border-blue-200", icon: Settings },
  ready: { label: "Ready for Delivery", color: "#4f46e5", bg: "bg-indigo-50", border: "border-indigo-200", icon: Package },
  failed: { label: "Failed", color: "#dc2626", bg: "bg-rose-50", border: "border-rose-200", icon: XCircle },
  shipped: { label: "Shipped", color: "#2563eb", bg: "bg-blue-50", border: "border-blue-200", icon: Package },
  delivered: { label: "Delivered", color: "#059669", bg: "bg-emerald-50", border: "border-emerald-200", icon: CheckCircle },
  fulfilled: { label: "Fulfilled", color: "#0891b2", bg: "bg-cyan-50", border: "border-cyan-200", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "#6b7280", bg: "bg-gray-50", border: "border-gray-200", icon: XCircle },
  refunded: { label: "Refunded", color: "#7c3aed", bg: "bg-purple-50", border: "border-purple-200", icon: Undo2 },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const RECENT_ORDER_LIMIT = 5;

export default function AccountDashboardPage({ params }: { params: {} }) {
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();
  const { isAuthenticated, isLoading: authLoading, customer } = useAuth();
  const toast = useToast();
  const [reviewProduct, setReviewProduct] = useState<PurchasedProduct | null>(null);

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => fetchBootstrap(),
  });
  const bootstrap = bootstrapQ.data;
  const currencyObj: Currency | undefined = getCurrencySymbol(bootstrap?.currencies || [], currency);
  const returnsModuleOn = bootstrap?.modules?.returns !== false;

  const ordersQ = useQuery({
    queryKey: ["my-orders", "dashboard"],
    queryFn: () => fetchMyOrders({ limit: 50 }),
    enabled: isAuthenticated && !!bootstrapQ.data,
  });

  const walletQ = useQuery({
    queryKey: ["wallet"],
    queryFn: () => getWallet(),
    enabled: isAuthenticated && !!bootstrapQ.data,
  });

  const addressesQ = useQuery({
    queryKey: ["addresses"],
    queryFn: () => fetchAddresses(),
    enabled: isAuthenticated && !!bootstrapQ.data,
  });

  const purchasedQ = useQuery({
    queryKey: ["purchased-products"],
    queryFn: () => fetchPurchasedProducts(),
    enabled: isAuthenticated && !!bootstrapQ.data,
  });

  if (bootstrapQ.isLoading || authLoading) return <StorefrontSkeleton />;
  if (!bootstrap) {
    return <div className="min-h-screen flex items-center justify-center text-rose-500">Failed to load store.</div>;
  }

  const brandColor = bootstrap.settings?.brand_color || "#4f46e5";

  // Not authenticated — prompt login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen">
        <Header bootstrap={bootstrap} currency={currency} setCurrency={setCurrency} lang={lang} setLang={setLang} />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">My Account</h1>
          <p className="text-gray-500 mb-6">Please sign in to view your account dashboard.</p>
          <Link
            href={`/account/login?redirect=/account/dashboard`}
            className="inline-block text-white font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition"
            style={{ background: brandColor }}
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const orders = ordersQ.data?.items ?? [];
  const totalOrders = ordersQ.data?.total ?? 0;
  const recentOrders = orders.slice(0, RECENT_ORDER_LIMIT);

  // Purchase overview stats
  const totalSpent = orders
    .filter((o) => !["cancelled", "failed", "refunded"].includes(o.status))
    .reduce((sum, o) => sum + o.grand_total, 0);
  const itemsBought = orders
    .filter((o) => !["cancelled", "failed"].includes(o.status))
    .reduce((sum, o) => sum + (o.items?.reduce((s, it) => s + it.quantity, 0) ?? 0), 0);
  const deliveredCount = orders.filter((o) => o.status === "delivered" || o.status === "fulfilled").length;

  const walletBalance = walletQ.data?.balance ?? 0;
  const walletCurrency = walletQ.data?.currency_code || currency;

  const addresses: Address[] = addressesQ.data?.items ?? [];
  const defaultAddress = addresses.find((a) => a.is_default) ?? addresses[0];

  const purchasedProducts: PurchasedProduct[] = purchasedQ.data?.items ?? [];
  // Reviews open once the order is delivered (fulfilled orders stay reviewable).
  const reviewableProducts = purchasedProducts.filter(
    (p) => !p.has_reviewed && (p.order_status === "delivered" || p.order_status === "fulfilled")
  );
  const reviewedCount = purchasedProducts.length - reviewableProducts.length;
  const returnableProducts = purchasedProducts.filter(
    (p) =>
      p.order_status !== "fulfilled" &&
      (p.return_eligible || p.refund_eligible || p.replacement_eligible)
  );

  const displayName = customer?.full_name || getStoredCustomer()?.full_name || "there";

  return (
    <div className="min-h-screen bg-slate-50">
      <Header bootstrap={bootstrap} currency={currency} setCurrency={setCurrency} lang={lang} setLang={setLang} />

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 mb-4 sm:mb-6 overflow-x-auto no-scrollbar">
          <Link href={``} className="hover:text-slate-900 whitespace-nowrap">Home</Link>
          <span>/</span>
          <span className="text-slate-900 font-medium whitespace-nowrap">My Account</span>
        </div>

        {/* Welcome header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Hello, {displayName.split(" ")[0]}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Here&apos;s an overview of your account activity.</p>
        </div>

        {/* Purchase overview — stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <StatCard
            icon={ShoppingBag}
            label="Total Orders"
            value={String(totalOrders)}
            color="#4f46e5"
          />
          <StatCard
            icon={Package}
            label="Items Bought"
            value={String(itemsBought)}
            color="#0891b2"
          />
          <StatCard
            icon={CheckCircle}
            label="Delivered"
            value={String(deliveredCount)}
            color="#059669"
          />
          <StatCard
            icon={WalletIcon}
            label="Total Spent"
            value={formatPrice(totalSpent, currencyObj)}
            color="#d97706"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column (2/3): Recent orders */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Orders */}
            <section className="bg-white rounded-2xl border p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" style={{ color: brandColor }} />
                  Recent Orders
                </h2>
                {totalOrders > RECENT_ORDER_LIMIT && (
                  <Link
                    href={`/orders`}
                    className="text-sm font-medium hover:underline inline-flex items-center gap-1"
                    style={{ color: brandColor }}
                  >
                    View all <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              {ordersQ.isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : ordersQ.error ? (
                <p className="text-sm text-rose-500">Failed to load orders.</p>
              ) : recentOrders.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No orders yet.</p>
                  <Link
                    href={``}
                    className="inline-block mt-3 text-sm font-medium hover:underline"
                    style={{ color: brandColor }}
                  >
                    Start shopping
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentOrders.map((order) => {
                    const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                    const SIcon = sc.icon;
                    return (
                      <Link
                        key={order.id}
                        href={`/orders/${order.id}`}
                        className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition group"
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${sc.bg} ${sc.border} border`}>
                          <SIcon className="w-5 h-5" strokeWidth={1.5} style={{ color: sc.color }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 text-sm truncate">
                            Order #{order.id.slice(0, 8)}
                            {order.order_tag && (
                              <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20 align-middle">
                                {order.order_tag}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDate(order.created_at)}
                            {order.items && ` · ${order.items.length} item${order.items.length !== 1 ? "s" : ""}`}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-slate-900 text-sm">
                            {formatPrice(order.grand_total, currencyObj)}
                          </p>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${sc.bg} ${sc.border} border whitespace-nowrap`}
                            style={{ color: sc.color }}
                          >
                            {sc.label}
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition flex-shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Saved Addresses */}
            <section className="bg-white rounded-2xl border p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5" style={{ color: brandColor }} />
                  Saved Addresses
                </h2>
                <Link
                  href={`/checkout`}
                  className="text-sm font-medium hover:underline inline-flex items-center gap-1"
                  style={{ color: brandColor }}
                >
                  Manage <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {addressesQ.isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : addressesQ.error ? (
                <p className="text-sm text-rose-500">Failed to load addresses.</p>
              ) : addresses.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <MapPin className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No saved addresses yet.</p>
                  <p className="text-xs mt-1">Addresses are saved at checkout.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {addresses.slice(0, 4).map((addr) => (
                    <div key={addr.id} className="p-3 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-slate-900 text-sm">{addr.label || "Address"}</p>
                        {addr.is_default && (
                          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {addr.first_name} {addr.last_name}
                        <br />
                        {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}
                        <br />
                        {addr.city}{addr.state ? `, ${addr.state}` : ""} {addr.postal_code ?? ""}
                        <br />
                        {addr.country}
                        {addr.phone && <><br />{addr.phone}</>}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Review Your Purchases */}
            <section className="bg-white rounded-2xl border p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-900 flex items-center gap-2">
                  <Star className="w-5 h-5" style={{ color: brandColor }} />
                  Review Your Purchases
                </h2>
                {purchasedProducts.length > 0 && (
                  <span className="text-xs text-slate-400">
                    {reviewedCount} reviewed · {reviewableProducts.length} pending
                  </span>
                )}
              </div>

              {purchasedQ.isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : purchasedQ.error ? (
                <p className="text-sm text-rose-500">Failed to load purchased products.</p>
              ) : purchasedProducts.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Star className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No purchases to review yet.</p>
                  <p className="text-xs mt-1">Products you buy will appear here for review.</p>
                </div>
              ) : reviewableProducts.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-emerald-400 opacity-60" />
                  <p className="text-sm">You&apos;ve reviewed all your purchases.</p>
                  <p className="text-xs mt-1">Thank you for sharing your feedback!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {reviewableProducts.slice(0, 6).map((p) => (
                    <div
                      key={p.product_id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200 transition"
                    >
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Package className="w-6 h-6 text-slate-300" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/products/${p.slug}`}
                          className="font-medium text-slate-900 text-sm truncate hover:underline block"
                        >
                          {p.name}
                        </Link>
                        <p className="text-xs text-slate-400">
                          Ordered {formatDate(p.order_date)} · {p.order_status}
                        </p>
                      </div>
                      <button
                        onClick={() => setReviewProduct(p)}
                        className="text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:opacity-90 transition flex-shrink-0 inline-flex items-center gap-1"
                        style={{ background: brandColor }}
                      >
                        <Star className="w-3.5 h-3.5" /> Review
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Returns & Refunds — hidden when the returns module is disabled */}
            {returnsModuleOn && (
            <section className="bg-white rounded-2xl border p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-900 flex items-center gap-2">
                  <RotateCcw className="w-5 h-5" style={{ color: brandColor }} />
                  Returns & Refunds
                </h2>
                {returnableProducts.length > 0 && (
                  <span className="text-xs text-slate-400">
                    {returnableProducts.length} eligible
                  </span>
                )}
              </div>

              {purchasedQ.isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : purchasedQ.error ? (
                <p className="text-sm text-rose-500">Failed to load return eligibility.</p>
              ) : returnableProducts.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <RotateCcw className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No eligible returns or refunds right now.</p>
                  <p className="text-xs mt-1">
                    {bootstrap.settings?.returns_enabled === false
                      ? "Returns and refunds are currently disabled for this store."
                      : "Return options appear here for recently delivered orders within the validity period."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {returnableProducts.slice(0, 6).map((p) => (
                    <div
                      key={`${p.product_id}-${p.order_id}`}
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200 transition"
                    >
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Package className="w-6 h-6 text-slate-300" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/products/${p.slug}`}
                          className="font-medium text-slate-900 text-sm truncate hover:underline block"
                        >
                          {p.name}
                        </Link>
                        <p className="text-xs text-slate-400">
                          Order #{p.order_id.slice(0, 8)} · {p.order_status}
                          {p.delivered_at && ` · delivered ${formatDate(p.delivered_at)}`}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {p.return_eligible && (
                            <Link
                              href={`/orders/${p.order_id}?action=return`}
                              className="text-xs font-medium px-2.5 py-1 rounded-lg text-white hover:opacity-90 transition inline-flex items-center gap-1"
                              style={{ background: brandColor }}
                            >
                              <Undo2 className="w-3 h-3" /> Return
                            </Link>
                          )}
                          {p.refund_eligible && (
                            <Link
                              href={`/orders/${p.order_id}?action=refund`}
                              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition inline-flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" /> Refund
                            </Link>
                          )}
                          {p.replacement_eligible && (
                            <Link
                              href={`/orders/${p.order_id}?action=replacement`}
                              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition inline-flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" /> Replace
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            )}
          </div>

          {/* Right column (1/3): Wallet + quick links */}
          <div className="space-y-6">
            {/* Wallet balance card */}
            <Link
              href={`/account/wallet`}
              className="block rounded-2xl p-5 sm:p-6 text-white shadow-lg relative overflow-hidden hover:opacity-95 transition group"
              style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)` }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 bg-white" style={{ transform: "translate(30%, -30%)" }} />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <WalletIcon className="w-5 h-5" />
                  <p className="text-sm font-medium text-white/80">Wallet Balance</p>
                </div>
                {walletQ.isLoading ? (
                  <div className="h-8 w-32 bg-white/20 rounded-lg animate-pulse" />
                ) : walletQ.error ? (
                  <p className="text-sm text-white/80">Unavailable</p>
                ) : (
                  <p className="text-3xl font-bold">
                    {walletCurrency}{" "}
                    {walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-1 text-sm text-white/80 group-hover:gap-2 transition-all">
                  <Plus className="w-3.5 h-3.5" /> Top up wallet
                </div>
              </div>
            </Link>

            {/* Quick links */}
            <section className="bg-white rounded-2xl border p-4 sm:p-6">
              <h2 className="font-bold text-slate-900 mb-3">Quick Links</h2>
              <div className="space-y-1">
                <QuickLink
                  href={`/orders`}
                  icon={ShoppingBag}
                  label="Order History"
                  brandColor={brandColor}
                />
                <QuickLink
                  href={`/account/wallet`}
                  icon={WalletIcon}
                  label="My Wallet"
                  brandColor={brandColor}
                />
                <QuickLink
                  href={`/account/data`}
                  icon={ShieldCheck}
                  label="Data & Privacy"
                  brandColor={brandColor}
                />
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Review form modal */}
      {reviewProduct && (
        <ReviewFormModal
         
          product={reviewProduct}
          brandColor={brandColor}
          onClose={() => setReviewProduct(null)}
          onSuccess={() => {
            setReviewProduct(null);
            toast.success("Review submitted!", "Thank you for your feedback.");
          }}
        />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border p-4">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center mb-2"
        style={{ background: `${color}1a` }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className="text-lg sm:text-xl font-bold text-slate-900 truncate">{value}</p>
    </div>
  );
}

function QuickLink({ href, icon: Icon, label, brandColor }: { href: string; icon: LucideIcon; label: string; brandColor: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition group"
    >
      <Icon className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition" />
      <span className="text-sm text-slate-700 flex-1">{label}</span>
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition" />
    </Link>
  );
}
