import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Spinner } from "@/components/Skeletons";
import { useToast } from "@/components/Toast";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [mode, setMode] = useState<"platform" | "tenant">("platform");
  const [tenant, setTenant] = useState("demo");
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
      const res =
        mode === "platform"
          ? await api.platformLogin(email, password)
          : await api.tenantLogin(tenant, email, password);
      login(res.user, res.access_token, mode === "tenant" ? tenant : undefined, res.tenant_name);
      navigate("/");
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900">
        <Spinner size={32} className="text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand text-white font-bold text-xl mb-3">
            TC
          </div>
          <h1 className="text-2xl font-bold text-slate-900">TruCommerce</h1>
          <p className="text-slate-500 text-sm mt-1">Backoffice Sign In</p>
        </div>

        <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setMode("platform")}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
              mode === "platform" ? "bg-white shadow text-brand" : "text-slate-500"
            }`}
          >
            Superadmin
          </button>
          <button
            onClick={() => setMode("tenant")}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
              mode === "tenant" ? "bg-white shadow text-brand" : "text-slate-500"
            }`}
          >
            Store Admin
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "tenant" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Store</label>
              <input
                value={tenant}
                onChange={(e) => setTenant(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand"
                placeholder="demo"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand"
              placeholder="admin@trucommerce.app"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand"
            />
          </div>

          {error && (
            <div className="bg-rose-50 text-rose-600 text-sm rounded-lg px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand text-white font-semibold py-2.5 rounded-lg hover:bg-brand-dark transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Spinner size={18} />}
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-xs text-slate-400 text-center mt-6">
          Superadmin: <code>admin@trucommerce.app</code> / <code>admin12345</code>
        </p>
      </div>
    </div>
  );
}
