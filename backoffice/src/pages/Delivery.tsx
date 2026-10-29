import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, MapPin, Phone, Package } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { api, generateIdempotencyKey } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { TableSkeleton } from "@/components/Skeletons";
import { ORDER_STATUS_LABELS, type OrderWithDetails } from "@/types";

type View = "queue" | "active" | "history";

const VIEWS: { key: View; label: string }[] = [
  { key: "queue", label: "Ready for pickup" },
  { key: "active", label: "My deliveries" },
  { key: "history", label: "Delivered" },
];

// Delivery partner home: ready orders at the partner's allocated branches
// (claimable), their in-flight deliveries, and delivered history.
export function Delivery() {
  const { tenant, user } = useAuth();
  const { formatMoney } = useCurrency();
  const qc = useQueryClient();
  const toast = useToast();
  const [view, setView] = useState<View>("queue");

  const branchesQ = useQuery({
    queryKey: ["delivery-branches", tenant],
    queryFn: () => api.listDeliveryBranches(),
    retry: false,
  });

  const ordersQ = useQuery({
    queryKey: ["delivery-orders", tenant, view],
    queryFn: () => api.listDeliveryOrders(tenant, { view }),
    refetchInterval: 15000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["delivery-orders", tenant] });
  };

  const act = useMutation({
    mutationFn: ({ orderId, action }: { orderId: string; action: "claim" | "start" | "deliver" }) => {
      const key = generateIdempotencyKey();
      if (action === "claim") return api.claimDeliveryOrder(orderId, key);
      if (action === "start") return api.startDeliveryOrder(orderId, key);
      return api.completeDeliveryOrder(orderId, key);
    },
    onSuccess: (res) => {
      invalidate();
      toast.success(res.message || "Updated");
    },
    onError: (e) => {
      invalidate();
      toast.error("Action failed", (e as Error).message);
    },
  });

  const branches = branchesQ.data?.items ?? [];
  const noBranch = branchesQ.isSuccess && branches.length === 0;

  // Queue view: unassigned first, then mine, then other partners' — oldest first.
  const orders = (ordersQ.data?.items ?? []).slice().sort((a, b) => {
    const rank = (o: OrderWithDetails) =>
      !o.delivery_partner_id ? 0 : o.delivery_partner_id === user?.id ? 1 : 2;
    return rank(a) - rank(b) || a.created_at.localeCompare(b.created_at);
  });

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-bold text-neutral-900">Deliveries</h1>
        <p className="text-xs text-neutral-500">
          {noBranch
            ? "No branch allocated to your account"
            : `Covering: ${branches.map((b) => b.name).join(", ") || "—"}`}
        </p>
      </div>

      {/* View tabs */}
      <div className="flex gap-1.5 mb-4 bg-white rounded-xl border p-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
              view === v.key ? "bg-emerald-600 text-white" : "text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {noBranch ? (
        <EmptyCard
          title="No branch allocated"
          body="Ask a store admin to allocate you to a branch before you can see deliveries."
        />
      ) : ordersQ.isLoading ? (
        <div className="bg-white rounded-2xl border p-4">
          <TableSkeleton cols={3} rows={4} />
        </div>
      ) : ordersQ.error ? (
        <EmptyCard title="Couldn't load orders" body={(ordersQ.error as Error).message} />
      ) : orders.length === 0 ? (
        <EmptyCard
          title={
            view === "queue"
              ? "No orders ready for pickup"
              : view === "active"
                ? "No active deliveries"
                : "No deliveries yet"
          }
          body={
            view === "queue"
              ? "Orders marked ready at your branch will appear here."
              : view === "active"
                ? "Claim a ready order or wait for one to be assigned to you."
                : "Orders you deliver will show up here."
          }
        />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <DeliveryCard
              key={o.id}
              order={o}
              me={user?.id}
              pending={act.isPending}
              onAction={(action) => act.mutate({ orderId: o.id, action })}
              formatMoney={formatMoney}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-white rounded-2xl border p-10 text-center">
      <Package className="w-10 h-10 mx-auto text-neutral-300 mb-3" />
      <p className="font-medium text-neutral-700">{title}</p>
      <p className="text-sm text-neutral-400 mt-1">{body}</p>
    </div>
  );
}

