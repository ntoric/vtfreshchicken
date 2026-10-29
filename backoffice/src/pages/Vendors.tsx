import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { Pagination } from "@/components/Pagination";
import { useConfirmState, ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import type { Vendor } from "@/types";

const inp = "w-full border rounded-lg px-3 py-2 text-sm";

export function Vendors() {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const confirmDlg = useConfirmState();
  const toast = useToast();
  const [page, setPage] = useState(0);
  const limit = 10;
  const q = useQuery({ queryKey: ["vendors", tenant, page], queryFn: () => api.listVendors(tenant, { limit, offset: page * limit }), enabled: !!tenant });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState({
    name: "", slug: "", email: "", phone: "", address: "", contact_person: "", commission_rate: 0, status: "active", notes: "",
  });

  const create = useMutation({
    mutationFn: () => api.createVendor(tenant, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendors", tenant] }); resetForm(); },
  });

  const update = useMutation({
    mutationFn: () => api.updateVendor(tenant, editing!.id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendors", tenant] }); resetForm(); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteVendor(tenant, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendors", tenant] }); toast.success("Deleted", "Vendor has been deleted."); },
    onError: (e) => toast.error("Delete failed", (e as Error).message),
  });

  function resetForm() {
    setShowForm(false);
    setEditing(null);
    setForm({ name: "", slug: "", email: "", phone: "", address: "", contact_person: "", commission_rate: 0, status: "active", notes: "" });
  }

  function startEdit(v: Vendor) {
    setEditing(v);
    setForm({
      name: v.name, slug: v.slug, email: v.email || "", phone: v.phone || "",
      address: v.address || "", contact_person: v.contact_person || "",
      commission_rate: v.commission_rate || 0, status: v.status, notes: v.notes || "",
    });
    setShowForm(true);
  }

  const vendors = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <PageHeader
        title="Vendors"
        subtitle={`${total} vendors`}
        action={
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark"
          >
            + New Vendor
          </button>
        }
      />

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold">{editing ? "Edit Vendor" : "Create Vendor"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-neutral-700">Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || e.target.value.toLowerCase().replace(/\s+/g, "-") })} className={inp + " mt-1"} />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700">Slug</label>
                <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className={inp + " mt-1"} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-neutral-700">Contact Person</label>
                <input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className={inp + " mt-1"} />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp + " mt-1"} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-neutral-700">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inp + " mt-1"} />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700">Commission (%)</label>
                <input type="number" step="0.01" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: Number(e.target.value) })} className={inp + " mt-1"} />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inp + " mt-1"}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700">Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inp + " mt-1"} />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inp + " mt-1"} />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => editing ? update.mutate() : create.mutate()}
                disabled={!form.name || !form.slug}
                className="bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50"
              >
                {editing ? "Save" : "Create"}
              </button>
              <button onClick={resetForm} className="border px-3 py-1.5 rounded-md text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {q.isLoading ? (
        <TableSkeleton cols={6} rows={5} />
      ) : (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Commission</th>
                <th className="px-4 py-3 font-medium">Products</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {vendors.map((v) => (
                <tr key={v.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{v.name}</div>
                    <div className="text-xs text-neutral-400 font-mono">{v.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500">
                    {v.contact_person && <div>{v.contact_person}</div>}
                    {v.email && <div>{v.email}</div>}
                    {v.phone && <div>{v.phone}</div>}
                  </td>
                  <td className="px-4 py-3">{v.commission_rate}%</td>
                  <td className="px-4 py-3">{v.product_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={v.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => startEdit(v)} className="text-brand hover:underline">Edit</button>
                      <button
                        onClick={() => confirmDlg.open({ message: `Delete vendor "${v.name}"? Products will be unlinked.`, variant: "danger", confirmLabel: "Delete", onConfirm: () => remove.mutate(v.id) })}
                        className="text-rose-500 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {vendors.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-400">No vendors yet. Create one to get started.</td></tr>
              )}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} total={total} start={page * limit} end={Math.min((page + 1) * limit, total)} onPage={setPage} />
        </div>
      )}
      <ConfirmDialog {...confirmDlg.props} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700",
    inactive: "bg-neutral-100 text-neutral-600",
    suspended: "bg-rose-100 text-rose-700",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colors[status] || colors.inactive}`}>{status}</span>;
}
