import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api, generateIdempotencyKey } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { Pagination } from "@/components/Pagination";
import { ActionMenu } from "@/components/ActionMenu";
import { ReportFilters, type ReportFiltersValue } from "@/components/ReportFilters";
import { ExportDialog } from "@/components/ExportDialog";
import type { InventoryItem } from "@/types";

type Tab = "inventory" | "movements";

export function Inventory() {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("inventory");
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [movFilters, setMovFilters] = useState<ReportFiltersValue>({});
  const [exportOpen, setExportOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustForm, setAdjustForm] = useState({ new_stock: "", reason: "" });

  const statsQ = useQuery({ queryKey: ["inventory-stats", tenant], queryFn: () => api.inventoryStats(tenant) });
  const [invPage, setInvPage] = useState(0);
  const invLimit = 10;
  const invQ = useQuery({
    queryKey: ["inventory", tenant, filter, search, invPage],
    queryFn: () => api.listInventory(tenant, { filter: filter || undefined, search: search || undefined, limit: invLimit, offset: invPage * invLimit }),
  });
  const [movPage, setMovPage] = useState(0);
  const movLimit = 10;
  const movQ = useQuery({
    queryKey: ["stock-movements", tenant, movFilters.from, movFilters.to, movFilters.movement_type, movFilters.search, movPage],
    queryFn: () => api.listStockMovements(tenant, {
      limit: movLimit, offset: movPage * movLimit,
      movement_type: movFilters.movement_type,
      search: movFilters.search,
      from: movFilters.from,
      to: movFilters.to,
    }),
    enabled: tab === "movements",
  });

  const movTotal = movQ.data?.total ?? 0;
  const movTotalPages = Math.max(1, Math.ceil(movTotal / movLimit));

  const adjustIdemKeyRef = useRef("");
  const adjust = useMutation({
    mutationFn: () => {
      if (!adjustIdemKeyRef.current) adjustIdemKeyRef.current = generateIdempotencyKey();
      return api.adjustStock(tenant, {
        product_id: adjustItem!.product_id,
        variant_id: adjustItem?.variant_id || undefined,
        new_stock: Number(adjustForm.new_stock),
        reason: adjustForm.reason || "Manual adjustment",
      }, adjustIdemKeyRef.current);
    },
    onSuccess: () => {
      adjustIdemKeyRef.current = "";
      qc.invalidateQueries({ queryKey: ["inventory", tenant] });
      qc.invalidateQueries({ queryKey: ["inventory-stats", tenant] });
      qc.invalidateQueries({ queryKey: ["stock-movements", tenant] });
      setAdjustItem(null);
      setAdjustForm({ new_stock: "", reason: "" });
    },
  });

  const stats = statsQ.data;
  const filtered = invQ.data?.items ?? [];
  const invTotal = invQ.data?.total ?? 0;
  const invTotalPages = Math.max(1, Math.ceil(invTotal / invLimit));

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Inventory" subtitle="Stock management & movement history" />
        <button
          onClick={() => setExportOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition flex-shrink-0"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total SKUs" value={stats?.total_skus ?? "—"} color="text-neutral-900" />
        <StatCard label="In Stock" value={stats?.in_stock ?? "—"} color="text-emerald-600" />
        <StatCard label="Low Stock" value={stats?.low_stock ?? "—"} color="text-amber-600" />
        <StatCard label="Out of Stock" value={stats?.out_of_stock ?? "—"} color="text-rose-600" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        <button
          onClick={() => setTab("inventory")}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "inventory" ? "border-brand text-brand" : "border-transparent text-neutral-500"}`}
        >
          Stock Levels
        </button>
        <button
          onClick={() => setTab("movements")}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "movements" ? "border-brand text-brand" : "border-transparent text-neutral-500"}`}
        >
          Movement History
        </button>
      </div>

      {tab === "inventory" && (
        <>
          {/* Filters */}
          <div className="flex gap-3 mb-4">
            <input
              placeholder="Search products, SKUs, variants…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setInvPage(0); }}
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
            />
            <select value={filter} onChange={(e) => { setFilter(e.target.value); setInvPage(0); }} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">All items</option>
              <option value="products">Products only</option>
              <option value="variants">Variants only</option>
            </select>
          </div>

          {invQ.isLoading ? (
            <TableSkeleton cols={6} rows={8} />
          ) : (
            <div className="bg-white rounded-2xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-neutral-500 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">SKU</th>
                    <th className="px-4 py-3 font-medium">Variant</th>
                    <th className="px-4 py-3 font-medium">Stock</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((item, idx) => (
                    <tr key={`${item.product_id}-${item.variant_id || ""}-${idx}`} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 font-medium text-neutral-900">{item.product_name}</td>
                      <td className="px-4 py-3 text-neutral-500 font-mono text-xs">{item.sku || "—"}</td>
                      <td className="px-4 py-3 text-neutral-500">{item.variant_name || "—"}</td>
                      <td className="px-4 py-3 font-semibold">{item.stock}</td>
                      <td className="px-4 py-3">
                        {item.is_out_of_stock ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700">Out of stock</span>
                        ) : item.is_low_stock ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Low stock</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">In stock</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ActionMenu
                          items={[
                            {
                              label: "Adjust",
                              onClick: () => {
                                setAdjustItem(item);
                                setAdjustForm({ new_stock: String(item.stock), reason: "" });
                              },
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-400">No inventory items found.</td></tr>
                  )}
                </tbody>
              </table>
              <Pagination page={invPage} totalPages={invTotalPages} total={invTotal} start={invPage * invLimit} end={Math.min((invPage + 1) * invLimit, invTotal)} onPage={setInvPage} />
            </div>
          )}

          {/* Adjust modal */}
          {adjustItem && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
                <h3 className="font-semibold text-lg">Adjust Stock</h3>
                <div>
                  <p className="text-sm text-neutral-600">{adjustItem.product_name}</p>
                  {adjustItem.variant_name && <p className="text-sm text-neutral-400">{adjustItem.variant_name}</p>}
                  <p className="text-sm text-neutral-400 mt-1">Current stock: <span className="font-semibold">{adjustItem.stock}</span></p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-neutral-700">New stock level</label>
                    <input
                      type="number"
                      value={adjustForm.new_stock}
                      onChange={(e) => setAdjustForm({ ...adjustForm, new_stock: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-700">Reason (optional)</label>
                    <input
                      value={adjustForm.reason}
                      onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                      placeholder="e.g. Stock count, damaged goods, restock"
                      className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setAdjustItem(null); setAdjustForm({ new_stock: "", reason: "" }); }} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                  <button
                    onClick={() => adjust.mutate()}
                    disabled={adjustForm.new_stock === "" || adjust.isPending}
                    className="inline-flex items-center gap-2 bg-brand text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50"
                  >
                    {adjust.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    {adjust.isPending ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "movements" && (
        <>
          <ReportFilters
            value={movFilters}
            onChange={(v) => { setMovFilters(v); setMovPage(0); }}
            dateRange
            search
            searchPlaceholder="Search product, SKU, reason…"
            selects={[
              { key: "movement_type", label: "Movement type", options: [
                { value: "purchase", label: "Purchase" },
                { value: "adjustment", label: "Adjustment" },
                { value: "sale", label: "Sale" },
                { value: "return", label: "Return" },
                { value: "transfer", label: "Transfer" },
              ] },
            ]}
          />
          {movQ.isLoading ? (
            <TableSkeleton cols={6} rows={10} />
          ) : (
            <div className="bg-white rounded-2xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-neutral-500 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Variant</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Qty</th>
                    <th className="px-4 py-3 font-medium">Reason / Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(movQ.data?.items ?? []).map((m) => (
                    <tr key={m.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 text-xs text-neutral-400">{new Date(m.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 font-medium text-neutral-900">{m.product_name}</td>
                      <td className="px-4 py-3 text-neutral-500">{m.variant_name || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${movementBadge(m.movement_type)}`}>
                          {m.movement_type}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-semibold ${m.quantity > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {m.quantity > 0 ? "+" : ""}{m.quantity}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-400">
                        {m.reason && <p>{m.reason}</p>}
                        {m.reference && <p className="font-mono">Ref: {m.reference.slice(0, 8)}</p>}
                      </td>
                    </tr>
                  ))}
                  {movQ.data && movQ.data.items.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-400">No stock movements match the filters.</td></tr>
                  )}
                </tbody>
              </table>
              <Pagination page={movPage} totalPages={movTotalPages} total={movTotal} start={movPage * movLimit} end={Math.min((movPage + 1) * movLimit, movTotal)} onPage={setMovPage} />
            </div>
          )}
        </>
      )}
      <ExportDialog
        open={exportOpen}
        type={tab === "movements" ? "stock_movements" : "inventory"}
        title={tab === "movements" ? "Stock Movements" : "Inventory"}
        filters={tab === "movements"
          ? { movement_type: movFilters.movement_type || "", search: movFilters.search || "", from: movFilters.from || "", to: movFilters.to || "" }
          : {}
        }
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-2xl border p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function movementBadge(type: string): string {
  switch (type) {
    case "order": return "bg-rose-100 text-rose-700";
    case "restock": return "bg-emerald-100 text-emerald-700";
    case "adjustment": return "bg-amber-100 text-amber-700";
    case "cancellation": return "bg-blue-100 text-blue-700";
    default: return "bg-neutral-100 text-neutral-600";
  }
}
