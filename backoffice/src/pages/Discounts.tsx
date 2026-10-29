import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { Pagination } from "@/components/Pagination";
import { useConfirmState, ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Toggle } from "@/components/Toggle";
import { ActionMenu } from "@/components/ActionMenu";
import { ReportFilters, type ReportFiltersValue } from "@/components/ReportFilters";
import { ExportDialog } from "@/components/ExportDialog";
import type { DiscountCode } from "@/types";

interface DiscountForm {
  code: string;
  description: string;
  discount_type: string;
  value: number;
  min_subtotal: number;
  max_uses: number | "";
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

const emptyForm: DiscountForm = {
  code: "", description: "", discount_type: "percentage", value: 10,
  min_subtotal: 0, max_uses: "", starts_at: "", ends_at: "", is_active: true,
};

function toRFC3339(s: string): string | undefined {
  if (!s) return undefined;
  // datetime-local format: "2024-01-15T12:30" → RFC3339
  return s.length === 16 ? s + ":00" : s;
}

function fromISO(s?: string): string {
  if (!s) return "";
  return s.slice(0, 16);
}

export function Discounts() {
  const { tenant } = useAuth();
  const { formatMoney, currency } = useCurrency();
  const qc = useQueryClient();
  const confirmDlg = useConfirmState();
  const toast = useToast();
  const [filters, setFilters] = useState<ReportFiltersValue>({});
  const [exportOpen, setExportOpen] = useState(false);
  const [page, setPage] = useState(0);
  const limit = 10;
  const q = useQuery({
    queryKey: ["discounts", tenant, filters.search, filters.status, filters.type, filters.validity, page],
    queryFn: () => api.listDiscounts(tenant, { search: filters.search, status: filters.status, type: filters.type, validity: filters.validity, limit, offset: page * limit }),
  });
  const filtered = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const statsQ = useQuery({ queryKey: ["discount-stats", tenant], queryFn: () => api.discountStats(tenant) });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DiscountForm>(emptyForm);

  const create = useMutation({
    mutationFn: () => api.createDiscount(tenant, {
      ...form,
      max_uses: form.max_uses === "" ? null : Number(form.max_uses),
      starts_at: toRFC3339(form.starts_at),
      ends_at: toRFC3339(form.ends_at),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discounts", tenant] });
      qc.invalidateQueries({ queryKey: ["discount-stats", tenant] });
      setShowForm(false);
      setForm(emptyForm);
    },
  });

  const update = useMutation({
    mutationFn: () => api.updateDiscount(tenant, editingId!, {
      ...form,
      max_uses: form.max_uses === "" ? null : Number(form.max_uses),
      starts_at: toRFC3339(form.starts_at),
      ends_at: toRFC3339(form.ends_at),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discounts", tenant] });
      qc.invalidateQueries({ queryKey: ["discount-stats", tenant] });
      setEditingId(null);
      setShowForm(false);
      setForm(emptyForm);
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteDiscount(tenant, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discounts", tenant] });
      qc.invalidateQueries({ queryKey: ["discount-stats", tenant] });
      toast.success("Deleted", "Discount code has been deleted.");
    },
    onError: (e) => toast.error("Delete failed", (e as Error).message),
  });

  function startEdit(d: DiscountCode) {
    setEditingId(d.id);
    setShowForm(true);
    setForm({
      code: d.code,
      description: d.description || "",
      discount_type: d.discount_type,
      value: d.value,
      min_subtotal: d.min_subtotal,
      max_uses: d.max_uses ?? "",
      starts_at: fromISO(d.starts_at),
      ends_at: fromISO(d.ends_at),
      is_active: d.is_active,
    });
  }

  function startCreate() {
    setEditingId(null);
    setShowForm(true);
    setForm(emptyForm);
  }

  const stats = statsQ.data;

  return (
    <div>
      <PageHeader
        title="Discount Codes"
        subtitle={`${q.data?.items.length ?? 0} codes`}
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => setExportOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition">
              <Download className="w-4 h-4" /> Export
            </button>
            <button onClick={startCreate} className="bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark">+ New Code</button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Codes" value={stats?.total_codes ?? "—"} />
        <StatCard label="Active" value={stats?.active_codes ?? "—"} />
        <StatCard label="Redemptions" value={stats?.total_redemptions ?? "—"} />
        <StatCard label="Total Discount" value={stats ? formatMoney(stats.total_discount) : "—"} />
      </div>

      <ReportFilters
        value={filters}
        onChange={(v) => { setFilters(v); setPage(0); }}
        search
        searchPlaceholder="Search code, description…"
        selects={[
          { key: "status", label: "Status", options: [
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ] },
          { key: "type", label: "Type", options: [
            { value: "percentage", label: "Percentage" },
            { value: "fixed", label: "Fixed" },
          ] },
          { key: "validity", label: "Validity", options: [
            { value: "current", label: "Current" },
            { value: "upcoming", label: "Upcoming" },
            { value: "expired", label: "Expired" },
          ] },
        ]}
      />

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-neutral-900">{editingId ? "Edit Discount Code" : "New Discount Code"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input placeholder="Code (e.g. WELCOME10)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className={inp} />
              <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inp} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className={inp}>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed ({currency.code})</option>
              </select>
              <input type="number" step="0.01" placeholder="Value" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className={inp} />
              <input type="number" step="0.01" placeholder="Min subtotal" value={form.min_subtotal} onChange={(e) => setForm({ ...form, min_subtotal: Number(e.target.value) })} className={inp} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <input type="number" placeholder="Max uses (blank = unlimited)" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value === "" ? "" : Number(e.target.value) })} className={inp} />
              <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className={inp} title="Start date" />
              <input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} className={inp} title="End date" />
            </div>
            <Toggle
              checked={form.is_active}
              onChange={(val) => setForm({ ...form, is_active: val })}
              label="Active"
            />
            <div className="flex gap-2">
              <button
                onClick={() => editingId ? update.mutate() : create.mutate()}
                disabled={!form.code || create.isPending || update.isPending}
                className="inline-flex items-center gap-2 bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50"
              >
                {(editingId ? update.isPending : create.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? (update.isPending ? "Saving…" : "Save") : (create.isPending ? "Creating…" : "Create")}
              </button>
              <button onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {q.isLoading ? (
        <TableSkeleton cols={7} rows={5} />
      ) : (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Value</th>
                <th className="px-4 py-3 font-medium">Min Subtotal</th>
                <th className="px-4 py-3 font-medium">Used</th>
                <th className="px-4 py-3 font-medium">Validity</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <p className="font-mono font-medium text-brand">{d.code}</p>
                    {d.description && <p className="text-xs text-neutral-400">{d.description}</p>}
                  </td>
                  <td className="px-4 py-3 capitalize">{d.discount_type}</td>
                  <td className="px-4 py-3">{d.discount_type === "percentage" ? `${d.value}%` : formatMoney(d.value)}</td>
                  <td className="px-4 py-3 text-neutral-500">{formatMoney(d.min_subtotal)}</td>
                  <td className="px-4 py-3">{d.used_count}{d.max_uses ? ` / ${d.max_uses}` : " / Unlimited"}</td>
                  <td className="px-4 py-3 text-xs text-neutral-400">
                    {d.starts_at && <p>From: {new Date(d.starts_at).toLocaleDateString()}</p>}
                    {d.ends_at && <p>Until: {new Date(d.ends_at).toLocaleDateString()}</p>}
                    {!d.starts_at && !d.ends_at && <span>No limit</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.is_active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                      {d.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ActionMenu
                      items={[
                        { label: "Edit", onClick: () => startEdit(d) },
                        { label: "Delete", variant: "danger", onClick: () => confirmDlg.open({ message: `Delete ${d.code}?`, variant: "danger", confirmLabel: "Delete", onConfirm: () => del.mutate(d.id) }) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
              {q.data && q.data.items.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-neutral-400">No discount codes yet.</td></tr>
              )}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} total={total} start={page * limit} end={Math.min((page + 1) * limit, total)} onPage={setPage} />
        </div>
      )}
      <ConfirmDialog {...confirmDlg.props} />
      <ExportDialog
        open={exportOpen}
        type="discounts"
        title="Discount Codes"
        filters={{}}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl border p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-2xl font-semibold text-neutral-900 mt-1">{value}</p>
    </div>
  );
}

const inp = "w-full border rounded-lg px-3 py-2 text-sm";
