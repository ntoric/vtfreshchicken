"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CheckCircle,
  Clock,
  Settings,
  XCircle,
  Package,
  Home,
  Undo2,
  Search,
  FileText,
  CreditCard,
  RotateCcw,
  RefreshCw,
  X,
  Plus,
  Minus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { fetchBootstrap, fetchOrder, listOrderReturns, createReturn, generateIdempotencyKey, fetchOrderReturnEligibility, listOrderShipments, trackShipment } from "@/lib/api";
import { Header } from "@/components/Header";
import { FullPageLoader } from "@/components/Loaders";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { InvoiceGenerator } from "@/components/checkout/InvoiceGenerator";
import { getCurrencySymbol } from "@/lib/format";
import type { OrderResponse, OrderReturn, CreateReturnRequest, OrderReturnEligibility, Shipment, TrackingResponse } from "@/types";
import { RETURN_STATUS_LABELS, RETURN_TYPE_LABELS, REFUND_METHOD_LABELS } from "@/types";
import { useCurrencyLang } from "@/lib/currency-lang";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const ORDER_CTX_KEY = "tc_order_response";

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

function OrderDetailsContent({ tenant, orderId }: { tenant: string; orderId: string }) {
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();
  const [cachedResponse, setCachedResponse] = useState<OrderResponse | null>(null);
  const qc = useQueryClient();

  // Return modal state
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnType, setReturnType] = useState<"refund" | "replacement" | "exchange">("refund");
  const [returnReason, setReturnReason] = useState("");
  const [returnRefundMethod, setReturnRefundMethod] = useState<"original" | "wallet" | "store_credit" | "none">("original");
  const [returnItems, setReturnItems] = useState<Record<string, { selected: boolean; quantity: number; reason: string }>>({});
  const [returnError, setReturnError] = useState("");
  const [selectedReturn, setSelectedReturn] = useState<OrderReturn | null>(null);

  // Read cached order response from sessionStorage (set by payment page after checkout)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ORDER_CTX_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as OrderResponse;
        // Only use cached data if it matches this order
        if (parsed.order.id === orderId) {
          setCachedResponse(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, [orderId]);

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap", tenant],
    queryFn: () => fetchBootstrap(tenant),
  });

  const orderQ = useQuery({
    queryKey: ["order", tenant, orderId],
    queryFn: () => fetchOrder(tenant, orderId),
    enabled: !!orderId && !!bootstrapQ.data,
  });

  const returnsQ = useQuery({
    queryKey: ["order-returns", tenant, orderId],
    queryFn: () => listOrderReturns(tenant, orderId),
    enabled: !!orderId && !!bootstrapQ.data,
  });

  const eligibilityQ = useQuery({
    queryKey: ["order-return-eligibility", tenant, orderId],
    queryFn: () => fetchOrderReturnEligibility(tenant, orderId),
    enabled: !!orderId && !!bootstrapQ.data,
  });

  const shipmentsQ = useQuery({
    queryKey: ["order-shipments", tenant, orderId],
    queryFn: () => listOrderShipments(tenant, orderId),
    enabled: !!orderId && !!bootstrapQ.data,
  });

  const [trackingData, setTrackingData] = useState<Record<string, TrackingResponse | null>>({});
  const [trackingLoading, setTrackingLoading] = useState<string | null>(null);

  const handleTrack = async (shipmentId: string) => {
    setTrackingLoading(shipmentId);
    try {
      const data = await trackShipment(tenant, orderId, shipmentId);
      setTrackingData((prev) => ({ ...prev, [shipmentId]: data }));
      qc.invalidateQueries({ queryKey: ["order-shipments", tenant, orderId] });
    } catch (e) {
      setTrackingData((prev) => ({ ...prev, [shipmentId]: { tracking_number: "", carrier: "", status: "failed", events: [{ status: "error", description: (e as Error).message }] } }));
    } finally {
      setTrackingLoading(null);
    }
  };

  const searchParams = useSearchParams();
  const router = useRouter();

  const returnIdemKeyRef = useRef("");
  const createReturnMut = useMutation({
    mutationFn: (body: CreateReturnRequest) => {
      if (!returnIdemKeyRef.current) {
        returnIdemKeyRef.current = generateIdempotencyKey();
      }
      return createReturn(tenant, orderId, body, returnIdemKeyRef.current);
    },
    onSuccess: () => {
      returnIdemKeyRef.current = "";
      qc.invalidateQueries({ queryKey: ["order-returns", tenant, orderId] });
      qc.invalidateQueries({ queryKey: ["my-returns", tenant] });
      setReturnModalOpen(false);
      setReturnError("");
      setReturnReason("");
      setReturnItems({});
    },
    onError: (err: Error) => {
      setReturnError(err.message || "Failed to create return request");
    },
  });

  const bootstrap = bootstrapQ.data;
  const order = orderQ.data?.order;
  const eligibility = eligibilityQ.data;

  useEffect(() => {
    if (order?.currency_code) setCurrency(order.currency_code);
  }, [order]);

  // Auto-open return modal when navigated with ?action=return|refund|replacement
  useEffect(() => {
    const action = searchParams.get("action");
    if (!action || !order || returnModalOpen) return;
    // Don't show return options for fulfilled orders.
    if (order.status === "fulfilled") return;
    const validActions: Record<string, "refund" | "replacement" | "exchange"> = {
      return: "exchange",
      refund: "refund",
      replacement: "replacement",
    };
    const mapped = validActions[action];
    if (!mapped) return;
    // Check eligibility before opening
    if (!eligibility) return;
    if (mapped === "refund" && !eligibility.refund_eligible) return;
    if (mapped === "replacement" && !eligibility.replacement_eligible) return;
    if (mapped === "exchange" && !eligibility.return_eligible) return;
    setReturnType(mapped);
    setReturnError("");
    const init: Record<string, { selected: boolean; quantity: number; reason: string }> = {};
    for (const item of order.items || []) {
      init[item.id] = { selected: false, quantity: 1, reason: "" };
    }
    setReturnItems(init);
    setReturnModalOpen(true);
    // Remove the action param so closing the modal doesn't re-trigger auto-open.
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    router.replace(`?${next.toString()}`, { scroll: false });
  }, [searchParams, order, eligibility, returnModalOpen, router]);

  const currencyObj = getCurrencySymbol(bootstrap?.currencies || [], currency);

  if (bootstrapQ.isLoading || orderQ.isLoading) {
    return <FullPageLoader label="Loading order details" />;
  }

  if (!bootstrap) {
    return (
      <div className="min-h-screen flex items-center justify-center text-rose-500">
        Failed to load store.
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen">
        <Header tenant={tenant} bootstrap={bootstrap} currency={currency} setCurrency={setCurrency} lang={lang} setLang={setLang} />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="flex justify-center mb-4">
            <Search className="w-16 h-16 text-gray-300" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h1>
          <p className="text-gray-500 mb-6">We couldn't find the order you're looking for.</p>
          <Link href={`/${tenant}`} className="inline-block bg-brand text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-brand-dark transition">
            Back to Store
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const transactionId = cachedResponse?.transaction_id;
  const paymentMethod = cachedResponse?.payment_method;
  const tenantName = bootstrap.store_name || "TruCommerce";

  return (
    <div className="min-h-screen">
      <Header tenant={tenant} bootstrap={bootstrap} currency={currency} setCurrency={setCurrency} lang={lang} setLang={setLang} />

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6 overflow-x-auto no-scrollbar">
          <Link href={`/${tenant}`} className="hover:text-brand whitespace-nowrap">Home</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium whitespace-nowrap">Order Details</span>
        </div>

        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-1">Order Details</h1>
            <p className="text-gray-500 text-sm sm:text-base">
              Order <span className="font-mono font-bold text-gray-700">#{order.id.slice(0, 8).toUpperCase()}</span>
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Replacement / exchange tag */}
            {order.order_tag && (
              <div className="inline-flex items-center gap-1.5 bg-brand/10 border border-brand/20 rounded-full px-3 py-1.5">
                <RefreshCw className="w-4 h-4 text-brand" strokeWidth={2} />
                <span className="text-xs font-bold uppercase tracking-wide text-brand">
                  {order.order_tag}
                </span>
              </div>
            )}
            {/* Status badge */}
            <div className={`inline-flex items-center gap-2 ${statusConfig.bg} ${statusConfig.border} border rounded-full px-4 py-2`}>
              {(() => { const SIcon = statusConfig.icon; return <SIcon className="w-4 h-4" strokeWidth={2} />; })()}
              <span className="text-sm font-bold uppercase tracking-wide" style={{ color: statusConfig.color }}>
                {statusConfig.label}
              </span>
            </div>
            {/* Invoice download */}
            <InvoiceGenerator
              order={order}
              currencyObj={currencyObj}
              settings={bootstrap.settings}
              tenantName={tenantName}
              transactionId={transactionId}
              paymentMethod={paymentMethod}
            />
          </div>
        </div>

        {/* Order timeline / status tracker */}
        <div className="bg-white rounded-2xl border p-4 sm:p-6 mb-6">
          <h3 className="font-bold text-gray-900 mb-4 sm:mb-5">Order Timeline</h3>
          {order.status === "cancelled" || order.status === "refunded" || order.status === "failed" ? (
            <div className={`rounded-xl p-4 ${statusConfig.bg} ${statusConfig.border} border flex items-center gap-3`}>
              {(() => { const SIcon = statusConfig.icon; return <SIcon className="w-7 h-7 flex-shrink-0" strokeWidth={1.5} />; })()}
              <div>
                <p className="font-bold" style={{ color: statusConfig.color }}>{statusConfig.label}</p>
                {order.cancel_reason && <p className="text-sm text-gray-600 mt-0.5">{order.cancel_reason}</p>}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between overflow-x-auto no-scrollbar">
              {[
                { key: "placed", label: "Order Placed", icon: FileText, active: true },
                { key: "paid", label: "Payment Confirmed", icon: CreditCard, active: ["paid", "processing", "shipped", "delivered"].includes(order.status) },
                { key: "processing", label: "Processing", icon: Settings, active: ["processing", "shipped", "delivered"].includes(order.status) },
                { key: "shipped", label: "Shipped", icon: Package, active: ["shipped", "delivered"].includes(order.status) },
                { key: "delivered", label: "Delivered", icon: Home, active: ["delivered", "fulfilled"].includes(order.status) },
                { key: "fulfilled", label: "Fulfilled", icon: CheckCircle, active: order.status === "fulfilled" },
              ].map((step, i, arr) => (
                <div key={step.key} className="flex items-center flex-shrink-0">
                  <div className="flex flex-col items-center gap-1.5 sm:gap-2">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition ${
                      step.active ? "bg-brand text-white shadow-md" : "bg-gray-100 text-gray-400"
                    }`}>
                      {(() => { const StepIcon = step.icon; return <StepIcon className="w-5 h-5" strokeWidth={1.5} />; })()}
                    </div>
                    <span className={`text-[10px] sm:text-xs font-medium whitespace-nowrap ${step.active ? "text-gray-900" : "text-gray-400"}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`w-8 sm:w-20 h-0.5 mx-1.5 sm:mx-2 ${arr[i + 1].active ? "bg-brand" : "bg-gray-200"}`} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tracking info */}
        {order.tracking_number && (
          <div className="bg-white rounded-2xl border p-4 sm:p-6 mb-6">
            <h3 className="font-bold text-gray-900 mb-4">Shipping Tracking</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">Carrier</p>
                <p className="font-medium text-gray-800">{order.carrier || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Tracking Number</p>
                <p className="font-mono text-sm text-gray-800">{order.tracking_number}</p>
              </div>
              {order.shipped_at && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Shipped On</p>
                  <p className="font-medium text-gray-800">{new Date(order.shipped_at).toLocaleString()}</p>
                </div>
              )}
              {order.delivered_at && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Delivered On</p>
                  <p className="font-medium text-gray-800">{new Date(order.delivered_at).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Carrier shipments with live tracking */}
        {shipmentsQ.data?.items && shipmentsQ.data.items.length > 0 && (
          <div className="bg-white rounded-2xl border p-4 sm:p-6 mb-6">
            <h3 className="font-bold text-gray-900 mb-4">Carrier Shipments</h3>
            <div className="space-y-4">
              {shipmentsQ.data.items.map((sh) => {
                const tracking = trackingData[sh.id];
                return (
                  <div key={sh.id} className="border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 capitalize">{sh.status.replace(/_/g, " ")}</span>
                        <span className="text-xs text-gray-400 uppercase">{sh.provider_code}</span>
                      </div>
                      <button
                        onClick={() => handleTrack(sh.id)}
                        disabled={trackingLoading === sh.id}
                        className="text-xs border px-3 py-1 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                      >
                        {trackingLoading === sh.id ? "Tracking…" : "Track Shipment"}
                      </button>
                    </div>
                    <div className="text-sm text-gray-600 space-y-0.5">
                      <div><span className="text-gray-400">Tracking #:</span> <span className="font-mono">{sh.tracking_number}</span></div>
                      {sh.carrier && <div><span className="text-gray-400">Carrier:</span> {sh.carrier}</div>}
                      {sh.awb_url && <div><a href={sh.awb_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">View Label / AWB</a></div>}
                    </div>
                    {sh.items && sh.items.length > 0 && (
                      <div className="border-t pt-3">
                        <p className="text-xs font-medium text-gray-600 mb-2">Items in this shipment</p>
                        <ul className="space-y-1">
                          {sh.items.map((si) => (
                            <li key={si.id} className="text-xs text-gray-500 flex justify-between">
                              <span>{si.product_name || "—"}{si.sku && <span className="text-gray-400 font-mono"> ({si.sku})</span>}</span>
                              <span className="text-gray-400">×{si.quantity}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {tracking && tracking.events && tracking.events.length > 0 && (
                      <div className="border-t pt-3">
                        <p className="text-xs font-medium text-gray-600 mb-2">Tracking History</p>
                        <ol className="space-y-1.5">
                          {tracking.events.map((ev, i) => (
                            <li key={i} className="text-xs text-gray-500 flex gap-2">
                              <span className="text-gray-300">•</span>
                              <span>
                                <span className="font-medium text-gray-600 capitalize">{ev.status.replace(/_/g, " ")}</span>
                                {ev.location && <span className="text-gray-400"> — {ev.location}</span>}
                                {ev.description && <span className="text-gray-400"> — {ev.description}</span>}
                                {ev.timestamp && <span className="text-gray-400"> ({new Date(ev.timestamp).toLocaleString()})</span>}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Status history */}
        {order.status_history && order.status_history.length > 0 && (
          <div className="bg-white rounded-2xl border p-4 sm:p-6 mb-6">
            <h3 className="font-bold text-gray-900 mb-4">Status History</h3>
            <div className="space-y-0">
              {order.status_history.slice().reverse().map((event, i) => {
                const eCfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.pending;
                const isLast = i === order.status_history!.length - 1;
                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${eCfg.bg}`} style={{ backgroundColor: isLast ? eCfg.color : undefined }} />
                      {!isLast && <div className="w-0.5 flex-1 bg-gray-200 my-1" />}
                    </div>
                    <div className="pb-4 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: eCfg.color }}>{eCfg.label}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(event.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {event.note && <p className="text-xs text-gray-500 mt-0.5">{event.note}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Order summary (reuses shared component) */}
        <OrderSummary
          order={order}
          currencyObj={currencyObj}
          transactionId={transactionId}
          paymentMethod={paymentMethod}
        />

        {/* Returns & Replacements section */}
        {["delivered", "shipped", "paid", "processing"].includes(order.status) && (
          <div className="bg-white rounded-2xl border p-4 sm:p-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-gray-500" strokeWidth={1.75} />
                Returns & Replacements
              </h3>
              {eligibility && (eligibility.return_eligible || eligibility.refund_eligible || eligibility.replacement_eligible) && (
                <button
                  onClick={() => {
                    setReturnModalOpen(true);
                    setReturnError("");
                    // Set default return type to first eligible type
                    if (eligibility.refund_eligible) setReturnType("refund");
                    else if (eligibility.replacement_eligible) setReturnType("replacement");
                    else setReturnType("exchange");
                    // Initialize return items
                    const init: Record<string, { selected: boolean; quantity: number; reason: string }> = {};
                    for (const item of order.items || []) {
                      init[item.id] = { selected: false, quantity: 1, reason: "" };
                    }
                    setReturnItems(init);
                  }}
                  className="text-sm font-medium text-brand hover:underline flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Request Return
                </button>
              )}
            </div>

            {/* Eligibility indicators */}
            {eligibility && (
              <div className="flex flex-wrap gap-2 mb-4">
                {eligibility.return_eligible ? (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                    <Undo2 className="w-3 h-3" /> Return eligible
                    {eligibility.return_expires_at && <span className="text-emerald-500">· until {new Date(eligibility.return_expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
                  </span>
                ) : eligibility.return_allowed && eligibility.delivered_at ? (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-50 text-gray-400 border border-gray-200 inline-flex items-center gap-1">
                    <Undo2 className="w-3 h-3" /> Return period expired
                  </span>
                ) : !eligibility.return_allowed ? (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-50 text-gray-400 border border-gray-200 inline-flex items-center gap-1">
                    <Undo2 className="w-3 h-3" /> Returns not available
                  </span>
                ) : null}
                {eligibility.refund_eligible ? (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Refund eligible
                    {eligibility.refund_expires_at && <span className="text-amber-500">· until {new Date(eligibility.refund_expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
                  </span>
                ) : eligibility.refund_allowed && eligibility.delivered_at ? (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-50 text-gray-400 border border-gray-200 inline-flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Refund period expired
                  </span>
                ) : !eligibility.refund_allowed ? (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-50 text-gray-400 border border-gray-200 inline-flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Refunds not available
                  </span>
                ) : null}
                {eligibility.replacement_eligible ? (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Replacement eligible
                    {eligibility.replacement_expires_at && <span className="text-blue-500">· until {new Date(eligibility.replacement_expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
                  </span>
                ) : eligibility.replacement_allowed && eligibility.delivered_at ? (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-50 text-gray-400 border border-gray-200 inline-flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Replacement period expired
                  </span>
                ) : !eligibility.replacement_allowed ? (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-50 text-gray-400 border border-gray-200 inline-flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Replacements not available
                  </span>
                ) : null}
              </div>
            )}

            {returnsQ.isLoading ? (
              <p className="text-sm text-gray-400">Loading returns...</p>
            ) : returnsQ.data?.items && returnsQ.data.items.length > 0 ? (
              <div className="space-y-3">
                {returnsQ.data.items.map((ret: OrderReturn) => (
                  <button
                    key={ret.id}
                    onClick={() => setSelectedReturn(ret)}
                    className="w-full text-left bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900 text-sm">{ret.return_number}</span>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        ret.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                        ret.status === "approved" ? "bg-blue-100 text-blue-700" :
                        ret.status === "rejected" ? "bg-rose-100 text-rose-700" :
                        ret.status === "cancelled" ? "bg-gray-100 text-gray-600" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {RETURN_STATUS_LABELS[ret.status] || ret.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{RETURN_TYPE_LABELS[ret.type] || ret.type}</span>
                      {ret.refund_amount > 0 && <span>{currencyObj?.symbol}{ret.refund_amount.toFixed(2)}</span>}
                      <span>{new Date(ret.created_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No returns requested for this order yet.</p>
            )}
          </div>
        )}

        {/* Return details modal */}
        {selectedReturn && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedReturn(null)}>
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Return Details</h3>
                <button onClick={() => setSelectedReturn(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Return Number</span>
                  <span className="font-medium text-gray-900">{selectedReturn.return_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Type</span>
                  <span className="font-medium text-gray-900">{RETURN_TYPE_LABELS[selectedReturn.type] || selectedReturn.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className={`font-medium px-2.5 py-1 rounded-full text-xs ${
                    selectedReturn.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                    selectedReturn.status === "approved" ? "bg-blue-100 text-blue-700" :
                    selectedReturn.status === "rejected" ? "bg-rose-100 text-rose-700" :
                    selectedReturn.status === "cancelled" ? "bg-gray-100 text-gray-600" :
                    "bg-amber-100 text-amber-700"
                  }`}>
                    {RETURN_STATUS_LABELS[selectedReturn.status] || selectedReturn.status}
                  </span>
                </div>
                {selectedReturn.reason && (
                  <div>
                    <span className="text-gray-500 block mb-1">Reason</span>
                    <span className="text-gray-800">{selectedReturn.reason}</span>
                  </div>
                )}
                {selectedReturn.status === "rejected" && selectedReturn.status_history && (() => {
                  const rejectionEvent = [...selectedReturn.status_history].reverse().find((e) => e.status === "rejected" && e.note);
                  return rejectionEvent ? (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                      <span className="text-rose-700 font-medium text-xs block mb-1">Rejection Reason</span>
                      <span className="text-rose-600 text-sm">{rejectionEvent.note}</span>
                    </div>
                  ) : null;
                })()}
                {selectedReturn.refund_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Refund Amount</span>
                    <span className="font-medium text-gray-900">{currencyObj?.symbol}{selectedReturn.refund_amount.toFixed(2)}</span>
                  </div>
                )}
                {selectedReturn.refund_method && selectedReturn.refund_method !== "none" && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Refund Method</span>
                    <span className="font-medium text-gray-900">{REFUND_METHOD_LABELS[selectedReturn.refund_method] || selectedReturn.refund_method}</span>
                  </div>
                )}
                {selectedReturn.items && selectedReturn.items.length > 0 && (
                  <div>
                    <span className="text-gray-500 block mb-2">Items</span>
                    <div className="space-y-2">
                      {selectedReturn.items.map((item) => (
                        <div key={item.id} className="flex justify-between bg-gray-50 rounded-lg p-2">
                          <span className="text-gray-800">{item.name} x{item.quantity}</span>
                          <span className="text-gray-500">{currencyObj?.symbol}{item.line_total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedReturn.status_history && selectedReturn.status_history.length > 0 && (
                  <div>
                    <span className="text-gray-500 block mb-2">Status History</span>
                    <div className="space-y-2">
                      {selectedReturn.status_history.map((event, i) => (
                        <div key={i} className="flex gap-2 text-xs">
                          <span className="font-medium text-gray-700">{RETURN_STATUS_LABELS[event.status] || event.status}</span>
                          <span className="text-gray-400">{new Date(event.timestamp).toLocaleString()}</span>
                          {event.note && <span className="text-gray-500">— {event.note}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Create return modal */}
        {returnModalOpen && order && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setReturnModalOpen(false)}>
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Request Return</h3>
                <button onClick={() => setReturnModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {returnError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg p-3 mb-4">
                  {returnError}
                </div>
              )}

              <div className="space-y-4">
                {/* Type */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Return Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["refund", "replacement", "exchange"] as const)
                      .filter((t) => {
                        if (!eligibility) return true;
                        if (t === "refund") return eligibility.refund_allowed;
                        if (t === "replacement") return eligibility.replacement_allowed;
                        return eligibility.return_allowed;
                      })
                      .map((t) => (
                      <button
                        key={t}
                        onClick={() => setReturnType(t)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                          returnType === t ? "bg-brand text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {RETURN_TYPE_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Refund method (only for refund type) */}
                {returnType === "refund" && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">Refund Method</label>
                    <select
                      value={returnRefundMethod}
                      onChange={(e) => setReturnRefundMethod(e.target.value as "original" | "wallet" | "store_credit" | "none")}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="original">Original Payment Method</option>
                      <option value="wallet">Store Wallet</option>
                      <option value="store_credit">Store Credit</option>
                    </select>
                  </div>
                )}

                {/* Items */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Select Items</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(order.items || []).map((item) => {
                      const ri = returnItems[item.id] || { selected: false, quantity: 1, reason: "" };
                      return (
                        <div key={item.id} className={`border rounded-lg p-3 ${ri.selected ? "border-brand bg-brand/5" : "border-gray-200"}`}>
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={ri.selected}
                              onChange={(e) => setReturnItems({ ...returnItems, [item.id]: { ...ri, selected: e.target.checked } })}
                              className="w-5 h-5 rounded accent-brand cursor-pointer flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                              <p className="text-xs text-gray-500">{currencyObj?.symbol}{item.unit_price.toFixed(2)} x {item.quantity}</p>
                            </div>
                            {ri.selected && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setReturnItems({ ...returnItems, [item.id]: { ...ri, quantity: Math.max(1, ri.quantity - 1) } })}
                                  className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-gray-100"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="text-sm font-medium w-6 text-center">{ri.quantity}</span>
                                <button
                                  onClick={() => setReturnItems({ ...returnItems, [item.id]: { ...ri, quantity: Math.min(item.quantity, ri.quantity + 1) } })}
                                  className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-gray-100"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                          {ri.selected && (
                            <input
                              type="text"
                              placeholder="Item reason (optional)"
                              value={ri.reason}
                              onChange={(e) => setReturnItems({ ...returnItems, [item.id]: { ...ri, reason: e.target.value } })}
                              className="w-full mt-2 border rounded-lg px-2 py-1.5 text-xs"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Overall reason */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Reason</label>
                  <textarea
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Describe why you're requesting a return..."
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                  />
                </div>

                {/* Submit */}
                <button
                  onClick={() => {
                    const selectedItems = Object.entries(returnItems)
                      .filter(([, v]) => v.selected)
                      .map(([k, v]) => ({ order_item_id: k, quantity: v.quantity, reason: v.reason }));
                    if (selectedItems.length === 0) {
                      setReturnError("Please select at least one item to return.");
                      return;
                    }
                    setReturnError("");
                    createReturnMut.mutate({
                      type: returnType,
                      reason: returnReason,
                      refund_method: returnType === "refund" ? returnRefundMethod : "none",
                      items: selectedItems,
                    });
                  }}
                  disabled={createReturnMut.isPending}
                  className="w-full bg-brand text-white font-semibold py-2.5 rounded-lg hover:bg-brand-dark transition disabled:opacity-50"
                >
                  {createReturnMut.isPending ? "Submitting..." : "Submit Return Request"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Link
            href={`/${tenant}`}
            className="flex-1 bg-brand text-white font-semibold py-2.5 rounded-lg text-center hover:bg-brand-dark transition flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.484M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
            Continue Shopping
          </Link>
          <button
            onClick={() => window.print()}
            className="flex-1 border font-semibold py-2.5 rounded-lg text-center hover:bg-gray-50 transition text-gray-700 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .889-.889m-.889.889-.889-.889m.889.889.889.889m-.889-.889.889-.889M6.34 18l-.889-.889m.889.889-.889.889M6.34 18l-.889.889M9 12h6m-6 4h6m-6-8h6M5.25 6.75v10.5m13.5-10.5v10.5" />
            </svg>
            Print Order
          </button>
        </div>

        {/* Help section */}
        <div className="mt-6 sm:mt-8 bg-gray-50 rounded-2xl p-4 sm:p-6 text-center">
          <p className="text-sm text-gray-600">
            Need help with this order?{" "}
            <a href="mailto:support@example.com" className="text-brand font-medium hover:underline">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailsPage({ params }: { params: { tenant: string; orderId: string } }) {
  return (
    <Suspense fallback={<FullPageLoader label="Loading" />}>
      <OrderDetailsContent tenant={params.tenant} orderId={params.orderId} />
    </Suspense>
  );
}
