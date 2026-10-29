import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, X, CheckCircle2, EyeOff, Eye, Trash2, MessageSquareText } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { ActionMenu } from "@/components/ActionMenu";
import { useConfirmState, ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import type { Review } from "@/types";

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "approved", label: "Approved" },
  { key: "pending", label: "Pending" },
];

const LIMIT = 20;

function StarRow({ rating, size = "w-4 h-4" }: { rating: number; size?: string }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${size} ${s <= rating ? "text-amber-400 fill-amber-400" : "text-neutral-200 fill-neutral-200"}`}
        />
      ))}
    </div>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function Reviews() {
  const { tenant, user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const confirmDlg = useConfirmState();
  const isSuperAdmin = user?.role === "superadmin";

  const [statusFilter, setStatusFilter] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Review | null>(null);

  const q = useQuery({
    queryKey: ["reviews", tenant, statusFilter, ratingFilter, search, page],
    queryFn: () =>
      api.listReviews(tenant, {
        status: statusFilter || undefined,
        rating: ratingFilter ? Number(ratingFilter) : undefined,
        search: search || undefined,
        limit: LIMIT,
        offset: page * LIMIT,
      }),
  });

  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT) || 1;
  const stats = q.data?.stats;

  const approveMut = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      api.updateReview(tenant, id, approved),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["reviews", tenant] });
      toast.success(v.approved ? "Review approved" : "Review hidden");
      setSelected((cur) => (cur && cur.id === v.id ? { ...cur, is_approved: v.approved } : cur));
    },
    onError: (e: Error) => toast.error("Update failed", e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => api.deleteReview(tenant, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews", tenant] });
      setSelected(null);
      toast.success("Review deleted");
    },
    onError: (e: Error) => toast.error("Delete failed", e.message),
  });

  const confirmDelete = (r: Review) =>
    confirmDlg.open({
      title: "Delete review?",
      message: (
        <>
          Permanently delete the {r.rating}-star review by <b>{r.author_name}</b>
          {r.product_name ? <> on <b>{r.product_name}</b></> : ""}? This cannot be undone.
        </>
      ),
      confirmLabel: "Delete",
      variant: "danger",
      onConfirm: () => delMut.mutate(r.id),
    });

  const actionItems = (r: Review) => [
    { label: "View Details", icon: <Eye className="w-3.5 h-3.5" />, onClick: () => setSelected(r) },
    r.is_approved
      ? { label: "Hide", icon: <EyeOff className="w-3.5 h-3.5" />, onClick: () => approveMut.mutate({ id: r.id, approved: false }) }
      : { label: "Approve", icon: <CheckCircle2 className="w-3.5 h-3.5" />, onClick: () => approveMut.mutate({ id: r.id, approved: true }) },
    {
      label: "Delete",
      icon: <Trash2 className="w-3.5 h-3.5" />,
      variant: "danger" as const,
      disabled: !isSuperAdmin,
      onClick: () => confirmDelete(r),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Reviews"
        subtitle="Moderate customer product reviews"
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-2xl border p-4">
            <p className="text-xs text-neutral-500 font-medium">Total Reviews</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-white rounded-2xl border p-4">
            <p className="text-xs text-neutral-500 font-medium">Average Rating</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-2xl font-bold text-neutral-900">{stats.avg_rating.toFixed(1)}</p>
              <StarRow rating={Math.round(stats.avg_rating)} />
            </div>
          </div>
          <div className="bg-white rounded-2xl border p-4">
            <p className="text-xs text-neutral-500 font-medium">Approved</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.approved}</p>
          </div>
          <div className="bg-white rounded-2xl border p-4">
            <p className="text-xs text-neutral-500 font-medium">Pending</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{stats.pending}</p>
          </div>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => {
          const count =
            tab.key === "" ? stats?.total ?? 0 : tab.key === "approved" ? stats?.approved ?? 0 : stats?.pending ?? 0;
          const active = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setStatusFilter(tab.key); setPage(0); }}
              className={`px-2.5 py-1 rounded-md text-sm font-medium whitespace-nowrap transition ${
                active ? "bg-brand text-white" : "bg-white border text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`ml-1.5 text-xs ${active ? "text-white/80" : "text-neutral-400"}`}>
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
          value={ratingFilter}
          onChange={(e) => { setRatingFilter(e.target.value); setPage(0); }}
          className="px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">All Ratings</option>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>{r} star{r !== 1 ? "s" : ""}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search by author, title, review text, or product..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="flex-1 min-w-[200px] max-w-md px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
        />
      </div>

      {q.isLoading ? (
        <TableSkeleton cols={6} rows={6} />
      ) : items.length > 0 ? (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Review</th>
                <th className="px-4 py-3 font-medium">Author</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5 min-w-[140px]">
                      {r.product_image ? (
                        <img src={r.product_image} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-neutral-100 flex-shrink-0" />
                      )}
                      <span className="font-medium text-neutral-800 line-clamp-1">{r.product_name || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-[320px]">
                    <StarRow rating={r.rating} size="w-3.5 h-3.5" />
                    {r.title && <p className="font-medium text-neutral-800 mt-1 line-clamp-1">{r.title}</p>}
                    <p className="text-neutral-500 text-xs mt-0.5 line-clamp-2">{r.body}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-800">{r.author_name}</div>
                    {r.is_verified && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                        <CheckCircle2 className="w-3 h-3" /> Verified customer
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.is_approved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {r.is_approved ? "Approved" : "Pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionMenu items={actionItems(r)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-neutral-50">
              <p className="text-xs text-neutral-500">
                Showing {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40 hover:bg-white transition"
                >
                  Prev
                </button>
                <span className="px-3 py-1 text-sm text-neutral-500">
                  Page {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
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
          <MessageSquareText className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
          <p className="text-neutral-400 text-sm">
            {search || statusFilter || ratingFilter ? "No reviews match your filters." : "No reviews yet."}
          </p>
        </div>
      )}

      {/* Review Details Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 border-b">
              <div>
                <h3 className="text-lg font-bold text-neutral-800">Review Details</h3>
                <p className="text-xs text-neutral-500 mt-0.5">{fmtDate(selected.created_at)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Product */}
              <div className="flex items-center gap-3">
                {selected.product_image ? (
                  <img src={selected.product_image} alt="" className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-neutral-100" />
                )}
                <div>
                  <p className="font-medium text-neutral-800">{selected.product_name || "—"}</p>
                  <StarRow rating={selected.rating} />
                </div>
              </div>

              {/* Author */}
              <div className="flex items-center gap-2">
                <span className="font-medium text-neutral-800">{selected.author_name}</span>
                {selected.is_verified && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Verified customer
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    selected.is_approved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {selected.is_approved ? "Approved" : "Pending"}
                </span>
              </div>

              {/* Body */}
              {selected.title && <h4 className="font-semibold text-neutral-900">{selected.title}</h4>}
              <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap">{selected.body || "—"}</p>

              {/* Images */}
              {selected.images && selected.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selected.images.map((img) => (
                    <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer">
                      <img src={img.url} alt={img.alt || "Review photo"} className="w-20 h-20 rounded-lg object-cover border" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 p-5 border-t">
              <div>
                {isSuperAdmin ? (
                  <button
                    onClick={() => confirmDelete(selected)}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 transition"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                ) : (
                  <span className="text-xs text-neutral-400">Deleting reviews requires superadmin</span>
                )}
              </div>
              <button
                onClick={() => approveMut.mutate({ id: selected.id, approved: !selected.is_approved })}
                disabled={approveMut.isPending}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white transition disabled:opacity-50 ${
                  selected.is_approved ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {selected.is_approved ? (
                  <><EyeOff className="w-4 h-4" /> Hide review</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Approve review</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog {...confirmDlg.props} />
    </div>
  );
}
