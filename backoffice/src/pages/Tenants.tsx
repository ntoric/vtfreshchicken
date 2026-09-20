import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { usePagination, Pagination } from "@/components/Pagination";
import { useConfirmState, ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import type { Tenant, StoreStats } from "@/types";

const inp = "w-full border rounded-lg px-3 py-2 text-sm";

export function Tenants() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["tenants"], queryFn: () => api.listTenants() });
  const pg = usePagination(q.data?.items ?? [], 10);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ slug: "", name: "", description: "", admin_email: "", admin_name: "", admin_password: "" });
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const create = useMutation({
    mutationFn: () => api.createTenant(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenants"] }); setShowForm(false); setForm({ slug: "", name: "", description: "", admin_email: "", admin_name: "", admin_password: "" }); },
  });

  if (user?.role !== "superadmin") {
    return (
      <div>
        <PageHeader title="Store Management" />
        <div className="bg-white rounded-2xl border p-8 text-center text-slate-500">
          Only superadmins can manage stores.
        </div>
      </div>
    );
  }

  if (selectedTenant) {
    return <StoreDetail tenant={selectedTenant} onBack={() => setSelectedTenant(null)} />;
  }

  return (
    <div>
      <PageHeader
        title="Store Management"
        subtitle={`${q.data?.items.length ?? 0} stores`}
        action={<button onClick={() => setShowForm((s) => !s)} className="bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark">+ New Store</button>}
      />

      {showForm && (
        <div className="bg-white rounded-2xl border p-6 mb-6 space-y-4">
          <h3 className="font-semibold">Create Store + Business Admin</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input placeholder="Slug (e.g. acme)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className={inp} />
            <input placeholder="Store name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} />
          </div>
          <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inp} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input placeholder="Admin name" value={form.admin_name} onChange={(e) => setForm({ ...form, admin_name: e.target.value })} className={inp} />
            <input type="email" placeholder="Admin email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} className={inp} />
            <input type="password" placeholder="Admin password" value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} className={inp} />
          </div>
          <button onClick={() => create.mutate()} disabled={create.isPending} className="inline-flex items-center gap-2 bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50">
            {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Create
          </button>
        </div>
      )}

      {q.isLoading ? (
        <TableSkeleton cols={5} rows={5} />
      ) : (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Store</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pg.pageItems.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedTenant(t)}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{t.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{t.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 capitalize">{t.plan || "standard"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {t.is_active ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Active</span> : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700">Inactive</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {t.contact_email || "—"}
                    {t.city && <div>{t.city}{t.country ? `, ${t.country}` : ""}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <a href={`/t/${t.slug}`} target="_blank" rel="noreferrer" className="text-brand hover:underline text-xs inline-flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>Open <ArrowRight className="w-3 h-3" /></a>
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

function StoreDetail({ tenant, onBack }: { tenant: Tenant; onBack: () => void }) {
  const qc = useQueryClient();
  const confirmDlg = useConfirmState();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: tenant.name,
    description: tenant.description,
    contact_email: tenant.contact_email || "",
    contact_phone: tenant.contact_phone || "",
    country: tenant.country || "",
    city: tenant.city || "",
    address: tenant.address || "",
    plan: tenant.plan || "standard",
    commission_rate: tenant.commission_rate || 0,
  });

  const statsQ = useQuery({ queryKey: ["store-stats", tenant.id], queryFn: () => api.tenantStoreStats(tenant.id) });

  const update = useMutation({
    mutationFn: () => api.updateTenant(tenant.id, editForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenants"] }); setEditing(false); },
  });

  const toggleActive = useMutation({
    mutationFn: () => api.setTenantActive(tenant.id, !tenant.is_active),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      toast.success(tenant.is_active ? "Store deactivated" : "Store activated", tenant.is_active ? `${tenant.name} has been deactivated.` : `${tenant.name} has been activated.`);
    },
    onError: (e) => toast.error("Action failed", (e as Error).message),
  });

  return (
    <div>
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-900 mb-4 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Back to stores</button>
      <PageHeader
        title={tenant.name}
        subtitle={tenant.slug}
        action={
          <div className="flex gap-2">
            <button onClick={() => setEditing(!editing)} className="border px-3 py-1.5 rounded-md text-sm font-medium hover:bg-slate-50">
              {editing ? "Cancel" : "Edit"}
            </button>
            <button
              onClick={() => confirmDlg.open({
                message: tenant.is_active
                  ? `Deactivate store "${tenant.name}"? The store and its storefront will be disabled.`
                  : `Activate store "${tenant.name}"? The store will be back online.`,
                variant: tenant.is_active ? "warning" : "info",
                confirmLabel: tenant.is_active ? "Deactivate" : "Activate",
                onConfirm: () => toggleActive.mutate(),
              })}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${tenant.is_active ? "bg-rose-50 text-rose-600 hover:bg-rose-100" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"}`}
            >
              {tenant.is_active ? "Deactivate" : "Activate"}
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard label="Products" value={statsQ.data?.product_count ?? "—"} />
        <StatCard label="Orders" value={statsQ.data?.order_count ?? "—"} />
        <StatCard label="Customers" value={statsQ.data?.customer_count ?? "—"} />
        <StatCard label="Staff" value={statsQ.data?.staff_count ?? "—"} />
        <StatCard label="Vendors" value={statsQ.data?.vendor_count ?? "—"} />
        <StatCard label="Revenue" value={statsQ.data ? `$${statsQ.data.revenue.toFixed(0)}` : "—"} />
      </div>

      {editing ? (
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <h3 className="font-semibold">Edit Store</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name"><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={inp} /></Field>
            <Field label="Plan">
              <select value={editForm.plan} onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })} className={inp}>
                <option value="standard">Standard</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
                <option value="trial">Trial</option>
              </select>
            </Field>
          </div>
          <Field label="Description"><textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={2} className={inp} /></Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contact Email"><input value={editForm.contact_email} onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })} className={inp} /></Field>
            <Field label="Contact Phone"><input value={editForm.contact_phone} onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })} className={inp} /></Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Country"><input value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} className={inp} /></Field>
            <Field label="City"><input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className={inp} /></Field>
            <Field label="Commission Rate (%)"><input type="number" step="0.01" value={editForm.commission_rate} onChange={(e) => setEditForm({ ...editForm, commission_rate: Number(e.target.value) })} className={inp} /></Field>
          </div>
          <Field label="Address"><input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} className={inp} /></Field>
          <button onClick={() => update.mutate()} disabled={update.isPending} className="inline-flex items-center gap-2 bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50">
            {update.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {update.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border p-6 space-y-3">
          <h3 className="font-semibold">Store Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <DetailRow label="Status" value={tenant.is_active ? "Active" : "Inactive"} />
            <DetailRow label="Plan" value={tenant.plan || "standard"} />
            <DetailRow label="Description" value={tenant.description || "—"} />
            <DetailRow label="Commission Rate" value={`${tenant.commission_rate || 0}%`} />
            <DetailRow label="Contact Email" value={tenant.contact_email || "—"} />
            <DetailRow label="Contact Phone" value={tenant.contact_phone || "—"} />
            <DetailRow label="Country" value={tenant.country || "—"} />
            <DetailRow label="City" value={tenant.city || "—"} />
            <DetailRow label="Address" value={tenant.address || "—"} />
            <DetailRow label="Created" value={new Date(tenant.created_at).toLocaleDateString()} />
          </div>
          <div className="pt-3">
            <a href={`/t/${tenant.slug}`} target="_blank" rel="noreferrer" className="text-brand hover:underline text-sm inline-flex items-center gap-1">Open storefront <ArrowRight className="w-4 h-4" /></a>
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
      <p className="text-xl font-semibold mt-1 text-slate-900">{value}</p>
    </div>
  );
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
