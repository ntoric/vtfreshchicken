import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Crown, Building2, UserCircle, ShoppingBag, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { usePagination, Pagination } from "@/components/Pagination";
import type { User, UserRole } from "@/types";

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  business_admin: "Business Admin",
  staff: "Staff",
  customer: "Customer",
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  superadmin: "bg-purple-100 text-purple-700",
  business_admin: "bg-blue-100 text-blue-700",
  staff: "bg-emerald-100 text-emerald-700",
  customer: "bg-slate-100 text-slate-600",
};

export function PlatformUsers() {
  const q = useQuery({
    queryKey: ["platform-users"],
    queryFn: () => api.listAllUsers(),
  });

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");

  const allUsers = q.data?.items ?? [];

  // Compute stats
  const stats = {
    total: allUsers.length,
    superadmins: allUsers.filter((u) => u.role === "superadmin").length,
    admins: allUsers.filter((u) => u.role === "business_admin").length,
    staff: allUsers.filter((u) => u.role === "staff").length,
    customers: allUsers.filter((u) => u.role === "customer").length,
    active: allUsers.filter((u) => u.is_active).length,
  };

  const filtered = allUsers.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!u.email.toLowerCase().includes(s) && !u.full_name.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const pg = usePagination(filtered, 15);

  return (
    <div>
      <PageHeader
        title="Platform Users & Roles"
        subtitle="All users across all stores"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard label="Total Users" value={stats.total} icon={<Users className="w-5 h-5" />} color="bg-indigo-50 text-indigo-600" />
        <StatCard label="Super Admins" value={stats.superadmins} icon={<Crown className="w-5 h-5" />} color="bg-purple-50 text-purple-600" />
        <StatCard label="Business Admins" value={stats.admins} icon={<Building2 className="w-5 h-5" />} color="bg-blue-50 text-blue-600" />
        <StatCard label="Staff" value={stats.staff} icon={<UserCircle className="w-5 h-5" />} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Customers" value={stats.customers} icon={<ShoppingBag className="w-5 h-5" />} color="bg-amber-50 text-amber-600" />
        <StatCard label="Active" value={stats.active} icon={<CheckCircle2 className="w-5 h-5" />} color="bg-pink-50 text-pink-600" />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs border rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm max-w-[180px]"
        >
          <option value="">All roles</option>
          <option value="superadmin">Super Admin</option>
          <option value="business_admin">Business Admin</option>
          <option value="staff">Staff</option>
          <option value="customer">Customer</option>
        </select>
      </div>

      {q.isLoading ? (
        <TableSkeleton cols={6} rows={8} />
      ) : q.error ? (
        <div className="bg-rose-50 text-rose-600 rounded-xl p-4">
          Failed to load users. {(q.error as Error).message}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last Login</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pg.pageItems.map((u: User) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.full_name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE_COLORS[u.role] || "bg-slate-100 text-slate-600"}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Active</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700">Disabled</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={pg.page} totalPages={pg.totalPages} total={pg.total} start={pg.start} end={pg.end} onPage={pg.setPage} />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-2xl border p-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${color}`}>
        {icon}
      </div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
