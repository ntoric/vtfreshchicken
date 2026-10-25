import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Download } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { ActionMenu } from "@/components/ActionMenu";
import { ExportDialog } from "@/components/ExportDialog";
import { ORDER_STATUS_LABELS } from "@/types";

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "paid", label: "Paid" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "fulfilled", label: "Fulfilled" },
  { key: "cancelled", label: "Cancelled" },
  { key: "refunded", label: "Refunded" },
];

export function Orders() {
  const { tenant } = useAuth();
  const { formatMoney } = useCurrency();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlStatus = searchParams.get("status") ?? "";
  const [statusFilter, setStatusFilter] = useState(urlStatus);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const limit = 20;

  const q = useQuery({
    queryKey: ["orders", tenant, statusFilter, search, from, to, page],
    queryFn: () => api.listOrders(tenant, {
      status: statusFilter || undefined,
      search: search || undefined,
      from: from || undefined,
      to: to || undefined,
      limit,
      offset: page * limit,
    }),
  });

  const countsQ = useQuery({
    queryKey: ["order-counts", tenant],
    queryFn: () => api.orderCounts(tenant),
  });

  // Deep links like /orders?status=pending (e.g. from the dashboard)
  useEffect(() => {
    setStatusFilter(urlStatus);
    setPage(0);
  }, [urlStatus]);

  const counts = countsQ.data?.counts || {};
  const total = q.data?.total ?? 0;
  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Orders" subtitle={`${total} order${total !== 1 ? "s" : ""}`} />
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

      {/* Search + date range */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by order ID, customer name, or email..."
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
                <th className="px-4 py-3 font-medium">Order ID</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {q.data.items.map((o) => {
                const cfg = ORDER_STATUS_LABELS[o.status] || { label: o.status, color: "text-slate-600", bg: "bg-slate-100" };
                return (
                  <tr key={o.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      #{o.id.slice(0, 8)}
                      {o.order_tag && (
                        <span className="ml-1 inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 align-middle">
                          {o.order_tag}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{o.customer_name || "—"}</div>
                      <div className="text-xs text-slate-400">{o.customer_email || ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 capitalize">
                      {o.payment_method ? o.payment_method.replace(/_/g, " ") : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatMoney(o.grand_total, o.currency_code)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(o.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ActionMenu
                        items={[
                          { label: "View Details", onClick: () => navigate(`/orders/${o.id}`) },
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
                  <ArrowLeft className="w-3.5 h-3.5 inline" /> Prev
                </button>
                <span className="px-3 py-1 text-sm text-slate-500">
                  Page {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40 hover:bg-white transition"
                >
                  Next <ArrowRight className="w-3.5 h-3.5 inline" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border p-12 text-center">
          <svg className="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-slate-400 text-sm">
            {search || statusFilter ? "No orders match your filters." : "No orders yet."}
          </p>
        </div>
      )}
      <ExportDialog
        open={exportOpen}
        type="orders"
        title="Orders"
        filters={{ status: statusFilter, search, from, to }}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}
