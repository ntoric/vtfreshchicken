import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api, generateIdempotencyKey } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { Toggle } from "@/components/Toggle";
import { ServiceAreaMapPicker } from "@/components/ServiceAreaMapPicker";
import type { Branch, ServiceZone } from "@/types";

const inp = "w-full border rounded-lg px-3 py-2 text-sm";

const emptyForm = {
  name: "", slug: "", phone: "", email: "", line1: "", city: "", state: "", country: "",
  postal_code: "", center_lat: 0, center_lng: 0, radius_km: 0, areasText: "",
  zones: [] as ServiceZone[],
  is_active: true, is_default: false, sort_order: 0,
};

type FormState = typeof emptyForm;

function branchToForm(b: Branch): FormState {
  return {
    name: b.name, slug: b.slug, phone: b.phone ?? "", email: b.email ?? "",
    line1: b.line1 ?? "", city: b.city ?? "", state: b.state ?? "", country: b.country ?? "",
    postal_code: b.postal_code ?? "", center_lat: b.center_lat, center_lng: b.center_lng,
    radius_km: b.radius_km, areasText: (b.areas ?? []).join("\n"),
    zones: (b.service_zones ?? []).map((z) => ({ ...z })),
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
    service_zones: f.zones
      .filter((z) => z.radius_km > 0)
      .map((z) => ({
        radius_km: z.radius_km,
        charge_type: z.charge_type,
        charge: z.charge_type === "free" ? 0 : Number(z.charge) || 0,
      }))
      .sort((a, b) => a.radius_km - b.radius_km),
    areas: f.areasText.split("\n").map((s) => s.trim()).filter(Boolean),
    is_active: f.is_active, is_default: f.is_default, sort_order: Number(f.sort_order) || 0,
  };
}

export function BranchEdit() {
  const { tenant } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const isNew = !id;

  const [form, setForm] = useState<FormState>(emptyForm);

  const existingQ = useQuery({
    queryKey: ["branch", tenant, id],
    queryFn: () => api.getBranch(tenant, id!),
    enabled: !isNew,
  });

  useEffect(() => {
    if (!isNew && existingQ.data) setForm(branchToForm(existingQ.data));
  }, [isNew, existingQ.data]);

  const save = useMutation({
    mutationFn: () => {
      const payload = formToPayload(form);
      return isNew
        ? api.createBranch(tenant, payload, generateIdempotencyKey())
        : api.updateBranch(tenant, id!, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches", tenant] });
      toast.success("Saved", "Branch saved.");
      navigate("/branches");
    },
    onError: (e) => toast.error("Save failed", (e as Error).message),
  });

  return (
    <div>
      <PageHeader title={isNew ? "Add Branch" : "Edit Branch"} subtitle={form.name} />

      <div className="bg-white rounded-2xl border p-6 mb-6 space-y-4">
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

        <h4 className="font-semibold text-sm text-neutral-700 pt-2">Delivery service area</h4>
        <ServiceAreaMapPicker
          lat={Number(form.center_lat) || 0}
          lng={Number(form.center_lng) || 0}
          radiusKm={
            form.zones.filter((z) => z.radius_km > 0).length > 0
              ? Math.max(...form.zones.map((z) => z.radius_km))
              : Number(form.radius_km) || 0
          }
          innerRings={form.zones.map((z) => z.radius_km).filter((r) => r > 0).sort((a, b) => a - b).slice(0, -1)}
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

        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-neutral-700">Delivery zones (distance-based charges)</label>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, zones: [...f.zones, { radius_km: 0, charge_type: "free" as const, charge: 0 }] }))}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Add zone
            </button>
          </div>
          <p className="text-xs text-neutral-400">
            Optional concentric rings from the branch centre. Once added, the outermost ring replaces the plain
            radius as the delivery boundary shown to customers. Each ring can be free or carry a charge —
            e.g. 2&nbsp;km free, then ₹10 per extra km (rings: 2&nbsp;km free + outer ring per-km).
            Zone charges apply at checkout only while the <strong>Shipping module is disabled</strong> (Developer → Modules &amp; Features), and only for exact map-picked locations.
          </p>
          {form.zones.length > 0 && (
            <div className="space-y-2">
              {form.zones.map((z, i) => (
                <div key={i} className="grid grid-cols-[90px_1fr_1fr_auto] gap-2 items-end">
                  <Field label="Up to (km)">
                    <input
                      type="number" step="any" min={0} value={z.radius_km || ""} placeholder="km"
                      onChange={(e) => setForm((f) => ({ ...f, zones: f.zones.map((zz, j) => j === i ? { ...zz, radius_km: parseFloat(e.target.value) || 0 } : zz) }))}
                      className={inp}
                    />
                  </Field>
                  <Field label="Delivery charge">
                    <select
                      value={z.charge_type}
                      onChange={(e) => setForm((f) => ({ ...f, zones: f.zones.map((zz, j) => j === i ? { ...zz, charge_type: e.target.value as ServiceZone["charge_type"] } : zz) }))}
                      className={inp}
                    >
                      <option value="free">Free delivery</option>
                      <option value="flat">Flat fee</option>
                      <option value="per_km">Per km (beyond prev. ring)</option>
                    </select>
                  </Field>
                  <Field label={z.charge_type === "per_km" ? "Rate / km" : "Amount"}>
                    <input
                      type="number" step="any" min={0} value={z.charge || ""} placeholder="0"
                      disabled={z.charge_type === "free"}
                      onChange={(e) => setForm((f) => ({ ...f, zones: f.zones.map((zz, j) => j === i ? { ...zz, charge: parseFloat(e.target.value) || 0 } : zz) }))}
                      className={inp + (z.charge_type === "free" ? " opacity-40" : "")}
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, zones: f.zones.filter((_, j) => j !== i) }))}
                    className="p-2 rounded hover:bg-rose-50 text-rose-500 mb-0.5"
                    title="Remove zone"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
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
            {isNew ? "Create Branch" : "Save Changes"}
          </button>
          <button onClick={() => navigate("/branches")} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-sm font-medium text-neutral-700">{label}</label><div className="mt-1">{children}</div></div>;
}
