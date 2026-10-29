import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, ExternalLink, Trash2, FileText, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { TableSkeleton } from "@/components/Skeletons";
import { useConfirmState, ConfirmDialog } from "@/components/ConfirmDialog";
import { PAGE_TYPES } from "@/types";
import type { StorePage } from "@/types";

const PAGE_TYPE_LABELS: Record<string, string> = Object.fromEntries(PAGE_TYPES.map((p) => [p.value, p.label]));

export function Pages() {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const confirmDlg = useConfirmState();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ slug: "", title: "", page_type: "custom" });

  const [page, setPage] = useState(0);
  const limit = 10;
  const q = useQuery({
    queryKey: ["pages", tenant, page],
    queryFn: () => api.listPages(tenant!, { limit, offset: page * limit }),
    enabled: !!tenant,
  });

  const createMut = useMutation({
    mutationFn: (body: { slug: string; title: string; page_type: string }) =>
      api.createPage(tenant!, { slug: body.slug, title: body.title, page_type: body.page_type, status: "draft", blocks: [], meta_title: "", meta_description: "" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages", tenant] });
      setShowForm(false);
      setForm({ slug: "", title: "", page_type: "custom" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deletePage(tenant!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pages", tenant] }),
  });

  if (q.isLoading) return <TableSkeleton />;
  const pages = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <PageHeader
        title="Store Pages"
        subtitle={`${total} pages`}
        action={
          <button onClick={() => setShowForm((s) => !s)} className="bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark inline-flex items-center gap-1">
            <Plus className="w-4 h-4" /> New Page
          </button>
        }
      />

      {showForm && (
        <div className="bg-white rounded-xl border p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Page title (e.g. Shipping Info)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Slug (e.g. shipping-info)"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
              className="border rounded-md px-3 py-2 text-sm"
            />
            <select
              value={form.page_type}
              onChange={(e) => setForm({ ...form, page_type: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm"
            >
              {PAGE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => createMut.mutate(form)}
            disabled={!form.slug || !form.title || createMut.isPending}
            className="inline-flex items-center gap-2 bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {createMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {createMut.isPending ? "Creating..." : "Create Page"}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-left border-b">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p: StorePage) => (
              <tr key={p.id} className="border-b hover:bg-neutral-50 transition">
                <td className="px-4 py-3">
                  <Link to={`/pages/${p.id}/edit`} className="font-medium text-neutral-900 hover:text-brand inline-flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-neutral-400" />
                    {p.title || p.slug}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-500 font-mono text-xs">{p.slug}</td>
                <td className="px-4 py-3 text-neutral-600">{PAGE_TYPE_LABELS[p.page_type] || p.page_type}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    p.status === "published" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"
                  }`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-neutral-400">{new Date(p.updated_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <a
                      href={`/t/${tenant}/p/${p.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-neutral-400 hover:text-brand"
                      title="Preview"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    {!p.is_system && (
                      <button
                        onClick={() => confirmDlg.open({
                          message: `Delete page "${p.title}"? This cannot be undone.`,
                          variant: "danger",
                          confirmLabel: "Delete",
                          onConfirm: () => deleteMut.mutate(p.id),
                        })}
                        className="text-neutral-400 hover:text-rose-500"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {pages.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-neutral-400">
                  No pages yet. Click "New Page" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} total={total} start={page * limit} end={Math.min((page + 1) * limit, total)} onPage={setPage} />
      </div>

      <ConfirmDialog {...confirmDlg.props} />
    </div>
  );
}
