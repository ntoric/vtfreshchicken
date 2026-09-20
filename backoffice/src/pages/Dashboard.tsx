import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { Package, Receipt, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { DashboardSkeleton } from "@/components/Skeletons";

export function Dashboard() {
  const { tenant, user } = useAuth();
  const isSuperAdmin = user?.role === "superadmin";

  // Superadmins land on the platform dashboard by default
  if (isSuperAdmin) {
    return <Navigate to="/platform-dashboard" replace />;
  }

  const statsQ = useQuery({
    queryKey: ["dashboard", tenant],
    queryFn: () => api.dashboardStats(tenant),
  });

  const stats = statsQ.data;
  const statusCounts = stats?.orders_by_status || {};

  return (
    <div>
      <PageHeader
        title="Dashboard"
      />

      {statsQ.isLoading ? (
        <DashboardSkeleton />
      ) : statsQ.error ? (
        <div className="bg-rose-50 text-rose-600 rounded-xl p-4">
          Failed to load dashboard. Make sure the backend is running and you have admin access.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            <StatCard label="Total Products" value={stats?.products ?? 0} icon={<Package className="w-6 h-6" />} color="bg-blue-50 text-blue-600" />
            <StatCard label="Total Orders" value={stats?.orders ?? 0} icon={<Receipt className="w-6 h-6" />} color="bg-emerald-50 text-emerald-600" />
            <StatCard label="Revenue" value={`$${(stats?.revenue ?? 0).toFixed(2)}`} icon={<Wallet className="w-6 h-6" />} color="bg-amber-50 text-amber-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Orders by Status</h3>
              <div className="space-y-3">
                {Object.entries(statusCounts).length === 0 && (
                  <p className="text-sm text-slate-400">No orders yet.</p>
                )}
                {Object.entries(statusCounts).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm capitalize text-slate-600">{status}</span>
                    <span className="font-semibold text-slate-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Recent Orders</h3>
              <div className="space-y-3">
                {(!stats?.recent_orders || stats.recent_orders.length === 0) && (
                  <p className="text-sm text-slate-400">No recent orders.</p>
                )}
                {stats?.recent_orders?.map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-slate-500">{o.id.slice(0, 8)}</span>
                    <span className="capitalize text-slate-600">{o.status}</span>
                    <span className="font-semibold">${o.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
