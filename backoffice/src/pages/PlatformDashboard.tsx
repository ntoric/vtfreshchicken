import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Store, DollarSign, ClipboardList, Package, Users, UserCircle, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { DashboardSkeleton } from "@/components/Skeletons";
import type { PlatformStats } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  cancelled: "bg-rose-100 text-rose-700",
  failed: "bg-rose-100 text-rose-700",
  refunded: "bg-slate-100 text-slate-700",
  shipped: "bg-blue-100 text-blue-700",
  delivered: "bg-indigo-100 text-indigo-700",
};

const PLAN_COLORS: Record<string, string> = {
  standard: "bg-slate-100 text-slate-700",
  professional: "bg-blue-100 text-blue-700",
  enterprise: "bg-purple-100 text-purple-700",
  trial: "bg-amber-100 text-amber-700",
};

export function PlatformDashboard() {
  const statsQ = useQuery({
    queryKey: ["platform-stats"],
    queryFn: () => api.platformStats(),
    refetchInterval: 30000,
  });

  if (statsQ.isLoading) {
    return (
      <div>
        <PageHeader title="Platform Dashboard" subtitle="Superadmin overview" />
        <DashboardSkeleton />
      </div>
    );
  }

  if (statsQ.error) {
    return (
      <div>
        <PageHeader title="Platform Dashboard" subtitle="Superadmin overview" />
        <div className="bg-rose-50 text-rose-600 rounded-xl p-4">
          Failed to load platform stats. {(statsQ.error as Error).message}
        </div>
      </div>
    );
  }

  const s: PlatformStats = statsQ.data!;

  return (
    <div>
      <PageHeader
        title="Platform Dashboard"
        subtitle="Aggregate KPIs across all stores"
      />

      {/* ===== KPI Cards ===== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <KPICard label="Total Stores" value={s.tenant_count} icon={<Store className="w-5 h-5" />} color="bg-indigo-50 text-indigo-600" sub={`${s.active_tenants} active`} />
        <KPICard label="Total Revenue" value={`$${s.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={<DollarSign className="w-5 h-5" />} color="bg-emerald-50 text-emerald-600" />
        <KPICard label="Total Orders" value={s.total_orders} icon={<ClipboardList className="w-5 h-5" />} color="bg-blue-50 text-blue-600" />
        <KPICard label="Total Products" value={s.total_products} icon={<Package className="w-5 h-5" />} color="bg-amber-50 text-amber-600" />
        <KPICard label="Customers" value={s.total_customers} icon={<Users className="w-5 h-5" />} color="bg-pink-50 text-pink-600" />
        <KPICard label="Staff & Admins" value={s.total_staff} icon={<UserCircle className="w-5 h-5" />} color="bg-purple-50 text-purple-600" />
      </div>

      {/* ===== Secondary KPIs ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MiniStat label="Active Stores" value={s.active_tenants} color="text-emerald-600" />
        <MiniStat label="Inactive Stores" value={s.inactive_tenants} color="text-rose-600" />
        <MiniStat label="Total Vendors" value={s.total_vendors} color="text-blue-600" />
        <MiniStat label="New This Month" value={s.new_tenants_this_month} color="text-indigo-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* ===== Orders by Status ===== */}
        <div className="bg-white rounded-2xl border p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Orders by Status (Platform-wide)</h3>
          <div className="space-y-3">
            {Object.entries(s.orders_by_status).length === 0 && (
              <p className="text-sm text-slate-400">No orders yet.</p>
            )}
            {Object.entries(s.orders_by_status).map(([status, count]) => {
              const pct = s.total_orders > 0 ? (count / s.total_orders) * 100 : 0;
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm capitalize text-slate-600">{status}</span>
                    <span className="font-semibold text-slate-900">{count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${STATUS_COLORS[status] ? STATUS_COLORS[status].split(" ")[0] : "bg-slate-300"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== Tenants by Plan ===== */}
        <div className="bg-white rounded-2xl border p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Stores by Plan</h3>
          <div className="space-y-3">
            {Object.entries(s.tenants_by_plan).length === 0 && (
              <p className="text-sm text-slate-400">No stores yet.</p>
            )}
            {Object.entries(s.tenants_by_plan).map(([plan, count]) => {
              const pct = s.tenant_count > 0 ? (count / s.tenant_count) * 100 : 0;
              return (
                <div key={plan}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm capitalize text-slate-600 flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_COLORS[plan] || "bg-slate-100 text-slate-600"}`}>
                        {plan}
                      </span>
                    </span>
                    <span className="font-semibold text-slate-900">{count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== Top Tenants by Revenue ===== */}
      <div className="bg-white rounded-2xl border p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Top Stores by Revenue</h3>
          <Link to="/tenants" className="text-sm text-brand hover:underline inline-flex items-center gap-1">View all <ArrowRight className="w-3.5 h-3.5" /></Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500 text-left border-b">
              <tr>
                <th className="pb-2 pr-4 font-medium">Store</th>
                <th className="pb-2 pr-4 font-medium">Plan</th>
                <th className="pb-2 pr-4 font-medium text-right">Products</th>
                <th className="pb-2 pr-4 font-medium text-right">Orders</th>
                <th className="pb-2 pr-4 font-medium text-right">Customers</th>
                <th className="pb-2 font-medium text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {s.top_tenants.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">No stores yet.</td>
                </tr>
              )}
              {s.top_tenants.map((t) => (
                <tr key={t.tenant_id} className="hover:bg-slate-50">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{t.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{t.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PLAN_COLORS[t.plan] || "bg-slate-100 text-slate-600"}`}>
                      {t.plan}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right text-slate-600">{t.products}</td>
                  <td className="py-3 pr-4 text-right text-slate-600">{t.orders}</td>
                  <td className="py-3 pr-4 text-right text-slate-600">{t.customers}</td>
                  <td className="py-3 text-right font-semibold text-slate-900">
                    ${t.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Recent Orders (cross-tenant) ===== */}
      <div className="bg-white rounded-2xl border p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Recent Orders (All Stores)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500 text-left border-b">
              <tr>
                <th className="pb-2 pr-4 font-medium">Order ID</th>
                <th className="pb-2 pr-4 font-medium">Store</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium text-right">Total</th>
                <th className="pb-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {s.recent_orders.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">No orders yet.</td>
                </tr>
              )}
              {s.recent_orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="py-3 pr-4 font-mono text-xs text-slate-500">{o.id.slice(0, 8)}</td>
                  <td className="py-3 pr-4">
                    <div className="font-medium text-slate-900">{o.tenant_name}</div>
                    <div className="text-xs text-slate-400 font-mono">{o.tenant_slug}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[o.status] || "bg-slate-100 text-slate-600"}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right font-semibold text-slate-900">
                    {o.currency} {o.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 text-xs text-slate-500">
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, icon, color, sub }: { label: string; value: string | number; icon: React.ReactNode; color: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border p-5">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        {icon}
      </div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl border p-4 flex items-center justify-between">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
