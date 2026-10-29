import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

// Minimal shell for the delivery partner portal — a top bar with the store
// name, the partner's name, and a sign-out button. No admin navigation.
export function DeliveryLayout() {
  const { user, tenantName, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return <Navigate to="/delivery/login" replace />;
  if (user.role !== "delivery_partner") return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-neutral-100">
      <header className="bg-neutral-900 text-white sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-600 flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-6m6 0V9.348c0-.621-.504-1.125-1.125-1.125H4.125c-.621 0-1.125.504-1.125 1.125v9.402c0 .621.504 1.125 1.125 1.125H7.5m6-12H9.75m6 0a8.997 8.997 0 013.75 7.5" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{tenantName || "Delivery"}</p>
              <p className="text-[11px] text-neutral-400 leading-none">Delivery Partner</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-300 hidden sm:block">{user.full_name}</span>
            <button
              onClick={() => { logout(); navigate("/delivery/login"); }}
              className="text-xs font-medium bg-white/10 hover:bg-white/20 rounded-md px-3 py-1.5 transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-5">
        <Outlet />
      </main>
    </div>
  );
}
