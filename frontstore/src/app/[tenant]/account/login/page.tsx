"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchBootstrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { StorefrontSkeleton } from "@/components/Loaders";
import { useCurrencyLang } from "@/lib/currency-lang";

export default function LoginPage({ params }: { params: { tenant: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect");
  const { login, isAuthenticated, replayPendingAction, pendingAction } = useAuth();
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap", params.tenant],
    queryFn: () => fetchBootstrap(params.tenant),
  });

  // If already authenticated, replay pending action or redirect
  useEffect(() => {
    if (isAuthenticated) {
      if (pendingAction) {
        replayPendingAction();
        router.push(pendingAction.returnPath);
      } else {
        router.push(redirectPath || `/${params.tenant}/account/dashboard`);
      }
    }
  }, [isAuthenticated, pendingAction, redirectPath, router, params.tenant, replayPendingAction]);

  if (bootstrapQ.isLoading) return <StorefrontSkeleton />;
  const bootstrap = bootstrapQ.data!;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(params.tenant, email, password);
      // The useEffect above will handle redirect + replay
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header tenant={params.tenant} bootstrap={bootstrap} currency={currency} setCurrency={setCurrency} lang={lang} setLang={setLang} />
      <div className="max-w-md mx-auto px-3 sm:px-4 py-8 sm:py-12">
        <div className="bg-white rounded-2xl border p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Sign In</h1>
          <p className="text-sm text-gray-500 mb-6">
            {pendingAction
              ? "Please sign in to continue."
              : "Welcome back! Sign in to your account."}
          </p>

          {pendingAction && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-700">
              {pendingAction.type === "add_to_cart"
                ? "Sign in to add items to your cart."
                : "Sign in to add items to your wishlist."}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:input-brand-focus"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:input-brand-focus"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-sm text-rose-500 bg-rose-50 rounded-lg p-2">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-dark disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="text-sm text-gray-500 text-center mt-6">
            Don't have an account?{" "}
            <Link
              href={`/${params.tenant}/account/register${redirectPath ? `?redirect=${encodeURIComponent(redirectPath)}` : ""}`}
              className="font-medium text-brand hover:text-brand-dark"
            >
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
