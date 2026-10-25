import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Loader2, MapPin, Pencil, Star, Trash2, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api, generateIdempotencyKey } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { useConfirmState, ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Toggle } from "@/components/Toggle";
import { ServiceAreaMapPicker } from "@/components/ServiceAreaMapPicker";
import type { Branch } from "@/types";

const inp = "w-full border rounded-lg px-3 py-2 text-sm";

const emptyForm = {
  name: "", slug: "", phone: "", email: "", line1: "", city: "", state: "", country: "",
  postal_code: "", center_lat: 0, center_lng: 0, radius_km: 0, areasText: "",
  is_active: true, is_default: false, sort_order: 0,
};

type FormState = typeof emptyForm;

function branchToForm(b: Branch): FormState {
  return {
    name: b.name, slug: b.slug, phone: b.phone ?? "", email: b.email ?? "",
    line1: b.line1 ?? "", city: b.city ?? "", state: b.state ?? "", country: b.country ?? "",
    postal_code: b.postal_code ?? "", center_lat: b.center_lat, center_lng: b.center_lng,
    radius_km: b.radius_km, areasText: (b.areas ?? []).join("\n"),
    is_active: b.is_active, is_default: b.is_default ?? false, sort_order: b.sort_order ?? 0,
  };
}

function formToPayload(f: FormState) {
  return {
    name: f.name, slug: f.slug || undefined, phone: f.phone, email: f.email,
    line1: f.line1, city: f.city, state: f.state, country: f.country,
    postal_code: f.postal_code,
    center_lat: Number(f.center_lat) || 0, center_lng: Number(f.center_lng) || 0,
    radius_km: Number(f.radius_km) || 0,
    areas: f.areasText.split("\n").map((s) => s.trim()).filter(Boolean),
    is_active: f.is_active, is_default: f.is_default, sort_order: Number(f.sort_order) || 0,
  };
}

