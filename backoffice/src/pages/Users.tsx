import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Download, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api, generateIdempotencyKey } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { usePagination, Pagination } from "@/components/Pagination";
import { useConfirmState, ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { ActionMenu } from "@/components/ActionMenu";
import { ExportDialog } from "@/components/ExportDialog";
import type { User, UserRole } from "@/types";

const inp = "w-full border rounded-lg px-3 py-2 text-sm";

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  business_admin: "Business Admin",
  branch_manager: "Branch Manager",
  staff: "Staff",
  customer: "Customer",
};

export function Users() {
  const { tenant, user: currentUser } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["users", tenant], queryFn: () => api.listUsers(tenant) });
  const statsQ = useQuery({ queryKey: ["user-stats", tenant], queryFn: () => api.userStats(tenant) });
  const branchesQ = useQuery({ queryKey: ["branches", tenant], queryFn: () => api.listBranches(tenant) });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", password: "", role: "staff", branch_id: "" });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [exportOpen, setExportOpen] = useState(false);

  const canManage = currentUser?.role === "superadmin" || currentUser?.role === "business_admin";

  const createIdemKeyRef = useRef("");
  const create = useMutation({
    mutationFn: () => {
      if (!createIdemKeyRef.current) createIdemKeyRef.current = generateIdempotencyKey();
      return api.createStaff(tenant, form, createIdemKeyRef.current);
    },
    onSuccess: () => {
      createIdemKeyRef.current = "";
      qc.invalidateQueries({ queryKey: ["users", tenant] });
      qc.invalidateQueries({ queryKey: ["user-stats", tenant] });
      setShowForm(false);
      setForm({ email: "", full_name: "", password: "", role: "staff", branch_id: "" });
    },
  });

  const allUsers = q.data?.items ?? [];
  const filtered = allUsers.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!u.email.toLowerCase().includes(s) && !u.full_name.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const pg = usePagination(filtered, 10);

  if (selectedUser) {
    return <UserDetail user={selectedUser} onBack={() => setSelectedUser(null)} />;
  }

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        subtitle={`${q.data?.items.length ?? 0} users`}
        action={canManage ? (
          <div className="flex items-center gap-2">
            <button onClick={() => setExportOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition">
              <Download className="w-4 h-4" /> Export
            </button>
            <button onClick={() => setShowForm((s) => !s)} className="bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark">
              + Add User
            </button>
          </div>
        ) : undefined}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard label="Total" value={statsQ.data?.total ?? "—"} />
        <StatCard label="Customers" value={statsQ.data?.customers ?? "—"} />
        <StatCard label="Staff" value={statsQ.data?.staff ?? "—"} />
        <StatCard label="Admins" value={statsQ.data?.admins ?? "—"} />
        <StatCard label="Active" value={statsQ.data?.active ?? "—"} />
        <StatCard label="Inactive" value={statsQ.data?.inactive ?? "—"} />
      </div>

      {showForm && canManage && (
        <div className="bg-white rounded-2xl border p-6 mb-6 space-y-4">
          <h3 className="font-semibold">Add Staff / Admin</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inp} />
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input type="password" placeholder="Password (min 6 chars)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inp} />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inp}>
              <option value="staff">Staff</option>
              <option value="branch_manager">Branch Manager</option>
              <option value="business_admin">Business Admin</option>
            </select>
          </div>
          {(form.role === "staff" || form.role === "branch_manager") && (
            <select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })} className={inp}>
              <option value="">No branch (store-wide)</option>
              {(branchesQ.data?.items ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <button onClick={() => create.mutate()} disabled={!form.email || !form.full_name || form.password.length < 6 || create.isPending} className="inline-flex items-center gap-2 bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50">
            {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Create
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className={inp + " max-w-xs"} />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={inp + " max-w-[180px]"}>
          <option value="">All roles</option>
          <option value="business_admin">Business Admin</option>
          <option value="branch_manager">Branch Manager</option>
          <option value="staff">Staff</option>
          <option value="customer">Customer</option>
        </select>
      </div>

      {q.isLoading ? (
        <TableSkeleton cols={6} rows={5} />
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
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pg.pageItems.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedUser(u)}>
                  <td className="px-4 py-3 font-medium text-slate-900">{u.full_name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Active</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Disabled</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedUser(u); }} className="text-brand hover:underline text-xs inline-flex items-center gap-0.5">
                      Manage <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No users found.</td></tr>
              )}
            </tbody>
          </table>
          <Pagination page={pg.page} totalPages={pg.totalPages} total={pg.total} start={pg.start} end={pg.end} onPage={pg.setPage} />
        </div>
      )}
      <ExportDialog
        open={exportOpen}
        type="users"
        title="Users & Staff"
        filters={{}}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}

