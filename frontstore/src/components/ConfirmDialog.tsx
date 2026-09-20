"use client";

import { type ReactNode, useState, useCallback } from "react";
import { AlertTriangle, AlertOctagon, Info, CheckCircle2, X } from "lucide-react";

export type ConfirmVariant = "danger" | "warning" | "info" | "success";

const VARIANT_CONFIG: Record<ConfirmVariant, {
  icon: typeof AlertTriangle;
  iconColor: string;
  iconBg: string;
  confirmBtn: string;
  title: string;
}> = {
  danger:  { icon: AlertOctagon,   iconColor: "text-rose-500",    iconBg: "bg-rose-50",     confirmBtn: "bg-rose-600 hover:bg-rose-700",         title: "Confirm Action" },
  warning: { icon: AlertTriangle,  iconColor: "text-amber-500",   iconBg: "bg-amber-50",    confirmBtn: "bg-amber-600 hover:bg-amber-700",        title: "Are you sure?" },
  info:    { icon: Info,           iconColor: "text-sky-500",      iconBg: "bg-sky-50",      confirmBtn: "bg-sky-600 hover:bg-sky-700",           title: "Please confirm" },
  success: { icon: CheckCircle2,   iconColor: "text-emerald-500", iconBg: "bg-emerald-50",  confirmBtn: "bg-emerald-600 hover:bg-emerald-700",    title: "Confirm" },
};

export interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  if (!open) return null;
  const cfg = VARIANT_CONFIG[variant];
  const Icon = cfg.icon;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 w-full max-w-md p-6">
        <button onClick={onCancel} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${cfg.iconBg} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${cfg.iconColor}`} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-lg font-semibold text-slate-900">{title || cfg.title}</h3>
            <div className="text-sm text-slate-600 mt-1.5 leading-relaxed">{message}</div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} disabled={loading} className="px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition disabled:opacity-50">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} disabled={loading} className={`px-3 py-2 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 ${cfg.confirmBtn}`}>
            {loading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ConfirmOptions {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void;
}

export function useConfirmState() {
  const [state, setState] = useState<{ open: boolean; loading: boolean; options: ConfirmOptions | null }>({
    open: false, loading: false, options: null,
  });

  const open = useCallback((options: ConfirmOptions) => {
    setState({ open: true, loading: false, options });
  }, []);

  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false, options: null }));
  }, []);

  const handleConfirm = useCallback(() => {
    if (!state.options) return;
    setState((s) => ({ ...s, loading: true }));
    state.options.onConfirm();
    setTimeout(() => close(), 0);
  }, [state.options, close]);

  const props: ConfirmDialogProps = {
    open: state.open,
    title: state.options?.title,
    message: state.options?.message ?? "",
    confirmLabel: state.options?.confirmLabel,
    cancelLabel: state.options?.cancelLabel,
    variant: state.options?.variant,
    onConfirm: handleConfirm,
    onCancel: close,
    loading: state.loading,
  };

  return { open, props };
}
