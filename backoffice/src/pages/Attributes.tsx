import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { Pagination } from "@/components/Pagination";
import { useConfirmState, ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Toggle } from "@/components/Toggle";
import { ActionMenu } from "@/components/ActionMenu";
import type { Attribute, AttributeOption } from "@/types";

export function Attributes() {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const confirmDlg = useConfirmState();
  const toast = useToast();
  const [page, setPage] = useState(0);
  const limit = 10;
  const q = useQuery({ queryKey: ["attributes", tenant, page], queryFn: () => api.listAttributes(tenant, { limit, offset: page * limit }) });
  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const del = useMutation({
    mutationFn: (id: string) => api.deleteAttribute(tenant, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attributes", tenant] }); toast.success("Deleted", "Attribute has been deleted."); },
    onError: (e) => toast.error("Delete failed", (e as Error).message),
  });

  const [editing, setEditing] = useState<Partial<Attribute> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [options, setOptions] = useState<AttributeOption[]>([]);

  const createMut = useMutation({
    mutationFn: (a: Partial<Attribute>) => api.createAttribute(tenant, { ...a, options }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attributes", tenant] }); closeForm(); },
  });

  const updateMut = useMutation({
    mutationFn: (a: Partial<Attribute>) => api.updateAttribute(tenant, editingId!, { ...a, options }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attributes", tenant] }); closeForm(); },
  });

  function closeForm() {
    setEditing(null);
    setEditingId(null);
    setOptions([]);
  }

  function startEdit(a: Attribute) {
    setEditingId(a.id);
    setEditing({ slug: a.slug, name: a.name, type: a.type, is_filterable: a.is_filterable, is_variant: a.is_variant, is_batch: a.is_batch, is_internal: a.is_internal });
    setOptions(a.options?.map(o => ({ ...o })) ?? []);
  }

  function addOption() {
    setOptions((o) => [...o, { value: "", label: "", sort_order: o.length, attribute_id: "" }]);
  }

  function save() {
    if (!editing) return;
    if (editingId) updateMut.mutate(editing);
    else createMut.mutate(editing);
  }

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div>
      <PageHeader
        title="Attributes"
        subtitle={`${total} attributes`}
        action={
          <button onClick={() => { setEditingId(null); setEditing({ slug: "", name: "", type: "text", is_filterable: false, is_variant: false, is_batch: false, is_internal: false }); setOptions([]); }} className="bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark">
            + New Attribute
          </button>
        }
      />

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold">{editingId ? "Edit Attribute" : "New Attribute"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <input placeholder="Name" value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inp} />
              <input placeholder="Slug" value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className={inp} />
              <select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })} className={inp}>
                <option value="text">Text</option>
                <option value="select">Select</option>
                <option value="color">Color</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="datetime">Date &amp; Time</option>
              </select>
            </div>
            <div className="flex gap-6">
              <Toggle
                checked={editing.is_filterable || false}
                onChange={(val) => setEditing({ ...editing, is_filterable: val })}
                label="Filterable"
              />
              <Toggle
                checked={editing.is_variant || false}
                onChange={(val) => setEditing({ ...editing, is_variant: val })}
                label="Used for variants"
              />
              <Toggle
                checked={editing.is_batch || false}
                onChange={(val) => setEditing({ ...editing, is_batch: val })}
                label="Used for batches"
              />
              <Toggle
                checked={editing.is_internal || false}
                onChange={(val) => setEditing({ ...editing, is_internal: val })}
                label="Internal (hidden from storefront)"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">Options</h4>
                <button onClick={addOption} className="text-sm text-brand hover:underline">+ Add option</button>
              </div>
              <div className="space-y-2">
                {options.map((o, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2">
                    <input placeholder="Value (e.g. red)" value={o.value} onChange={(e) => setOptions((os) => os.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))} className={inp} />
                    <input placeholder="Label (e.g. Red)" value={o.label} onChange={(e) => setOptions((os) => os.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} className={inp} />
                    <button onClick={() => setOptions((os) => os.filter((_, idx) => idx !== i))} className="text-rose-500 text-sm">Remove</button>
                  </div>
                ))}
                {options.length === 0 && <p className="text-xs text-neutral-400">No options yet. Add options for select/color type attributes.</p>}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={save} disabled={isSaving || !editing.name || !editing.slug} className="bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50">
                {isSaving ? "Saving..." : editingId ? "Update" : "Save"}
              </button>
              <button onClick={closeForm} className="border px-3 py-1.5 rounded-md text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {q.isLoading ? (
        <TableSkeleton cols={6} rows={4} />
      ) : (
      <div className="bg-white rounded-2xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Options</th>
              <th className="px-4 py-3 font-medium">Flags</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((a) => (
              <tr key={a.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3 font-medium text-neutral-900">{a.name}</td>
                <td className="px-4 py-3 text-neutral-500">{a.slug}</td>
                <td className="px-4 py-3"><span className="bg-neutral-100 px-2 py-0.5 rounded text-xs">{a.type}</span></td>
                <td className="px-4 py-3 text-neutral-500">{a.options?.length ?? 0}</td>
                <td className="px-4 py-3 text-xs">
                  {a.is_filterable && <span className="text-blue-600 mr-2">filter</span>}
                  {a.is_variant && <span className="text-purple-600 mr-2">variant</span>}
                  {a.is_batch && <span className="text-emerald-600 mr-2">batch</span>}
                  {a.is_internal && <span className="text-amber-600">internal</span>}
                </td>
                <td className="px-4 py-3">
                  <ActionMenu
                    items={[
                      { label: "Edit", onClick: () => startEdit(a) },
                      { label: "Delete", variant: "danger", onClick: () => confirmDlg.open({ message: `Delete ${a.name}?`, variant: "danger", confirmLabel: "Delete", onConfirm: () => del.mutate(a.id) }) },
                    ]}
                  />
                </td>
              </tr>
            ))}
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
