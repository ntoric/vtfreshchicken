import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { usePagination, Pagination } from "@/components/Pagination";
import { useConfirmState, ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Toggle } from "@/components/Toggle";
import { ActionMenu } from "@/components/ActionMenu";
import type { Category } from "@/types";

export function Categories() {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const confirmDlg = useConfirmState();
  const toast = useToast();
  const q = useQuery({ queryKey: ["categories", tenant], queryFn: () => api.listCategories(tenant) });
  const del = useMutation({
    mutationFn: (id: string) => api.deleteCategory(tenant, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories", tenant] }); toast.success("Deleted", "Category has been deleted."); },
    onError: (e) => toast.error("Delete failed", (e as Error).message),
  });
  const [editing, setEditing] = useState<Partial<Category> | null>(null);

  const save = useMutation({
    mutationFn: async (c: Partial<Category>) => {
      if (c.id) return api.updateCategory(tenant, c.id, c);
      return api.createCategory(tenant, c);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories", tenant] }); setEditing(null); },
  });

  const categories = q.data?.items ?? [];
  const pg = usePagination(categories, 10);

  // Build a map of parent names for display
  function parentName(id?: string | null): string {
    if (!id) return "—";
    const parent = categories.find(c => c.id === id);
    return parent ? parent.name : "—";
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle={`${categories.length} categories`}
        action={
          <button onClick={() => setEditing({ slug: "", name: "", description: "", sort_order: 0, is_active: true, parent_id: undefined })} className="bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark">
            + New Category
          </button>
        }
      />

      {editing && (
        <div className="bg-white rounded-2xl border p-6 mb-6 space-y-4">
          <h3 className="font-semibold">{editing.id ? "Edit" : "New"} Category</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input placeholder="Name" value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inp} />
            <input placeholder="Slug" value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className={inp} />
          </div>
          <textarea placeholder="Description" value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} className={inp} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input placeholder="SEO Meta Title (optional)" value={editing.meta_title || ""} onChange={(e) => setEditing({ ...editing, meta_title: e.target.value })} className={inp} />
            <input placeholder="SEO Meta Description (optional)" value={editing.meta_description || ""} onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })} className={inp} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select
              value={editing.parent_id || ""}
              onChange={(e) => setEditing({ ...editing, parent_id: e.target.value || undefined })}
              className={inp}
            >
              <option value="">— No parent (top level) —</option>
              {categories
                .filter(c => c.id !== editing.id) // can't be own parent
                .map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="number" placeholder="Sort order" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} className={`${inp} w-28`} />
                Sort
              </label>
              <Toggle
                checked={editing.is_active ?? true}
                onChange={(val) => setEditing({ ...editing, is_active: val })}
                label="Active"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => save.mutate(editing)} disabled={!editing.name || !editing.slug || save.isPending} className="inline-flex items-center gap-2 bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50">
              {save.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {save.isPending ? "Saving..." : "Save"}
            </button>
            <button onClick={() => setEditing(null)} className="border px-3 py-1.5 rounded-md text-sm">Cancel</button>
          </div>
        </div>
      )}

      {q.isLoading ? (
        <TableSkeleton cols={6} rows={5} />
      ) : (
      <div className="bg-white rounded-2xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Parent</th>
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pg.pageItems.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                <td className="px-4 py-3 text-slate-500">{c.slug}</td>
                <td className="px-4 py-3 text-slate-500">{parentName(c.parent_id)}</td>
                <td className="px-4 py-3">{c.sort_order}</td>
                <td className="px-4 py-3">{c.is_active ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : "—"}</td>
                <td className="px-4 py-3">
                  <ActionMenu
                    items={[
                      { label: "Edit", onClick: () => setEditing(c) },
                      { label: "Delete", variant: "danger", onClick: () => confirmDlg.open({ message: `Delete ${c.name}?`, variant: "danger", confirmLabel: "Delete", onConfirm: () => del.mutate(c.id) }) },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No categories yet.</td></tr>
            )}
          </tbody>
        </table>
        <Pagination page={pg.page} totalPages={pg.totalPages} total={pg.total} start={pg.start} end={pg.end} onPage={pg.setPage} />
      </div>
      )}
      <ConfirmDialog {...confirmDlg.props} />
    </div>
  );
}

const inp = "w-full border rounded-lg px-3 py-2 text-sm";
