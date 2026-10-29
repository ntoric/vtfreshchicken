import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";
import { MODULES_QUERY_KEY } from "@/lib/modules";
import type { PaymentGatewayConfig, StoreModule } from "@/types";

// The backend returns this sentinel for stored secret values. Sending it back
// on update preserves the stored secret instead of overwriting it.
const SECRET_MASK = "********";

// Well-known config keys offered in the editor even before they are set.
// Values marked `secret` are masked by the API when read back.
const SUGGESTED_KEYS: Record<string, { key: string; label: string }[]> = {
  razorpay: [
    { key: "key_id", label: "Key ID (public)" },
    { key: "key_secret", label: "Key Secret" },
    { key: "webhook_secret", label: "Webhook Secret" },
  ],
  paypal: [
    { key: "client_id", label: "Client ID" },
    { key: "client_secret", label: "Client Secret" },
  ],
  card: [
    { key: "publishable_key", label: "Publishable Key" },
    { key: "api_key", label: "API Key" },
  ],
};

function isSecretKey(key: string) {
  const k = key.toLowerCase();
  if (["key_id", "client_id", "publishable", "public_key"].some((p) => k.includes(p))) return false;
  return ["secret", "password", "private", "token", "api_key"].some((p) => k.includes(p));
}

export function Developer() {
  const { user, tenant } = useAuth();

  if (!user) return null;
  if (user.role !== "superadmin") return <Navigate to="/" replace />;

  return <DeveloperSettings tenant={tenant} />;
}

