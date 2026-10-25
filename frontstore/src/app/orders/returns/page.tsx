"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import {
  RotateCcw,
  ArrowLeft,
  X,
  ShoppingBag,
} from "lucide-react";
import { fetchBootstrap, listMyReturns } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { StorefrontSkeleton } from "@/components/Loaders";
import { getCurrencySymbol } from "@/lib/format";
import { useCurrencyLang } from "@/lib/currency-lang";
import type { Currency, OrderReturn } from "@/types";
import { RETURN_STATUS_LABELS, RETURN_TYPE_LABELS, REFUND_METHOD_LABELS } from "@/types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function MyReturnsPage({ params }: { params: {} }) {
  const { currency, lang, setLang } = useCurrencyLang();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selected, setSelected] = useState<OrderReturn | null>(null);

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => fetchBootstrap(),
  });
  const bootstrap = bootstrapQ.data;
  const currencyObj: Currency | undefined = getCurrencySymbol(bootstrap?.currencies || [], currency);

  const returnsQ = useQuery({
    queryKey: ["my-returns"],
    queryFn: () => listMyReturns(50),
    enabled: isAuthenticated && !!bootstrapQ.data,
  });

  const returns = returnsQ.data?.items ?? [];
  const total = returnsQ.data?.total ?? 0;

  if (bootstrapQ.isLoading || authLoading) {
    return <StorefrontSkeleton />;
  }
  if (!bootstrap) {
    return <div className="min-h-screen flex items-center justify-center text-rose-500">Failed to load store.</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen">
        <Header bootstrap={bootstrap} currency={currency} setCurrency={() => {}} lang={lang} setLang={setLang} />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">My Returns</h1>
          <p className="text-gray-500 mb-6">Please log in to view your return requests.</p>
          <Link
            href={`/account/login?redirect=/orders/returns`}
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
      <Header bootstrap={bootstrap} currency={currency} setCurrency={() => {}} lang={lang} setLang={setLang} />

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6 overflow-x-auto no-scrollbar">
          <Link href={``} className="hover:text-brand whitespace-nowrap">Home</Link>
          <span>/</span>
          <Link href={`/orders`} className="hover:text-brand whitespace-nowrap">Orders</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium whitespace-nowrap">My Returns</span>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 flex items-center gap-2">
            <RotateCcw className="w-7 h-7 text-gray-500" strokeWidth={1.75} />
            My Returns
          </h1>
          <Link href={`/orders`} className="text-brand font-medium hover:underline text-sm inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to Orders
          </Link>
        </div>

        {bootstrap.settings?.returns_enabled === false && (
          <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-4">
            Returns, refunds, and replacements are currently disabled for this store. New requests can&apos;t be made, but your existing requests are listed below.
          </p>
        )}

        {returnsQ.isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border p-6 animate-pulse h-28" />
            ))}
          </div>
        ) : returns.length === 0 ? (
          <div className="bg-white rounded-2xl border p-8 sm:p-12 text-center">
            <div className="flex justify-center mb-4">
              <ShoppingBag className="w-16 h-16 text-gray-300" strokeWidth={1.5} />
            </div>
            <p className="text-xl font-medium text-gray-900 mb-2">No returns yet</p>
            <p className="text-gray-500 mb-6">When you request a return, it will appear here.</p>
            <Link
              href={`/orders`}
              className="inline-block bg-brand text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-brand-dark transition"
            >
              View Orders
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">{total} return{total !== 1 ? "s" : ""}</p>
            <div className="space-y-3">
              {returns.map((ret) => (
                <button
                  key={ret.id}
                  onClick={() => setSelected(ret)}
                  className="block w-full text-left bg-white rounded-2xl border p-4 sm:p-5 hover:border-brand hover:shadow-sm transition"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-purple-50 border border-purple-200">
                        <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                          {ret.return_number}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500">
                          {formatDate(ret.created_at)}
                          {ret.items && ` · ${ret.items.length} item${ret.items.length !== 1 ? "s" : ""}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                      {ret.refund_amount > 0 && currencyObj && (
                        <div className="text-right hidden sm:block">
                          <p className="font-bold text-gray-900 text-sm sm:text-base">
                            {currencyObj.symbol}{ret.refund_amount.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-400">{RETURN_TYPE_LABELS[ret.type] || ret.type}</p>
                        </div>
                      )}
                      <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full whitespace-nowrap ${
                        ret.status === "completed" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                        ret.status === "approved" ? "bg-blue-50 border-blue-200 text-blue-700" :
                        ret.status === "rejected" ? "bg-rose-50 border-rose-200 text-rose-700" :
                        ret.status === "cancelled" ? "bg-gray-50 border-gray-200 text-gray-600" :
                        "bg-amber-50 border-amber-200 text-amber-700"
                      } border`}>
                        {RETURN_STATUS_LABELS[ret.status] || ret.status}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Return details modal */}
      {selected && currencyObj && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Return Details</h3>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Return Number</span>
                <span className="font-medium text-gray-900">{selected.return_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="font-medium text-gray-900">{RETURN_TYPE_LABELS[selected.type] || selected.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`font-medium px-2.5 py-1 rounded-full text-xs ${
                  selected.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                  selected.status === "approved" ? "bg-blue-100 text-blue-700" :
                  selected.status === "rejected" ? "bg-rose-100 text-rose-700" :
                  selected.status === "cancelled" ? "bg-gray-100 text-gray-600" :
                  "bg-amber-100 text-amber-700"
                }`}>
                  {RETURN_STATUS_LABELS[selected.status] || selected.status}
                </span>
              </div>
              {selected.reason && (
                <div>
                  <span className="text-gray-500 block mb-1">Reason</span>
                  <span className="text-gray-800">{selected.reason}</span>
                </div>
              )}
              {selected.status === "rejected" && selected.status_history && (() => {
                const rejectionEvent = [...selected.status_history].reverse().find((e) => e.status === "rejected" && e.note);
                return rejectionEvent ? (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                    <span className="text-rose-700 font-medium text-xs block mb-1">Rejection Reason</span>
                    <span className="text-rose-600 text-sm">{rejectionEvent.note}</span>
                  </div>
                ) : null;
              })()}
              {selected.refund_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Refund Amount</span>
                  <span className="font-medium text-gray-900">{currencyObj.symbol}{selected.refund_amount.toFixed(2)}</span>
                </div>
              )}
              {selected.refund_method && selected.refund_method !== "none" && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Refund Method</span>
                  <span className="font-medium text-gray-900">{REFUND_METHOD_LABELS[selected.refund_method] || selected.refund_method}</span>
                </div>
              )}
              {selected.items && selected.items.length > 0 && (
                <div>
                  <span className="text-gray-500 block mb-2">Items</span>
                  <div className="space-y-2">
                    {selected.items.map((item) => (
                      <div key={item.id} className="flex justify-between bg-gray-50 rounded-lg p-2">
                        <span className="text-gray-800">{item.name} x{item.quantity}</span>
                        <span className="text-gray-500">{currencyObj.symbol}{item.line_total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selected.status_history && selected.status_history.length > 0 && (
                <div>
                  <span className="text-gray-500 block mb-2">Status History</span>
                  <div className="space-y-2">
                    {selected.status_history.map((event, i) => (
                      <div key={i} className="flex gap-2 text-xs">
                        <span className="font-medium text-gray-700">{RETURN_STATUS_LABELS[event.status] || event.status}</span>
                        <span className="text-gray-400">{new Date(event.timestamp).toLocaleString()}</span>
                        {event.note && <span className="text-gray-500">— {event.note}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="pt-2">
                <Link
                  href={`/orders/${selected.order_id}`}
                  className="text-brand text-sm font-medium hover:underline"
                >
                  View Order
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
