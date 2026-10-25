"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { AuthShell } from "@/components/AuthShell";
import { StorefrontSkeleton } from "@/components/Loaders";
import { Toggle } from "@/components/Toggle";
import { useBootstrap } from "@/lib/bootstrap";
import { useCurrencyLang } from "@/lib/currency-lang";

const INPUT_CLS =
  "w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 transition focus:bg-white focus:input-brand-focus";
const LABEL_CLS =
  "block text-[11px] font-semibold tracking-[0.14em] uppercase text-stone-500 mb-2";

export default function RegisterPage({ params }: { params: {} }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect");
  const { register, isAuthenticated, replayPendingAction, pendingAction } = useAuth();
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();
  const bootstrap = useBootstrap();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", phone: "", marketing_consent: false });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already authenticated, replay pending action or redirect
  useEffect(() => {
    if (isAuthenticated) {
      if (pendingAction) {
        replayPendingAction();
        router.push(pendingAction.returnPath);
      } else {
        router.push(redirectPath || `/account/dashboard`);
      }
    }
  }, [isAuthenticated, pendingAction, redirectPath, router, replayPendingAction]);

  if (!bootstrap) return <StorefrontSkeleton />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(form.email, form.password, form.full_name, form.phone, form.marketing_consent);
      // The useEffect above will handle redirect + replay
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Header bootstrap={bootstrap} currency={currency} setCurrency={setCurrency} lang={lang} setLang={setLang} />
      <AuthShell
        eyebrow="Join us"
        title="Create your account"
        subtitle={
          pendingAction
            ? "Please register to continue."
            : "A few details and you're ready to order."
        }
        panelTitle={
          <>
            Pull up{" "}
            <em className="italic" style={{ color: "var(--brand-color)" }}>
              a chair.
            </em>
          </>
        }
        storeName={bootstrap.store_name}
      >
        {pendingAction && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {pendingAction.type === "add_to_cart"
              ? "Register to add items to your cart."
              : "Register to add items to your wishlist."}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={LABEL_CLS}>Full Name</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
              className={INPUT_CLS}
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className={INPUT_CLS}
              placeholder="you@example.com"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className={LABEL_CLS}>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
                className={INPUT_CLS}
                placeholder="Min. 6 characters"
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Phone <span className="normal-case tracking-normal font-medium text-stone-400">(optional)</span></label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={INPUT_CLS}
                placeholder="+1 555 000 0000"
              />
            </div>
          </div>
          <Toggle
            checked={form.marketing_consent}
            onChange={(val) => setForm({ ...form, marketing_consent: val })}
            label="I agree to receive marketing emails and promotional offers."
          />
          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_12px_28px_-12px_color-mix(in_srgb,var(--brand-color)_55%,transparent)]"
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-stone-100 text-center">
          <p className="text-sm text-stone-500">
            Already have an account?{" "}
            <Link
              href={`/account/login${redirectPath ? `?redirect=${encodeURIComponent(redirectPath)}` : ""}`}
              className="font-semibold text-brand hover:text-brand-dark transition"
            >
              Sign in
            </Link>
          </p>
        </div>
      </AuthShell>
    </div>
  );
}