function DeveloperSettings({ tenant }: { tenant: string }) {
  const qc = useQueryClient();
  const toast = useToast();

  const modulesQ = useQuery({
    queryKey: MODULES_QUERY_KEY,
    queryFn: () => api.listModules(),
  });
  const moduleMut = useMutation({
    mutationFn: (m: StoreModule) => api.updateModule(tenant, m.module_code, !m.is_enabled),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: MODULES_QUERY_KEY });
      toast.success(`${m.display_name} ${m.is_enabled ? "enabled" : "disabled"}`);
    },
    onError: (e) => toast.error("Update failed", (e as Error).message),
  });

  const gatewaysQ = useQuery({
    queryKey: ["dev-payment-gateways", tenant],
    queryFn: () => api.listPaymentGatewayConfigs(tenant),
  });
  const methodsQ = useQuery({
    queryKey: ["dev-payment-methods"],
    queryFn: () => api.listPaymentMethods(),
  });

  const [editing, setEditing] = useState<PaymentGatewayConfig | null>(null);

  const toggleMut = useMutation({
    mutationFn: (g: PaymentGatewayConfig) =>
      api.updatePaymentGatewayConfig(tenant, g.id, {
        display_name: g.display_name,
        is_enabled: !g.is_enabled,
        is_test_mode: g.is_test_mode,
        sort_order: g.sort_order,
        config: g.config ?? {},
      }),
    onSuccess: (g) => {
      qc.invalidateQueries({ queryKey: ["dev-payment-gateways", tenant] });
      qc.invalidateQueries({ queryKey: ["dev-payment-methods"] });
      toast.success(`${g.display_name} ${g.is_enabled ? "enabled" : "disabled"}`);
    },
    onError: (e) => toast.error("Update failed", (e as Error).message),
  });

  const enabledIds = new Set((methodsQ.data?.methods ?? []).map((m) => m.id));

  return (
    <div className="max-w-4xl">
      <PageHeader title="Developer Settings" subtitle="Platform-level configuration — visible to superadmin only" />

      {/* Environment */}
      <div className="bg-white rounded-2xl border p-6 mb-6">
        <h3 className="font-semibold text-neutral-900 mb-3">Environment</h3>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-neutral-500">Payment processing:</span>
          {methodsQ.isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
          ) : (
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                methodsQ.data?.test_mode
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {methodsQ.data?.test_mode ? "Test mode" : "Live mode"}
            </span>
          )}
          <span className="text-xs text-neutral-400">
            Test mode is active outside production (APP_ENV ≠ production).
          </span>
        </div>
      </div>

      {/* Modules & Features */}
      <div className="bg-white rounded-2xl border p-6 mb-6">
        <h3 className="font-semibold text-neutral-900">Modules &amp; Features</h3>
        <p className="text-sm text-neutral-500 mt-0.5 mb-4">
          Enable or disable store modules. A disabled module hides its related menus,
          pages, widgets, and components on both the frontstore and the backoffice.
        </p>

        {modulesQ.isLoading && <TableSkeleton cols={3} rows={4} />}

        {modulesQ.data && (
          <div className="divide-y border rounded-xl overflow-hidden">
            {modulesQ.data.items.map((m) => (
              <div key={m.module_code} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-800 truncate">{m.display_name}</span>
                    <code className="text-[11px] font-mono text-neutral-400">{m.module_code}</code>
                  </div>
                  {m.description && (
                    <p className="text-xs text-neutral-400 mt-0.5">{m.description}</p>
                  )}
                </div>
                {moduleMut.isPending && moduleMut.variables?.module_code === m.module_code && (
                  <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
                )}
                <Toggle
                  checked={m.is_enabled}
                  onChange={() => moduleMut.mutate(m)}
                  disabled={moduleMut.isPending}
                  label="Enabled"
                  size="sm"
                />
              </div>
            ))}
          </div>
        )}

        {modulesQ.data && modulesQ.data.items.length === 0 && (
          <div className="border rounded-xl p-12 text-center text-neutral-400 text-sm">
            No modules configured.
          </div>
        )}
      </div>

      {/* Payment methods */}
      <div className="bg-white rounded-2xl border p-6">
        <h3 className="font-semibold text-neutral-900">Payment Methods</h3>
        <p className="text-sm text-neutral-500 mt-0.5 mb-4">
          Enable or disable payment methods on the storefront and configure per-gateway
          credentials. Credentials saved here take precedence over environment variables
          (e.g. <code className="font-mono text-xs">RAZORPAY_KEY_ID</code>). Secret values are
          masked — leave a masked field unchanged to keep the stored value.
        </p>

        {gatewaysQ.isLoading && <TableSkeleton cols={4} rows={4} />}

        {gatewaysQ.data && (
          <div className="divide-y border rounded-xl overflow-hidden">
            {gatewaysQ.data.items.map((g) => (
              <GatewayRow
                key={g.id}
                gateway={g}
                tenant={tenant}
                live={enabledIds.has(g.gateway_code)}
                editing={editing?.id === g.id}
                onEdit={() => setEditing(editing?.id === g.id ? null : g)}
                onClose={() => setEditing(null)}
                onToggle={() => toggleMut.mutate(g)}
                toggling={toggleMut.isPending && toggleMut.variables?.id === g.id}
              />
            ))}
          </div>
        )}

        {gatewaysQ.data && gatewaysQ.data.items.length === 0 && (
          <div className="border rounded-xl p-12 text-center text-neutral-400 text-sm">
            No payment gateways configured.
          </div>
        )}
      </div>
    </div>
  );
}

function GatewayRow({
  gateway: g,
  tenant,
  live,
  editing,
  onEdit,
  onClose,
  onToggle,
  toggling,
}: {
  gateway: PaymentGatewayConfig;
  tenant: string;
  live: boolean;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
  onToggle: () => void;
  toggling: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-neutral-800 truncate">{g.display_name}</span>
            <code className="text-[11px] font-mono text-neutral-400">{g.gateway_code}</code>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                g.is_test_mode ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {g.is_test_mode ? "Test" : "Live"}
            </span>
            {g.is_enabled && !live && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-500">
                not in storefront
              </span>
            )}
          </div>
        </div>
        {toggling && <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />}
        <Toggle checked={g.is_enabled} onChange={onToggle} disabled={toggling} label="Enabled" size="sm" />
        <button
          onClick={onEdit}
          className="border rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
        >
          {editing ? "Close" : "Configure"}
        </button>
      </div>
      {editing && <GatewayEditor gateway={g} tenant={tenant} onClose={onClose} />}
    </div>
  );
}

