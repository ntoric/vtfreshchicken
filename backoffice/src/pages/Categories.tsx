import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { Pagination } from "@/components/Pagination";
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
  const [page, setPage] = useState(0);
  const limit = 10;
  const q = useQuery({ queryKey: ["categories", tenant, "page", page], queryFn: () => api.listCategories(tenant, { limit, offset: page * limit }) });
  // Full (unpaginated) list for the parent picker in the edit dialog.
  const allCatsQ = useQuery({ queryKey: ["categories", tenant, "all"], queryFn: () => api.listCategories(tenant) });
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

  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const allCats = allCatsQ.data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle={`${total} categories`}
        action={
          <button onClick={() => setEditing({ slug: "", name: "", description: "", sort_order: 0, is_active: true, parent_id: undefined })} className="bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark">
            + New Category
          </button>
        }
      />

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
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
                {allCats
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
        </div>
      )}

      {q.isLoading ? (
        <TableSkeleton cols={6} rows={5} />
      ) : (
      <div className="bg-white rounded-2xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-left">
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
            {items.map((c) => (
              <tr key={c.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3 font-medium text-neutral-900">{c.name}</td>
                <td className="px-4 py-3 text-neutral-500">{c.slug}</td>
                <td className="px-4 py-3 text-neutral-500">{c.parent_name || "—"}</td>
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
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-400">No categories yet.</td></tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} total={total} start={page * limit} end={Math.min((page + 1) * limit, total)} onPage={setPage} />
      </div>
      )}
      <ConfirmDialog {...confirmDlg.props} />
    </div>
  );
}

const inp = "w-full border rounded-lg px-3 py-2 text-sm";
