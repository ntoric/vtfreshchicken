"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  CheckCircle,
  Clock,
  Settings,
  XCircle,
  Package,
  Undo2,
  ShoppingBag,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { fetchBootstrap, fetchMyOrders } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { StorefrontSkeleton } from "@/components/Loaders";
import { formatPrice, getCurrencySymbol } from "@/lib/format";
import { useCurrencyLang } from "@/lib/currency-lang";
import type { Currency } from "@/types";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: LucideIcon }> = {
  paid: { label: "Paid", color: "#059669", bg: "bg-emerald-50", border: "border-emerald-200", icon: CheckCircle },
  pending: { label: "Pending", color: "#d97706", bg: "bg-amber-50", border: "border-amber-200", icon: Clock },
  processing: { label: "Processing", color: "#2563eb", bg: "bg-blue-50", border: "border-blue-200", icon: Settings },
  failed: { label: "Failed", color: "#dc2626", bg: "bg-rose-50", border: "border-rose-200", icon: XCircle },
  shipped: { label: "Shipped", color: "#2563eb", bg: "bg-blue-50", border: "border-blue-200", icon: Package },
  delivered: { label: "Delivered", color: "#059669", bg: "bg-emerald-50", border: "border-emerald-200", icon: CheckCircle },
  fulfilled: { label: "Fulfilled", color: "#0891b2", bg: "bg-cyan-50", border: "border-cyan-200", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "#6b7280", bg: "bg-gray-50", border: "border-gray-200", icon: XCircle },
  refunded: { label: "Refunded", color: "#7c3aed", bg: "bg-purple-50", border: "border-purple-200", icon: Undo2 },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function OrderHistoryPage({ params }: { params: { tenant: string } }) {
  const { currency, lang, setLang } = useCurrencyLang();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap", params.tenant],
    queryFn: () => fetchBootstrap(params.tenant),
  });
  const bootstrap = bootstrapQ.data;
  const currencyObj: Currency | undefined = getCurrencySymbol(bootstrap?.currencies || [], currency);

  const ordersQ = useQuery({
    queryKey: ["my-orders", params.tenant],
    queryFn: () => fetchMyOrders(params.tenant, { limit: 50 }),
    enabled: isAuthenticated && !!bootstrapQ.data,
  });

  const orders = ordersQ.data?.items ?? [];
  const total = ordersQ.data?.total ?? 0;

  if (bootstrapQ.isLoading || authLoading) {
    return <StorefrontSkeleton />;
  }
  if (!bootstrap) {
    return <div className="min-h-screen flex items-center justify-center text-rose-500">Failed to load store.</div>;
  }

  // Not authenticated — prompt login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen">
        <Header tenant={params.tenant} bootstrap={bootstrap} currency={currency} setCurrency={() => {}} lang={lang} setLang={setLang} />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order History</h1>
          <p className="text-gray-500 mb-6">Please log in to view your order history.</p>
          <Link
            href={`/${params.tenant}/account/login?redirect=/${params.tenant}/orders`}
            className="inline-block bg-brand text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-brand-dark transition"
          >
            Log In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header tenant={params.tenant} bootstrap={bootstrap} currency={currency} setCurrency={() => {}} lang={lang} setLang={setLang} />

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6 overflow-x-auto no-scrollbar">
          <Link href={`/${params.tenant}`} className="hover:text-brand whitespace-nowrap">Home</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium whitespace-nowrap">Order History</span>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">My Orders</h1>
          <Link href={`/${params.tenant}`} className="text-brand font-medium hover:underline text-sm inline-flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Continue shopping
          </Link>
        </div>

        {ordersQ.isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border p-6 animate-pulse h-28" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl border p-8 sm:p-12 text-center">
            <div className="flex justify-center mb-4">
              <ShoppingBag className="w-16 h-16 text-gray-300" strokeWidth={1.5} />
            </div>
            <p className="text-xl font-medium text-gray-900 mb-2">No orders yet</p>
            <p className="text-gray-500 mb-6">When you place an order, it will appear here.</p>
            <Link
              href={`/${params.tenant}`}
              className="inline-block bg-brand text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-brand-dark transition"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">{total} order{total !== 1 ? "s" : ""}</p>
            <div className="space-y-3">
              {orders.map((order) => {
                const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                const SIcon = sc.icon;
                return (
                  <Link
                    key={order.id}
                    href={`/${params.tenant}/orders/${order.id}`}
                    className="block bg-white rounded-2xl border p-4 sm:p-5 hover:border-brand hover:shadow-sm transition group"
                  >
                    <div className="flex items-center justify-between gap-4">
                      {/* Left: status + order info */}
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${sc.bg} ${sc.border} border`}>
                          <SIcon className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.5} style={{ color: sc.color }} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                            Order #{order.id.slice(0, 8)}
                            {order.order_tag && (
                              <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20 align-middle">
                                {order.order_tag}
                              </span>
                            )}
                          </p>
                          <p className="text-xs sm:text-sm text-gray-500">
                            {formatDate(order.created_at)}
                            {order.items && ` · ${order.items.length} item${order.items.length !== 1 ? "s" : ""}`}
                          </p>
                        </div>
                      </div>
                      {/* Right: total + status badge + chevron */}
                      <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="font-bold text-gray-900 text-sm sm:text-base">
                            {formatPrice(order.grand_total, currencyObj)}
                          </p>
                          <p className="text-xs text-gray-400">{order.currency_code}</p>
                        </div>
                        <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${sc.bg} ${sc.border} border whitespace-nowrap`}
                          style={{ color: sc.color }}>
                          {sc.label}
                        </span>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand transition flex-shrink-0" />
                      </div>
                    </div>
                    {/* Mobile total */}
                    <div className="mt-2 sm:hidden flex items-center justify-between">
                      <span className="text-xs text-gray-400">{order.currency_code}</span>
                      <span className="font-bold text-gray-900 text-sm">{formatPrice(order.grand_total, currencyObj)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
