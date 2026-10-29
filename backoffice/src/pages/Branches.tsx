import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, Pencil, Star, Trash2, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { Pagination } from "@/components/Pagination";
import { useConfirmState, ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

export function Branches() {
  const { tenant } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const confirmDlg = useConfirmState();
  const [page, setPage] = useState(0);
  const limit = 10;
  const q = useQuery({ queryKey: ["branches", tenant, "page", page], queryFn: () => api.listBranches(tenant, { limit, offset: page * limit }) });
  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["branches", tenant] });

  const setDefault = useMutation({
    mutationFn: (id: string) => api.setDefaultBranch(tenant, id),
    onSuccess: () => { invalidate(); toast.success("Updated", "Default branch changed."); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteBranch(tenant, id),
    onSuccess: () => { invalidate(); toast.success("Deleted", "Branch removed."); },
    onError: (e) => toast.error("Delete failed", (e as Error).message),
  });

  return (
    <div>
      <PageHeader
        title="Branches"
        subtitle="Outlets & their delivery service areas"
        action={
          <button onClick={() => navigate("/branches/new")} className="bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark">
            + Add Branch
          </button>
        }
      />

      {q.isLoading ? (
        <TableSkeleton cols={6} rows={4} />
      ) : (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Branch</th>
                <th className="px-4 py-3 font-medium">Service area</th>
                <th className="px-4 py-3 font-medium">Named areas</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Backoffice</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((b) => (
                <tr key={b.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900 flex items-center gap-1.5">
                      {b.name}
                      {b.is_default && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                    </div>
                    <div className="text-xs text-neutral-400">/{b.slug}{b.city ? ` · ${b.city}` : ""}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {(() => {
                      const outer = (b.service_zones?.length ?? 0) > 0
                        ? Math.max(...b.service_zones!.map((z) => z.radius_km))
                        : b.radius_km;
                      if (outer <= 0) return "—";
                      return (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />{outer} km
                          {(b.service_zones?.length ?? 0) > 0 && (
                            <span className="text-xs text-neutral-400">· {b.service_zones!.length} zone{b.service_zones!.length > 1 ? "s" : ""}</span>
                          )}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{b.areas?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    {b.is_active ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Active</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-500">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/b/${b.slug}`} className="inline-flex items-center gap-1 text-brand hover:underline text-xs">
                      Open <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigate(`/branches/${b.id}/edit`)} className="p-1.5 rounded hover:bg-neutral-100" title="Edit"><Pencil className="w-4 h-4 text-neutral-500" /></button>
                      {!b.is_default && (
                        <button onClick={() => setDefault.mutate(b.id)} className="p-1.5 rounded hover:bg-neutral-100" title="Make default"><Star className="w-4 h-4 text-neutral-500" /></button>
                      )}
                      <button
                        onClick={() => confirmDlg.open({ message: `Delete branch "${b.name}"? Orders keep their history but lose the branch link.`, variant: "danger", confirmLabel: "Delete", onConfirm: () => remove.mutate(b.id) })}
                        className="p-1.5 rounded hover:bg-rose-50" title="Delete"><Trash2 className="w-4 h-4 text-rose-500" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-400">No branches yet. Add your first outlet.</td></tr>
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
