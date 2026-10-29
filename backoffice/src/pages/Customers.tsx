import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { api, generateIdempotencyKey } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton, Spinner } from "@/components/Skeletons";
import { useConfirmState, ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Toggle } from "@/components/Toggle";
import { ExportDialog } from "@/components/ExportDialog";
import type { User, CustomerDetail } from "@/types";

export function Customers() {
  const { tenant } = useAuth();
  const { formatMoney } = useCurrency();
  const qc = useQueryClient();
  const confirmDlg = useConfirmState();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const limit = 20;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: "", phone: "", is_active: true, marketing_consent: false, admin_notes: "" });

  // Wallet admin state
  const [walletAdjustAmount, setWalletAdjustAmount] = useState("");
  const [walletAdjustNote, setWalletAdjustNote] = useState("");

  const listQ = useQuery({
    queryKey: ["customers", tenant, search, statusFilter, page],
    queryFn: () => api.listCustomers(tenant, search || undefined, statusFilter || undefined, limit, page * limit),
  });

  const statsQ = useQuery({
    queryKey: ["customer-stats", tenant],
    queryFn: () => api.customerStats(tenant),
  });

  const detailQ = useQuery({
    queryKey: ["customer", tenant, selectedId],
    queryFn: () => api.getCustomer(tenant, selectedId!),
    enabled: !!selectedId,
  });

  // Wallet queries (only when a customer is selected)
  const walletQ = useQuery({
    queryKey: ["customer-wallet", tenant, selectedId],
    queryFn: () => api.customerWallet(tenant, selectedId!),
    enabled: !!selectedId,
  });

  const walletTxnsQ = useQuery({
    queryKey: ["customer-wallet-txns", tenant, selectedId],
    queryFn: () => api.customerWalletTransactions(tenant, selectedId!, 20, 0),
    enabled: !!selectedId,
  });

  const walletIdemKeyRef = useRef("");
  const walletAdjustMut = useMutation({
    mutationFn: ({ amount, description }: { amount: number; description?: string }) => {
      if (!walletIdemKeyRef.current) walletIdemKeyRef.current = generateIdempotencyKey();
      return api.adjustCustomerWallet(tenant, selectedId!, amount, description, walletIdemKeyRef.current);
    },
    onSuccess: () => {
      walletIdemKeyRef.current = "";
      qc.invalidateQueries({ queryKey: ["customer-wallet", tenant, selectedId] });
      qc.invalidateQueries({ queryKey: ["customer-wallet-txns", tenant, selectedId] });
      setWalletAdjustAmount("");
      setWalletAdjustNote("");
      toast.success("Wallet adjusted", "The customer's wallet balance has been updated.");
    },
    onError: (e: Error) => {
      toast.error("Adjustment failed", e.message);
    },
  });

  const updateMut = useMutation({
    mutationFn: (body: any) => api.updateCustomer(tenant, selectedId!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers", tenant] });
      qc.invalidateQueries({ queryKey: ["customer", tenant, selectedId] });
      qc.invalidateQueries({ queryKey: ["customer-stats", tenant] });
      setEditing(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteCustomer(tenant, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers", tenant] });
      qc.invalidateQueries({ queryKey: ["customer-stats", tenant] });
      setSelectedId(null);
      toast.success("Deleted", "Customer has been deleted.");
    },
    onError: (e) => toast.error("Delete failed", (e as Error).message),
  });

  function openDetail(c: User) {
    setSelectedId(c.id);
    setEditing(false);
  }

  function startEdit(cd: CustomerDetail) {
    setEditForm({
      full_name: cd.full_name,
      phone: cd.phone || "",
      is_active: cd.is_active,
      marketing_consent: cd.marketing_consent || false,
      admin_notes: cd.admin_notes || "",
    });
    setEditing(true);
  }

  const stats = statsQ.data;
  const total = listQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Customers" subtitle={`${total} customers`} />
        <button
          onClick={() => setExportOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition flex-shrink-0"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Customers" value={stats?.total_customers ?? "—"} />
        <StatCard label="Active" value={stats?.active_customers ?? "—"} />
        <StatCard label="New This Month" value={stats?.new_this_month ?? "—"} />
        <StatCard label="Total Revenue" value={stats ? formatMoney(stats.total_spent) : "—"} />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search by name or email…"
          className="flex-1 max-w-sm border rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer list */}
        <div className="lg:col-span-2">
          {listQ.isLoading ? (
            <TableSkeleton cols={5} rows={6} />
          ) : (
            <div className="bg-white rounded-2xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-neutral-500 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {listQ.data?.items.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => openDetail(c)}
                      className={`hover:bg-neutral-50 cursor-pointer ${selectedId === c.id ? "bg-brand/5" : ""}`}
                    >
                      <td className="px-4 py-3 font-medium text-neutral-900">{c.full_name || "—"}</td>
                      <td className="px-4 py-3 text-neutral-600">{c.email}</td>
                      <td className="px-4 py-3 text-neutral-500">{c.phone || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.is_active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                        }`}>
                          {c.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-400 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {listQ.data && listQ.data.items.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-400">No customers found.</td></tr>
                  )}
                </tbody>
              </table>
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
                  <span className="text-neutral-500">{page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 border rounded disabled:opacity-40">Prev</button>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Customer detail panel */}
        <div className="lg:col-span-1">
          {!selectedId ? (
            <div className="bg-white rounded-2xl border p-8 text-center text-neutral-400 text-sm">
              Select a customer to view details.
            </div>
          ) : detailQ.isLoading ? (
            <div className="bg-white rounded-2xl border p-8 flex items-center justify-center">
              <Spinner size={24} />
            </div>
          ) : detailQ.data ? (
            <div className="bg-white rounded-2xl border p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-neutral-900">{detailQ.data.full_name || "—"}</h3>
                  <p className="text-sm text-neutral-500">{detailQ.data.email}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  detailQ.data.is_active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                }`}>
                  {detailQ.data.is_active ? "Active" : "Disabled"}
                </span>
              </div>

              {/* Order stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-xs text-neutral-500">Orders</p>
                  <p className="text-lg font-semibold text-neutral-900">{detailQ.data.order_count}</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-xs text-neutral-500">Total Spent</p>
                  <p className="text-lg font-semibold text-neutral-900">{formatMoney(detailQ.data.total_spent)}</p>
                </div>
              </div>

              {!editing ? (
                <>
                  {/* Read-only details */}
                  <div className="space-y-2 text-sm">
                    <DetailRow label="Phone" value={detailQ.data.phone || "—"} />
                    <DetailRow label="Marketing Consent" value={detailQ.data.marketing_consent ? "Yes" : "No"} />
                    <DetailRow label="Last Login" value={detailQ.data.last_login_at ? new Date(detailQ.data.last_login_at).toLocaleString() : "Never"} />
                    <DetailRow label="Joined" value={new Date(detailQ.data.created_at).toLocaleDateString()} />
                  </div>

                  {/* Addresses */}
                  {detailQ.data.addresses.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-neutral-600 mb-2">Addresses</h4>
                      <div className="space-y-2">
                        {detailQ.data.addresses.map((a) => (
                          <div key={a.id} className="text-xs bg-neutral-50 rounded-lg p-2">
                            <p className="font-medium">{a.label}{a.is_default && <span className="text-brand ml-1">(default)</span>}</p>
                            <p className="text-neutral-500">{a.line1}, {a.city}, {a.country} {a.postal_code}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Admin notes */}
                  {detailQ.data.admin_notes && (
                    <div>
                      <h4 className="text-xs font-medium text-neutral-600 mb-1">Admin Notes</h4>
                      <p className="text-xs text-neutral-600 bg-amber-50 rounded-lg p-2">{detailQ.data.admin_notes}</p>
                    </div>
                  )}

                  {/* Wallet */}
                  <div className="border-t pt-3">
                    <h4 className="text-xs font-medium text-neutral-600 mb-2">Wallet</h4>
                    {walletQ.isLoading ? (
                      <div className="h-8 bg-neutral-50 rounded animate-pulse" />
                    ) : walletQ.error ? (
                      <p className="text-xs text-rose-500">Failed to load wallet.</p>
                    ) : walletQ.data ? (
                      <>
                        <div className="bg-red-50 rounded-lg p-3 mb-2">
                          <p className="text-xs text-red-500">Current Balance</p>
                          <p className="text-lg font-bold text-red-700">
                            {formatMoney(walletQ.data.balance, walletQ.data.currency_code)}
                          </p>
                        </div>

                        {/* Admin adjust form */}
                        <div className="space-y-2 mb-3">
                          <div className="flex gap-2">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Amount (+/-)"
                              value={walletAdjustAmount}
                              onChange={(e) => setWalletAdjustAmount(e.target.value)}
                              className="flex-1 border rounded-lg px-2 py-1.5 text-xs"
                            />
                            <button
                              onClick={() => {
                                const amt = parseFloat(walletAdjustAmount);
                                if (!amt || amt === 0) return;
                                confirmDlg.open({
                                  message: `${amt > 0 ? "Credit" : "Debit"} ${formatMoney(Math.abs(amt), walletQ.data.currency_code)} from this customer's wallet?`,
                                  variant: amt < 0 ? "danger" : "info",
                                  confirmLabel: "Confirm",
                                  onConfirm: () => walletAdjustMut.mutate({ amount: amt, description: walletAdjustNote || undefined }),
                                });
                              }}
                              disabled={walletAdjustMut.isPending || !walletAdjustAmount}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                            >
                              {walletAdjustMut.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                              {walletAdjustMut.isPending ? "…" : "Adjust"}
                            </button>
                          </div>
                          <input
                            placeholder="Note (optional)"
                            value={walletAdjustNote}
                            onChange={(e) => setWalletAdjustNote(e.target.value)}
                            className="w-full border rounded-lg px-2 py-1.5 text-xs"
                          />
                        </div>

                        {/* Recent transactions */}
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {walletTxnsQ.isLoading ? (
                            <p className="text-xs text-neutral-400">Loading…</p>
                          ) : walletTxnsQ.data && walletTxnsQ.data.items.length > 0 ? (
                            walletTxnsQ.data.items.map((t) => (
                              <div key={t.id} className="flex items-center justify-between text-xs bg-neutral-50 rounded px-2 py-1.5">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-neutral-700 truncate">{t.description || t.source}</p>
                                  <p className="text-neutral-400 text-[10px]">
                                    {new Date(t.created_at).toLocaleDateString()}{" "}
                                    {new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </p>
                                </div>
                                <p className={`font-semibold flex-shrink-0 ml-2 ${t.type === "credit" ? "text-emerald-600" : "text-rose-600"}`}>
                                  {t.type === "credit" ? "+" : "−"}{formatMoney(t.amount, t.currency_code)}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-neutral-400 text-center py-2">No transactions.</p>
                          )}
                        </div>
                      </>
                    ) : null}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => startEdit(detailQ.data)} className="flex-1 bg-brand text-white px-3 py-2 rounded-lg text-sm font-medium">Edit</button>
                    <button
                      onClick={() => confirmDlg.open({ message: `Delete customer ${detailQ.data.email}? This will remove all their data.`, variant: "danger", confirmLabel: "Delete", onConfirm: () => deleteMut.mutate(detailQ.data.id) })}
                      className="px-3 py-2 border border-rose-300 text-rose-600 rounded-lg text-sm font-medium hover:bg-rose-50"
                    >Delete</button>
                  </div>
                </>
              ) : (
                /* Edit form */
                <div className="space-y-3">
                  <Field label="Full Name">
                    <input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} className={inp} />
                  </Field>
                  <Field label="Phone">
                    <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className={inp} />
                  </Field>
                  <Field label="Admin Notes">
                    <textarea value={editForm.admin_notes} onChange={(e) => setEditForm({ ...editForm, admin_notes: e.target.value })} rows={3} className={inp} placeholder="Internal notes about this customer…" />
                  </Field>
                  <div className="flex flex-col gap-3">
                    <Toggle
                      checked={editForm.is_active}
                      onChange={(val) => setEditForm({ ...editForm, is_active: val })}
                      label="Active (can login)"
                    />
                    <Toggle
                      checked={editForm.marketing_consent}
                      onChange={(val) => setEditForm({ ...editForm, marketing_consent: val })}
                      label="Marketing consent"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => updateMut.mutate(editForm)}
                      disabled={updateMut.isPending || !editForm.full_name}
                      className="inline-flex items-center justify-center gap-2 flex-1 bg-brand text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {updateMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                      {updateMut.isPending ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setEditing(false)} className="px-3 py-2 border rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
      <ConfirmDialog {...confirmDlg.props} />
      <ExportDialog
        open={exportOpen}
        type="customers"
        title="Customers"
        filters={{ search, status: statusFilter }}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl border p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-2xl font-semibold text-neutral-900 mt-1">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-900 font-medium">{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inp = "w-full border rounded-lg px-3 py-2 text-sm";
