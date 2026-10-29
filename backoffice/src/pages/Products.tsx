import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { Pagination } from "@/components/Pagination";
import { useConfirmState, ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { ActionMenu } from "@/components/ActionMenu";
import { ReportFilters, type ReportFiltersValue } from "@/components/ReportFilters";
import { ExportDialog } from "@/components/ExportDialog";

export function Products() {
  const { tenant } = useAuth();
  const { formatMoney } = useCurrency();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirmDlg = useConfirmState();
  const toast = useToast();
  const [filters, setFilters] = useState<ReportFiltersValue>({});
  const [exportOpen, setExportOpen] = useState(false);
  const [page, setPage] = useState(0);
  const limit = 10;

  const q = useQuery({
    queryKey: ["products-admin", tenant, filters.search, filters.status, page],
    queryFn: () => api.listProductsAdmin(tenant, { search: filters.search, status: filters.status, limit, offset: page * limit }),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteProduct(tenant, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products-admin", tenant] }); toast.success("Deleted", "Product has been deleted."); },
    onError: (e) => toast.error("Delete failed", (e as Error).message),
  });

  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={`${q.data?.total ?? 0} products`}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExportOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition"
            >
              <Download className="w-4 h-4" /> Export
            </button>
            <Link
              to="/products/new"
              className="bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-dark"
            >
              + New Product
            </Link>
          </div>
        }
      />

      <ReportFilters
        value={filters}
        onChange={(v) => { setFilters(v); setPage(0); }}
        search
        searchPlaceholder="Search products…"
        selects={[
          { key: "status", label: "Status", options: [
            { value: "active", label: "Active" },
            { value: "draft", label: "Draft" },
            { value: "archived", label: "Archived" },
          ] },
        ]}
      />

      {q.isLoading ? (
        <TableSkeleton cols={7} rows={6} />
      ) : (
      <div className="bg-white rounded-2xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Variants</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((p) => (
              <tr key={p.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {p.image_url && (
                      <img src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    )}
                    <div>
                      <p className="font-medium text-neutral-900">{p.name}</p>
                      <p className="text-xs text-neutral-400">{p.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-neutral-600">{p.sku || "—"}</td>
                <td className="px-4 py-3 font-medium">{formatMoney(p.base_price, p.currency_code)}</td>
                <td className="px-4 py-3">{p.stock}</td>
                <td className="px-4 py-3">{p.variants?.length ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.status === "active" ? "bg-emerald-100 text-emerald-700" :
                    p.status === "draft" ? "bg-neutral-100 text-neutral-600" :
                    "bg-rose-100 text-rose-700"
                  }`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <ActionMenu
                    items={[
                      { label: "Edit", onClick: () => navigate(`/products/${p.id}/edit`) },
                      { label: "Delete", variant: "danger", onClick: () => confirmDlg.open({ message: `Delete ${p.name}?`, variant: "danger", confirmLabel: "Delete", onConfirm: () => del.mutate(p.id) }) },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-400">No products found.</td></tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} total={total} start={page * limit} end={Math.min((page + 1) * limit, total)} onPage={setPage} />
      </div>
      )}
      <ConfirmDialog {...confirmDlg.props} />
      <ExportDialog
        open={exportOpen}
        type="products"
        title="Products"
        filters={{ search: filters.search || "", status: filters.status || "" }}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}
