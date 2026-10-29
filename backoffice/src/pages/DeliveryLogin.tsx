import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { api, clearAuth } from "@/lib/api";
import { Spinner } from "@/components/Skeletons";
import { useToast } from "@/components/Toast";

// Dedicated sign-in for delivery partners. Uses the same store login endpoint
// but rejects accounts that aren't delivery partners.
export function DeliveryLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getSetupStatus()
      .then((s) => {
        if (cancelled) return;
        if (s.needs_setup) navigate("/setup", { replace: true });
      })
      .catch(() => {
        // Backend may be unreachable; stay on login so user sees the error.
      })
      .finally(() => {
        if (!cancelled) setCheckingSetup(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.storeLogin(email, password);
      if (res.user.role !== "delivery_partner") {
        clearAuth();
        setError("This portal is for delivery partners only.");
        return;
      }
      login(res.user, res.access_token, res.tenant_slug, res.tenant_name);
      navigate("/delivery");
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error("Login failed", msg);
    } finally {
      setLoading(false);
    }
  }

  if (checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-900 via-emerald-950 to-neutral-900">
        <Spinner size={32} className="text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-900 via-emerald-950 to-neutral-900 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 text-white mb-3">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-6m6 0V9.348c0-.621-.504-1.125-1.125-1.125H4.125c-.621 0-1.125.504-1.125 1.125v9.402c0 .621.504 1.125 1.125 1.125H7.5m6-12H9.75m6 0a8.997 8.997 0 013.75 7.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Delivery Partner</h1>
          <p className="text-neutral-500 text-sm mt-1">Sign in to view your deliveries</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              placeholder="rider@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
            />
          </div>

          {error && (
            <div className="bg-rose-50 text-rose-600 text-sm rounded-lg px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white font-semibold py-2.5 rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Spinner size={18} />}
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-center text-xs text-neutral-400 mt-6">
          Store staff? <Link to="/login" className="text-emerald-700 hover:underline">Backoffice sign in</Link>
        </p>
      </div>
    </div>
  );
}
