import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BarChart3,
  Boxes,
  ChevronRight,
  Clock,
  CreditCard,
  FilePlus2,
  Inbox,
  MessageSquare,
  Package,
  PackageX,
  Percent,
  Plus,
  Receipt,
  RefreshCw,
  RotateCcw,
  ShoppingCart,
  Star,
  Tag,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { useBranchPrefix } from "@/lib/branch";
import { api } from "@/lib/api";
import { ORDER_STATUS_LABELS } from "@/types";
import { PageHeader } from "@/components/PageHeader";
import { DashboardSkeleton } from "@/components/Skeletons";
import { AreaChart, DonutChart, MeterBar, Sparkline } from "@/components/charts";

// ---------- helpers ----------

type RangeKey = "today" | "7d" | "30d" | "90d" | "all";

const RANGES: Record<RangeKey, { label: string; params: () => { from?: string; to?: string } }> = {
  today: {
    label: "Today",
    params: () => ({ from: isoDate(0), to: isoDate(-1) }),
  },
  "7d": { label: "7D", params: () => ({ from: isoDate(6), to: isoDate(-1) }) },
  "30d": { label: "30D", params: () => ({ from: isoDate(29), to: isoDate(-1) }) },
  "90d": { label: "90D", params: () => ({ from: isoDate(89), to: isoDate(-1) }) },
  all: { label: "All time", params: () => ({}) },
};

/** ISO date N days back from today (negative N = future). */
function isoDate(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

function pctChange(cur: number, prev: number): number | null {
  if (prev <= 0) return cur > 0 ? 100 : null;
  return ((cur - prev) / prev) * 100;
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const STATUS_HEX: Record<string, string> = {
  pending: "#f59e0b",
  paid: "#10b981",
  processing: "#3b82f6",
  shipped: "#6366f1",
  delivered: "#22c55e",
  fulfilled: "#06b6d4",
  cancelled: "#f43f5e",
  refunded: "#a855f7",
  failed: "#ef4444",
};

const QUICK_ACTIONS: { label: string; to: string; icon: LucideIcon }[] = [
  { label: "New product", to: "/products/new", icon: Plus },
  { label: "Create offer", to: "/offers", icon: Tag },
  { label: "New discount", to: "/discounts", icon: Percent },
  { label: "Create page", to: "/pages", icon: FilePlus2 },
  { label: "View reports", to: "/reports", icon: BarChart3 },
  { label: "Inventory", to: "/inventory", icon: Boxes },
];

const METHOD_ICONS: Record<string, LucideIcon> = {
  cod: Banknote,
  cash_on_delivery: Banknote,
  wallet: Wallet,
  unpaid: Clock,
};

// ---------- small building blocks ----------

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function DeltaChip({ pct, label }: { pct: number | null; label: string }) {
  if (pct == null) return null;
  const up = pct >= 0;
  return (
    <span
      title={label}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
        up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"
      }`}
    >
      {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {up ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

function KpiCard({
  label,
  value,
  icon,
  gradient,
  delta,
  deltaLabel,
  spark,
  sparkColor,
  footnote,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  gradient: string;
  delta?: number | null;
  deltaLabel?: string;
  spark?: number[];
  sparkColor?: string;
  footnote?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm ${gradient}`}>
          {icon}
        </div>
        {spark && spark.length > 1 && (
          <Sparkline data={spark} width={96} height={36} color={sparkColor ?? "#4f46e5"} className="opacity-90" />
        )}
      </div>
      <p className="text-sm text-slate-500 mt-4">{label}</p>
      <div className="flex items-end justify-between gap-2 mt-0.5">
        <p className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">{value}</p>
        {delta != null && <DeltaChip pct={delta} label={deltaLabel ?? ""} />}
      </div>
      {footnote && <p className="text-xs text-slate-400 mt-1">{footnote}</p>}
    </div>
  );
}

// ---------- the page ----------