function UserDetail({ user, onBack }: { user: User; onBack: () => void }) {
  const { tenant, user: currentUser } = useAuth();
  const qc = useQueryClient();
  const confirmDlg = useConfirmState();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [showPwdReset, setShowPwdReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [editForm, setEditForm] = useState({
    full_name: user.full_name,
    phone: user.phone || "",
    role: user.role,
    admin_notes: user.admin_notes || "",
    is_active: user.is_active,
    branch_id: user.branch_id || "",
  });
  const branchesQ = useQuery({ queryKey: ["branches", tenant], queryFn: () => api.listBranches(tenant) });

  const canManage = currentUser?.role === "superadmin" || currentUser?.role === "business_admin";
  const isSelf = currentUser?.id === user.id;

  const update = useMutation({
    mutationFn: () => api.updateUser(tenant, user.id, editForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", tenant] });
      qc.invalidateQueries({ queryKey: ["user-stats", tenant] });
      setEditing(false);
    },
  });

  const toggleActive = useMutation({
    mutationFn: () => api.setUserActive(tenant, user.id, !user.is_active),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", tenant] });
      qc.invalidateQueries({ queryKey: ["user-stats", tenant] });
      toast.success(user.is_active ? "Disabled" : "Enabled", user.is_active ? "User has been disabled." : "User has been enabled.");
    },
    onError: (e) => toast.error("Action failed", (e as Error).message),
  });

  const resetPwd = useMutation({
    mutationFn: () => api.resetUserPassword(tenant, user.id, newPassword),
    onSuccess: () => { setShowPwdReset(false); setNewPassword(""); },
  });

  const remove = useMutation({
    mutationFn: () => api.deleteUser(tenant, user.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users", tenant] }); qc.invalidateQueries({ queryKey: ["user-stats", tenant] }); toast.success("Deleted", "User has been deleted."); onBack(); },
    onError: (e) => toast.error("Delete failed", (e as Error).message),
  });

  return (
    <div>
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-900 mb-4 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Back to users</button>
      <PageHeader
        title={user.full_name}
        subtitle={user.email}
        action={canManage && !isSelf ? (
          <div className="flex gap-2">
            <button onClick={() => setEditing(!editing)} className="border px-3 py-1.5 rounded-md text-sm font-medium hover:bg-slate-50">
              {editing ? "Cancel" : "Edit"}
            </button>
            <button
              onClick={() => confirmDlg.open({ message: user.is_active ? `Disable user "${user.full_name}"? They will no longer be able to log in.` : `Enable user "${user.full_name}"?`, variant: "warning", confirmLabel: user.is_active ? "Disable" : "Enable", onConfirm: () => toggleActive.mutate() })}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${user.is_active ? "bg-rose-50 text-rose-600 hover:bg-rose-100" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"}`}
            >
              {user.is_active ? "Disable" : "Enable"}
            </button>
          </div>
        ) : undefined}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Role" value={ROLE_LABELS[user.role] || user.role} />
        <StatCard label="Status" value={user.is_active ? "Active" : "Disabled"} />
        <StatCard label="Last Login" value={user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : "Never"} />
        <StatCard label="Joined" value={new Date(user.created_at).toLocaleDateString()} />
      </div>

      {editing && canManage && !isSelf ? (
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <h3 className="font-semibold">Edit User</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name">
              <input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} className={inp} />
            </Field>
            <Field label="Phone">
              <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className={inp} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Role">
              <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })} className={inp}>
                <option value="customer">Customer</option>
                <option value="staff">Staff</option>
                <option value="branch_manager">Branch Manager</option>
                <option value="business_admin">Business Admin</option>
              </select>
            </Field>
            <Field label="Branch">
              <select value={editForm.branch_id} onChange={(e) => setEditForm({ ...editForm, branch_id: e.target.value })} className={inp}>
                <option value="">No branch (store-wide)</option>
                {(branchesQ.data?.items ?? []).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Active">
              <select value={editForm.is_active ? "true" : "false"} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === "true" })} className={inp}>
                <option value="true">Active</option>
                <option value="false">Disabled</option>
              </select>
            </Field>
          </div>
          <Field label="Admin Notes">
            <textarea value={editForm.admin_notes} onChange={(e) => setEditForm({ ...editForm, admin_notes: e.target.value })} rows={3} className={inp} />
          </Field>
          <button onClick={() => update.mutate()} disabled={update.isPending} className="inline-flex items-center gap-2 bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50">
            {update.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {update.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border p-6 space-y-3">
          <h3 className="font-semibold">User Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <DetailRow label="Email" value={user.email} />
            <DetailRow label="Phone" value={user.phone || "—"} />
            <DetailRow label="Role" value={ROLE_LABELS[user.role] || user.role} />
            <DetailRow label="Branch" value={user.branch_name || "—"} />
            <DetailRow label="Status" value={user.is_active ? "Active" : "Disabled"} />
            <DetailRow label="Admin Notes" value={user.admin_notes || "—"} />
            <DetailRow label="Marketing Consent" value={user.marketing_consent ? "Yes" : "No"} />
          </div>
        </div>
      )}

      {/* Password Reset & Delete (admin only, not self) */}
      {canManage && !isSelf && !editing && (
        <div className="bg-white rounded-2xl border p-6 mt-4 space-y-4">
          <h3 className="font-semibold text-rose-600">Danger Zone</h3>

          {!showPwdReset ? (
            <button onClick={() => setShowPwdReset(true)} className="border border-amber-300 text-amber-700 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-amber-50">
              Reset Password
            </button>
          ) : (
            <div className="space-y-3">
              <Field label="New Password (min 6 chars)">
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inp + " max-w-sm"} placeholder="Enter new password" />
              </Field>
              <div className="flex gap-2">
                <button
                  onClick={() => resetPwd.mutate()}
                  disabled={newPassword.length < 6 || resetPwd.isPending}
                  className="inline-flex items-center gap-2 bg-amber-600 text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50"
                >
                  {resetPwd.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {resetPwd.isPending ? "Resetting…" : "Confirm Reset"}
                </button>
                <button onClick={() => { setShowPwdReset(false); setNewPassword(""); }} className="border px-3 py-1.5 rounded-md text-sm">Cancel</button>
              </div>
            </div>
          )}

          <div className="pt-4 border-t">
            <button
              onClick={() => confirmDlg.open({ message: `Delete user "${user.full_name}"? This cannot be undone.`, variant: "danger", confirmLabel: "Delete", onConfirm: () => remove.mutate() })}
              className="border border-rose-300 text-rose-700 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-rose-50"
            >
              Delete User
            </button>
          </div>
        </div>
      )}
      <ConfirmDialog {...confirmDlg.props} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl border p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold mt-1 text-slate-900">{value}</p>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    superadmin: "bg-purple-100 text-purple-700",
    business_admin: "bg-blue-100 text-blue-700",
    staff: "bg-slate-100 text-slate-600",
    customer: "bg-emerald-50 text-emerald-600",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[role] || colors.staff}`}>{ROLE_LABELS[role] || role}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-sm font-medium text-slate-700">{label}</label><div className="mt-1">{children}</div></div>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-medium text-slate-900">{value}</p>
    </div>
  );
}
