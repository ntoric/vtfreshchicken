import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { usePagination, Pagination } from "@/components/Pagination";
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
  const q = useQuery({ queryKey: ["attributes", tenant], queryFn: () => api.listAttributes(tenant) });
  const pg = usePagination(q.data?.items ?? [], 10);
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
    setEditing({ slug: a.slug, name: a.name, type: a.type, is_filterable: a.is_filterable, is_variant: a.is_variant });
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
        subtitle={`${q.data?.items.length ?? 0} attributes`}
        action={
          <button onClick={() => { setEditingId(null); setEditing({ slug: "", name: "", type: "text", is_filterable: false, is_variant: false }); setOptions([]); }} className="bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark">
            + New Attribute
          </button>
        }
      />

      {editing && (
        <div className="bg-white rounded-2xl border p-6 mb-6 space-y-4">
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
              {options.length === 0 && <p className="text-xs text-slate-400">No options yet. Add options for select/color type attributes.</p>}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={save} disabled={isSaving || !editing.name || !editing.slug} className="bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50">
              {isSaving ? "Saving..." : editingId ? "Update" : "Save"}
            </button>
            <button onClick={closeForm} className="border px-3 py-1.5 rounded-md text-sm">Cancel</button>
          </div>
        </div>
      )}

      {q.isLoading ? (
        <TableSkeleton cols={6} rows={4} />
      ) : (
      <div className="bg-white rounded-2xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
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
            {pg.pageItems.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{a.name}</td>
                <td className="px-4 py-3 text-slate-500">{a.slug}</td>
                <td className="px-4 py-3"><span className="bg-slate-100 px-2 py-0.5 rounded text-xs">{a.type}</span></td>
                <td className="px-4 py-3 text-slate-500">{a.options?.length ?? 0}</td>
                <td className="px-4 py-3 text-xs">
                  {a.is_filterable && <span className="text-blue-600 mr-2">filter</span>}
                  {a.is_variant && <span className="text-purple-600">variant</span>}
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
        <Pagination page={pg.page} totalPages={pg.totalPages} total={pg.total} start={pg.start} end={pg.end} onPage={pg.setPage} />
      </div>
      )}
      <ConfirmDialog {...confirmDlg.props} />
    </div>
  );
}

const inp = "w-full border rounded-lg px-3 py-2 text-sm";
