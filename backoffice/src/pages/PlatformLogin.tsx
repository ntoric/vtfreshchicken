import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Spinner } from "@/components/Skeletons";
import { useToast } from "@/components/Toast";

export function PlatformLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.platformLogin(email, password);
      login(res.user, res.access_token, res.tenant_slug, res.tenant_name);
      navigate("/");
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error("Login failed", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-neutral-800 text-rose-400 font-bold text-xl mb-3 border border-neutral-700">
            TC
          </div>
          <h1 className="text-2xl font-bold text-white">TruCommerce</h1>
          <p className="text-neutral-400 text-sm mt-1">Platform Access</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 placeholder-neutral-500"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>

          {error && (
            <div className="bg-rose-950 text-rose-400 border border-rose-900 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-rose-600 text-white font-semibold py-2.5 rounded-lg hover:bg-rose-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Spinner size={18} />}
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
