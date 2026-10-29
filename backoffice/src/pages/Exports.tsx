import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, CheckCircle2, AlertCircle, Clock, Mail, Plus, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeletons";
import { Pagination } from "@/components/Pagination";
import { ExportDialog } from "@/components/ExportDialog";
import type { ExportTypeMeta } from "@/types";

const STATUS_ICONS: Record<string, typeof Clock> = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle2,
  failed: AlertCircle,
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-neutral-500 bg-neutral-50",
  running: "text-red-600 bg-red-50",
  completed: "text-emerald-600 bg-emerald-50",
  failed: "text-rose-600 bg-rose-50",
};

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(s: string): string {
  const d = new Date(s);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function Exports() {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const limit = 20;

  const q = useQuery({
    queryKey: ["exports", tenant, page],
    queryFn: () => api.listExports(tenant, limit, page * limit),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      const hasActive = items.some((j) => j.status === "pending" || j.status === "running");
      return hasActive ? 3000 : false;
    },
  });

  const typesQ = useQuery({
    queryKey: ["export-types", tenant],
    queryFn: () => api.listExportTypes(tenant),
  });

  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleExportCreated = () => {
    qc.invalidateQueries({ queryKey: ["exports", tenant] });
    setSelectedType(null);
    setPickerOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Exports"
        subtitle={`${total} export job${total !== 1 ? "s" : ""}`}
        action={
          <button
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-dark transition"
          >
            <Plus className="w-4 h-4" /> Create Export
          </button>
        }
      />

      {q.isLoading ? (
        <TableSkeleton cols={6} rows={5} />
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center">
          <Download className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
          <p className="text-neutral-400 text-sm">No exports yet. Click "Create Export" above to generate one.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Progress</th>
                <th className="px-4 py-3 font-medium">Size</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((job) => {
                const Icon = STATUS_ICONS[job.status] || Clock;
                const color = STATUS_COLORS[job.status] || "";
                const progress = job.rows_total > 0 ? Math.round((job.rows_done / job.rows_total) * 100) : 0;
                return (
                  <tr key={job.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-800 capitalize">{job.type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
                        <Icon className={`w-3.5 h-3.5 ${job.status === "running" ? "animate-spin" : ""}`} />
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {job.rows_total > 0 ? `${job.rows_done.toLocaleString()} / ${job.rows_total.toLocaleString()} (${progress}%)` : "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{job.file_size > 0 ? fmtSize(job.file_size) : "—"}</td>
                    <td className="px-4 py-3 text-neutral-600">
                      {job.email ? (
                        <span className="inline-flex items-center gap-1 text-xs"><Mail className="w-3.5 h-3.5" /> {job.email}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-400">{fmtDate(job.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {job.status === "completed" && job.file_name ? (
                        <button
                          onClick={() => api.downloadExport(tenant, job.id, job.file_name)}
                          className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-700 text-xs font-medium"
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </button>
                      ) : job.error ? (
                        <span className="text-xs text-rose-500" title={job.error}>Failed</span>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} total={total} start={page * limit} end={Math.min((page + 1) * limit, total)} onPage={setPage} />
        </div>
      )}

      {/* Type picker modal — step 1: choose what to export */}
      {pickerOpen && !selectedType && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-neutral-900/30 backdrop-blur-sm" onClick={() => setPickerOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-neutral-200/50 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">Create Export</h3>
              <button onClick={() => setPickerOpen(false)} className="text-neutral-400 hover:text-neutral-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-neutral-500 mb-4">Select the data type to export as CSV.</p>

            {typesQ.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-neutral-400 animate-spin" />
              </div>
            ) : typesQ.data && typesQ.data.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {typesQ.data.map((t: ExportTypeMeta) => (
                  <button
                    key={t.key}
                    onClick={() => setSelectedType(t.key)}
                    className="w-full text-left p-3 border border-neutral-200 rounded-lg hover:border-brand hover:bg-brand/5 transition"
                  >
                    <div className="font-medium text-sm text-neutral-800">{t.name}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">{t.description}</div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-400 text-center py-8">No export types available.</p>
            )}
          </div>
        </div>
      )}

      {/* Export dialog — step 2: configure and create (reuses existing component) */}
      {pickerOpen && selectedType && (
        <ExportDialog
          open={true}
          type={selectedType}
          title={(typesQ.data?.find((t) => t.key === selectedType)?.name) || selectedType}
          filters={{}}
          onClose={handleExportCreated}
        />
      )}
    </div>
  );
}
