import { useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, X, Plus, RotateCcw, Loader2, Package } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useBranch } from "@/lib/branch";
import { useCurrency } from "@/lib/currency";
import { useModules } from "@/lib/modules";
import { api, generateIdempotencyKey } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { Toggle } from "@/components/Toggle";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TRANSITIONS,
  RETURN_STATUS_LABELS,
  RETURN_STATUS_TRANSITIONS,
  RETURN_TYPE_LABELS,
  REFUND_METHOD_LABELS,
  SHIPMENT_STATUS_LABELS,
  SUPPORTED_SHIPPING_PROVIDERS,
  type OrderWithDetails,
  type UpdateOrderStatusRequest,
  type CreateReturnRequest,
  type UpdateReturnStatusRequest,
  type OrderReturn,
  type Shipment,
  type TrackingResponse,
  type UUID,
  type OrderHandoff,
} from "@/types";

export function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const { tenant, user } = useAuth();
  const { formatMoney } = useCurrency();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { isEnabled: moduleEnabled } = useModules();
  const returnsModuleOn = moduleEnabled("returns");
  const shippingModuleOn = moduleEnabled("shipping");

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [note, setNote] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [notesEdit, setNotesEdit] = useState(false);
  const [notesValue, setNotesValue] = useState("");

  // Return/replacement state
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnType, setReturnType] = useState("refund");
  const [returnReason, setReturnReason] = useState("");
  const [returnRefundMethod, setReturnRefundMethod] = useState("original");
  const [returnRestock, setReturnRestock] = useState(true);
  const [returnItems, setReturnItems] = useState<Record<string, { selected: boolean; quantity: number; reason: string }>>({});
  const [selectedReturn, setSelectedReturn] = useState<OrderReturn | null>(null);

  const q = useQuery({
    queryKey: ["order", tenant, orderId],
    queryFn: () => api.getOrder(tenant, orderId!),
    enabled: !!orderId,
  });

  const payTxnsQ = useQuery({
    queryKey: ["order-payment-txns", tenant, orderId],
    queryFn: () => api.listOrderPaymentTransactions(tenant, orderId!),
    enabled: !!orderId,
  });

  const returnsQ = useQuery({
    queryKey: ["order-returns", tenant, orderId],
    queryFn: () => api.listOrderReturns(tenant, orderId!),
    enabled: !!orderId && returnsModuleOn,
  });

  const shipmentsQ = useQuery({
    queryKey: ["order-shipments", tenant, orderId],
    queryFn: () => api.listOrderShipments(tenant, orderId!),
    enabled: !!orderId && shippingModuleOn,
  });

  const { branch: scopeBranch } = useBranch();

  const handoffsQ = useQuery({
    queryKey: ["order-handoffs", tenant, orderId],
    queryFn: () => api.listOrderHandoffs(tenant, orderId!),
    enabled: !!orderId,
  });
  const branchesQ = useQuery({
    queryKey: ["branches", tenant],
    queryFn: () => api.listBranches(tenant),
  });

  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffTarget, setHandoffTarget] = useState("");
  const [handoffItemIds, setHandoffItemIds] = useState<UUID[]>([]);
  const [handoffNote, setHandoffNote] = useState("");

  const createHandoffMut = useMutation({
    mutationFn: () => api.createOrderHandoff(tenant, orderId!, {
      to_branch_id: handoffTarget || undefined,
      item_ids: handoffItemIds.length ? handoffItemIds : undefined,
      note: handoffNote || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-handoffs", tenant, orderId] });
      setHandoffOpen(false); setHandoffTarget(""); setHandoffItemIds([]); setHandoffNote("");
      toast.success("Handoff requested", "Waiting for the receiving branch to accept.");
    },
    onError: (e) => toast.error("Handoff failed", (e as Error).message),
  });

  const respondHandoffMut = useMutation({
    mutationFn: (vars: { id: UUID; action: "accept" | "reject" | "cancel" }) =>
      api.respondToHandoff(tenant, vars.id, vars.action),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["order-handoffs", tenant, orderId] });
      qc.invalidateQueries({ queryKey: ["order", tenant, orderId] });
      qc.invalidateQueries({ queryKey: ["orders", tenant] });
      toast.success(
        vars.action === "accept" ? "Handoff accepted" : vars.action === "reject" ? "Handoff rejected" : "Handoff cancelled",
        vars.action === "accept" ? "The order now belongs to this branch." : undefined,
      );
    },
    onError: (e) => toast.error("Failed", (e as Error).message),
  });

  // Delivery partner assignment — partners covering this order's branch.
  const orderBranchId = q.data?.order?.branch_id;
  const orderStatus = q.data?.order?.status;
  const deliveryPartnersQ = useQuery({
    queryKey: ["delivery-partners", tenant, orderBranchId],
    queryFn: () => api.listDeliveryPartners(tenant, orderBranchId || undefined),
    enabled: !!orderId && ["ready", "shipped"].includes(orderStatus ?? ""),
  });
  const [assignPartnerId, setAssignPartnerId] = useState("");
  const assignDeliveryMut = useMutation({
    mutationFn: (partnerId: string | null) =>
      api.assignDeliveryPartner(tenant, orderId!, partnerId, generateIdempotencyKey()),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["order", tenant, orderId] });
      qc.invalidateQueries({ queryKey: ["orders", tenant] });
      setAssignPartnerId("");
      toast.success(res.message || "Delivery updated");
    },
    onError: (e) => toast.error("Assignment failed", (e as Error).message),
  });

  const providersQ = useQuery({
    queryKey: ["shipping-providers", tenant],
    queryFn: () => api.listShippingProviders(tenant),
    enabled: shippingModuleOn,
  });
  const enabledProviders = (providersQ.data?.items ?? []).filter((p) => p.is_enabled);

  const [createShipmentProvider, setCreateShipmentProvider] = useState("");
  const [trackingData, setTrackingData] = useState<Record<string, TrackingResponse | null>>({});
  // Split-shipment item selection: map of order_item_id → quantity to ship
  const [selectedShipItems, setSelectedShipItems] = useState<Record<string, number>>({});
  // Optional estimated delivery date when creating a shipment (date-only, ISO)
  const [estimatedDelivery, setEstimatedDelivery] = useState("");

  const createShipmentMut = useMutation({
    mutationFn: (providerCode: string) => api.createOrderShipment(tenant, orderId!, providerCode, estimatedDelivery || undefined, generateIdempotencyKey()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-shipments", tenant, orderId] });
      setEstimatedDelivery("");
      toast.success("Shipment created", "Carrier shipment created and tracking number assigned.");
    },
    onError: (e) => toast.error("Shipment failed", (e as Error).message),
  });

  const createSplitShipmentMut = useMutation({
    mutationFn: (vars: { providerCode: string; itemIds: UUID[]; itemQuantities: { order_item_id: UUID; quantity: number }[] }) =>
      api.createOrderShipmentWithItems(tenant, orderId!, vars.providerCode, vars.itemIds, vars.itemQuantities, estimatedDelivery || undefined, generateIdempotencyKey()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-shipments", tenant, orderId] });
      setSelectedShipItems({});
      setEstimatedDelivery("");
      toast.success("Split shipment created", "Carrier shipment created for the selected items.");
    },
    onError: (e) => toast.error("Shipment failed", (e as Error).message),
  });

  const trackShipmentMut = useMutation({
    mutationFn: (shipmentId: string) => api.trackShipment(tenant, shipmentId),
    onSuccess: (data, shipmentId) => {
      setTrackingData((prev) => ({ ...prev, [shipmentId]: data }));
      qc.invalidateQueries({ queryKey: ["order-shipments", tenant, orderId] });
    },
    onError: (e) => toast.error("Tracking failed", (e as Error).message),
  });

  const statusIdemKeyRef = useRef("");
  const statusMut = useMutation({
    mutationFn: (body: UpdateOrderStatusRequest) => {
      if (!statusIdemKeyRef.current) statusIdemKeyRef.current = generateIdempotencyKey();
      return api.updateOrderStatus(tenant, orderId!, body, statusIdemKeyRef.current);
    },
    onSuccess: () => {
      statusIdemKeyRef.current = "";
      qc.invalidateQueries({ queryKey: ["order", tenant, orderId] });
      qc.invalidateQueries({ queryKey: ["orders", tenant] });
      qc.invalidateQueries({ queryKey: ["order-counts", tenant] });
      setStatusModalOpen(false);
      setNewStatus("");
      setNote("");
      setTrackingNumber("");
      setCarrier("");
    },
  });

  const notesMut = useMutation({
    mutationFn: (notes: string) => api.updateOrderNotes(tenant, orderId!, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order", tenant, orderId] });
      setNotesEdit(false);
    },
  });

  const returnIdemKeyRef = useRef("");
  const createReturnMut = useMutation({
    mutationFn: (body: CreateReturnRequest) => {
      if (!returnIdemKeyRef.current) returnIdemKeyRef.current = generateIdempotencyKey();
      return api.createReturn(tenant, orderId!, body, returnIdemKeyRef.current);
    },
    onSuccess: () => {
      returnIdemKeyRef.current = "";
      qc.invalidateQueries({ queryKey: ["order-returns", tenant, orderId] });
      qc.invalidateQueries({ queryKey: ["returns", tenant] });
      qc.invalidateQueries({ queryKey: ["return-counts", tenant] });
      setReturnModalOpen(false);
      setReturnType("refund");
      setReturnReason("");
      setReturnRefundMethod("original");
      setReturnRestock(true);
      setReturnItems({});
      toast.success("Return request created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const returnStatusIdemKeyRef = useRef("");
  const [returnStatusModalOpen, setReturnStatusModalOpen] = useState(false);
  const [returnNewStatus, setReturnNewStatus] = useState("");
  const [returnStatusNote, setReturnStatusNote] = useState("");
  const updateReturnStatusMut = useMutation({
    mutationFn: (body: UpdateReturnStatusRequest) => {
      if (!returnStatusIdemKeyRef.current) returnStatusIdemKeyRef.current = generateIdempotencyKey();
      return api.updateReturnStatus(tenant, selectedReturn!.id, body, returnStatusIdemKeyRef.current);
    },
    onSuccess: () => {
      returnStatusIdemKeyRef.current = "";
      qc.invalidateQueries({ queryKey: ["order-returns", tenant, orderId] });
      qc.invalidateQueries({ queryKey: ["returns", tenant] });
      qc.invalidateQueries({ queryKey: ["return-counts", tenant] });
      setReturnStatusModalOpen(false);
      setReturnNewStatus("");
      setReturnStatusNote("");
      setSelectedReturn(null);
      toast.success("Return status updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (q.isLoading) {
    return (
      <div>
        <PageHeader title="Order Details" />
        <div className="bg-white rounded-2xl border p-8 animate-pulse">
          <div className="h-4 bg-neutral-100 rounded w-1/3 mb-3" />
          <div className="h-4 bg-neutral-100 rounded w-1/2 mb-3" />
          <div className="h-4 bg-neutral-100 rounded w-1/4" />
        </div>
      </div>
    );
  }

  if (q.error || !q.data) {
    return (
      <div>
        <PageHeader title="Order Not Found" />
        <div className="bg-white rounded-2xl border p-8 text-center">
          <p className="text-neutral-400 mb-4">This order could not be found.</p>
          <Link to="/orders" className="text-brand text-sm font-medium hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const order: OrderWithDetails = q.data.order;
  const cfg = ORDER_STATUS_LABELS[order.status] || { label: order.status, color: "text-neutral-600", bg: "bg-neutral-100" };
  const allowedTransitions = (ORDER_STATUS_TRANSITIONS[order.status] || []).filter(
    (s) => s !== "fulfilled" || user?.role === "superadmin"
  );
  const history = order.status_history || [];
  const items = order.items || [];
  const shipping = order.shipping_address;
  const billing = order.billing_address;

  const handleUpdateStatus = () => {
    if (!newStatus) return;
    statusMut.mutate({
      status: newStatus,
      note: note || undefined,
      tracking_number: trackingNumber || undefined,
      carrier: carrier || undefined,
    });
  };

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  }) : "—";

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate("/orders")}
          className="text-neutral-400 hover:text-neutral-600 transition"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <PageHeader
          title={
            <>
              Order #{order.id.slice(0, 8)}
              {order.order_tag && (
                <span className="ml-2 inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 align-middle">
                  {order.order_tag}
                </span>
              )}
            </>
          }
          subtitle={order.id}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: items + timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status banner */}
          <div className={`rounded-2xl border p-5 ${cfg.bg} border-current/10`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${cfg.color}`}>Current Status</p>
                <p className={`text-2xl font-bold ${cfg.color}`}>{cfg.label}</p>
              </div>
              {allowedTransitions.length > 0 && (
                <button
                  onClick={() => setStatusModalOpen(true)}
                  className="px-4 py-2 bg-white text-neutral-700 text-sm font-medium rounded-lg border hover:bg-neutral-50 transition shadow-sm"
                >
                  Update Status
                </button>
              )}
              {allowedTransitions.length === 0 && (
                <span className="text-xs text-neutral-500 italic">Terminal state</span>
              )}
            </div>
            {allowedTransitions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {allowedTransitions.map((s) => {
                  const sCfg = ORDER_STATUS_LABELS[s] || { label: s, color: "text-neutral-600", bg: "bg-neutral-100" };
                  return (
                    <button
                      key={s}
                      onClick={() => { setNewStatus(s); setStatusModalOpen(true); }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${sCfg.bg} ${sCfg.color} hover:opacity-80 transition`}
                    >
                      <ArrowRight className="w-3 h-3 inline" /> {sCfg.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Order Items */}
          <div className="bg-white rounded-2xl border overflow-x-auto">
            <div className="px-5 py-4 border-b">
              <h3 className="font-semibold text-neutral-800">Items ({items.length})</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-500 text-left">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Product</th>
                  <th className="px-5 py-2.5 font-medium text-center">Qty</th>
                  <th className="px-5 py-2.5 font-medium text-right">Unit Price</th>
                  <th className="px-5 py-2.5 font-medium text-right">Tax</th>
                  <th className="px-5 py-2.5 font-medium text-right">Shipping</th>
                  <th className="px-5 py-2.5 font-medium text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {item.image_url ? (
                          <img src={item.image_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-neutral-100 flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-neutral-100 flex-shrink-0 flex items-center justify-center text-neutral-300">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-neutral-800">{item.name}</div>
                          {item.sku && <div className="text-xs text-neutral-400 font-mono">{item.sku}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center text-neutral-600">{item.quantity}</td>
                    <td className="px-5 py-3 text-right text-neutral-600">
                      {formatMoney(item.unit_price, order.currency_code)}
                    </td>
                    <td className="px-5 py-3 text-right text-neutral-500 text-xs">
                      {item.tax_amount && item.tax_amount > 0 ? (
                        <span>{formatMoney(item.tax_amount, order.currency_code)}
                        {item.tax_rate && item.tax_rate > 0 && <span className="text-neutral-400"> ({item.tax_rate.toFixed(2)}%)</span>}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-neutral-500 text-xs">
                      {item.shipping_method ? (
                        <div>
                          <div className="capitalize">{item.shipping_method}</div>
                          {item.shipping_cost && item.shipping_cost > 0 && (
                            <div>{formatMoney(item.shipping_cost, order.currency_code)}</div>
                          )}
                          {item.shipping_weight && item.shipping_weight > 0 && (
                            <div className="text-neutral-400">{item.shipping_weight.toFixed(2)} kg</div>
                          )}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-medium">
                      {formatMoney(item.line_total, order.currency_code)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-neutral-50">
                <tr>
                  <td colSpan={5} className="px-5 py-2 text-right text-neutral-500 text-xs">Subtotal</td>
                  <td className="px-5 py-2 text-right font-medium">{formatMoney(order.subtotal, order.currency_code)}</td>
                </tr>
                {order.discount_total > 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-2 text-right text-neutral-500 text-xs">Discount</td>
                    <td className="px-5 py-2 text-right text-emerald-600">−{formatMoney(order.discount_total, order.currency_code)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={5} className="px-5 py-2 text-right text-neutral-500 text-xs">Shipping ({order.shipping_method || "standard"})</td>
                  <td className="px-5 py-2 text-right font-medium">{formatMoney(order.shipping_total, order.currency_code)}</td>
                </tr>
                {order.tax_breakdown && order.tax_breakdown.length > 0 ? (
                  order.tax_breakdown.map((b, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-5 py-1 text-right text-neutral-400 text-xs">
                        Tax — {b.tax_class_name} ({b.rate_name}, {b.rate}%{b.compound ? ", compound" : ""})
                      </td>
                      <td className="px-5 py-1 text-right text-neutral-500 text-xs">{formatMoney(b.tax_amount, order.currency_code)}</td>
                    </tr>
                  ))
                ) : null}
                <tr>
                  <td colSpan={5} className="px-5 py-2 text-right text-neutral-500 text-xs">Tax Total</td>
                  <td className="px-5 py-2 text-right font-medium">{formatMoney(order.tax_total, order.currency_code)}</td>
                </tr>
                <tr className="border-t-2">
                  <td colSpan={5} className="px-5 py-3 text-right font-bold text-neutral-800">Grand Total</td>
                  <td className="px-5 py-3 text-right font-bold text-lg text-brand">
                    {formatMoney(order.grand_total, order.currency_code)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Status Timeline */}
          <div className="bg-white rounded-2xl border p-5">
            <h3 className="font-semibold text-neutral-800 mb-4">Status Timeline</h3>
            {history.length > 0 ? (
              <div className="space-y-0">
                {history.slice().reverse().map((event, i) => {
                  const eCfg = ORDER_STATUS_LABELS[event.status] || { label: event.status, color: "text-neutral-600", bg: "bg-neutral-100" };
                  const isLast = i === history.length - 1;
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${eCfg.bg} ${isLast ? "ring-4 ring-current/10" : ""}`} />
                        {!isLast && <div className="w-0.5 flex-1 bg-neutral-200 my-1" />}
                      </div>
                      <div className="pb-4 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${eCfg.color}`}>{eCfg.label}</span>
                          <span className="text-xs text-neutral-400">{fmtDate(event.timestamp)}</span>
                        </div>
                        {event.note && <p className="text-xs text-neutral-500 mt-0.5">{event.note}</p>}
                        {event.actor && event.actor !== "system" && (
                          <p className="text-xs text-neutral-400 mt-0.5">by staff</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-neutral-400">No status history available.</p>
            )}
          </div>

          {/* Returns / Replacements / Refunds — hidden when the returns module is disabled */}
          {returnsModuleOn && (
          <div className="bg-white rounded-2xl border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-neutral-800">Returns & Replacements</h3>
              {(order.status === "delivered" || order.status === "shipped" || order.status === "paid" || order.status === "processing") && (
                <button
                  onClick={() => setReturnModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand border border-brand/30 rounded-lg hover:bg-brand/5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Create Return
                </button>
              )}
            </div>
            {returnsQ.data && returnsQ.data.items.length > 0 ? (
              <div className="space-y-3">
                {returnsQ.data.items.map((r) => {
                  const sCfg = RETURN_STATUS_LABELS[r.status] || { label: r.status, color: "text-neutral-600", bg: "bg-neutral-100" };
                  const tCfg = RETURN_TYPE_LABELS[r.type] || { label: r.type, color: "text-neutral-600", bg: "bg-neutral-100" };
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedReturn(r)}
                      className="w-full text-left flex items-center justify-between p-3 border rounded-lg hover:bg-neutral-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-mono text-xs text-neutral-700">{r.return_number}</div>
                          <div className="flex gap-1.5 mt-1">
                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${tCfg.bg} ${tCfg.color}`}>{tCfg.label}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${sCfg.bg} ${sCfg.color}`}>{sCfg.label}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {r.refund_amount > 0 && (
                          <div className="text-sm font-medium text-neutral-700">
                            {formatMoney(r.refund_amount, order.currency_code)}
                          </div>
                        )}
                        <div className="text-xs text-neutral-400">{new Date(r.created_at).toLocaleDateString()}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-neutral-400">No returns for this order.</p>
            )}
          </div>
          )}
        </div>

        {/* Right column: customer info, addresses, tracking, notes */}
        <div className="space-y-6">
          {/* Customer */}
          <div className="bg-white rounded-2xl border p-5">
            <h3 className="font-semibold text-neutral-800 mb-3">Customer</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-neutral-400 text-xs">Name</dt>
                <dd className="text-neutral-700 font-medium">{order.customer_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-400 text-xs">Email</dt>
                <dd className="text-neutral-700">{order.customer_email || "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-400 text-xs">User ID</dt>
                <dd className="text-neutral-700 font-mono text-xs">{order.user_id || "Guest"}</dd>
              </div>
            </dl>
          </div>

          {/* Payment */}
          <div className="bg-white rounded-2xl border p-5">
            <h3 className="font-semibold text-neutral-800 mb-3">Payment</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-neutral-400 text-xs">Method</dt>
                <dd className="text-neutral-700 capitalize">{order.payment_method?.replace(/_/g, " ") || "—"}</dd>
              </div>
              {order.transaction_id && (
                <div>
                  <dt className="text-neutral-400 text-xs">Transaction ID</dt>
                  <dd className="text-neutral-700 font-mono text-xs">{order.transaction_id}</dd>
                </div>
              )}
              <div>
                <dt className="text-neutral-400 text-xs">Shipping Method</dt>
                <dd className="text-neutral-700 capitalize">{order.shipping_method || "Standard"}</dd>
              </div>
              {order.shipping_weight ? (
                <div>
                  <dt className="text-neutral-400 text-xs">Shipping Weight</dt>
                  <dd className="text-neutral-700">{order.shipping_weight.toFixed(3)} kg</dd>
                </div>
              ) : null}
            </dl>

            {/* Payment transactions */}
            {payTxnsQ.data && payTxnsQ.data.items.length > 0 && (
              <div className="mt-4 pt-3 border-t">
                <p className="text-xs text-neutral-400 font-medium mb-2">Payment Transactions ({payTxnsQ.data.items.length})</p>
                <div className="space-y-2">
                  {payTxnsQ.data.items.map((txn) => (
                    <div key={txn.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded-full font-medium ${txn.type === "refund" ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"}`}>
                          {txn.type}
                        </span>
                        <span className="text-neutral-500 capitalize">{txn.gateway}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-neutral-700">
                          {formatMoney(Math.abs(txn.amount), txn.currency_code)}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                          txn.status === "success" ? "bg-emerald-50 text-emerald-600" :
                          txn.status === "failed" ? "bg-rose-50 text-rose-600" :
                          txn.status === "refunded" ? "bg-purple-50 text-purple-600" :
                          "bg-neutral-50 text-neutral-500"
                        }`}>
                          {txn.status.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <Link to="/payments" className="text-brand text-xs font-medium hover:underline mt-2 inline-flex items-center gap-1">
                  View in Payments <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>

          {/* Delivery Partner — local-delivery assignment */}
          {(order.delivery_partner_id || ["ready", "shipped"].includes(order.status)) && (
          <div className="bg-white rounded-2xl border p-5">
            <h3 className="font-semibold text-neutral-800 mb-3">Delivery Partner</h3>
            {order.delivery_partner_id ? (
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-neutral-400 text-xs">Assigned To</dt>
                  <dd className="text-neutral-700 font-medium">{order.delivery_partner_name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-neutral-400 text-xs">Assigned At</dt>
                  <dd className="text-neutral-700">{fmtDate(order.delivery_assigned_at)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-neutral-400">No delivery partner assigned.</p>
            )}

            {["ready", "shipped"].includes(order.status) && (
              <div className="mt-3 pt-3 border-t space-y-2">
                <select
                  value={assignPartnerId}
                  onChange={(e) => setAssignPartnerId(e.target.value)}
                  className="w-full text-sm border rounded-lg px-2.5 py-2"
                >
                  <option value="">Select a partner…</option>
                  {(deliveryPartnersQ.data?.items ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}{p.branch_names?.length ? ` (${p.branch_names.join(", ")})` : ""}{(p.active_deliveries ?? 0) > 0 ? ` — ${p.active_deliveries} active` : ""}
                    </option>
                  ))}
                </select>
                {deliveryPartnersQ.data && deliveryPartnersQ.data.items.length === 0 && (
                  <p className="text-xs text-amber-600">No active delivery partners{order.branch_name ? ` allocated to ${order.branch_name}` : ""}. Create one under Users & Staff.</p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => assignDeliveryMut.mutate(assignPartnerId)}
                    disabled={!assignPartnerId || assignDeliveryMut.isPending}
                    className="inline-flex items-center gap-1.5 text-xs bg-brand text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    {assignDeliveryMut.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                    {order.delivery_partner_id ? "Reassign" : "Assign"}
                  </button>
                  {order.delivery_partner_id && (
                    <button
                      onClick={() => assignDeliveryMut.mutate(null)}
                      disabled={assignDeliveryMut.isPending}
                      className="text-xs border px-3 py-1.5 rounded-lg hover:bg-neutral-50 disabled:opacity-50"
                    >
                      Unassign
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          )}

          {/* Tracking */}
          <div className="bg-white rounded-2xl border p-5">
            <h3 className="font-semibold text-neutral-800 mb-3">Shipping & Tracking</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-neutral-400 text-xs">Carrier</dt>
                <dd className="text-neutral-700">{order.carrier || "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-400 text-xs">Tracking Number</dt>
                <dd className="text-neutral-700 font-mono text-xs">{order.tracking_number || "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-400 text-xs">Shipped At</dt>
                <dd className="text-neutral-700">{fmtDate(order.shipped_at)}</dd>
              </div>
              <div>
                <dt className="text-neutral-400 text-xs">Delivered At</dt>
                <dd className="text-neutral-700">{fmtDate(order.delivered_at)}</dd>
              </div>
            </dl>

            {/* Carrier Shipments — hidden when the shipping module is disabled */}
            {shippingModuleOn && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-sm font-semibold text-neutral-700 mb-2">Carrier Shipments</h4>
              {shipmentsQ.isLoading ? (
                <p className="text-xs text-neutral-400">Loading shipments…</p>
              ) : shipmentsQ.data?.items && shipmentsQ.data.items.length > 0 ? (
                <div className="space-y-3">
                  {shipmentsQ.data.items.map((sh) => {
                    const statusLabel = SHIPMENT_STATUS_LABELS[sh.status] || { label: sh.status, color: "text-neutral-700", bg: "bg-neutral-100" };
                    const tracking = trackingData[sh.id];
                    return (
                      <div key={sh.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusLabel.bg} ${statusLabel.color}`}>{statusLabel.label}</span>
                            <span className="text-xs text-neutral-400 uppercase">{sh.provider_code}</span>
                          </div>
                          <button
                            onClick={() => trackShipmentMut.mutate(sh.id)}
                            disabled={trackShipmentMut.isPending && trackShipmentMut.variables === sh.id}
                            className="inline-flex items-center gap-1.5 text-xs border px-2 py-1 rounded hover:bg-neutral-50 disabled:opacity-50"
                          >
                            {trackShipmentMut.isPending && trackShipmentMut.variables === sh.id && <Loader2 className="w-3 h-3 animate-spin" />}
                            {trackShipmentMut.isPending && trackShipmentMut.variables === sh.id ? "Tracking…" : "Track"}
                          </button>
                        </div>
                        <div className="text-xs text-neutral-600 space-y-0.5">
                          <div><span className="text-neutral-400">Tracking #:</span> <span className="font-mono">{sh.tracking_number}</span></div>
                          {sh.carrier && <div><span className="text-neutral-400">Carrier:</span> {sh.carrier}</div>}
                          {sh.estimated_delivery && (
                            <div><span className="text-neutral-400">Est. delivery:</span> {new Date(sh.estimated_delivery).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</div>
                          )}
                          {sh.awb_url && <div><a href={sh.awb_url} target="_blank" rel="noreferrer" className="text-brand hover:underline">View Label / AWB</a></div>}
                        </div>
                        {sh.items && sh.items.length > 0 && (
                          <div className="border-t pt-2">
                            <p className="text-xs font-medium text-neutral-600 mb-1">Items in this shipment</p>
                            <ul className="space-y-0.5">
                              {sh.items.map((si) => (
                                <li key={si.id} className="text-xs text-neutral-500 flex justify-between">
                                  <span>{si.product_name || "—"}{si.sku && <span className="text-neutral-400 font-mono"> ({si.sku})</span>}</span>
                                  <span className="text-neutral-400">×{si.quantity}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {tracking && tracking.events && tracking.events.length > 0 && (
                          <div className="mt-2 border-t pt-2">
                            <p className="text-xs font-medium text-neutral-600 mb-1">Tracking History</p>
                            <ol className="space-y-1">
                              {tracking.events.map((ev, i) => (
                                <li key={i} className="text-xs text-neutral-500 flex gap-2">
                                  <span className="text-neutral-300">•</span>
                                  <span>
                                    <span className="font-medium text-neutral-600">{ev.status}</span>
                                    {ev.location && <span className="text-neutral-400"> — {ev.location}</span>}
                                    {ev.description && <span className="text-neutral-400"> — {ev.description}</span>}
                                    {ev.timestamp && <span className="text-neutral-400"> ({new Date(ev.timestamp).toLocaleString()})</span>}
                                  </span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* Split-shipment creation for remaining unshipped items */}
                  {(() => {
                    const shippedQty: Record<string, number> = {};
                    for (const sh of shipmentsQ.data!.items) {
                      if (sh.status === "cancelled") continue;
                      for (const si of sh.items ?? []) {
                        shippedQty[si.order_item_id] = (shippedQty[si.order_item_id] ?? 0) + si.quantity;
                      }
                    }
                    const unshipped = items.filter((it) => (it.quantity - (shippedQty[it.id] ?? 0)) > 0);
                    if (unshipped.length === 0) return null;
                    return (
                      <div className="border-t pt-3 space-y-2">
                        <p className="text-xs font-medium text-neutral-600">Create split shipment for remaining items</p>
                        <div className="space-y-1">
                          {unshipped.map((it) => {
                            const remaining = it.quantity - (shippedQty[it.id] ?? 0);
                            const sel = selectedShipItems[it.id] ?? 0;
                            return (
                              <div key={it.id} className="flex items-center gap-2 text-xs">
                                <Toggle
                                  size="sm"
                                  checked={sel > 0}
                                  onChange={(v) => {
                                    setSelectedShipItems((prev) => {
                                      const next = { ...prev };
                                      if (v) next[it.id] = remaining;
                                      else delete next[it.id];
                                      return next;
                                    });
                                  }}
                                />
                                <span className="flex-1 text-neutral-600">{it.name}</span>
                                <span className="text-neutral-400">remaining {remaining}</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={remaining}
                                  value={sel || ""}
                                  placeholder="qty"
                                  onChange={(e) => {
                                    const v = Math.min(remaining, Math.max(1, parseInt(e.target.value) || 0));
                                    setSelectedShipItems((prev) => ({ ...prev, [it.id]: v }));
                                  }}
                                  className="w-16 border rounded px-1 py-0.5 text-xs"
                                  disabled={sel === 0}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <select
                            value={createShipmentProvider}
                            onChange={(e) => setCreateShipmentProvider(e.target.value)}
                            className="text-xs border rounded px-2 py-1"
                          >
                            <option value="">Select provider…</option>
                            {enabledProviders.map((p) => (
                              <option key={p.id} value={p.provider_code}>{p.display_name} ({p.is_test_mode ? "Sandbox" : "Live"})</option>
                            ))}
                          </select>
                          <input
                            type="date"
                            value={estimatedDelivery}
                            onChange={(e) => setEstimatedDelivery(e.target.value)}
                            className="text-xs border rounded px-2 py-1"
                            title="Estimated delivery date (optional)"
                          />
                          <button
                            onClick={() => {
                              const itemIds = Object.keys(selectedShipItems) as UUID[];
                              const itemQuantities = itemIds.map((id) => ({ order_item_id: id, quantity: selectedShipItems[id] }));
                              createSplitShipmentMut.mutate({ providerCode: createShipmentProvider, itemIds, itemQuantities });
                            }}
                            disabled={!createShipmentProvider || Object.keys(selectedShipItems).length === 0 || createSplitShipmentMut.isPending}
                            className="inline-flex items-center gap-1.5 text-xs bg-brand text-white px-2 py-1 rounded disabled:opacity-50"
                          >
                            {createSplitShipmentMut.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                            {createSplitShipmentMut.isPending ? "Creating…" : "Create Split Shipment"}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-neutral-400">No carrier shipments created yet.</p>
                  {enabledProviders.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={createShipmentProvider}
                        onChange={(e) => setCreateShipmentProvider(e.target.value)}
                        className="text-xs border rounded px-2 py-1"
                      >
                        <option value="">Select provider…</option>
                        {enabledProviders.map((p) => (
                          <option key={p.id} value={p.provider_code}>{p.display_name} ({p.is_test_mode ? "Sandbox" : "Live"})</option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={estimatedDelivery}
                        onChange={(e) => setEstimatedDelivery(e.target.value)}
                        className="text-xs border rounded px-2 py-1"
                        title="Estimated delivery date (optional)"
                      />
                      <button
                        onClick={() => createShipmentMut.mutate(createShipmentProvider)}
                        disabled={!createShipmentProvider || createShipmentMut.isPending}
                        className="inline-flex items-center gap-1.5 text-xs bg-brand text-white px-2 py-1 rounded disabled:opacity-50"
                      >
                        {createShipmentMut.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                        {createShipmentMut.isPending ? "Creating…" : "Create Shipment"}
                      </button>
                    </div>
                  )}
                  {enabledProviders.length === 0 && (
                    <p className="text-xs text-amber-600">No shipping providers enabled. Configure one in Shipping → Carrier Providers.</p>
                  )}
                </div>
              )}
            </div>
            )}
          </div>

          {/* Shipping Address */}
          {shipping && (
            <div className="bg-white rounded-2xl border p-5">
              <h3 className="font-semibold text-neutral-800 mb-3">Shipping Address</h3>
              <address className="text-sm text-neutral-600 not-italic space-y-0.5">
                {shipping.first_name && <p className="font-medium text-neutral-700">{shipping.first_name} {shipping.last_name}</p>}
                <p>{shipping.line1}</p>
                {shipping.line2 && <p>{shipping.line2}</p>}
                <p>{shipping.city}{shipping.state ? `, ${shipping.state}` : ""} {shipping.postal_code}</p>
                <p>{shipping.country}</p>
                {shipping.phone && <p className="text-neutral-400">{shipping.phone}</p>}
                {shipping.email && <p className="text-neutral-400">{shipping.email}</p>}
              </address>
            </div>
          )}

          {/* Billing Address */}
          {billing && (
            <div className="bg-white rounded-2xl border p-5">
              <h3 className="font-semibold text-neutral-800 mb-3">Billing Address</h3>
              <address className="text-sm text-neutral-600 not-italic space-y-0.5">
                {billing.first_name && <p className="font-medium text-neutral-700">{billing.first_name} {billing.last_name}</p>}
                <p>{billing.line1}</p>
                {billing.line2 && <p>{billing.line2}</p>}
                <p>{billing.city}{billing.state ? `, ${billing.state}` : ""} {billing.postal_code}</p>
                <p>{billing.country}</p>
              </address>
            </div>
          )}

          {/* Branch Handoffs — pass this order (or items) to another branch */}
          {(order.branch_id || (handoffsQ.data?.items?.length ?? 0) > 0) && (
          <div className="bg-white rounded-2xl border p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-neutral-800">Branch Handoffs</h3>
              {order.branch_id && !handoffOpen && (
                <button onClick={() => setHandoffOpen(true)} className="text-xs text-brand hover:underline">
                  Hand off to branch
                </button>
              )}
            </div>
            {handoffOpen && (
              <div className="border rounded-lg p-3 mb-3 space-y-2 bg-neutral-50">
                <div className="flex items-center gap-2 flex-wrap">
                  <select value={handoffTarget} onChange={(e) => setHandoffTarget(e.target.value)} className="text-xs border rounded px-2 py-1">
                    <option value="">Auto: nearest other branch</option>
                    {(branchesQ.data?.items ?? []).filter((b) => b.id !== order.branch_id).map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  <input value={handoffNote} onChange={(e) => setHandoffNote(e.target.value)} placeholder="Note (optional)"
                    className="text-xs border rounded px-2 py-1 flex-1 min-w-[140px]" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-neutral-500">Items to hand off (none selected = whole order):</p>
                  {items.map((it) => (
                    <label key={it.id} className="flex items-center gap-2 text-xs text-neutral-600">
                      <input type="checkbox" checked={handoffItemIds.includes(it.id)}
                        onChange={(e) => setHandoffItemIds((prev) => e.target.checked ? [...prev, it.id] : prev.filter((x) => x !== it.id))} />
                      <span className="flex-1">{it.name}</span><span className="text-neutral-400">×{it.quantity}</span>
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => createHandoffMut.mutate()} disabled={createHandoffMut.isPending}
                    className="inline-flex items-center gap-1.5 text-xs bg-brand text-white px-2 py-1 rounded disabled:opacity-50">
                    {createHandoffMut.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                    Request handoff
                  </button>
                  <button onClick={() => setHandoffOpen(false)} className="text-xs text-neutral-500 hover:underline">Cancel</button>
                </div>
              </div>
            )}
            {handoffsQ.isLoading ? (
              <p className="text-xs text-neutral-400">Loading…</p>
            ) : (handoffsQ.data?.items?.length ?? 0) === 0 ? (
              <p className="text-xs text-neutral-400">No handoffs for this order.</p>
            ) : (
              <div className="space-y-2">
                {handoffsQ.data!.items.map((ho) => {
                  const myBranch = scopeBranch?.id ?? user?.branch_id;
                  const isMine = ho.status === "pending" && (ho.to_branch_id === myBranch || ho.from_branch_id === myBranch);
                  const itemNames = ho.item_ids && ho.item_ids.length
                    ? items.filter((it) => ho.item_ids!.includes(it.id)).map((it) => it.name).join(", ")
                    : "Entire order";
                  return (
                    <div key={ho.id} className="border rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs text-neutral-600">
                          {ho.from_branch_name || "—"} → <span className="font-medium">{ho.to_branch_name || "—"}</span>
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ho.status === "accepted" ? "bg-emerald-100 text-emerald-700" : ho.status === "rejected" ? "bg-red-100 text-red-700" : ho.status === "cancelled" ? "bg-neutral-100 text-neutral-500" : "bg-amber-100 text-amber-700"}`}>
                          {ho.status}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500">{itemNames}{ho.note && ` — ${ho.note}`}</p>
                      {isMine && ho.status === "pending" && (
                        <div className="flex items-center gap-2 pt-1">
                          {ho.to_branch_id === myBranch && (<>
                            <button onClick={() => respondHandoffMut.mutate({ id: ho.id, action: "accept" })} disabled={respondHandoffMut.isPending}
                              className="text-xs bg-emerald-600 text-white px-2 py-1 rounded disabled:opacity-50">Accept</button>
                            <button onClick={() => respondHandoffMut.mutate({ id: ho.id, action: "reject" })} disabled={respondHandoffMut.isPending}
                              className="text-xs bg-red-600 text-white px-2 py-1 rounded disabled:opacity-50">Reject</button>
                          </>)}
                          {ho.from_branch_id === myBranch && (
                            <button onClick={() => respondHandoffMut.mutate({ id: ho.id, action: "cancel" })} disabled={respondHandoffMut.isPending}
                              className="text-xs border px-2 py-1 rounded disabled:opacity-50">Cancel request</button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {/* Internal Notes */}
          <div className="bg-white rounded-2xl border p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-neutral-800">Internal Notes</h3>
              {!notesEdit && (
                <button
                  onClick={() => { setNotesValue(order.internal_notes || ""); setNotesEdit(true); }}
                  className="text-xs text-brand hover:underline"
                >
                  {order.internal_notes ? "Edit" : "Add"}
                </button>
              )}
            </div>
            {notesEdit ? (
              <div className="space-y-2">
                <textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  rows={4}
                  placeholder="Staff notes (not visible to customer)..."
                  className="w-full text-sm border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => notesMut.mutate(notesValue)}
                    disabled={notesMut.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand rounded-lg hover:opacity-90 transition disabled:opacity-50"
                  >
                    {notesMut.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {notesMut.isPending ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => setNotesEdit(false)}
                    className="px-3 py-1.5 text-xs font-medium text-neutral-600 border rounded-lg hover:bg-neutral-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-600 whitespace-pre-wrap">
                {order.internal_notes || <span className="text-neutral-400 italic">No internal notes.</span>}
              </p>
            )}
          </div>

          {/* Order Meta */}
          <div className="bg-white rounded-2xl border p-5">
            <h3 className="font-semibold text-neutral-800 mb-3">Order Info</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-neutral-400 text-xs">Created</dt>
                <dd className="text-neutral-700">{fmtDate(order.created_at)}</dd>
              </div>
              <div>
                <dt className="text-neutral-400 text-xs">Last Updated</dt>
                <dd className="text-neutral-700">{fmtDate(order.updated_at)}</dd>
              </div>
              {order.cancelled_at && (
                <div>
                  <dt className="text-neutral-400 text-xs">Cancelled</dt>
                  <dd className="text-rose-600">{fmtDate(order.cancelled_at)}</dd>
                </div>
              )}
              {order.cancel_reason && (
                <div>
                  <dt className="text-neutral-400 text-xs">Cancel Reason</dt>
                  <dd className="text-neutral-600">{order.cancel_reason}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* Status Update Modal */}
      {statusModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-neutral-800 mb-1">Update Order Status</h3>
            <p className="text-sm text-neutral-500 mb-4">
              Current: <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">New Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">Select status...</option>
                  {allowedTransitions.map((s) => {
                    const sCfg = ORDER_STATUS_LABELS[s] || { label: s, color: "", bg: "" };
                    return (
                      <option key={s} value={s}>{sCfg.label}</option>
                    );
                  })}
                </select>
              </div>

              {newStatus === "shipped" && (
                <>
                  <div>
                    <label className="text-sm font-medium text-neutral-700 block mb-1">Carrier</label>
                    <input
                      type="text"
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      placeholder="e.g., FedEx, UPS, DHL"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-700 block mb-1">Tracking Number</label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="e.g., 1Z999AA10123456784"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">
                  Note {newStatus === "cancelled" && "(cancel reason)"}
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder={newStatus === "cancelled" ? "Reason for cancellation..." : "Optional note..."}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>

              {statusMut.isError && (
                <p className="text-sm text-rose-500">{(statusMut.error as Error).message}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleUpdateStatus}
                  disabled={!newStatus || statusMut.isPending}
                  className="inline-flex items-center justify-center gap-2 flex-1 px-4 py-2 text-sm font-semibold text-white bg-brand rounded-lg hover:opacity-90 transition disabled:opacity-50"
                >
                  {statusMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {statusMut.isPending ? "Updating..." : "Confirm"}
                </button>
                <button
                  onClick={() => { setStatusModalOpen(false); setNewStatus(""); setNote(""); setTrackingNumber(""); setCarrier(""); }}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 border rounded-lg hover:bg-neutral-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Return Modal */}
      {returnModalOpen && (
        <CreateReturnModal
          order={order}
          returnType={returnType}
          setReturnType={setReturnType}
          returnReason={returnReason}
          setReturnReason={setReturnReason}
          returnRefundMethod={returnRefundMethod}
          setReturnRefundMethod={setReturnRefundMethod}
          returnRestock={returnRestock}
          setReturnRestock={setReturnRestock}
          returnItems={returnItems}
          setReturnItems={setReturnItems}
          onClose={() => { setReturnModalOpen(false); setReturnItems({}); }}
          onSubmit={() => {
            const items = Object.entries(returnItems)
              .filter(([, v]) => v.selected && v.quantity > 0)
              .map(([orderItemId, v]) => ({
                order_item_id: orderItemId,
                quantity: v.quantity,
                reason: v.reason,
              }));
            if (items.length === 0) {
              toast.error("Select at least one item to return");
              return;
            }
            createReturnMut.mutate({
              type: returnType,
              reason: returnReason,
              refund_method: returnType === "refund" ? returnRefundMethod : "none",
              restock: returnRestock,
              items,
            });
          }}
          isPending={createReturnMut.isPending}
          error={createReturnMut.error as Error | null}
        />
      )}

      {/* Return Details Modal */}
      {selectedReturn && !returnStatusModalOpen && (
        <OrderReturnDetailsModal
          ret={selectedReturn}
          currencyCode={order.currency_code}
          onClose={() => setSelectedReturn(null)}
          onOpenStatus={() => { setReturnNewStatus(""); setReturnStatusNote(""); setReturnStatusModalOpen(true); }}
        />
      )}

      {/* Return Status Update Modal */}
      {selectedReturn && returnStatusModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold text-neutral-800">Update Return Status</h3>
              <button onClick={() => setReturnStatusModalOpen(false)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-neutral-500 mb-4">
              Return <span className="font-mono">{selectedReturn.return_number}</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">New Status</label>
                <select
                  value={returnNewStatus}
                  onChange={(e) => setReturnNewStatus(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">Select status...</option>
                  {(RETURN_STATUS_TRANSITIONS[selectedReturn.status] || []).map((s) => {
                    const sCfg = RETURN_STATUS_LABELS[s] || { label: s, color: "", bg: "" };
                    return <option key={s} value={s}>{sCfg.label}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">
                  {returnNewStatus === "rejected" ? "Rejection Reason" : "Note"}
                </label>
                <textarea
                  value={returnStatusNote}
                  onChange={(e) => setReturnStatusNote(e.target.value)}
                  rows={3}
                  placeholder={returnNewStatus === "rejected" ? "Reason for rejection (visible to customer)..." : "Optional note (visible to customer)..."}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                {returnNewStatus === "rejected" && (
                  <p className="text-xs text-rose-500 mt-1">This reason will be displayed to the customer as the rejection reason.</p>
                )}
              </div>
              {updateReturnStatusMut.isError && (
                <p className="text-sm text-rose-500">{(updateReturnStatusMut.error as Error).message}</p>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => updateReturnStatusMut.mutate({ status: returnNewStatus, note: returnStatusNote || undefined })}
                  disabled={!returnNewStatus || updateReturnStatusMut.isPending}
                  className="inline-flex items-center justify-center gap-2 flex-1 px-4 py-2 text-sm font-semibold text-white bg-brand rounded-lg hover:opacity-90 transition disabled:opacity-50"
                >
                  {updateReturnStatusMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {updateReturnStatusMut.isPending ? "Updating..." : "Confirm"}
                </button>
                <button
                  onClick={() => setReturnStatusModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 border rounded-lg hover:bg-neutral-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Create Return Modal ----------------

function CreateReturnModal({
  order,
  returnType,
  setReturnType,
  returnReason,
  setReturnReason,
  returnRefundMethod,
  setReturnRefundMethod,
  returnRestock,
  setReturnRestock,
  returnItems,
  setReturnItems,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  order: OrderWithDetails;
  returnType: string;
  setReturnType: (v: string) => void;
  returnReason: string;
  setReturnReason: (v: string) => void;
  returnRefundMethod: string;
  setReturnRefundMethod: (v: string) => void;
  returnRestock: boolean;
  setReturnRestock: (v: boolean) => void;
  returnItems: Record<string, { selected: boolean; quantity: number; reason: string }>;
  setReturnItems: (v: Record<string, { selected: boolean; quantity: number; reason: string }>) => void;
  onClose: () => void;
  onSubmit: () => void;
  isPending: boolean;
  error: Error | null;
}) {
  const { formatMoney } = useCurrency();
  const items = order.items || [];

  const toggleItem = (itemId: string, checked: boolean) => {
    setReturnItems({
      ...returnItems,
      [itemId]: {
        selected: checked,
        quantity: returnItems[itemId]?.quantity || items.find((i) => i.id === itemId)?.quantity || 1,
        reason: returnItems[itemId]?.reason || "",
      },
    });
  };

  const setItemQty = (itemId: string, qty: number) => {
    const maxQty = items.find((i) => i.id === itemId)?.quantity || 1;
    setReturnItems({
      ...returnItems,
      [itemId]: { ...returnItems[itemId], quantity: Math.min(qty, maxQty) },
    });
  };

  const setItemReason = (itemId: string, reason: string) => {
    setReturnItems({
      ...returnItems,
      [itemId]: { ...returnItems[itemId], reason },
    });
  };

  // Calculate estimated refund
  let estimatedRefund = 0;
  for (const item of items) {
    const ri = returnItems[item.id];
    if (ri?.selected && ri.quantity > 0) {
      estimatedRefund += item.unit_price * ri.quantity;
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold text-neutral-800">Create Return / Replacement</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Type */}
          <div>
            <label className="text-sm font-medium text-neutral-700 block mb-1.5">Return Type</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "refund", label: "Refund" },
                { value: "replacement", label: "Replacement" },
                { value: "exchange", label: "Exchange" },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setReturnType(t.value)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg border transition ${
                    returnType === t.value
                      ? "bg-brand text-white border-brand"
                      : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Items */}
          <div>
            <label className="text-sm font-medium text-neutral-700 block mb-1.5">Items to Return</label>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-neutral-500 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium w-8"></th>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium text-center">Ordered</th>
                    <th className="px-3 py-2 font-medium text-center">Return Qty</th>
                    <th className="px-3 py-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) => {
                    const ri = returnItems[item.id];
                    return (
                      <tr key={item.id}>
                        <td className="px-3 py-2 text-center">
                          <Toggle
                            size="sm"
                            checked={ri?.selected || false}
                            onChange={(v) => toggleItem(item.id, v)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-neutral-800">{item.name}</div>
                          {item.sku && <div className="text-xs text-neutral-400 font-mono">{item.sku}</div>}
                        </td>
                        <td className="px-3 py-2 text-center text-neutral-600">{item.quantity}</td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min={1}
                            max={item.quantity}
                            value={ri?.quantity || 1}
                            disabled={!ri?.selected}
                            onChange={(e) => setItemQty(item.id, parseInt(e.target.value) || 1)}
                            className="w-16 px-2 py-1 text-center border rounded text-sm disabled:bg-neutral-50 disabled:text-neutral-300"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={ri?.reason || ""}
                            disabled={!ri?.selected}
                            placeholder="Reason..."
                            onChange={(e) => setItemReason(item.id, e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm disabled:bg-neutral-50"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Refund method (only for refund type) */}
          {returnType === "refund" && (
            <div>
              <label className="text-sm font-medium text-neutral-700 block mb-1.5">Refund Method</label>
              <select
                value={returnRefundMethod}
                onChange={(e) => setReturnRefundMethod(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
              >
                <option value="original">Original Payment Method</option>
                <option value="wallet">Customer Wallet</option>
                <option value="store_credit">Store Credit</option>
                <option value="none">No Refund</option>
              </select>
            </div>
          )}

          {/* Restock toggle */}
          <Toggle label="Restock returned items" checked={returnRestock} onChange={setReturnRestock} />

          {/* Reason */}
          <div>
            <label className="text-sm font-medium text-neutral-700 block mb-1.5">Overall Reason</label>
            <textarea
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              rows={2}
              placeholder="Why is this return being processed?"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>

          {/* Estimated refund */}
          {returnType === "refund" && estimatedRefund > 0 && (
            <div className="bg-purple-50 text-purple-700 rounded-lg px-4 py-3 text-sm flex items-center justify-between">
              <span>Estimated Refund Amount</span>
              <span className="font-bold text-lg">
                {formatMoney(estimatedRefund, order.currency_code)}
              </span>
            </div>
          )}

          {error && (
            <p className="text-sm text-rose-500">{error.message}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onSubmit}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 flex-1 px-4 py-2 text-sm font-semibold text-white bg-brand rounded-lg hover:opacity-90 transition disabled:opacity-50"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPending ? "Creating..." : "Create Return"}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-600 border rounded-lg hover:bg-neutral-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Return Details Modal ----------------

function OrderReturnDetailsModal({
  ret,
  currencyCode,
  onClose,
  onOpenStatus,
}: {
  ret: OrderReturn;
  currencyCode: string;
  onClose: () => void;
  onOpenStatus: () => void;
}) {
  const sCfg = RETURN_STATUS_LABELS[ret.status] || { label: ret.status, color: "text-neutral-600", bg: "bg-neutral-100" };
  const tCfg = RETURN_TYPE_LABELS[ret.type] || { label: ret.type, color: "text-neutral-600", bg: "bg-neutral-100" };
  const items = ret.items || [];
  const history = ret.status_history || [];

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  }) : "—";

  const { formatMoney } = useCurrency();
  const fmtMoney = (amount: number) => formatMoney(Math.abs(amount), currencyCode);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-bold text-neutral-800">{ret.return_number}</h3>
            <p className="text-sm text-neutral-500">
              Order <span className="font-mono">#{ret.order_id.slice(0, 8)}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Badges */}
          <div className="flex gap-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${tCfg.bg} ${tCfg.color}`}>{tCfg.label}</span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${sCfg.bg} ${sCfg.color}`}>{sCfg.label}</span>
            {ret.refund_amount > 0 && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                Refund: {fmtMoney(ret.refund_amount)}
              </span>
            )}
          </div>

          {/* Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-neutral-400 text-xs">Reason</p>
              <p className="text-neutral-700">{ret.reason || "—"}</p>
            </div>
            <div>
              <p className="text-neutral-400 text-xs">Refund Method</p>
              <p className="text-neutral-700">{REFUND_METHOD_LABELS[ret.refund_method] || ret.refund_method}</p>
            </div>
            <div>
              <p className="text-neutral-400 text-xs">Restock Items</p>
              <p className="text-neutral-700">{ret.restock ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-neutral-400 text-xs">Created</p>
              <p className="text-neutral-700">{fmtDate(ret.created_at)}</p>
            </div>
            {ret.completed_at && (
              <div>
                <p className="text-neutral-400 text-xs">Completed</p>
                <p className="text-neutral-700">{fmtDate(ret.completed_at)}</p>
              </div>
            )}
          </div>

          {/* Rejection Reason callout */}
          {ret.status === "rejected" && (() => {
            const rejectionEvent = [...history].reverse().find((e) => e.status === "rejected" && e.note);
            return rejectionEvent ? (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                <p className="text-rose-700 font-medium text-xs mb-1">Rejection Reason</p>
                <p className="text-rose-600 text-sm">{rejectionEvent.note}</p>
              </div>
            ) : null;
          })()}

          {/* Items */}
          {items.length > 0 && (
            <div>
              <h4 className="font-semibold text-neutral-800 mb-2">Returned Items ({items.length})</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-neutral-500 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Product</th>
                      <th className="px-3 py-2 font-medium text-center">Qty</th>
                      <th className="px-3 py-2 font-medium text-right">Unit Price</th>
                      <th className="px-3 py-2 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2">
                          <div className="font-medium text-neutral-800">{it.name}</div>
                          {it.sku && <div className="text-xs text-neutral-400 font-mono">{it.sku}</div>}
                          {it.reason && <div className="text-xs text-neutral-500 mt-0.5">{it.reason}</div>}
                        </td>
                        <td className="px-3 py-2 text-center text-neutral-600">{it.quantity}</td>
                        <td className="px-3 py-2 text-right text-neutral-600">{fmtMoney(it.unit_price)}</td>
                        <td className="px-3 py-2 text-right font-medium">{fmtMoney(it.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Status History */}
          {history.length > 0 && (
            <div>
              <h4 className="font-semibold text-neutral-800 mb-2">Status History</h4>
              <div className="space-y-0">
                {history.slice().reverse().map((event, i) => {
                  const eCfg = RETURN_STATUS_LABELS[event.status] || { label: event.status, color: "text-neutral-600", bg: "bg-neutral-100" };
                  const isLast = i === history.length - 1;
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${eCfg.bg}`} />
                        {!isLast && <div className="w-0.5 flex-1 bg-neutral-200 my-1" />}
                      </div>
                      <div className="pb-4 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${eCfg.color}`}>{eCfg.label}</span>
                          <span className="text-xs text-neutral-400">{fmtDate(event.timestamp)}</span>
                        </div>
                        {event.note && <p className="text-xs text-neutral-500 mt-0.5">{event.note}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Update Status action */}
          {(ret.status === "requested" || ret.status === "approved") && (
            <button
              onClick={onOpenStatus}
              className="w-full px-4 py-2 text-sm font-semibold text-white bg-brand rounded-lg hover:opacity-90 transition"
            >
              Update Status
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