export function Dashboard() {
  const { tenant, user, tenantName } = useAuth();
  const { formatMoney, currency } = useCurrency();
  const prefix = useBranchPrefix();
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>("30d");
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);

  const rangeParams = useMemo(() => RANGES[range].params(), [range]);
  const statsQ = useQuery({
    queryKey: ["dashboard", tenant, range],
    queryFn: () => api.dashboardStats(tenant, rangeParams.from, rangeParams.to),
    refetchInterval: 60_000,
  });

  const stats = statsQ.data;

  const fmtMoney = formatMoney;
  const fmtAxis = useMemo(() => {
    const f = new Intl.NumberFormat(undefined, { style: "currency", currency: currency.code, notation: "compact", maximumFractionDigits: 1 });
    return (v: number) => f.format(v);
  }, [currency.code]);
  const fmtInt = useMemo(() => new Intl.NumberFormat(), []);

  const statusCounts = stats?.orders_by_status ?? {};
  const firstName = (user?.full_name || "").split(" ")[0] || "there";
  const hour = new Date().getHours();
  const daypart = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const todayLong = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const series = useMemo(
    () =>
      (stats?.revenue_series ?? []).map((d) => ({
        label: new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: d.revenue,
        extra: d.orders,
      })),
    [stats],
  );

  const delta = (cur: number, key: "revenue" | "orders" | "avg_order_value") => {
    if (range === "all") {
      if (key === "avg_order_value") return { pct: null, label: "" };
      return { pct: pctChange(stats?.week?.[key] ?? 0, stats?.prev_week?.[key] ?? 0), label: "last 7 days vs prior 7 days" };
    }
    if (!stats?.comparison) return { pct: null, label: "" };
    return { pct: pctChange(cur, stats.comparison[key]), label: "vs previous period" };
  };

  const statusSlices = Object.entries(statusCounts)
    .map(([status, n]) => ({
      label: ORDER_STATUS_LABELS[status]?.label ?? status,
      status,
      value: n,
      color: STATUS_HEX[status] ?? "#94a3b8",
    }))
    .sort((a, b) => b.value - a.value);
  const totalOrders = statusSlices.reduce((s, d) => s + d.value, 0);
  const hovered = hoveredSlice != null ? statusSlices[hoveredSlice] : null;

  const maxCatRev = Math.max(...(stats?.top_categories ?? []).map((c) => c.revenue), 1);
  const maxPmRev = Math.max(...(stats?.payment_methods ?? []).map((p) => p.revenue), 1);
  const maxProdRev = Math.max(...(stats?.top_products ?? []).map((p) => p.revenue), 1);

  const attention = [
    {
      icon: ShoppingCart,
      label: "Pending orders",
      hint: "Awaiting confirmation",
      count: statusCounts["pending"] ?? 0,
      to: `${prefix}/orders?status=pending`,
      color: "bg-amber-50 text-amber-600",
    },
    {
      icon: Receipt,
      label: "Orders to fulfil",
      hint: "Paid, not yet shipped",
      count: (statusCounts["paid"] ?? 0) + (statusCounts["processing"] ?? 0),
      to: `${prefix}/orders?status=paid`,
      color: "bg-blue-50 text-blue-600",
    },
    {
      icon: RotateCcw,
      label: "Return requests",
      hint: "Waiting for review",
      count: stats?.pending_returns ?? 0,
      to: `${prefix}/returns?status=requested`,
      color: "bg-violet-50 text-violet-600",
    },
    {
      icon: PackageX,
      label: "Out of stock",
      hint: "Items unavailable to buy",
      count: stats?.inventory?.out_of_stock ?? 0,
      to: `${prefix}/inventory`,
      color: "bg-rose-50 text-rose-600",
    },
    {
      icon: AlertTriangle,
      label: "Low stock",
      hint: "Below reorder threshold",
      count: stats?.inventory?.low_stock ?? 0,
      to: `${prefix}/inventory`,
      color: "bg-orange-50 text-orange-600",
    },
  ];
  const attentionTotal = attention.reduce((s, a) => s + a.count, 0);

  const pulseTiles = [
    { icon: Package, label: "Products", value: fmtInt.format(stats?.products ?? 0), color: "bg-indigo-50 text-indigo-600", to: `${prefix}/products` },
    { icon: Boxes, label: "Stock value", value: fmtMoney(stats?.inventory?.total_stock_value ?? 0), color: "bg-teal-50 text-teal-600", to: `${prefix}/inventory` },
    { icon: Tag, label: "Active offers", value: fmtInt.format(stats?.active_offers ?? 0), color: "bg-sky-50 text-sky-600", to: `${prefix}/offers` },
    { icon: Percent, label: "Active discounts", value: fmtInt.format(stats?.active_discounts ?? 0), color: "bg-fuchsia-50 text-fuchsia-600", to: `${prefix}/discounts` },
    { icon: Star, label: "Store rating", value: (stats?.avg_rating ?? 0) > 0 ? `${stats!.avg_rating.toFixed(1)} (${stats!.reviews})` : "—", color: "bg-amber-50 text-amber-600", to: undefined as string | undefined },
    { icon: MessageSquare, label: "Unread messages", value: fmtInt.format(stats?.unread_messages ?? 0), color: "bg-pink-50 text-pink-600", to: undefined as string | undefined },
  ];

  return (
    <div>
      <PageHeader
        title={`Good ${daypart}, ${firstName}`}
        subtitle={`Here's how ${tenantName || "your store"} is doing — ${todayLong}`}
        action={
          <div className="flex items-center gap-2">
            <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
              {(Object.keys(RANGES) as RangeKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setRange(k)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    range === k ? "bg-brand text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {RANGES[k].label}
                </button>
              ))}
            </div>
            <button
              onClick={() => statsQ.refetch()}
              title="Refresh"
              className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 hover:border-slate-300 shadow-sm transition"
            >
              <RefreshCw className={`w-4 h-4 ${statsQ.isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        }
      />

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.label}
            to={`${prefix}${a.to}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:text-brand hover:border-brand/40 hover:shadow-sm transition"
          >
            <a.icon className="w-3.5 h-3.5" />
            {a.label}
          </Link>
        ))}
      </div>

      {statsQ.isLoading ? (
        <DashboardSkeleton />
      ) : statsQ.error ? (
        <div className="bg-rose-50 text-rose-600 rounded-xl p-4">
          Failed to load dashboard. Make sure the backend is running and you have admin access.
        </div>
      ) : (
        <div className="space-y-5 animate-fade-in-up">
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <KpiCard
              label={range === "all" ? "Total revenue" : "Revenue"}
              value={fmtMoney(stats?.revenue ?? 0)}
              icon={<Banknote className="w-5 h-5" />}
              gradient="bg-gradient-to-br from-indigo-500 to-violet-600"
              delta={delta(stats?.revenue ?? 0, "revenue").pct}
              deltaLabel={delta(stats?.revenue ?? 0, "revenue").label}
              spark={(stats?.revenue_series ?? []).map((d) => d.revenue)}
              sparkColor="#6366f1"
              footnote={`${fmtMoney(stats?.today?.revenue ?? 0)} today`}
            />
            <KpiCard
              label="Orders"
              value={fmtInt.format(stats?.orders ?? 0)}
              icon={<ShoppingCart className="w-5 h-5" />}
              gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
              delta={delta(stats?.orders ?? 0, "orders").pct}
              deltaLabel={delta(stats?.orders ?? 0, "orders").label}
              spark={(stats?.revenue_series ?? []).map((d) => d.orders)}
              sparkColor="#10b981"
              footnote={`${stats?.today?.orders ?? 0} today`}
            />
            <KpiCard
              label="Avg. order value"
              value={fmtMoney(stats?.avg_order_value ?? 0)}
              icon={<Receipt className="w-5 h-5" />}
              gradient="bg-gradient-to-br from-amber-500 to-orange-600"
              delta={delta(stats?.avg_order_value ?? 0, "avg_order_value").pct}
              deltaLabel={delta(stats?.avg_order_value ?? 0, "avg_order_value").label}
              footnote={`${fmtMoney(stats?.week?.revenue ?? 0)} last 7 days`}
            />
            <KpiCard
              label="Customers"
              value={fmtInt.format(stats?.customers ?? 0)}
              icon={<Users className="w-5 h-5" />}
              gradient="bg-gradient-to-br from-pink-500 to-rose-600"
              footnote={`+${stats?.new_customers ?? 0} new ${range === "all" ? "last 30 days" : "in period"}`}
            />
          </div>

          {/* Revenue chart + needs attention */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <Card className="xl:col-span-2 p-6">
              <CardHeader
                title="Revenue"
                subtitle={range === "all" ? "Last 30 days" : `Selected period · ${RANGES[range].label}`}
                action={
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-brand inline-block" /> Revenue
                    </span>
                    <span className="tabular-nums font-semibold text-slate-900">{fmtMoney(stats?.revenue ?? 0)}</span>
                  </div>
                }
              />
              <AreaChart
                data={series}
                height={270}
                formatValue={fmtMoney}
                formatAxis={fmtAxis}
                extraLabel="orders"
                emptyMessage="No revenue in this period yet"
              />
            </Card>

            <Card className="p-6">
              <CardHeader
                title="Needs attention"
                subtitle={attentionTotal > 0 ? `${attentionTotal} item${attentionTotal !== 1 ? "s" : ""} to review` : "You're all caught up"}
                action={attentionTotal > 0 ? <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse mt-1.5" /> : undefined}
              />
              <div className="space-y-1.5">
                {attention.map((a) => (
                  <Link
                    key={a.label}
                    to={a.to}
                    className="flex items-center gap-3 px-2.5 py-2.5 -mx-2.5 rounded-xl hover:bg-slate-50 transition group"
                  >
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${a.color}`}>
                      <a.icon className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-800">{a.label}</span>
                      <span className="block text-xs text-slate-400 truncate">{a.hint}</span>
                    </span>
                    <span
                      className={`text-sm font-bold tabular-nums px-2 py-0.5 rounded-md ${
                        a.count > 0 ? "bg-slate-900 text-white" : "text-slate-300"
                      }`}
                    >
                      {a.count}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition" />
                  </Link>
                ))}
              </div>
            </Card>
          </div>

          {/* Breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="p-6">
              <CardHeader title="Orders by status" subtitle={`${totalOrders} in period`} />
              {totalOrders === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">No orders in this period.</p>
              ) : (
                <div className="flex items-center gap-5">
                  <DonutChart
                    data={statusSlices}
                    size={168}
                    thickness={22}
                    hovered={hoveredSlice}
                    onHover={setHoveredSlice}
                    center={
                      <>
                        <span className="text-2xl font-bold text-slate-900 tabular-nums">
                          {hovered ? hovered.value : totalOrders}
                        </span>
                        <span className="text-xs text-slate-400">{hovered ? hovered.label : "orders"}</span>
                      </>
                    }
                  />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {statusSlices.slice(0, 6).map((s, i) => (
                      <Link
                        key={s.status}
                        to={`${prefix}/orders?status=${s.status}`}
                        onMouseEnter={() => setHoveredSlice(i)}
                        onMouseLeave={() => setHoveredSlice(null)}
                        className={`flex items-center gap-2 text-sm rounded-lg px-1.5 py-1 -mx-1.5 transition ${
                          hoveredSlice === i ? "bg-slate-50" : ""
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                        <span className="flex-1 truncate text-slate-600">{s.label}</span>
                        <span className="font-semibold text-slate-900 tabular-nums">{s.value}</span>
                        <span className="text-xs text-slate-400 w-9 text-right tabular-nums">
                          {Math.round((s.value / totalOrders) * 100)}%
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <Card className="p-6">
              <CardHeader title="Top categories" subtitle="By revenue" />
              {(stats?.top_categories ?? []).length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">No sales yet.</p>
              ) : (
                <div className="space-y-3.5">
                  {stats!.top_categories!.map((c) => (
                    <div key={c.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-700 font-medium truncate">{c.name}</span>
                        <span className="text-slate-900 font-semibold tabular-nums">{fmtMoney(c.revenue)}</span>
                      </div>
                      <MeterBar value={c.revenue} max={maxCatRev} color="linear-gradient(90deg,#4f46e5,#818cf8)" />
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <CardHeader title="Payment methods" subtitle="Revenue share" />
              {(stats?.payment_methods ?? []).length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">No payments yet.</p>
              ) : (
                <div className="space-y-3.5">
                  {stats!.payment_methods!.map((p) => {
                    const Icon = METHOD_ICONS[p.method.toLowerCase()] ?? CreditCard;
                    const share = stats!.payment_methods!.reduce((s, x) => s + x.revenue, 0);
                    return (
                      <div key={p.method} className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-slate-700 font-medium capitalize truncate">{p.method.replace(/_/g, " ")}</span>
                            <span className="text-slate-900 font-semibold tabular-nums">
                              {share > 0 ? `${Math.round((p.revenue / share) * 100)}%` : "—"}
                            </span>
                          </div>
                          <MeterBar value={p.revenue} max={maxPmRev} color="#0ea5e9" height={5} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Top products + recent orders */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <Card className="p-6">
              <CardHeader
                title="Top products"
                subtitle="By revenue"
                action={
                  <Link to={`${prefix}/products`} className="text-xs font-medium text-brand hover:text-brand-dark inline-flex items-center gap-0.5">
                    All products <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                }
              />
              {(stats?.top_products ?? []).length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">No sales yet.</p>
              ) : (
                <div className="space-y-1">
                  {stats!.top_products!.map((p, i) => (
                    <button
                      key={`${p.product_id}-${i}`}
                      onClick={() => p.product_id && navigate(`${prefix}/products/${p.product_id}/edit`)}
                      className="w-full flex items-center gap-3 px-2 py-2 -mx-2 rounded-xl hover:bg-slate-50 transition text-left"
                    >
                      <span className="w-5 text-xs font-bold text-slate-300 tabular-nums">{i + 1}</span>
                      {p.image ? (
                        <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-100 flex-shrink-0" />
                      ) : (
                        <span className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Package className="w-4 h-4 text-slate-400" />
                        </span>
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-slate-800 truncate">{p.name}</span>
                        <span className="block text-xs text-slate-400">{p.qty} sold</span>
                      </span>
                      <span className="text-sm font-semibold text-slate-900 tabular-nums">{fmtMoney(p.revenue)}</span>
                    </button>
                  ))}
                  <div className="pt-3">
                    <MeterBar value={stats!.top_products![0]?.revenue ?? 0} max={maxProdRev} color="linear-gradient(90deg,#10b981,#34d399)" height={4} />
                    <p className="text-xs text-slate-400 mt-1.5">
                      Top seller drives {fmtMoney(stats!.top_products![0]?.revenue ?? 0)}
                    </p>
                  </div>
                </div>
              )}
            </Card>

            <Card className="xl:col-span-2 p-6">
              <CardHeader
                title="Recent orders"
                subtitle="Latest activity"
                action={
                  <Link to={`${prefix}/orders`} className="text-xs font-medium text-brand hover:text-brand-dark inline-flex items-center gap-0.5">
                    View all <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                }
              />
              {(!stats?.recent_orders || stats.recent_orders.length === 0) ? (
                <div className="py-10 text-center">
                  <Inbox className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No orders yet. They'll appear here.</p>
                </div>
              ) : (
                <div className="-mx-6 -mb-6 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                        <th className="font-medium pl-6 pr-3 py-2.5">Order</th>
                        <th className="font-medium px-3 py-2.5">Customer</th>
                        <th className="font-medium px-3 py-2.5">Status</th>
                        <th className="font-medium px-3 py-2.5">Placed</th>
                        <th className="font-medium pr-6 pl-3 py-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {stats.recent_orders.map((o) => {
                        const cfg = ORDER_STATUS_LABELS[o.status] ?? { label: o.status, color: "text-slate-600", bg: "bg-slate-100" };
                        return (
                          <tr
                            key={o.id}
                            onClick={() => navigate(`${prefix}/orders/${o.id}`)}
                            className="hover:bg-slate-50/80 cursor-pointer transition"
                          >
                            <td className="pl-6 pr-3 py-3 font-mono text-xs text-slate-500">#{o.id.slice(0, 8)}</td>
                            <td className="px-3 py-3 text-slate-700 max-w-[160px] truncate">
                              {o.customer_name || "Guest"}
                            </td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-slate-400 text-xs whitespace-nowrap">{timeAgo(o.created_at)}</td>
                            <td className="pr-6 pl-3 py-3 text-right font-semibold text-slate-900 tabular-nums">
                              {fmtMoney(o.total, o.currency)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Low stock + store pulse */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <Card className="p-6">
              <CardHeader
                title="Low stock alerts"
                subtitle="Below reorder threshold"
                action={
                  <Link to={`${prefix}/inventory`} className="text-xs font-medium text-brand hover:text-brand-dark inline-flex items-center gap-0.5">
                    Inventory <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                }
              />
              {(stats?.low_stock_items ?? []).length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">Stock levels look healthy.</p>
              ) : (
                <div className="space-y-3">
                  {stats!.low_stock_items!.map((it, i) => {
                    const out = it.stock <= 0;
                    return (
                      <button
                        key={i}
                        onClick={() => navigate(`${prefix}/products/${it.product_id}/edit`)}
                        className="w-full flex items-center gap-3 px-2 py-1.5 -mx-2 rounded-xl hover:bg-slate-50 transition text-left"
                      >
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${out ? "bg-rose-500" : "bg-amber-400"}`}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-slate-800 truncate">
                            {it.name}
                            {it.variant && <span className="text-slate-400 font-normal"> · {it.variant}</span>}
                          </span>
                        </span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-md tabular-nums ${
                            out ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {out ? "Out" : `${it.stock} left`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="xl:col-span-2 p-6">
              <CardHeader title="Store pulse" subtitle="Key figures at a glance" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {pulseTiles.map((t) => {
                  const inner = (
                    <>
                      <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${t.color}`}>
                        <t.icon className="w-4 h-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-lg font-bold text-slate-900 tabular-nums leading-tight truncate">
                          {t.value}
                        </span>
                        <span className="block text-xs text-slate-400 truncate">{t.label}</span>
                      </span>
                    </>
                  );
                  return t.to ? (
                    <Link
                      key={t.label}
                      to={t.to}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 hover:bg-slate-50 hover:border-slate-200 transition"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div key={t.label} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                      {inner}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
