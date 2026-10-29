import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { Pagination } from "@/components/Pagination";
import { useConfirmState, ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Toggle } from "@/components/Toggle";
import { ActionMenu } from "@/components/ActionMenu";
import type { TaxClass, TaxZone, TaxRate } from "@/types";

type Tab = "classes" | "zones" | "rates";

export function Tax() {
  const { tenant } = useAuth();
  const [tab, setTab] = useState<Tab>("classes");

  return (
    <div>
      <PageHeader title="Tax Management" subtitle="Configure tax classes, zones, and rates" />

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6">
        {([
          { key: "classes", label: "Tax Classes" },
          { key: "zones", label: "Tax Zones" },
          { key: "rates", label: "Tax Rates" },
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

      {tab === "classes" && <TaxClassesTab tenant={tenant} />}
      {tab === "zones" && <TaxZonesTab tenant={tenant} />}
      {tab === "rates" && <TaxRatesTab tenant={tenant} />}
    </div>
  );
}

// ---------------- Tax Classes ----------------

function TaxClassesTab({ tenant }: { tenant: string }) {
  const qc = useQueryClient();
  const confirmDlg = useConfirmState();
  const toast = useToast();
  const [page, setPage] = useState(0);
  const limit = 10;
  const q = useQuery({ queryKey: ["tax-classes", tenant, page], queryFn: () => api.listTaxClasses(tenant, { limit, offset: page * limit }) });
  const rows = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TaxClass | null>(null);
  const [form, setForm] = useState({ name: "", description: "", is_default: false, is_active: true });

  const createMut = useMutation({
    mutationFn: () => api.createTaxClass(tenant, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tax-classes", tenant] }); resetForm(); },
  });
  const updateMut = useMutation({
    mutationFn: () => api.updateTaxClass(tenant, editing!.id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tax-classes", tenant] }); resetForm(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteTaxClass(tenant, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tax-classes", tenant] }); toast.success("Deleted", "Tax class has been deleted."); },
    onError: (e) => toast.error("Delete failed", (e as Error).message),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({ name: "", description: "", is_default: false, is_active: true });
  };

  const startEdit = (tc: TaxClass) => {
    setEditing(tc);
    setForm({ name: tc.name, description: tc.description || "", is_default: tc.is_default, is_active: tc.is_active });
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
          {showForm ? "Cancel" : "+ New Tax Class"}
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-neutral-800">{editing ? "Edit Tax Class" : "New Tax Class"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Standard, Reduced, Zero-rated"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
            </div>
            <div className="flex gap-6">
              <Toggle
                checked={form.is_default}
                onChange={(val) => setForm(f => ({ ...f, is_default: val }))}
                label="Default class (assigned to new products)"
              />
              <Toggle
                checked={form.is_active}
                onChange={(val) => setForm(f => ({ ...f, is_active: val }))}
                label="Active"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={!form.name || createMut.isPending || updateMut.isPending}
                className="inline-flex items-center gap-2 bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark disabled:opacity-50"
              >
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
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Default</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((tc) => (
                <tr key={tc.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-800">{tc.name}</td>
                  <td className="px-4 py-3 text-neutral-500">{tc.description || "—"}</td>
                  <td className="px-4 py-3">
                    {tc.is_default && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-brand/10 text-brand">Default</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tc.is_active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                      {tc.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionMenu
                      items={[
                        { label: "Edit", onClick: () => startEdit(tc) },
                        { label: "Delete", variant: "danger", onClick: () => confirmDlg.open({ message: `Delete tax class "${tc.name}"?`, variant: "danger", confirmLabel: "Delete", onConfirm: () => deleteMut.mutate(tc.id) }) },
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
        <div className="bg-white rounded-2xl border p-12 text-center text-neutral-400 text-sm">No tax classes yet.</div>
      )}
      <ConfirmDialog {...confirmDlg.props} />
    </div>
  );
}

// ---------------- Tax Zones ----------------

function TaxZonesTab({ tenant }: { tenant: string }) {
  const qc = useQueryClient();
  const confirmDlg = useConfirmState();
  const toast = useToast();
  const [page, setPage] = useState(0);
  const limit = 10;
  const q = useQuery({ queryKey: ["tax-zones", tenant, page], queryFn: () => api.listTaxZones(tenant, { limit, offset: page * limit }) });
  const rows = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TaxZone | null>(null);
  const [form, setForm] = useState({ name: "", country_code: "", state_code: "", city: "", postal_code_pattern: "", is_active: true });

  const createMut = useMutation({
    mutationFn: () => api.createTaxZone(tenant, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tax-zones", tenant] }); resetForm(); },
  });
  const updateMut = useMutation({
    mutationFn: () => api.updateTaxZone(tenant, editing!.id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tax-zones", tenant] }); resetForm(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteTaxZone(tenant, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tax-zones", tenant] }); toast.success("Deleted", "Tax zone has been deleted."); },
    onError: (e) => toast.error("Delete failed", (e as Error).message),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({ name: "", country_code: "", state_code: "", city: "", postal_code_pattern: "", is_active: true });
  };

  const startEdit = (tz: TaxZone) => {
    setEditing(tz);
    setForm({
      name: tz.name,
      country_code: tz.country_code || "",
      state_code: tz.state_code || "",
      city: tz.city || "",
      postal_code_pattern: tz.postal_code_pattern || "",
      is_active: tz.is_active,
    });
    setShowForm(true);
  };

  const submit = () => {
    if (editing) updateMut.mutate();
    else createMut.mutate();
  };

  const zoneScope = (tz: TaxZone) => {
    const parts = [];
    if (tz.country_code) parts.push(tz.country_code);
    if (tz.state_code) parts.push(tz.state_code);
    if (tz.city) parts.push(tz.city);
    if (tz.postal_code_pattern) parts.push(`postal: ${tz.postal_code_pattern}`);
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
          {showForm ? "Cancel" : "+ New Tax Zone"}
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-neutral-800">{editing ? "Edit Tax Zone" : "New Tax Zone"}</h3>
            <p className="text-xs text-neutral-500">Leave country/state/city blank to create a catch-all zone that matches any address.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., US-California, EU, Global"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Country Code</label>
                <input
                  type="text"
                  value={form.country_code}
                  onChange={(e) => setForm(f => ({ ...f, country_code: e.target.value.toUpperCase() }))}
                  placeholder="e.g., US, GB, DE (2-letter ISO)"
                  maxLength={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">State/Province Code</label>
                <input
                  type="text"
                  value={form.state_code}
                  onChange={(e) => setForm(f => ({ ...f, state_code: e.target.value.toUpperCase() }))}
                  placeholder="e.g., CA, NY, TX"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">City</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="e.g., Los Angeles"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Postal Code Pattern</label>
                <input
                  type="text"
                  value={form.postal_code_pattern}
                  onChange={(e) => setForm(f => ({ ...f, postal_code_pattern: e.target.value }))}
                  placeholder="e.g., 90% (SQL LIKE pattern)"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
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
              <button
                onClick={submit}
                disabled={!form.name || createMut.isPending || updateMut.isPending}
                className="inline-flex items-center gap-2 bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark disabled:opacity-50"
              >
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
              {rows.map((tz) => (
                <tr key={tz.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-800">{tz.name}</td>
                  <td className="px-4 py-3 text-neutral-600 font-mono text-xs">{zoneScope(tz)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tz.is_active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                      {tz.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionMenu
                      items={[
                        { label: "Edit", onClick: () => startEdit(tz) },
                        { label: "Delete", variant: "danger", onClick: () => confirmDlg.open({ message: `Delete tax zone "${tz.name}"?`, variant: "danger", confirmLabel: "Delete", onConfirm: () => deleteMut.mutate(tz.id) }) },
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
        <div className="bg-white rounded-2xl border p-12 text-center text-neutral-400 text-sm">No tax zones yet. Create a zone to define geographic tax regions.</div>
      )}
      <ConfirmDialog {...confirmDlg.props} />
    </div>
  );
}

// ---------------- Tax Rates ----------------

function TaxRatesTab({ tenant }: { tenant: string }) {
  const qc = useQueryClient();
  const confirmDlg = useConfirmState();
  const toast = useToast();
  const [page, setPage] = useState(0);
  const limit = 10;
  const ratesQ = useQuery({ queryKey: ["tax-rates", tenant, page], queryFn: () => api.listTaxRates(tenant, { limit, offset: page * limit }) });
  const classesQ = useQuery({ queryKey: ["tax-classes", tenant], queryFn: () => api.listTaxClasses(tenant) });
  const zonesQ = useQuery({ queryKey: ["tax-zones", tenant], queryFn: () => api.listTaxZones(tenant) });
  const rows = ratesQ.data?.items ?? [];
  const total = ratesQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TaxRate | null>(null);
  const [form, setForm] = useState({
    name: "",
    tax_class_id: "",
    tax_zone_id: "",
    rate: 0,
    compound: false,
    priority: 0,
    is_active: true,
    effective_from: "",
    effective_to: "",
  });

  const createMut = useMutation({
    mutationFn: () => api.createTaxRate(tenant, {
      ...form,
      effective_from: form.effective_from || undefined,
      effective_to: form.effective_to || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tax-rates", tenant] }); resetForm(); },
  });
  const updateMut = useMutation({
    mutationFn: () => api.updateTaxRate(tenant, editing!.id, {
      ...form,
      effective_from: form.effective_from || undefined,
      effective_to: form.effective_to || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tax-rates", tenant] }); resetForm(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteTaxRate(tenant, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tax-rates", tenant] }); toast.success("Deleted", "Tax rate has been deleted."); },
    onError: (e) => toast.error("Delete failed", (e as Error).message),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({ name: "", tax_class_id: "", tax_zone_id: "", rate: 0, compound: false, priority: 0, is_active: true, effective_from: "", effective_to: "" });
  };

  const startEdit = (tr: TaxRate) => {
    setEditing(tr);
    setForm({
      name: tr.name,
      tax_class_id: tr.tax_class_id,
      tax_zone_id: tr.tax_zone_id,
      rate: tr.rate,
      compound: tr.compound,
      priority: tr.priority,
      is_active: tr.is_active,
      effective_from: tr.effective_from ? tr.effective_from.slice(0, 10) : "",
      effective_to: tr.effective_to ? tr.effective_to.slice(0, 10) : "",
    });
    setShowForm(true);
  };

  const submit = () => {
    if (editing) updateMut.mutate();
    else createMut.mutate();
  };

  if (ratesQ.isLoading || classesQ.isLoading || zonesQ.isLoading) return <TableSkeleton cols={6} rows={3} />;

  const classes = classesQ.data?.items || [];
  const zones = zonesQ.data?.items || [];

  if (classes.length === 0 || zones.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
        <p className="text-amber-700 text-sm font-medium mb-2">Prerequisites needed</p>
        <p className="text-amber-600 text-sm">
          You need at least one tax class and one tax zone before creating tax rates.
          {classes.length === 0 && " Create a tax class first."}
          {zones.length === 0 && " Create a tax zone first."}
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
          {showForm ? "Cancel" : "+ New Tax Rate"}
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-neutral-800">{editing ? "Edit Tax Rate" : "New Tax Rate"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Rate Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., US-CA Standard 7.25%"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Rate (%) *</label>
                <input
                  type="number"
                  step="0.0001"
                  value={form.rate}
                  onChange={(e) => setForm(f => ({ ...f, rate: parseFloat(e.target.value) || 0 }))}
                  placeholder="e.g., 7.25"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Tax Class *</label>
                <select
                  value={form.tax_class_id}
                  onChange={(e) => setForm(f => ({ ...f, tax_class_id: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">Select class...</option>
                  {classes.map((tc) => (
                    <option key={tc.id} value={tc.id}>{tc.name}{tc.is_default ? " (default)" : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Tax Zone *</label>
                <select
                  value={form.tax_zone_id}
                  onChange={(e) => setForm(f => ({ ...f, tax_zone_id: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">Select zone...</option>
                  {zones.map((tz) => (
                    <option key={tz.id} value={tz.id}>{tz.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Priority</label>
                <input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                <p className="text-xs text-neutral-400 mt-1">Lower priority taxes are calculated first</p>
              </div>
              <div className="flex flex-col gap-2 justify-end">
                <Toggle
                  checked={form.compound}
                  onChange={(val) => setForm(f => ({ ...f, compound: val }))}
                  label="Compound (tax on top of other taxes)"
                />
                <Toggle
                  checked={form.is_active}
                  onChange={(val) => setForm(f => ({ ...f, is_active: val }))}
                  label="Active"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Effective From</label>
                <input
                  type="date"
                  value={form.effective_from}
                  onChange={(e) => setForm(f => ({ ...f, effective_from: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Effective To</label>
                <input
                  type="date"
                  value={form.effective_to}
                  onChange={(e) => setForm(f => ({ ...f, effective_to: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={!form.name || !form.tax_class_id || !form.tax_zone_id || createMut.isPending || updateMut.isPending}
                className="inline-flex items-center gap-2 bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark disabled:opacity-50"
              >
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
                <th className="px-4 py-3 font-medium">Rate Name</th>
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Zone</th>
                <th className="px-4 py-3 font-medium">Rate</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((tr) => (
                <tr key={tr.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-800">{tr.name}</td>
                  <td className="px-4 py-3 text-neutral-600">{tr.tax_class_name || "—"}</td>
                  <td className="px-4 py-3 text-neutral-600">{tr.tax_zone_name || "—"}</td>
                  <td className="px-4 py-3 font-mono font-medium text-brand">{tr.rate.toFixed(4)}%</td>
                  <td className="px-4 py-3 text-neutral-500">{tr.priority}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tr.is_active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                      {tr.is_active ? "Active" : "Inactive"}
                    </span>
                    {tr.compound && <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Compound</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionMenu
                      items={[
                        { label: "Edit", onClick: () => startEdit(tr) },
                        { label: "Delete", variant: "danger", onClick: () => confirmDlg.open({ message: `Delete tax rate "${tr.name}"?`, variant: "danger", confirmLabel: "Delete", onConfirm: () => deleteMut.mutate(tr.id) }) },
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
        <div className="bg-white rounded-2xl border p-12 text-center text-neutral-400 text-sm">No tax rates yet. Create a rate to link a tax class to a tax zone.</div>
      )}
      <ConfirmDialog {...confirmDlg.props} />
    </div>
  );
}
