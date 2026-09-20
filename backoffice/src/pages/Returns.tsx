import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PackageOpen, X, Download } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api, generateIdempotencyKey } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { ActionMenu } from "@/components/ActionMenu";
import { useToast } from "@/components/Toast";
import { ExportDialog } from "@/components/ExportDialog";
import {
  RETURN_STATUS_LABELS,
  RETURN_TYPE_LABELS,
  REFUND_METHOD_LABELS,
  type OrderReturn,
  type UpdateReturnStatusRequest,
} from "@/types";

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "requested", label: "Requested" },
  { key: "approved", label: "Approved" },
  { key: "completed", label: "Completed" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
];

export function Returns() {
  const { tenant } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<OrderReturn | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [note, setNote] = useState("");
  const limit = 20;

  const q = useQuery({
    queryKey: ["returns", tenant, statusFilter, typeFilter, search, from, to, page],
    queryFn: () => api.listReturns(tenant, {
      status: statusFilter || undefined,
      type: typeFilter || undefined,
      search: search || undefined,
      from: from || undefined,
      to: to || undefined,
      limit,
      offset: page * limit,
    }),
  });

  const countsQ = useQuery({
    queryKey: ["return-counts", tenant],
    queryFn: () => api.returnCounts(tenant),
  });

  const statusIdemKeyRef = useRef("");
  const statusMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateReturnStatusRequest }) => {
      if (!statusIdemKeyRef.current) statusIdemKeyRef.current = generateIdempotencyKey();
      return api.updateReturnStatus(tenant, id, body, statusIdemKeyRef.current);
    },
    onSuccess: () => {
      statusIdemKeyRef.current = "";
      qc.invalidateQueries({ queryKey: ["returns", tenant] });
      qc.invalidateQueries({ queryKey: ["return-counts", tenant] });
      setStatusModalOpen(false);
      setNewStatus("");
      setNote("");
      setSelectedReturn(null);
      toast.success("Return status updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const counts = countsQ.data || {};
  const total = q.data?.total ?? 0;
  const totalPages = Math.ceil(total / limit) || 1;

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  }) : "—";

  const fmtMoney = (amount: number, currency?: string) =>
    `${currency === "USD" || !currency ? "$" : ""}${Math.abs(amount).toFixed(2)}`;

  const openStatusModal = (ret: OrderReturn) => {
    setSelectedReturn(ret);
    setNewStatus("");
    setNote("");
    setStatusModalOpen(true);
  };

  const handleUpdateStatus = () => {
    if (!selectedReturn || !newStatus) return;
    statusMut.mutate({
      id: selectedReturn.id,
      body: { status: newStatus, note: note || undefined },
    });
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Returns & Replacements" subtitle={`${total} return${total !== 1 ? "s" : ""}`} />
        <button
          onClick={() => setExportOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition flex-shrink-0"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => {
          const count = tab.key === "" ? total : (counts[tab.key] || 0);
          const active = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setStatusFilter(tab.key); setPage(0); }}
              className={`px-2.5 py-1 rounded-md text-sm font-medium whitespace-nowrap transition ${
                active ? "bg-brand text-white" : "bg-white border text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`ml-1.5 text-xs ${active ? "text-white/80" : "text-slate-400"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">All Types</option>
          <option value="refund">Refund</option>
          <option value="replacement">Replacement</option>
          <option value="exchange">Exchange</option>
        </select>
        <input
          type="text"
          placeholder="Search by return #, order ID, customer name, or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="flex-1 min-w-[200px] max-w-md px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
        />
        <input
          type="date"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(0); }}
          className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          title="From date"
        />
        <span className="text-slate-400 text-sm">→</span>
        <input
          type="date"
          value={to}
          onChange={(e) => { setTo(e.target.value); setPage(0); }}
          className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          title="To date"
        />
        {(from || to) && (
          <button
            onClick={() => { setFrom(""); setTo(""); setPage(0); }}
            className="text-xs text-slate-500 hover:text-rose-600 transition"
          >
            Clear dates
          </button>
        )}
      </div>

      {q.isLoading ? (
        <TableSkeleton cols={7} rows={6} />
      ) : q.data && q.data.items.length > 0 ? (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Return #</th>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {q.data.items.map((r) => {
                const sCfg = RETURN_STATUS_LABELS[r.status] || { label: r.status, color: "text-slate-600", bg: "bg-slate-100" };
                const tCfg = RETURN_TYPE_LABELS[r.type] || { label: r.type, color: "text-slate-600", bg: "bg-slate-100" };
                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.return_number}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/orders/${r.order_id}`)}
                        className="font-mono text-xs text-brand hover:underline"
                      >
                        #{r.order_id.slice(0, 8)}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{r.customer_name || "—"}</div>
                      <div className="text-xs text-slate-400">{r.customer_email || ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tCfg.bg} ${tCfg.color}`}>
                        {tCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sCfg.bg} ${sCfg.color}`}>
                        {sCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {r.refund_amount > 0 ? fmtMoney(r.refund_amount) : "—"}
                      {r.refund_amount > 0 && (
                        <div className="text-xs text-slate-400">{REFUND_METHOD_LABELS[r.refund_method] || r.refund_method}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ActionMenu
                        items={[
                          { label: "View Details", onClick: () => setSelectedReturn(r) },
                          ...(r.status === "requested" || r.status === "approved" ? [
                            { label: "Update Status", onClick: () => openStatusModal(r) },
                          ] : []),
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50">
              <p className="text-xs text-slate-500">
                Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40 hover:bg-white transition"
                >
                  Prev
                </button>
                <span className="px-3 py-1 text-sm text-slate-500">
                  Page {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40 hover:bg-white transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border p-12 text-center">
          <PackageOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400 text-sm">
            {search || statusFilter || typeFilter ? "No returns match your filters." : "No returns yet."}
          </p>
        </div>
      )}

      {/* Return Details Modal */}
      {selectedReturn && !statusModalOpen && (
        <ReturnDetailsModal
          ret={selectedReturn}
          onClose={() => setSelectedReturn(null)}
          onOpenStatus={() => openStatusModal(selectedReturn)}
        />
      )}

      {/* Status Update Modal */}
      {statusModalOpen && selectedReturn && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold text-slate-800">Update Return Status</h3>
              <button onClick={() => setStatusModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Return <span className="font-mono">{selectedReturn.return_number}</span>
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">New Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">Select status...</option>
                  {(RETURN_STATUS_TRANSITIONS_FOR(selectedReturn.status)).map((s) => {
                    const sCfg = RETURN_STATUS_LABELS[s] || { label: s, color: "", bg: "" };
                    return (
                      <option key={s} value={s}>{sCfg.label}</option>
                    );
                  })}
                </select>
              </div>

              {newStatus === "completed" && (
                <div className="bg-blue-50 text-blue-700 rounded-lg px-3 py-2 text-xs">
                  Completing this return will {selectedReturn.restock ? "restock items and " : ""}
                  {selectedReturn.type === "refund" && selectedReturn.refund_method !== "none"
                    ? `process a refund of ${fmtMoney(selectedReturn.refund_amount)} via ${REFUND_METHOD_LABELS[selectedReturn.refund_method] || selectedReturn.refund_method}.`
                    : "finalize the return."}
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  {newStatus === "rejected" ? "Rejection Reason" : "Note"}
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder={newStatus === "rejected" ? "Reason for rejection (visible to customer)..." : "Optional note (visible to customer)..."}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                {newStatus === "rejected" && (
                  <p className="text-xs text-rose-500 mt-1">This reason will be displayed to the customer as the rejection reason.</p>
                )}
              </div>

              {statusMut.isError && (
                <p className="text-sm text-rose-500">{(statusMut.error as Error).message}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleUpdateStatus}
                  disabled={!newStatus || statusMut.isPending}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-brand rounded-lg hover:opacity-90 transition disabled:opacity-50"
                >
                  {statusMut.isPending ? "Updating..." : "Confirm"}
                </button>
                <button
                  onClick={() => { setStatusModalOpen(false); setNewStatus(""); setNote(""); }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 border rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ExportDialog
        open={exportOpen}
        type="returns"
        title="Returns"
        filters={{ status: statusFilter, type: typeFilter, search, from, to }}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}

function RETURN_STATUS_TRANSITIONS_FOR(current: string): string[] {
  const map: Record<string, string[]> = {
    requested: ["approved", "rejected", "cancelled"],
    approved: ["completed", "cancelled"],
    rejected: [],
    completed: [],
    cancelled: [],
  };
  return map[current] || [];
}

function ReturnDetailsModal({
  ret,
  onClose,
  onOpenStatus,
}: {
  ret: OrderReturn;
  onClose: () => void;
  onOpenStatus: () => void;
}) {
  const sCfg = RETURN_STATUS_LABELS[ret.status] || { label: ret.status, color: "text-slate-600", bg: "bg-slate-100" };
  const tCfg = RETURN_TYPE_LABELS[ret.type] || { label: ret.type, color: "text-slate-600", bg: "bg-slate-100" };
  const items = ret.items || [];
  const history = ret.status_history || [];

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  }) : "—";

  const fmtMoney = (amount: number) =>
    `$${Math.abs(amount).toFixed(2)}`;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{ret.return_number}</h3>
            <p className="text-sm text-slate-500">
              Order <span className="font-mono">#{ret.order_id.slice(0, 8)}</span> · {ret.customer_name || "—"}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Badges */}
          <div className="flex gap-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${tCfg.bg} ${tCfg.color}`}>
              {tCfg.label}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${sCfg.bg} ${sCfg.color}`}>
              {sCfg.label}
            </span>
            {ret.refund_amount > 0 && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                Refund: {fmtMoney(ret.refund_amount)}
              </span>
            )}
          </div>

          {/* Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-400 text-xs">Reason</p>
              <p className="text-slate-700">{ret.reason || "—"}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Refund Method</p>
              <p className="text-slate-700">{REFUND_METHOD_LABELS[ret.refund_method] || ret.refund_method}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Restock Items</p>
              <p className="text-slate-700">{ret.restock ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Created</p>
              <p className="text-slate-700">{fmtDate(ret.created_at)}</p>
            </div>
            {ret.completed_at && (
              <div>
                <p className="text-slate-400 text-xs">Completed</p>
                <p className="text-slate-700">{fmtDate(ret.completed_at)}</p>
              </div>
            )}
          </div>

          {/* Rejection Reason callout */}
          {ret.status === "rejected" && (() => {
            const rejectionEvent = [...history].reverse().find((e) => e.status === "rejected" && e.note);
            return rejectionEvent ? (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                <p className="text-rose-700 font-medium text-xs mb-1">Rejection Reason</p>
                <p className="text-rose-600 text-sm">{rejectionEvent.note}</p>
              </div>
            ) : null;
          })()}

          {/* Items */}
          {items.length > 0 && (
            <div>
              <h4 className="font-semibold text-slate-800 mb-2">Returned Items ({items.length})</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Product</th>
                      <th className="px-3 py-2 font-medium text-center">Qty</th>
                      <th className="px-3 py-2 font-medium text-right">Unit Price</th>
                      <th className="px-3 py-2 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800">{it.name}</div>
                          {it.sku && <div className="text-xs text-slate-400 font-mono">{it.sku}</div>}
                          {it.reason && <div className="text-xs text-slate-500 mt-0.5">{it.reason}</div>}
                        </td>
                        <td className="px-3 py-2 text-center text-slate-600">{it.quantity}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{fmtMoney(it.unit_price)}</td>
                        <td className="px-3 py-2 text-right font-medium">{fmtMoney(it.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Status History */}
          {history.length > 0 && (
            <div>
              <h4 className="font-semibold text-slate-800 mb-2">Status History</h4>
              <div className="space-y-0">
                {history.slice().reverse().map((event, i) => {
                  const eCfg = RETURN_STATUS_LABELS[event.status] || { label: event.status, color: "text-slate-600", bg: "bg-slate-100" };
                  const isLast = i === history.length - 1;
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${eCfg.bg}`} />
                        {!isLast && <div className="w-0.5 flex-1 bg-slate-200 my-1" />}
                      </div>
                      <div className="pb-4 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${eCfg.color}`}>{eCfg.label}</span>
                          <span className="text-xs text-slate-400">{fmtDate(event.timestamp)}</span>
                        </div>
                        {event.note && <p className="text-xs text-slate-500 mt-0.5">{event.note}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          {(ret.status === "requested" || ret.status === "approved") && (
            <button
              onClick={onOpenStatus}
              className="w-full px-4 py-2 text-sm font-semibold text-white bg-brand rounded-lg hover:opacity-90 transition"
            >
              Update Status
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