function DeliveryCard({
  order: o,
  me,
  pending,
  onAction,
  formatMoney,
}: {
  order: OrderWithDetails;
  me?: string;
  pending: boolean;
  onAction: (action: "claim" | "start" | "deliver") => void;
  formatMoney: (n: number, c?: string) => string;
}) {
  const cfg = ORDER_STATUS_LABELS[o.status] || { label: o.status, color: "text-neutral-600", bg: "bg-neutral-100" };
  const addr = o.shipping_address;
  const isCod = (o.payment_method || "").toLowerCase() === "cod";
  const mine = o.delivery_partner_id === me;
  const someoneElses = !!o.delivery_partner_id && !mine;
  const items = o.items || [];

  const addressLines = addr
    ? [addr.line1, addr.line2, [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", "), addr.country]
        .filter(Boolean)
        .join("\n")
    : "";

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden ${someoneElses ? "opacity-70" : ""}`}>
      <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-neutral-800">#{o.id.slice(0, 8)}</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.color}`}>
              {o.status === "shipped" ? "Out for delivery" : cfg.label}
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            {o.branch_name || "Store"} · {new Date(o.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-neutral-900">{formatMoney(o.grand_total, o.currency_code)}</p>
          {isCod ? (
            <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
              Collect COD
            </span>
          ) : (
            <span className="text-[11px] text-emerald-600 font-medium capitalize">{o.payment_method || "paid"}</span>
          )}
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Customer + address */}
        <div className="flex items-start gap-2.5">
          <MapPin className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-800">
              {[addr?.first_name, addr?.last_name].filter(Boolean).join(" ") || o.customer_name || "Customer"}
            </p>
            {addr?.phone && (
              <a href={`tel:${addr.phone}`} className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium mt-0.5">
                <Phone className="w-3 h-3" /> {addr.phone}
              </a>
            )}
            {addressLines && (
              <p className="text-xs text-neutral-500 mt-1 whitespace-pre-line">{addressLines}</p>
            )}
            {addr?.label && <p className="text-[11px] text-neutral-400 mt-0.5">Area: {addr.label}</p>}
          </div>
        </div>

        {/* Items */}
        {items.length > 0 && (
          <div className="bg-neutral-50 rounded-lg px-3 py-2">
            <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">
              Items ({items.reduce((n, i) => n + i.quantity, 0)})
            </p>
            <ul className="text-xs text-neutral-700 space-y-0.5">
              {items.map((i) => (
                <li key={i.id}>
                  {i.quantity} × {i.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Assignment + actions */}
        {someoneElses ? (
          <p className="text-xs text-neutral-500 italic">
            Assigned to {o.delivery_partner_name || "another partner"}
          </p>
        ) : o.status === "ready" && !o.delivery_partner_id ? (
          <button
            onClick={() => onAction("claim")}
            disabled={pending}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition inline-flex items-center justify-center gap-2"
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            Claim delivery
          </button>
        ) : o.status === "ready" && mine ? (
          <button
            onClick={() => onAction("start")}
            disabled={pending}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition inline-flex items-center justify-center gap-2"
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            Start delivery
          </button>
        ) : o.status === "shipped" && mine ? (
          <button
            onClick={() => onAction("deliver")}
            disabled={pending}
            className="w-full bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition inline-flex items-center justify-center gap-2"
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            Mark delivered
          </button>
        ) : o.status === "delivered" ? (
          <p className="text-xs text-emerald-700 font-medium">
            Delivered {o.delivered_at ? new Date(o.delivered_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}
