import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, ArrowLeft, ArrowRight, Download, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { api, generateIdempotencyKey } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { Toggle } from "@/components/Toggle";
import { ActionMenu } from "@/components/ActionMenu";
import { ExportDialog } from "@/components/ExportDialog";
import type { PaymentTransaction, PaymentGatewayConfig, RefundRequest } from "@/types";

type Tab = "transactions" | "gateways";

const STATUS_STYLES: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-rose-100 text-rose-700",
  refunded: "bg-purple-100 text-purple-700",
  partial_refund: "bg-indigo-100 text-indigo-700",
};

const TYPE_STYLES: Record<string, string> = {
  capture: "bg-blue-50 text-blue-600",
  authorize: "bg-cyan-50 text-cyan-600",
  refund: "bg-purple-50 text-purple-600",
  void: "bg-slate-100 text-slate-500",
};

function fmtDate(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function Payments() {
  const { tenant } = useAuth();
  const [tab, setTab] = useState<Tab>("transactions");

  return (
    <div>
      <PageHeader title="Payments" subtitle="Manage payment transactions, refunds, and gateway configurations" />

      <div className="flex gap-1 mb-6">
        {([
          { key: "transactions", label: "Transactions" },
          { key: "gateways", label: "Gateway Settings" },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              tab === t.key ? "bg-brand text-white" : "bg-white border text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "transactions" && <TransactionsTab tenant={tenant} />}
      {tab === "gateways" && <GatewaysTab tenant={tenant} />}
    </div>
  );
}

// ---------------- Transactions Tab ----------------

function TransactionsTab({ tenant }: { tenant: string }) {
  const { formatMoney: fmt } = useCurrency();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [gatewayFilter, setGatewayFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [selected, setSelected] = useState<PaymentTransaction | null>(null);
  const [refundModal, setRefundModal] = useState(false);
  const [refundForm, setRefundForm] = useState<RefundRequest>({ amount: 0, reason: "" });
  const limit = 20;

  const q = useQuery({
    queryKey: ["payment-txns", tenant, page, statusFilter, gatewayFilter, typeFilter, search, from, to],
    queryFn: () => api.listPaymentTransactions(tenant, {
      limit,
      offset: page * limit,
      status: statusFilter || undefined,
      gateway: gatewayFilter || undefined,
      type: typeFilter || undefined,
      search: search || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
  });

  const refundIdemKeyRef = useRef("");
  const refundMut = useMutation({
    mutationFn: () => {
      if (!refundIdemKeyRef.current) refundIdemKeyRef.current = generateIdempotencyKey();
      return api.refundPaymentTransaction(tenant, selected!.id, refundForm, refundIdemKeyRef.current);
    },
    onSuccess: () => {
      refundIdemKeyRef.current = "";
      qc.invalidateQueries({ queryKey: ["payment-txns", tenant] });
      if (selected) {
        api.getPaymentTransaction(tenant, selected.id).then(setSelected).catch(() => {});
      }
      setRefundModal(false);
      setRefundForm({ amount: 0, reason: "" });
    },
  });

  const openRefund = (txn: PaymentTransaction) => {
    setSelected(txn);
    const remaining = txn.amount - txn.refunded_amount;
    setRefundForm({ amount: remaining, reason: "" });
    setRefundModal(true);
  };

  const statsQ = useQuery({
    queryKey: ["payment-stats", tenant],
    queryFn: () => api.paymentStats(tenant),
  });

  if (q.isLoading) return <TableSkeleton cols={6} rows={5} />;

  const txns = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  if (q.isError) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
        <p className="text-rose-700 font-medium text-sm">Failed to load payment transactions</p>
        <p className="text-rose-500 text-xs mt-1">{(q.error as Error)?.message}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Stats cards */}
      {statsQ.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Collected" value={fmt(statsQ.data.total_collected)} color="bg-emerald-50 text-emerald-700" />
          <StatCard label="Total Refunded" value={fmt(statsQ.data.total_refunded)} color="bg-purple-50 text-purple-700" />
          <StatCard label="Net Revenue" value={fmt(statsQ.data.net_revenue)} color="bg-blue-50 text-blue-700" />
          <StatCard label="Transactions" value={String(statsQ.data.transaction_count)} color="bg-amber-50 text-amber-700" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search txn ID, email, name…"
          className="flex-1 min-w-[200px] max-w-md border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
          <option value="partial_refund">Partial Refund</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">All types</option>
          <option value="capture">Capture</option>
          <option value="refund">Refund</option>
          <option value="authorization">Authorization</option>
        </select>
        <select
          value={gatewayFilter}
          onChange={(e) => { setGatewayFilter(e.target.value); setPage(0); }}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">All gateways</option>
          <option value="card">Card</option>
          <option value="paypal">PayPal</option>
          <option value="razorpay">Razorpay</option>
          <option value="cod">COD</option>
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(0); }}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
          title="From date"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => { setTo(e.target.value); setPage(0); }}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
          title="To date"
        />
        {(statusFilter || gatewayFilter || typeFilter || search || from || to) && (
          <button
            onClick={() => { setStatusFilter(""); setGatewayFilter(""); setTypeFilter(""); setSearch(""); setFrom(""); setTo(""); setPage(0); }}
            className="text-xs text-slate-500 hover:text-rose-600 transition px-2"
          >
            Clear
          </button>
        )}
        <button
          onClick={() => setExportOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Transactions table */}
      {txns.length > 0 ? (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Transaction</th>
                <th className="px-4 py-3 font-medium">Gateway</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {txns.map((txn) => (
                <tr key={txn.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(txn)}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800 font-mono text-xs">{txn.gateway_txn_id || txn.id.slice(0, 8)}</div>
                    {txn.customer_name && <div className="text-xs text-slate-400">{txn.customer_name}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 capitalize">{txn.gateway}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${TYPE_STYLES[txn.type] || "bg-slate-100 text-slate-500"}`}>
                      {txn.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-slate-800">{fmt(txn.amount, txn.currency_code)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[txn.status] || "bg-slate-100 text-slate-500"}`}>
                      {txn.status.replace(/_/g, " ")}
                    </span>
                    {txn.refunded_amount > 0 && (
                      <div className="text-xs text-purple-500 mt-0.5">refunded: {fmt(txn.refunded_amount, txn.currency_code)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(txn.created_at)}</td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {txn.type === "capture" && txn.status === "success" && (
                      <ActionMenu
                        items={[
                          { label: "Refund", onClick: () => openRefund(txn) },
                        ]}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-xs text-slate-500">
                {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-2.5 py-0.5 rounded-md border text-xs disabled:opacity-40 hover:bg-slate-50"
                >
                  <ArrowLeft className="w-3 h-3 inline" /> Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-2.5 py-0.5 rounded-md border text-xs disabled:opacity-40 hover:bg-slate-50"
                >
                  Next <ArrowRight className="w-3 h-3 inline" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border p-12 text-center text-slate-400 text-sm">
          No payment transactions yet. Transactions are created automatically when orders are placed.
        </div>
      )}

      {/* Transaction detail modal */}
      {selected && !refundModal && (
        <DetailModal txn={selected} onClose={() => setSelected(null)} onRefund={() => openRefund(selected)} />
      )}

      {/* Refund modal */}
      {refundModal && selected && (
        <RefundModal
          txn={selected}
          form={refundForm}
          setForm={setRefundForm}
          onSubmit={() => refundMut.mutate()}
          onClose={() => { setRefundModal(false); setSelected(null); }}
          isPending={refundMut.isPending}
          error={refundMut.error?.message}
        />
      )}
      <ExportDialog
        open={exportOpen}
        type="transactions"
        title="Payment Transactions"
        filters={{ status: statusFilter, gateway: gatewayFilter, type: typeFilter, search, from, to }}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border p-4">
      <p className="text-xs text-slate-400 font-medium mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function DetailModal({ txn, onClose, onRefund }: { txn: PaymentTransaction; onClose: () => void; onRefund: () => void }) {
  const { formatMoney: fmt } = useCurrency();
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-semibold text-slate-800">Transaction Details</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <dl className="space-y-3 text-sm">
          <Row label="Transaction ID" value={txn.gateway_txn_id || txn.id} mono />
          <Row label="Gateway" value={txn.gateway} />
          <Row label="Type" value={txn.type} />
          <Row label="Status" value={txn.status.replace(/_/g, " ")} />
          <Row label="Amount" value={fmt(txn.amount, txn.currency_code)} />
          {txn.refunded_amount > 0 && <Row label="Refunded" value={fmt(txn.refunded_amount, txn.currency_code)} />}
          <Row label="Customer" value={txn.customer_name || "—"} />
          <Row label="Email" value={txn.customer_email || "—"} />
          <Row label="Order ID" value={txn.order_id} mono />
          {txn.order_status && <Row label="Order Status" value={txn.order_status} />}
          {txn.failure_reason && <Row label="Failure Reason" value={txn.failure_reason} />}
          <Row label="Created" value={fmtDate(txn.created_at)} />
          {txn.gateway_response && Object.keys(txn.gateway_response).length > 0 && (
            <div>
              <dt className="text-slate-400 text-xs mb-1">Gateway Response</dt>
              <dd className="text-slate-700 font-mono text-xs bg-slate-50 rounded-lg p-3 overflow-x-auto">
                <pre>{JSON.stringify(txn.gateway_response, null, 2)}</pre>
              </dd>
            </div>
          )}
        </dl>

        {txn.type === "capture" && txn.status === "success" && (
          <button
            onClick={onRefund}
            className="mt-4 w-full bg-purple-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-purple-700"
          >
            Issue Refund
          </button>
        )}
      </div>
    </div>
  );
}

function RefundModal({
  txn, form, setForm, onSubmit, onClose, isPending, error,
}: {
  txn: PaymentTransaction;
  form: RefundRequest;
  setForm: (f: RefundRequest) => void;
  onSubmit: () => void;
  onClose: () => void;
  isPending: boolean;
  error?: string;
}) {
  const { formatMoney: fmt } = useCurrency();
  const remaining = txn.amount - txn.refunded_amount;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-semibold text-slate-800">Issue Refund</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-3 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-slate-500">Transaction amount:</span>
              <span className="font-medium">{fmt(txn.amount, txn.currency_code)}</span>
            </div>
            {txn.refunded_amount > 0 && (
              <div className="flex justify-between mb-1">
                <span className="text-slate-500">Already refunded:</span>
                <span className="font-medium text-purple-600">{fmt(txn.refunded_amount, txn.currency_code)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Refundable remaining:</span>
              <span className="font-bold text-emerald-600">{fmt(remaining, txn.currency_code)}</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Refund Amount</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max={remaining}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <p className="text-xs text-slate-400 mt-1">Set to full amount for complete refund, or less for partial.</p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Reason (optional)</label>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="e.g., Customer request, item returned"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>

          {error && <div className="text-rose-500 text-sm">{error}</div>}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 border rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={isPending || form.amount <= 0 || form.amount > remaining}
              className="inline-flex items-center justify-center gap-2 flex-1 bg-purple-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPending ? "Processing..." : "Confirm Refund"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-400 text-xs">{label}</dt>
      <dd className={`text-slate-700 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

// ---------------- Gateways Tab ----------------

function GatewaysTab({ tenant }: { tenant: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["payment-gateways", tenant], queryFn: () => api.listPaymentGatewayConfigs(tenant) });
  const [editing, setEditing] = useState<PaymentGatewayConfig | null>(null);
  const [form, setForm] = useState({ display_name: "", is_enabled: true, is_test_mode: true, sort_order: 0 });

  const updateMut = useMutation({
    mutationFn: () => api.updatePaymentGatewayConfig(tenant, editing!.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-gateways", tenant] });
      setEditing(null);
    },
  });

  const startEdit = (g: PaymentGatewayConfig) => {
    setEditing(g);
    setForm({
      display_name: g.display_name,
      is_enabled: g.is_enabled,
      is_test_mode: g.is_test_mode,
      sort_order: g.sort_order,
    });
  };

  const submit = () => {
    if (editing) updateMut.mutate();
  };

  if (q.isLoading) return <TableSkeleton cols={4} rows={3} />;

  return (
    <div>
      <p className="text-sm text-slate-500 mb-4">
        Configure which payment gateways are available for your store. Gateway implementations are built-in;
        these settings control display name, enabled status, test mode, and sort order.
      </p>

      {editing && (
        <div className="bg-white rounded-2xl border p-6 mb-6 space-y-4">
          <h3 className="font-semibold text-slate-800">Edit Gateway: {editing.gateway_code}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Display Name</label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => setForm(f => ({ ...f, display_name: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Sort Order</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </div>
          <div className="flex gap-6">
            <Toggle
              checked={form.is_enabled}
              onChange={(val) => setForm(f => ({ ...f, is_enabled: val }))}
              label="Enabled"
            />
            <Toggle
              checked={form.is_test_mode}
              onChange={(val) => setForm(f => ({ ...f, is_test_mode: val }))}
              label="Test Mode (sandbox)"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setEditing(null)} className="border rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!form.display_name || updateMut.isPending}
              className="inline-flex items-center gap-2 bg-brand text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-brand-dark disabled:opacity-50"
            >
              {updateMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {updateMut.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {q.data && q.data.items.length > 0 ? (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Gateway</th>
                <th className="px-4 py-3 font-medium">Display Name</th>
                <th className="px-4 py-3 font-medium">Mode</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Sort</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {q.data.items.map((g) => (
                <tr key={g.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{g.gateway_code}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{g.display_name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${g.is_test_mode ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {g.is_test_mode ? "Test" : "Live"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${g.is_enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {g.is_enabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{g.sort_order}</td>
                  <td className="px-4 py-3 text-right">
                    <ActionMenu
                      items={[
                        { label: "Edit", onClick: () => startEdit(g) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border p-12 text-center text-slate-400 text-sm">
          No gateway configurations found.
        </div>
      )}
    </div>
  );
}
