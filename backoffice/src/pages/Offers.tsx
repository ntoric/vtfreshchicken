import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { usePagination, Pagination } from "@/components/Pagination";
import { useConfirmState, ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Toggle } from "@/components/Toggle";
import { ActionMenu } from "@/components/ActionMenu";
import { ReportFilters, type ReportFiltersValue } from "@/components/ReportFilters";
import { ExportDialog } from "@/components/ExportDialog";
import type { Offer, OfferTarget } from "@/types";

interface OfferForm {
  name: string;
  description: string;
  offer_type: string;
  value: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  target_type: "all" | "product" | "category";
  target_id: string;
}

const emptyForm: OfferForm = {
  name: "", description: "", offer_type: "percentage", value: 0,
  starts_at: "", ends_at: "", is_active: true,
  target_type: "all", target_id: "",
};

function toRFC3339(s: string): string | undefined {
  if (!s) return undefined;
  return s.length === 16 ? s + ":00" : s;
}

function fromISO(s?: string): string {
  if (!s) return "";
  return s.slice(0, 16);
}

export function Offers() {
  const { tenant } = useAuth();
  const { formatMoney, currency } = useCurrency();
  const qc = useQueryClient();
  const confirmDlg = useConfirmState();
  const toast = useToast();
  const q = useQuery({ queryKey: ["offers", tenant], queryFn: () => api.listOffers(tenant) });
  const productsQ = useQuery({ queryKey: ["products-admin", tenant], queryFn: () => api.listProductsAdmin(tenant) });
  const categoriesQ = useQuery({ queryKey: ["categories", tenant], queryFn: () => api.listCategories(tenant) });

  const [filters, setFilters] = useState<ReportFiltersValue>({});
  const [exportOpen, setExportOpen] = useState(false);
  const allOffers = q.data?.items ?? [];
  const filtered = allOffers.filter((o) => {
    if (filters.search) {
      const s = filters.search.toLowerCase();
      if (!o.name?.toLowerCase().includes(s) && !o.description?.toLowerCase().includes(s)) return false;
    }
    if (filters.status === "active" && !o.is_active) return false;
    if (filters.status === "inactive" && o.is_active) return false;
    if (filters.type && o.offer_type !== filters.type) return false;
    return true;
  });
  const pg = usePagination(filtered, 10);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<OfferForm>(emptyForm);

  const del = useMutation({
    mutationFn: (id: string) => api.deleteOffer(tenant, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["offers", tenant] }); toast.success("Deleted", "Offer has been deleted."); },
    onError: (e) => toast.error("Delete failed", (e as Error).message),
  });

  function buildTargets(): OfferTarget[] {
    if (form.target_type === "all") return [{ target_type: "all" }];
    if (!form.target_id) return [{ target_type: "all" }];
    return [{ target_type: form.target_type, target_id: form.target_id }];
  }

  const create = useMutation({
    mutationFn: () => api.createOffer(tenant, {
      name: form.name,
      description: form.description,
      offer_type: form.offer_type,
      value: form.value,
      starts_at: toRFC3339(form.starts_at),
      ends_at: toRFC3339(form.ends_at),
      is_active: form.is_active,
      targets: buildTargets(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offers", tenant] });
      setShowForm(false);
      setForm(emptyForm);
    },
  });

  const update = useMutation({
    mutationFn: () => api.updateOffer(tenant, editingId!, {
      name: form.name,
      description: form.description,
      offer_type: form.offer_type,
      value: form.value,
      starts_at: toRFC3339(form.starts_at),
      ends_at: toRFC3339(form.ends_at),
      is_active: form.is_active,
      targets: buildTargets(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offers", tenant] });
      setEditingId(null);
      setShowForm(false);
      setForm(emptyForm);
    },
  });

  function startEdit(o: Offer) {
    setEditingId(o.id);
    setShowForm(true);
    const t = o.targets?.[0];
    setForm({
      name: o.name,
      description: o.description || "",
      offer_type: o.offer_type,
      value: o.value,
      starts_at: fromISO(o.starts_at),
      ends_at: fromISO(o.ends_at),
      is_active: o.is_active,
      target_type: (t?.target_type as "all" | "product" | "category") || "all",
      target_id: t?.target_id || "",
    });
  }

  function startCreate() {
    setEditingId(null);
    setShowForm(true);
    setForm(emptyForm);
  }

  return (
    <div>
      <PageHeader
        title="Offers"
        subtitle={`${q.data?.items.length ?? 0} offers`}
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => setExportOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition">
              <Download className="w-4 h-4" /> Export
            </button>
            <button onClick={startCreate} className="bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark">+ New Offer</button>
          </div>
        }
      />

      <ReportFilters
        value={filters}
        onChange={setFilters}
        search
        searchPlaceholder="Search offers…"
        selects={[
          { key: "status", label: "Status", options: [
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ] },
          { key: "type", label: "Type", options: [
            { value: "percentage", label: "Percentage" },
            { value: "fixed", label: "Fixed" },
          ] },
        ]}
      />

      {showForm && (
        <div className="bg-white rounded-2xl border p-6 mb-6 space-y-4">
          <h3 className="font-semibold text-slate-900">{editingId ? "Edit Offer" : "New Offer"}</h3>
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} />
          <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inp} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select value={form.offer_type} onChange={(e) => setForm({ ...form, offer_type: e.target.value })} className={inp}>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed amount ({currency.code})</option>
            </select>
            <input type="number" step="0.01" placeholder="Value" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className={inp} />
          </div>
          {/* Target selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select value={form.target_type} onChange={(e) => setForm({ ...form, target_type: e.target.value as any, target_id: "" })} className={inp}>
              <option value="all">All products</option>
              <option value="product">Specific product</option>
              <option value="category">Specific category</option>
            </select>
            {form.target_type === "product" && (
              <select value={form.target_id} onChange={(e) => setForm({ ...form, target_id: e.target.value })} className={inp}>
                <option value="">Select product…</option>
                {productsQ.data?.items.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
            {form.target_type === "category" && (
              <select value={form.target_id} onChange={(e) => setForm({ ...form, target_id: e.target.value })} className={inp}>
                <option value="">Select category…</option>
                {categoriesQ.data?.items.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
          {/* Date pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className={inp} title="Start date (optional)" />
            <input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} className={inp} title="End date (optional)" />
          </div>
          <Toggle
            checked={form.is_active}
            onChange={(val) => setForm({ ...form, is_active: val })}
            label="Active"
          />
          <div className="flex gap-2">
            <button
              onClick={() => editingId ? update.mutate() : create.mutate()}
              disabled={!form.name || create.isPending || update.isPending}
              className="inline-flex items-center gap-2 bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50"
            >
              {(editingId ? update.isPending : create.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? (update.isPending ? "Saving…" : "Save") : (create.isPending ? "Creating…" : "Create")}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {q.isLoading ? (
        <TableSkeleton cols={6} rows={5} />
      ) : q.data && q.data.items.length > 0 ? (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Validity</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pg.pageItems.map((o) => {
                const target = o.targets?.[0];
                const targetLabel = !target || target.target_type === "all"
                  ? "All products"
                  : target.target_type === "product" ? "Specific product" : "Specific category";
                const hasDates = o.starts_at || o.ends_at;
                return (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{o.name}</div>
                      {o.description && <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{o.description}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-brand-light text-brand px-2.5 py-1 rounded-full text-xs font-bold">
                        {o.offer_type === "percentage" ? `${o.value}% off` : `${formatMoney(o.value)} off`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{targetLabel}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${o.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {o.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {hasDates ? (
                        <div>
                          {o.starts_at && <div>From: {new Date(o.starts_at).toLocaleDateString()}</div>}
                          {o.ends_at && <div>Until: {new Date(o.ends_at).toLocaleDateString()}</div>}
                        </div>
                      ) : (
                        <span className="text-slate-400">No restrictions</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ActionMenu
                        items={[
                          { label: "Edit", onClick: () => startEdit(o) },
                          { label: "Delete", onClick: () => confirmDlg.open({ message: `Delete ${o.name}?`, variant: "danger", confirmLabel: "Delete", onConfirm: () => del.mutate(o.id) }) },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border p-12 text-center text-slate-400 text-sm">
          No offers yet. Click "New Offer" to create one.
        </div>
      )}
      <Pagination page={pg.page} totalPages={pg.totalPages} total={pg.total} start={pg.start} end={pg.end} onPage={pg.setPage} />
      <ConfirmDialog {...confirmDlg.props} />
      <ExportDialog
        open={exportOpen}
        type="offers"
        title="Offers"
        filters={{}}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}

const inp = "w-full border rounded-lg px-3 py-2 text-sm";
