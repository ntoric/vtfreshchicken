import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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
import type { ShippingMethod, ShippingZone, ShippingRate, ShippingProvider, ProviderTestResult } from "@/types";
import { SUPPORTED_SHIPPING_PROVIDERS } from "@/types";

type Tab = "methods" | "zones" | "rates" | "providers";

export function Shipping() {
  const { tenant } = useAuth();
  const [tab, setTab] = useState<Tab>("methods");

  return (
    <div>
      <PageHeader title="Shipping Management" subtitle="Configure shipping methods, zones, rates, and carrier providers" />

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6">
        {([
          { key: "methods", label: "Shipping Methods" },
          { key: "zones", label: "Shipping Zones" },
          { key: "rates", label: "Shipping Rates" },
          { key: "providers", label: "Carrier Providers" },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              tab === t.key ? "bg-brand text-white" : "bg-white border text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "methods" && <ShippingMethodsTab tenant={tenant} />}
      {tab === "zones" && <ShippingZonesTab tenant={tenant} />}
      {tab === "rates" && <ShippingRatesTab tenant={tenant} />}
      {tab === "providers" && <ShippingProvidersTab tenant={tenant} />}
    </div>
  );
}

// ---------------- Shipping Methods ----------------

function ShippingMethodsTab({ tenant }: { tenant: string }) {
  const { formatMoney: fmt, currency, currencies } = useCurrency();
  const qc = useQueryClient();
  const confirmDlg = useConfirmState();
  const toast = useToast();
  const [page, setPage] = useState(0);
  const limit = 10;
  const q = useQuery({ queryKey: ["shipping-methods", tenant, page], queryFn: () => api.listShippingMethods(tenant, { limit, offset: page * limit }) });
  const rows = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ShippingMethod | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    base_rate: 0,
    weight_rate: 0,
    currency_code: currency.code,
    min_days: "",
    max_days: "",
    free_shipping_threshold: "",
    is_active: true,
    sort_order: 0,
  });

  const createMut = useMutation({
    mutationFn: () => api.createShippingMethod(tenant, {
      ...form,
      weight_rate: form.weight_rate,
      min_days: form.min_days ? parseInt(form.min_days) : undefined,
      max_days: form.max_days ? parseInt(form.max_days) : undefined,
      free_shipping_threshold: form.free_shipping_threshold ? parseFloat(form.free_shipping_threshold) : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shipping-methods", tenant] }); resetForm(); },
  });
  const updateMut = useMutation({
    mutationFn: () => api.updateShippingMethod(tenant, editing!.id, {
      ...form,
      weight_rate: form.weight_rate,
      min_days: form.min_days ? parseInt(form.min_days) : undefined,
      max_days: form.max_days ? parseInt(form.max_days) : undefined,
      free_shipping_threshold: form.free_shipping_threshold ? parseFloat(form.free_shipping_threshold) : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shipping-methods", tenant] }); resetForm(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteShippingMethod(tenant, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shipping-methods", tenant] }); toast.success("Deleted", "Shipping method has been deleted."); },
    onError: (e) => toast.error("Delete failed", (e as Error).message),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({ name: "", code: "", description: "", base_rate: 0, weight_rate: 0, currency_code: currency.code, min_days: "", max_days: "", free_shipping_threshold: "", is_active: true, sort_order: 0 });
  };

  const startEdit = (sm: ShippingMethod) => {
    setEditing(sm);
    setForm({
      name: sm.name,
      code: sm.code,
      description: sm.description || "",
      base_rate: sm.base_rate,
      weight_rate: sm.weight_rate || 0,
      currency_code: sm.currency_code || currency.code,
      min_days: sm.min_days?.toString() || "",
      max_days: sm.max_days?.toString() || "",
      free_shipping_threshold: sm.free_shipping_threshold?.toString() || "",
      is_active: sm.is_active,
      sort_order: sm.sort_order,
    });
    setShowForm(true);
  };

  const submit = () => {
    if (editing) updateMut.mutate();
    else createMut.mutate();
  };

  if (q.isLoading) return <TableSkeleton cols={5} rows={3} />;

  return (
    <div>
      <div className="mb-4">
        <button
          onClick={() => { if (editing) resetForm(); else setShowForm(s => !s); }}
          className="bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark"
        >
          {showForm ? "Cancel" : "+ New Shipping Method"}
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-neutral-800">{editing ? "Edit Shipping Method" : "New Shipping Method"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Standard Shipping" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Code *</label>
                <input type="text" value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                  placeholder="e.g., standard, express, overnight" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
                <p className="text-xs text-neutral-400 mt-1">Unique slug used in checkout</p>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-neutral-700 block mb-1">Description</label>
                <input type="text" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g., Standard delivery (3-5 business days)" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Base Rate *</label>
                <input type="number" step="0.01" value={form.base_rate} onChange={(e) => setForm(f => ({ ...f, base_rate: parseFloat(e.target.value) || 0 }))}
                  placeholder="e.g., 5.99" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
                <p className="text-xs text-neutral-400 mt-1">Default rate if no zone-specific rate applies</p>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Weight Rate (per kg)</label>
                <input type="number" step="0.01" min="0" value={form.weight_rate} onChange={(e) => setForm(f => ({ ...f, weight_rate: parseFloat(e.target.value) || 0 }))}
                  placeholder="e.g., 0.50" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
                <p className="text-xs text-neutral-400 mt-1">Additional rate per kg of total item weight (0 = flat rate)</p>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Currency</label>
                <select value={form.currency_code} onChange={(e) => setForm(f => ({ ...f, currency_code: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20">
                  {currencies.filter((c) => c.is_active).map((c) => (
                    <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.symbol})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Min Delivery Days</label>
                <input type="number" value={form.min_days} onChange={(e) => setForm(f => ({ ...f, min_days: e.target.value }))}
                  placeholder="e.g., 3" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Max Delivery Days</label>
                <input type="number" value={form.max_days} onChange={(e) => setForm(f => ({ ...f, max_days: e.target.value }))}
                  placeholder="e.g., 5" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Free Shipping Threshold</label>
                <input type="number" step="0.01" value={form.free_shipping_threshold} onChange={(e) => setForm(f => ({ ...f, free_shipping_threshold: e.target.value }))}
                  placeholder="e.g., 50 (leave blank = never free)" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
                <p className="text-xs text-neutral-400 mt-1">Free shipping when subtotal ≥ this amount</p>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Sort Order</label>
                <input type="number" value={form.sort_order} onChange={(e) => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                  placeholder="0" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
                <p className="text-xs text-neutral-400 mt-1">Lower numbers appear first</p>
              </div>
              <div className="flex items-end">
                <Toggle
                  checked={form.is_active}
                  onChange={(val) => setForm(f => ({ ...f, is_active: val }))}
                  label="Active"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={submit} disabled={!form.name || !form.code || createMut.isPending || updateMut.isPending}
                className="inline-flex items-center gap-2 bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark disabled:opacity-50">
                {(createMut.isPending || updateMut.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                {createMut.isPending || updateMut.isPending ? "Saving..." : editing ? "Update" : "Create"}
              </button>
              <button onClick={resetForm} className="border px-3 py-1.5 rounded-md text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {q.data && q.data.items.length > 0 ? (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Base Rate</th>
                <th className="px-4 py-3 font-medium">Weight Rate</th>
                <th className="px-4 py-3 font-medium">Delivery</th>
                <th className="px-4 py-3 font-medium">Free Shipping</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((sm) => (
                <tr key={sm.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-800">{sm.name}</td>
                  <td className="px-4 py-3 text-neutral-500 font-mono text-xs">{sm.code}</td>
                  <td className="px-4 py-3 text-neutral-600">{fmt(sm.base_rate, sm.currency_code)}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {sm.weight_rate ? `${fmt(sm.weight_rate, sm.currency_code)}/kg` : "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {sm.min_days && sm.max_days ? `${sm.min_days}-${sm.max_days} days` : "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {sm.free_shipping_threshold ? `≥ ${fmt(sm.free_shipping_threshold, sm.currency_code)}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sm.is_active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                      {sm.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionMenu
                      items={[
                        { label: "Edit", onClick: () => startEdit(sm) },
                        { label: "Delete", variant: "danger", onClick: () => confirmDlg.open({ message: `Delete shipping method "${sm.name}"?`, variant: "danger", confirmLabel: "Delete", onConfirm: () => deleteMut.mutate(sm.id) }) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} total={total} start={page * limit} end={Math.min((page + 1) * limit, total)} onPage={setPage} />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border p-12 text-center text-neutral-400 text-sm">No shipping methods yet.</div>
      )}
      <ConfirmDialog {...confirmDlg.props} />
    </div>
  );
}

// ---------------- Shipping Zones ----------------

function ShippingZonesTab({ tenant }: { tenant: string }) {
  const qc = useQueryClient();
  const confirmDlg = useConfirmState();
  const toast = useToast();
  const [page, setPage] = useState(0);
  const limit = 10;
  const q = useQuery({ queryKey: ["shipping-zones", tenant, page], queryFn: () => api.listShippingZones(tenant, { limit, offset: page * limit }) });
  const rows = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ShippingZone | null>(null);
  const [form, setForm] = useState({ name: "", country_code: "", state_code: "", city: "", postal_code_pattern: "", is_active: true });

  const createMut = useMutation({
    mutationFn: () => api.createShippingZone(tenant, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shipping-zones", tenant] }); resetForm(); },
  });
  const updateMut = useMutation({
    mutationFn: () => api.updateShippingZone(tenant, editing!.id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shipping-zones", tenant] }); resetForm(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteShippingZone(tenant, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shipping-zones", tenant] }); toast.success("Deleted", "Shipping zone has been deleted."); },
    onError: (e) => toast.error("Delete failed", (e as Error).message),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({ name: "", country_code: "", state_code: "", city: "", postal_code_pattern: "", is_active: true });
  };

  const startEdit = (sz: ShippingZone) => {
    setEditing(sz);
    setForm({
      name: sz.name,
      country_code: sz.country_code || "",
      state_code: sz.state_code || "",
      city: sz.city || "",
      postal_code_pattern: sz.postal_code_pattern || "",
      is_active: sz.is_active,
    });
    setShowForm(true);
  };

  const submit = () => {
    if (editing) updateMut.mutate();
    else createMut.mutate();
  };

  const zoneScope = (sz: ShippingZone) => {
    const parts = [];
    if (sz.country_code) parts.push(sz.country_code);
    if (sz.state_code) parts.push(sz.state_code);
    if (sz.city) parts.push(sz.city);
    if (sz.postal_code_pattern) parts.push(`postal: ${sz.postal_code_pattern}`);
    return parts.length > 0 ? parts.join(", ") : "Any (catch-all)";
  };

  if (q.isLoading) return <TableSkeleton cols={4} rows={3} />;

  return (
    <div>
      <div className="mb-4">
        <button
          onClick={() => { if (editing) resetForm(); else setShowForm(s => !s); }}
          className="bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark"
        >
          {showForm ? "Cancel" : "+ New Shipping Zone"}
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-neutral-800">{editing ? "Edit Shipping Zone" : "New Shipping Zone"}</h3>
            <p className="text-xs text-neutral-500">Leave country/state/city blank to create a catch-all zone that matches any address.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., US-California, Europe, Global" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Country Code</label>
                <input type="text" value={form.country_code} onChange={(e) => setForm(f => ({ ...f, country_code: e.target.value.toUpperCase() }))}
                  placeholder="e.g., US, GB, DE" maxLength={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">State/Province Code</label>
                <input type="text" value={form.state_code} onChange={(e) => setForm(f => ({ ...f, state_code: e.target.value.toUpperCase() }))}
                  placeholder="e.g., CA, NY, TX" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">City</label>
                <input type="text" value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="e.g., Los Angeles" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Postal Code Pattern</label>
                <input type="text" value={form.postal_code_pattern} onChange={(e) => setForm(f => ({ ...f, postal_code_pattern: e.target.value }))}
                  placeholder="e.g., 90% (SQL LIKE pattern)" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </div>
              <div className="flex items-end">
                <Toggle
                  checked={form.is_active}
                  onChange={(val) => setForm(f => ({ ...f, is_active: val }))}
                  label="Active"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={submit} disabled={!form.name || createMut.isPending || updateMut.isPending}
                className="inline-flex items-center gap-2 bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark disabled:opacity-50">
                {(createMut.isPending || updateMut.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                {createMut.isPending || updateMut.isPending ? "Saving..." : editing ? "Update" : "Create"}
              </button>
              <button onClick={resetForm} className="border px-3 py-1.5 rounded-md text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {q.data && q.data.items.length > 0 ? (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Scope</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((sz) => (
                <tr key={sz.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-800">{sz.name}</td>
                  <td className="px-4 py-3 text-neutral-600 font-mono text-xs">{zoneScope(sz)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sz.is_active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                      {sz.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionMenu
                      items={[
                        { label: "Edit", onClick: () => startEdit(sz) },
                        { label: "Delete", variant: "danger", onClick: () => confirmDlg.open({ message: `Delete shipping zone "${sz.name}"?`, variant: "danger", confirmLabel: "Delete", onConfirm: () => deleteMut.mutate(sz.id) }) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} total={total} start={page * limit} end={Math.min((page + 1) * limit, total)} onPage={setPage} />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border p-12 text-center text-neutral-400 text-sm">No shipping zones yet. Create a zone to define geographic shipping regions.</div>
      )}
      <ConfirmDialog {...confirmDlg.props} />
    </div>
  );
}

// ---------------- Shipping Rates ----------------

function ShippingRatesTab({ tenant }: { tenant: string }) {
  const { formatMoney: fmt } = useCurrency();
  const qc = useQueryClient();
  const confirmDlg = useConfirmState();
  const toast = useToast();
  const [page, setPage] = useState(0);
  const limit = 10;
  const ratesQ = useQuery({ queryKey: ["shipping-rates", tenant, page], queryFn: () => api.listShippingRates(tenant, { limit, offset: page * limit }) });
  const methodsQ = useQuery({ queryKey: ["shipping-methods", tenant], queryFn: () => api.listShippingMethods(tenant) });
  const zonesQ = useQuery({ queryKey: ["shipping-zones", tenant], queryFn: () => api.listShippingZones(tenant) });
  const rows = ratesQ.data?.items ?? [];
  const total = ratesQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ShippingRate | null>(null);
  const [form, setForm] = useState({
    shipping_method_id: "",
    shipping_zone_id: "",
    rate: 0,
    is_active: true,
  });

  const createMut = useMutation({
    mutationFn: () => api.createShippingRate(tenant, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shipping-rates", tenant] }); resetForm(); },
  });
  const updateMut = useMutation({
    mutationFn: () => api.updateShippingRate(tenant, editing!.id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shipping-rates", tenant] }); resetForm(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteShippingRate(tenant, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shipping-rates", tenant] }); toast.success("Deleted", "Shipping rate has been deleted."); },
    onError: (e) => toast.error("Delete failed", (e as Error).message),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({ shipping_method_id: "", shipping_zone_id: "", rate: 0, is_active: true });
  };

  const startEdit = (sr: ShippingRate) => {
    setEditing(sr);
    setForm({
      shipping_method_id: sr.shipping_method_id,
      shipping_zone_id: sr.shipping_zone_id,
      rate: sr.rate,
      is_active: sr.is_active,
    });
    setShowForm(true);
  };

  const submit = () => {
    if (editing) updateMut.mutate();
    else createMut.mutate();
  };

  if (ratesQ.isLoading || methodsQ.isLoading || zonesQ.isLoading) return <TableSkeleton cols={5} rows={3} />;

  const methods = methodsQ.data?.items || [];
  const zones = zonesQ.data?.items || [];

  if (methods.length === 0 || zones.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
        <p className="text-amber-700 text-sm font-medium mb-2">Prerequisites needed</p>
        <p className="text-amber-600 text-sm">
          You need at least one shipping method and one shipping zone before creating shipping rates.
          {methods.length === 0 && " Create a shipping method first."}
          {zones.length === 0 && " Create a shipping zone first."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <button
          onClick={() => { if (editing) resetForm(); else setShowForm(s => !s); }}
          className="bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark"
        >
          {showForm ? "Cancel" : "+ New Shipping Rate"}
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-neutral-800">{editing ? "Edit Shipping Rate" : "New Shipping Rate"}</h3>
            <p className="text-xs text-neutral-500">Zone-specific rates override the method's base rate for addresses matching the zone.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Shipping Method *</label>
                <select value={form.shipping_method_id} onChange={(e) => setForm(f => ({ ...f, shipping_method_id: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20">
                  <option value="">Select method...</option>
                  {methods.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.code}) — base: {m.base_rate}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Shipping Zone *</label>
                <select value={form.shipping_zone_id} onChange={(e) => setForm(f => ({ ...f, shipping_zone_id: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20">
                  <option value="">Select zone...</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Rate *</label>
                <input type="number" step="0.01" value={form.rate} onChange={(e) => setForm(f => ({ ...f, rate: parseFloat(e.target.value) || 0 }))}
                  placeholder="e.g., 7.99" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
                <p className="text-xs text-neutral-400 mt-1">Shipping cost for this method+zone combination</p>
              </div>
              <div className="flex items-end">
                <Toggle
                  checked={form.is_active}
                  onChange={(val) => setForm(f => ({ ...f, is_active: val }))}
                  label="Active"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={submit} disabled={!form.shipping_method_id || !form.shipping_zone_id || createMut.isPending || updateMut.isPending}
                className="inline-flex items-center gap-2 bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark disabled:opacity-50">
                {(createMut.isPending || updateMut.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                {createMut.isPending || updateMut.isPending ? "Saving..." : editing ? "Update" : "Create"}
              </button>
              <button onClick={resetForm} className="border px-3 py-1.5 rounded-md text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {ratesQ.data && ratesQ.data.items.length > 0 ? (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Zone</th>
                <th className="px-4 py-3 font-medium">Rate</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((sr) => (
                <tr key={sr.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-800">{sr.shipping_method_name || "—"}</td>
                  <td className="px-4 py-3 text-neutral-600">{sr.shipping_zone_name || "—"}</td>
                  <td className="px-4 py-3 font-mono font-medium text-brand">{fmt(sr.rate)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sr.is_active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                      {sr.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionMenu
                      items={[
                        { label: "Edit", onClick: () => startEdit(sr) },
                        { label: "Delete", variant: "danger", onClick: () => confirmDlg.open({ message: `Delete this shipping rate?`, variant: "danger", confirmLabel: "Delete", onConfirm: () => deleteMut.mutate(sr.id) }) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} total={total} start={page * limit} end={Math.min((page + 1) * limit, total)} onPage={setPage} />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border p-12 text-center text-neutral-400 text-sm">
          No zone-specific shipping rates yet. Without zone-specific rates, the method's base rate is used for all addresses.
        </div>
      )}
      <ConfirmDialog {...confirmDlg.props} />
    </div>
  );
}

// ---------------- Shipping Providers ----------------

function ShippingProvidersTab({ tenant }: { tenant: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirmDlg = useConfirmState();
  const [editing, setEditing] = useState<Partial<ShippingProvider> | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null);

  const q = useQuery({ queryKey: ["shipping-providers", tenant], queryFn: () => api.listShippingProviders(tenant) });
  const providers = q.data?.items ?? [];

  const save = useMutation({
    mutationFn: async (p: Partial<ShippingProvider>) => {
      if (p.id) return api.updateShippingProvider(tenant, p.id, p);
      return api.createShippingProvider(tenant, p);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipping-providers", tenant] });
      setEditing(null);
      toast.success("Saved", "Shipping provider configuration saved.");
    },
    onError: (e) => toast.error("Save failed", (e as Error).message),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteShippingProvider(tenant, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shipping-providers", tenant] }); toast.success("Deleted", "Provider removed."); },
    onError: (e) => toast.error("Delete failed", (e as Error).message),
  });

  const test = useMutation({
    mutationFn: (id: string) => api.testShippingProvider(tenant, id),
    onMutate: (id) => setTesting(id),
    onSuccess: (result) => {
      setTesting(null);
      setTestResult(result);
      if (result.ok) toast.success("Connection OK", result.message);
      else toast.error("Connection failed", result.message);
    },
    onError: (e) => {
      setTesting(null);
      setTestResult({ ok: false, message: (e as Error).message });
      toast.error("Connection failed", (e as Error).message);
    },
  });

  // Providers that haven't been configured yet
  const configuredCodes = providers.map((p) => p.provider_code);
  const availableProviders = SUPPORTED_SHIPPING_PROVIDERS.filter((sp) => !configuredCodes.includes(sp.code));

  return (
    <div>
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold">{editing.id ? "Edit" : "Configure"} Carrier Provider</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1">
                <span className="text-sm font-medium text-neutral-700">Provider</span>
                <select
                  value={editing.provider_code || ""}
                  onChange={(e) => {
                    const code = e.target.value;
                    const supported = SUPPORTED_SHIPPING_PROVIDERS.find((sp) => sp.code === code);
                    setEditing({ ...editing, provider_code: code, display_name: supported?.name || code });
                  }}
                  disabled={!!editing.id}
                  className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-neutral-50"
                >
                  <option value="">Select a provider…</option>
                  {SUPPORTED_SHIPPING_PROVIDERS.map((sp) => (
                    <option key={sp.code} value={sp.code}>{sp.name}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-neutral-700">Display Name</span>
                <input
                  value={editing.display_name || ""}
                  onChange={(e) => setEditing({ ...editing, display_name: e.target.value })}
                  placeholder="e.g. Delhivery Express"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </label>
            </div>
            <label className="space-y-1 block">
              <span className="text-sm font-medium text-neutral-700">
                {editing.provider_code === "ekart" ? "Merchant Token"
                  : editing.provider_code === "fedex" ? "Client ID (API Key)"
                  : editing.provider_code === "shiprocket" ? "API User Password"
                  : "API Key"}
              </span>
              <input
                type="password"
                value={editing.api_key || ""}
                onChange={(e) => setEditing({ ...editing, api_key: e.target.value })}
                placeholder={
                  editing.provider_code === "ekart" ? "EKart merchant token (from EKart team)"
                  : editing.provider_code === "fedex" ? "FedEx Client ID (from FedEx Developer Portal)"
                  : editing.provider_code === "shiprocket" ? "Shiprocket API user password (sent to your registered email)"
                  : "Leave empty to use mock mode (simulated responses)"
                }
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
              />
              <span className="text-xs text-neutral-400">
                {editing.provider_code === "ekart"
                  ? "Token provided by the EKart integration team. If empty, tracking uses EKart's public API and shipment creation uses mock data."
                  : editing.provider_code === "fedex"
                  ? "Client ID from the FedEx Developer Portal. Paired with the Client Secret below. If either is empty, the provider runs in mock mode."
                  : editing.provider_code === "shiprocket"
                  ? "Password for the Shiprocket API user (Settings → API → Create API User). Paired with the Email below. If either is empty, the provider runs in mock mode."
                  : "If no API key is set, the provider runs in mock mode with simulated shipment creation and tracking."}
              </span>
            </label>

            {/* EKart-specific config fields */}
            {editing.provider_code === "ekart" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-neutral-700">Merchant Code</span>
                  <input
                    value={(editing.config as Record<string, unknown>)?.merchant_code as string || ""}
                    onChange={(e) => setEditing({ ...editing, config: { ...(editing.config as Record<string, unknown> || {}), merchant_code: e.target.value } })}
                    placeholder="EKart merchant code"
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-neutral-700">Location Code (optional)</span>
                  <input
                    value={(editing.config as Record<string, unknown>)?.location_code as string || ""}
                    onChange={(e) => setEditing({ ...editing, config: { ...(editing.config as Record<string, unknown> || {}), location_code: e.target.value } })}
                    placeholder="Pickup location code"
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </label>
              </div>
            )}

            {/* FedEx-specific config fields */}
            {editing.provider_code === "fedex" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-neutral-700">Client Secret</span>
                  <input
                    type="password"
                    value={(editing.config as Record<string, unknown>)?.client_secret as string || ""}
                    onChange={(e) => setEditing({ ...editing, config: { ...(editing.config as Record<string, unknown> || {}), client_secret: e.target.value } })}
                    placeholder="FedEx Client Secret (from Developer Portal)"
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-neutral-700">Account Number</span>
                  <input
                    value={(editing.config as Record<string, unknown>)?.account_number as string || ""}
                    onChange={(e) => setEditing({ ...editing, config: { ...(editing.config as Record<string, unknown> || {}), account_number: e.target.value } })}
                    placeholder="FedEx shipping account number (required for shipment creation)"
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </label>
              </div>
            )}

            {/* Shiprocket-specific config fields */}
            {editing.provider_code === "shiprocket" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-neutral-700">API User Email</span>
                  <input
                    type="email"
                    value={(editing.config as Record<string, unknown>)?.email as string || ""}
                    onChange={(e) => setEditing({ ...editing, config: { ...(editing.config as Record<string, unknown> || {}), email: e.target.value } })}
                    placeholder="Shiprocket API user email (must differ from registered email)"
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-neutral-700">Pickup Location (optional)</span>
                  <input
                    value={(editing.config as Record<string, unknown>)?.pickup_location as string || ""}
                    onChange={(e) => setEditing({ ...editing, config: { ...(editing.config as Record<string, unknown> || {}), pickup_location: e.target.value } })}
                    placeholder="Pickup location name (defaults to Primary)"
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </label>
              </div>
            )}

            <label className="space-y-1 block">
              <span className="text-sm font-medium text-neutral-700">API Base URL (optional override)</span>
              <input
                value={editing.api_base_url || ""}
                onChange={(e) => setEditing({ ...editing, api_base_url: e.target.value })}
                placeholder={
                  editing.provider_code === "ekart" ? "B2C API base URL (provided by EKart team). Empty = tracking uses public API only."
                  : editing.provider_code === "fedex" ? "Empty = use FedEx default (sandbox for test mode, production for live)"
                  : editing.provider_code === "shiprocket" ? "Empty = use https://apiv2.shiprocket.in"
                  : "Empty = use provider default (sandbox for test mode, production for live)"
                }
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
              />
              {editing.provider_code === "ekart" && (
                <span className="text-xs text-neutral-400">For EKart, this is the B2C API base URL provided by your integration team. Required for shipment creation. Tracking works without it via the public API.</span>
              )}
              {editing.provider_code === "fedex" && (
                <span className="text-xs text-neutral-400">FedEx sandbox: https://apis-sandbox.fedex.com — Production: https://apis.fedex.com. Leave empty to auto-select based on test mode.</span>
              )}
              {editing.provider_code === "shiprocket" && (
                <span className="text-xs text-neutral-400">Shiprocket default: https://apiv2.shiprocket.in. Shiprocket has no sandbox — test mode uses mock data.</span>
              )}
            </label>
            <div className="flex items-center gap-6">
              <Toggle
                checked={editing.is_enabled ?? false}
                onChange={(val) => setEditing({ ...editing, is_enabled: val })}
                label="Enabled"
                description="Allow this provider to be used for shipment creation"
              />
              <Toggle
                checked={editing.is_test_mode ?? true}
                onChange={(val) => setEditing({ ...editing, is_test_mode: val })}
                label="Test / Sandbox Mode"
                description={
                  editing.provider_code === "ekart" ? "Mock mode — EKart has no public sandbox. Tracking uses simulated data."
                  : editing.provider_code === "fedex" ? "Use FedEx sandbox API (apis-sandbox.fedex.com)"
                  : editing.provider_code === "shiprocket" ? "Mock mode — Shiprocket has no sandbox. Uses simulated data."
                  : "Use the provider's sandbox environment (Delhivery staging)"
                }
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => save.mutate(editing)}
                disabled={!editing.provider_code || save.isPending}
                className="inline-flex items-center gap-2 bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50"
              >
                {save.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {save.isPending ? "Saving..." : "Save Provider"}
              </button>
              <button onClick={() => setEditing(null)} className="border px-3 py-1.5 rounded-md text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {q.isLoading ? (
        <TableSkeleton cols={5} rows={3} />
      ) : (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">API Key</th>
                <th className="px-4 py-3 font-medium">Mode</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {providers.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{p.display_name || p.provider_code}</div>
                    <div className="text-xs text-neutral-400 uppercase">{p.provider_code}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {p.api_key ? <span className="font-mono text-xs">{p.api_key.slice(0, 4)}••••{p.api_key.slice(-4)}</span> : <span className="text-amber-600 text-xs">Mock mode (no key)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_test_mode ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {p.is_test_mode ? "Sandbox" : "Live"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_enabled ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                      {p.is_enabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setTestResult(null); test.mutate(p.id); }}
                        disabled={testing === p.id}
                        className="text-xs border px-2 py-1 rounded hover:bg-neutral-50 disabled:opacity-50"
                      >
                        {testing === p.id ? "Testing..." : "Test"}
                      </button>
                      <ActionMenu
                        items={[
                          { label: "Edit", onClick: () => setEditing(p) },
                          { label: "Delete", variant: "danger", onClick: () => confirmDlg.open({ message: `Remove ${p.display_name || p.provider_code}?`, variant: "danger", confirmLabel: "Delete", onConfirm: () => del.mutate(p.id) }) },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {providers.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-400">No shipping providers configured yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {testResult && (
        <div className={`mt-4 rounded-xl border p-4 ${testResult.ok ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
          <div className="flex items-start gap-3">
            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${testResult.ok ? "bg-emerald-500" : "bg-rose-500"}`}>
              <span className="text-white text-xs font-bold">{testResult.ok ? "✓" : "!"}</span>
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${testResult.ok ? "text-emerald-800" : "text-rose-800"}`}>
                {testResult.ok ? "Connection Successful" : "Connection Failed"}
              </p>
              <p className={`text-sm mt-1 ${testResult.ok ? "text-emerald-700" : "text-rose-700"}`}>{testResult.message}</p>
            </div>
            <button onClick={() => setTestResult(null)} className="text-neutral-400 hover:text-neutral-600 text-sm">Dismiss</button>
          </div>
        </div>
      )}

      {availableProviders.length > 0 && (
        <button
          onClick={() => setEditing({ provider_code: availableProviders[0].code, display_name: availableProviders[0].name, is_enabled: false, is_test_mode: true, api_key: "", api_base_url: "", config: {} })}
          className="mt-4 bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark"
        >
          + Add Provider
        </button>
      )}

      <ConfirmDialog {...confirmDlg.props} />
    </div>
  );
}
