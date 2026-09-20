import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  CheckCircle2, XCircle, AlertTriangle, Info, Bell, BellRing, AlertOctagon, X, Send,
} from "lucide-react";

export type ToastType =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "alert"
  | "reminder"
  | "notification"
  | "push";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (t: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  alert: (title: string, message?: string) => void;
  reminder: (title: string, message?: string) => void;
  notification: (title: string, message?: string) => void;
  push: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const TYPE_CONFIG: Record<ToastType, {
  icon: typeof CheckCircle2;
  accent: string;
  iconColor: string;
  borderColor: string;
  barColor: string;
}> = {
  success:     { icon: CheckCircle2,  accent: "bg-emerald-500/10", iconColor: "text-emerald-500",    borderColor: "border-emerald-400/20", barColor: "bg-emerald-500" },
  error:       { icon: XCircle,       accent: "bg-rose-500/10",    iconColor: "text-rose-500",       borderColor: "border-rose-400/20",    barColor: "bg-rose-500" },
  warning:     { icon: AlertTriangle, accent: "bg-amber-500/10",   iconColor: "text-amber-500",      borderColor: "border-amber-400/20",  barColor: "bg-amber-500" },
  info:        { icon: Info,          accent: "bg-sky-500/10",     iconColor: "text-sky-500",        borderColor: "border-sky-400/20",    barColor: "bg-sky-500" },
  alert:       { icon: AlertOctagon,  accent: "bg-orange-500/10",  iconColor: "text-orange-500",     borderColor: "border-orange-400/20", barColor: "bg-orange-500" },
  reminder:    { icon: Bell,          accent: "bg-violet-500/10",   iconColor: "text-violet-500",     borderColor: "border-violet-400/20", barColor: "bg-violet-500" },
  notification:{ icon: BellRing,      accent: "bg-indigo-500/10",  iconColor: "text-indigo-500",     borderColor: "border-indigo-400/20", barColor: "bg-indigo-500" },
  push:        { icon: Send,          accent: "bg-cyan-500/10",    iconColor: "text-cyan-500",       borderColor: "border-cyan-400/20",   barColor: "bg-cyan-500" },
};

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const cfg = TYPE_CONFIG[toast.type];
  const Icon = cfg.icon;
  const duration = toast.duration ?? 5000;

  const [progress, setProgress] = useState(1); // 1 = full, 0 = empty
  const [hovered, setHovered] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);

  useEffect(() => {
    if (duration === 0) return; // persistent toast

    // When hovered: pause and reset to full
    if (hovered) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      elapsedRef.current = 0;
      setProgress(1);
      return;
    }

    // When not hovered: run the countdown
    startRef.current = performance.now() - elapsedRef.current;

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      elapsedRef.current = elapsed;
      const remaining = Math.max(0, 1 - elapsed / duration);
      setProgress(remaining);

      if (remaining <= 0) {
        onClose();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [hovered, duration, onClose]);

  return (
    <div
      className={`relative overflow-hidden flex items-start gap-3 p-4 pb-3.5 rounded-2xl border ${cfg.borderColor} ${cfg.accent}
        backdrop-blur-xl bg-white/70 shadow-lg shadow-slate-900/5
        animate-in slide-in-from-right-full duration-300
        min-w-[320px] max-w-md`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${cfg.iconColor}`} strokeWidth={2} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
        {toast.message && <p className="text-sm text-slate-600 mt-0.5">{toast.message}</p>}
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition"
      >
        <X className="w-4 h-4" />
      </button>
      {/* Timeout progress bar */}
      {duration > 0 && (
        <div
          className={`absolute bottom-0 left-0 h-[3px] ${cfg.barColor} transition-none`}
          style={{ width: `${progress * 100}%` }}
        />
      )}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-4), { ...t, id }]);
  }, []);

  const make = (type: ToastType) => (title: string, message?: string) =>
    addToast({ type, title, message });

  const value: ToastContextValue = {
    toasts,
    addToast,
    removeToast,
    success:     make("success"),
    error:       make("error"),
    warning:     make("warning"),
    info:        make("info"),
    alert:       make("alert"),
    reminder:    make("reminder"),
    notification:make("notification"),
    push:        make("push"),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastCard toast={t} onClose={() => removeToast(t.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
