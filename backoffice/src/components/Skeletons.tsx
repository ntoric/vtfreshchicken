// Backoffice skeleton loading components

// ============ Spinner ============
export function Spinner({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ============ Stat card skeleton ============
export function StatCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-5 ${count >= 4 ? "xl:grid-cols-4" : "md:grid-cols-3"}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border p-6 h-32 shimmer" />
      ))}
    </div>
  );
}

// ============ Panel skeleton (for dashboard side panels) ============
export function PanelSkeleton() {
  return (
    <div className="bg-white rounded-2xl border p-6 space-y-3">
      <div className="h-5 w-40 bg-slate-100 rounded shimmer" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="h-4 w-24 bg-slate-100 rounded shimmer" />
          <div className="h-4 w-10 bg-slate-100 rounded shimmer" />
        </div>
      ))}
    </div>
  );
}

// ============ Dashboard skeleton ============
export function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <StatCardSkeleton count={4} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 bg-white rounded-2xl border p-6">
          <div className="h-5 w-32 bg-slate-100 rounded shimmer mb-4" />
          <div className="h-[270px] bg-slate-50 rounded-xl shimmer" />
        </div>
        <PanelSkeleton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <PanelSkeleton />
        <PanelSkeleton />
        <PanelSkeleton />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <PanelSkeleton />
        <div className="xl:col-span-2"><PanelSkeleton /></div>
      </div>
    </div>
  );
}

// ============ Table skeleton ============
export function TableSkeleton({ cols = 5, rows = 6 }: { cols?: number; rows?: number }) {
  return (
    <div className="bg-white rounded-2xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-left">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <div className="h-4 w-20 bg-slate-100 rounded shimmer" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="px-4 py-3.5">
                  <div
                    className="h-4 bg-slate-100 rounded shimmer"
                    style={{ width: `${40 + ((c + r) % 4) * 15}%` }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============ Page header skeleton ============
export function PageHeaderSkeleton() {
  return (
    <div className="mb-6">
      <div className="h-8 w-48 bg-slate-100 rounded shimmer mb-2" />
      <div className="h-4 w-32 bg-slate-100 rounded shimmer" />
    </div>
  );
}

// ============ Card grid skeleton (for offers) ============
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border p-5 space-y-3">
          <div className="flex justify-between">
            <div className="h-5 w-32 bg-slate-100 rounded shimmer" />
            <div className="h-4 w-12 bg-slate-100 rounded shimmer" />
          </div>
          <div className="h-4 w-48 bg-slate-100 rounded shimmer" />
          <div className="flex gap-2 pt-2">
            <div className="h-7 w-20 bg-slate-100 rounded-full shimmer" />
            <div className="h-7 w-16 bg-slate-100 rounded-full shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============ Product edit form skeleton ============
export function ProductEditSkeleton() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-8 w-40 bg-slate-100 rounded shimmer mb-2" />
        <div className="h-4 w-24 bg-slate-100 rounded shimmer" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border p-6 space-y-4">
            <div className="h-5 w-24 bg-slate-100 rounded shimmer" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[0, 1].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-12 bg-slate-100 rounded shimmer" />
                  <div className="h-10 w-full bg-slate-100 rounded-lg shimmer" />
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-20 bg-slate-100 rounded shimmer" />
              <div className="h-24 w-full bg-slate-100 rounded-lg shimmer" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-10 bg-slate-100 rounded shimmer" />
                  <div className="h-10 w-full bg-slate-100 rounded-lg shimmer" />
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border p-6 space-y-4">
            <div className="h-5 w-20 bg-slate-100 rounded shimmer" />
            {[0, 1].map((i) => (
              <div key={i} className="border rounded-xl p-4 space-y-3">
                <div className="h-4 w-24 bg-slate-100 rounded shimmer" />
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {[0, 1, 2, 3].map((j) => (
                    <div key={j} className="space-y-1.5">
                      <div className="h-3 w-8 bg-slate-100 rounded shimmer" />
                      <div className="h-9 w-full bg-slate-100 rounded-lg shimmer" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border p-6 space-y-4">
            <div className="h-5 w-24 bg-slate-100 rounded shimmer" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-14 bg-slate-100 rounded shimmer" />
                <div className="h-10 w-full bg-slate-100 rounded-lg shimmer" />
              </div>
            ))}
          </div>
          <div className="h-11 w-full bg-slate-100 rounded-lg shimmer" />
        </div>
      </div>
    </div>
  );
}

// ============ Full-page loader ============
export function FullPageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-100">
      <Spinner size={36} className="text-brand" />
      <p className="text-sm font-medium text-slate-400">{label}…</p>
    </div>
  );
}
