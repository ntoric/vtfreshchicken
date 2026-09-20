import { useState, useEffect, useRef } from "react";
import { Download, Mail, X, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { ExportJob } from "@/types";

export interface ExportDialogProps {
  open: boolean;
  type: string;
  title: string;
  filters: Record<string, string>;
  onClose: () => void;
}

const EMAIL_THRESHOLD = 5000;

export function ExportDialog({ open, type, title, filters, onClose }: ExportDialogProps) {
  const { tenant } = useAuth();
  const [email, setEmail] = useState("");
  const [job, setJob] = useState<ExportJob | null>(null);
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [estimated, setEstimated] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setJob(null);
      setError("");
      setEmail("");
      setEstimated(null);
    }
  }, [open]);

  // Estimate size when dialog opens
  useEffect(() => {
    if (!open || !type) return;
    setEstimating(true);
    api
      .estimateExportSize(tenant, { type, ...filters })
      .then((r) => setEstimated(r.estimated_rows))
      .catch(() => setEstimated(null))
      .finally(() => setEstimating(false));
  }, [open, type, tenant, filters]);

  // Poll job status
  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") {
      if (pollRef.current) clearTimeout(pollRef.current);
      return;
    }
    pollRef.current = setTimeout(async () => {
      try {
        const updated = await api.getExport(tenant, job.id);
        setJob(updated);
      } catch {
        // ignore polling errors
      }
    }, 1500);
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [job, tenant]);

  if (!open) return null;

  const largeExport = estimated !== null && estimated > EMAIL_THRESHOLD;
  const progress = job && job.rows_total > 0 ? Math.round((job.rows_done / job.rows_total) * 100) : 0;

  const handleCreate = async () => {
    if (largeExport && !email.trim()) {
      setError("This is a large export. Please enter an email address to receive the file.");
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const created = await api.createExport(tenant, {
        type,
        format: "csv",
        filters,
        email: email.trim() || undefined,
      });
      setJob(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create export");
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async () => {
    if (!job) return;
    setDownloading(true);
    try {
      await api.downloadExport(tenant, job.id, job.file_name || "export.csv");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 w-full max-w-lg p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4 mb-5">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6 text-indigo-500" />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-lg font-semibold text-slate-900">Export {title}</h3>
            <p className="text-sm text-slate-500 mt-0.5">Generate a CSV file of the current data with applied filters.</p>
          </div>
        </div>

        {/* Pre-job: form */}
        {!job && (
          <div className="space-y-4">
            {estimating ? (
              <div className="text-sm text-slate-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Estimating export size...
              </div>
            ) : estimated !== null ? (
              <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
                Estimated rows: <span className="font-semibold">{estimated.toLocaleString()}</span>
                {largeExport && (
                  <span className="block mt-1 text-amber-600">
                    This is a large export. Enter your email to receive the file asynchronously.
                  </span>
                )}
              </div>
            ) : null}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Format</label>
              <select disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 text-sm">
                <option value="csv">CSV (Comma-separated values)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email address <span className="text-slate-400 font-normal">{largeExport ? "(required)" : "(optional)"}</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={largeExport ? "you@example.com" : "Enter email for async delivery (optional)"}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {largeExport
                  ? "Required for large exports — the file will be emailed when ready."
                  : "If provided, the exported file will be emailed to this address on completion. Otherwise, you can download it here."}
              </p>
            </div>

            {error && (
              <div className="text-sm text-rose-600 bg-rose-50 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button onClick={onClose} className="px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 flex items-center gap-2"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {creating ? "Creating..." : "Create Export"}
              </button>
            </div>
          </div>
        )}

        {/* In-progress / completed */}
        {job && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {job.status === "pending" && <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />}
              {job.status === "running" && <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />}
              {job.status === "completed" && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              {job.status === "failed" && <AlertCircle className="w-5 h-5 text-rose-500" />}
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-800">
                  {job.status === "pending" && "Queued — waiting for worker..."}
                  {job.status === "running" && "Processing..."}
                  {job.status === "completed" && "Export completed"}
                  {job.status === "failed" && "Export failed"}
                </div>
                <div className="text-xs text-slate-500">
                  {job.rows_done.toLocaleString()} / {job.rows_total.toLocaleString()} rows
                  {job.file_size > 0 && ` · ${(job.file_size / 1024).toFixed(1)} KB`}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            {(job.status === "running" || job.status === "completed") && job.rows_total > 0 && (
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${job.status === "completed" ? "bg-emerald-500" : "bg-indigo-500"}`}
                  style={{ width: `${job.status === "completed" ? 100 : progress}%` }}
                />
              </div>
            )}

            {job.status === "failed" && job.error && (
              <div className="text-sm text-rose-600 bg-rose-50 rounded-lg p-3">{job.error}</div>
            )}

            {job.status === "completed" && (
              <div className="space-y-3">
                {job.email && (
                  <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3 flex items-start gap-2">
                    <Mail className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    The exported file has been sent to <strong>{job.email}</strong>.
                  </div>
                )}
                <div className="flex justify-end gap-3">
                  <button onClick={onClose} className="px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition">
                    Close
                  </button>
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {downloading ? "Downloading..." : "Download CSV"}
                  </button>
                </div>
              </div>
            )}

            {(job.status === "pending" || job.status === "running") && (
              <div className="flex justify-end">
                <button onClick={onClose} className="px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition">
                  Run in background
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