function GatewayEditor({
  gateway: g,
  tenant,
  onClose,
}: {
  gateway: PaymentGatewayConfig;
  tenant: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();

  const [displayName, setDisplayName] = useState(g.display_name);
  const [sortOrder, setSortOrder] = useState(g.sort_order);
  const [testMode, setTestMode] = useState(g.is_test_mode);
  const [entries, setEntries] = useState<{ key: string; value: string }[]>(() => {
    const seen = new Set<string>();
    const rows: { key: string; value: string }[] = [];
    for (const [k, v] of Object.entries(g.config ?? {})) {
      seen.add(k);
      rows.push({ key: k, value: typeof v === "string" ? v : JSON.stringify(v) });
    }
    for (const s of SUGGESTED_KEYS[g.gateway_code] ?? []) {
      if (!seen.has(s.key)) rows.push({ key: s.key, value: "" });
    }
    return rows;
  });
  const [newKey, setNewKey] = useState("");

  const saveMut = useMutation({
    mutationFn: () => {
      const config: Record<string, string> = {};
      for (const e of entries) {
        if (e.key.trim() === "") continue;
        config[e.key.trim()] = e.value;
      }
      return api.updatePaymentGatewayConfig(tenant, g.id, {
        display_name: displayName,
        is_enabled: g.is_enabled,
        is_test_mode: testMode,
        sort_order: sortOrder,
        config,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dev-payment-gateways", tenant] });
      qc.invalidateQueries({ queryKey: ["dev-payment-methods"] });
      toast.success("Gateway configuration saved");
      onClose();
    },
    onError: (e) => toast.error("Save failed", (e as Error).message),
  });

  const setEntry = (idx: number, value: string) =>
    setEntries((rows) => rows.map((r, i) => (i === idx ? { ...r, value } : r)));

  const removeEntry = (idx: number) => setEntries((rows) => rows.filter((_, i) => i !== idx));

  const addKey = () => {
    const k = newKey.trim();
    if (!k || entries.some((e) => e.key === k)) return;
    setEntries((rows) => [...rows, { key: k, value: "" }]);
    setNewKey("");
  };

  const suggestedLabel = (key: string) =>
    SUGGESTED_KEYS[g.gateway_code]?.find((s) => s.key === key)?.label;

  return (
    <div className="bg-neutral-50 border-t px-4 py-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-neutral-700 block mb-1">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700 block mb-1">Sort Order</label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </div>

      <Toggle
        checked={testMode}
        onChange={setTestMode}
        label="Test Mode (sandbox)"
        description="Flagged on the storefront via public_config.test_mode"
      />

      {/* Config / credentials */}
      <div>
        <p className="text-sm font-medium text-neutral-700 mb-2">Configuration</p>
        {entries.length === 0 && (
          <p className="text-xs text-neutral-400 mb-2">No configuration keys for this gateway.</p>
        )}
        <div className="space-y-2">
          {entries.map((e, idx) => {
            const secret = isSecretKey(e.key);
            const masked = e.value === SECRET_MASK;
            return (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-48 flex-shrink-0">
                  <code className="text-xs font-mono text-neutral-600 break-all">{e.key}</code>
                  {suggestedLabel(e.key) && (
                    <span className="block text-[10px] text-neutral-400">{suggestedLabel(e.key)}</span>
                  )}
                </div>
                <input
                  type={secret ? "password" : "text"}
                  value={e.value}
                  onChange={(ev) => setEntry(idx, ev.target.value)}
                  placeholder={secret ? (masked ? "•••• stored ••••" : "Enter secret") : "Value"}
                  className="flex-1 border rounded-lg px-3 py-1.5 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                <button
                  onClick={() => removeEntry(idx)}
                  title="Remove key"
                  className="text-neutral-400 hover:text-rose-500 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addKey()}
            placeholder="Add config key…"
            className="w-48 border rounded-lg px-3 py-1.5 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <button
            onClick={addKey}
            disabled={!newKey.trim()}
            className="inline-flex items-center gap-1 border rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button
          onClick={onClose}
          className="border rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 bg-white"
        >
          Cancel
        </button>
        <button
          onClick={() => saveMut.mutate()}
          disabled={!displayName.trim() || saveMut.isPending}
          className="inline-flex items-center gap-2 bg-brand text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-brand-dark disabled:opacity-50"
        >
          {saveMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {saveMut.isPending ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