export function Branches() {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const confirmDlg = useConfirmState();
  const q = useQuery({ queryKey: ["branches", tenant], queryFn: () => api.listBranches(tenant) });
  const [editing, setEditing] = useState<Branch | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["branches", tenant] });

  const save = useMutation({
    mutationFn: () => {
      const payload = formToPayload(form);
      return editing === "new"
        ? api.createBranch(tenant, payload, generateIdempotencyKey())
        : api.updateBranch(tenant, (editing as Branch).id, payload);
    },
    onSuccess: () => { invalidate(); setEditing(null); toast.success("Saved", "Branch saved."); },
    onError: (e) => toast.error("Save failed", (e as Error).message),
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => api.setDefaultBranch(tenant, id),
    onSuccess: () => { invalidate(); toast.success("Updated", "Default branch changed."); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteBranch(tenant, id),
    onSuccess: () => { invalidate(); toast.success("Deleted", "Branch removed."); },
    onError: (e) => toast.error("Delete failed", (e as Error).message),
  });

  const openNew = () => { setForm(emptyForm); setEditing("new"); };
  const openEdit = (b: Branch) => { setForm(branchToForm(b)); setEditing(b); };

  return (
    <div>
      <PageHeader
        title="Branches"
        subtitle="Outlets & their delivery service areas"
        action={
          <button onClick={openNew} className="bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark">
            + Add Branch
          </button>
        }
      />

      {editing && (
        <div className="bg-white rounded-2xl border p-6 mb-6 space-y-4">
          <h3 className="font-semibold">{editing === "new" ? "Add Branch" : `Edit ${editing.name}`}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Name *"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} /></Field>
            <Field label="Slug (auto if empty)"><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className={inp} /></Field>
            <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inp} /></Field>
            <Field label="Email"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp} /></Field>
            <Field label="Address"><input value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} className={inp} /></Field>
            <Field label="City"><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inp} /></Field>
            <Field label="State"><input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className={inp} /></Field>
            <Field label="Country"><input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={inp} /></Field>
            <Field label="Postal code"><input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} className={inp} /></Field>
          </div>

          <h4 className="font-semibold text-sm text-slate-700 pt-2">Delivery service area</h4>
          <ServiceAreaMapPicker
            lat={Number(form.center_lat) || 0}
            lng={Number(form.center_lng) || 0}
            radiusKm={Number(form.radius_km) || 0}
            onPick={(la, ln) => setForm((f) => ({ ...f, center_lat: +la.toFixed(6), center_lng: +ln.toFixed(6) }))}
            onSelect={(p) => setForm((f) => ({
              ...f,
              center_lat: +p.lat.toFixed(6), center_lng: +p.lng.toFixed(6),
              line1: f.line1 || p.line1 || "",
              city: f.city || p.city || "",
              state: f.state || p.state || "",
              country: f.country || p.country || "",
              postal_code: f.postal_code || p.postcode || "",
            }))}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Center latitude"><input type="number" step="any" value={form.center_lat} onChange={(e) => setForm({ ...form, center_lat: parseFloat(e.target.value) || 0 })} className={inp} /></Field>
            <Field label="Center longitude"><input type="number" step="any" value={form.center_lng} onChange={(e) => setForm({ ...form, center_lng: parseFloat(e.target.value) || 0 })} className={inp} /></Field>
            <Field label="Radius (km)"><input type="number" step="any" min={0} value={form.radius_km} onChange={(e) => setForm({ ...form, radius_km: parseFloat(e.target.value) || 0 })} className={inp} /></Field>
          </div>
          <Field label="Named delivery areas (one per line)">
            <textarea value={form.areasText} onChange={(e) => setForm({ ...form, areasText: e.target.value })} rows={4} className={inp} placeholder={"Malappuram\nManjeri\nTirur"} />
          </Field>

          <div className="flex flex-wrap items-center gap-6">
            <Toggle label="Active" checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
            <Toggle label="Default branch" checked={form.is_default} onChange={(v) => setForm({ ...form, is_default: v })} />
            <Field label="Sort order">
              <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} className={inp + " w-24"} />
            </Field>
          </div>

          <div className="flex gap-2">
            <button onClick={() => save.mutate()} disabled={!form.name || save.isPending} className="inline-flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
              {save.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing === "new" ? "Create Branch" : "Save Changes"}
            </button>
            <button onClick={() => setEditing(null)} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
          </div>
        </div>
      )}

      {q.isLoading ? (
        <TableSkeleton cols={6} rows={4} />
      ) : (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Branch</th>
                <th className="px-4 py-3 font-medium">Service area</th>
                <th className="px-4 py-3 font-medium">Named areas</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Backoffice</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(q.data?.items ?? []).map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 flex items-center gap-1.5">
                      {b.name}
                      {b.is_default && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                    </div>
                    <div className="text-xs text-slate-400">/{b.slug}{b.city ? ` · ${b.city}` : ""}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {b.radius_km > 0 ? (
                      <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{b.radius_km} km</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{b.areas?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    {b.is_active ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Active</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/b/${b.slug}`} className="inline-flex items-center gap-1 text-brand hover:underline text-xs">
                      Open <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(b)} className="p-1.5 rounded hover:bg-slate-100" title="Edit"><Pencil className="w-4 h-4 text-slate-500" /></button>
                      {!b.is_default && (
                        <button onClick={() => setDefault.mutate(b.id)} className="p-1.5 rounded hover:bg-slate-100" title="Make default"><Star className="w-4 h-4 text-slate-500" /></button>
                      )}
                      <button
                        onClick={() => confirmDlg.open({ message: `Delete branch "${b.name}"? Orders keep their history but lose the branch link.`, variant: "danger", confirmLabel: "Delete", onConfirm: () => remove.mutate(b.id) })}
                        className="p-1.5 rounded hover:bg-rose-50" title="Delete"><Trash2 className="w-4 h-4 text-rose-500" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {(q.data?.items ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No branches yet. Add your first outlet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog {...confirmDlg.props} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-sm font-medium text-slate-700">{label}</label><div className="mt-1">{children}</div></div>;
}
