"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Check, AlertTriangle } from "lucide-react";
import { fetchBootstrap, getStoredCustomer, getAuthToken, customerLogin, exportMyData, deleteMyAccount, clearAuthToken } from "@/lib/api";
import { Header } from "@/components/Header";
import { StorefrontSkeleton } from "@/components/Loaders";
import { CookiePreferencesModal } from "@/components/CookiePreferencesModal";
import { getConsent, hasConsent, withdrawConsent, COOKIE_CATEGORIES } from "@/lib/cookies";
import { useCurrencyLang } from "@/lib/currency-lang";
import { useToast } from "@/components/Toast";
import { useConfirmState, ConfirmDialog } from "@/components/ConfirmDialog";

export default function AccountDataPage({ params }: { params: {} }) {
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();
  const toast = useToast();
  const confirmDlg = useConfirmState();
  const [authed, setAuthed] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [consentWithdrawn, setConsentWithdrawn] = useState(false);

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => fetchBootstrap(),
  });

  useEffect(() => {
    setAuthed(!!getAuthToken());
  }, []);

  if (bootstrapQ.isLoading) return <StorefrontSkeleton />;
  if (bootstrapQ.error || !bootstrapQ.data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-rose-500">
        Failed to load. Please try again.
      </div>
    );
  }

  const customer = getStoredCustomer();
  const consent = getConsent();
  const hasGivenConsent = hasConsent() && !consentWithdrawn;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      await customerLogin(loginEmail, loginPassword);
      setAuthed(true);
      setLoginEmail("");
      setLoginPassword("");
    } catch (err) {
      setLoginError((err as Error).message);
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    setAuthed(false);
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const data = await exportMyData();
      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-data-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Export failed", (err as Error).message);
    } finally {
      setExportLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteError("");
    try {
      await deleteMyAccount(deletePassword);
      setDeleteSuccess(true);
      setAuthed(false);
      setDeleteConfirmOpen(false);
      setDeletePassword("");
    } catch (err) {
      setDeleteError((err as Error).message);
    }
  };

  const handleWithdrawConsent = () => {
    confirmDlg.open({
      message: "Withdraw cookie consent? Non-essential cookies will be disabled immediately.",
      variant: "warning",
      confirmLabel: "Withdraw",
      onConfirm: () => {
        withdrawConsent();
        setConsentWithdrawn(true);
        toast.info("Consent withdrawn", "Non-essential cookies have been disabled.");
        setTimeout(() => setConsentWithdrawn(false), 3000);
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
       
        bootstrap={bootstrapQ.data}
        currency={currency}
        setCurrency={setCurrency}
        lang={lang}
        setLang={setLang}
      />

      {/* Hero */}
      <section className="bg-gradient-to-r from-brand-light to-white border-b">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-8 sm:py-10">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">Your Data & Privacy</h1>
          <p className="text-sm sm:text-base text-gray-500 mt-2">
            Manage your personal data and exercise your GDPR rights
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-8 sm:py-10 space-y-6">
        {/* Wallet Quick Link */}
        <Link
          href={`/account/wallet`}
          className="block bg-gradient-to-r from-brand to-brand-dark rounded-2xl p-5 sm:p-6 text-white hover:opacity-95 transition group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold">My Wallet</h2>
                <p className="text-sm text-white/80">View balance, top up, and see transaction history</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-white/60 group-hover:translate-x-1 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </Link>

        {/* GDPR Rights Summary */}
        <div className="bg-white rounded-2xl border p-4 sm:p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Your Rights Under GDPR</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {[
              { art: "Art. 15", title: "Right of Access", desc: "Get a copy of your personal data" },
              { art: "Art. 17", title: "Right to Erasure", desc: "Delete your account and personal data" },
              { art: "Art. 20", title: "Data Portability", desc: "Export your data in machine-readable format" },
              { art: "Art. 7(3)", title: "Withdraw Consent", desc: "Revoke cookie consent at any time" },
            ].map((right) => (
              <div key={right.art} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "color-mix(in srgb, var(--brand-color, #4f46e5) 10%, transparent)" }}>
                  <svg className="w-5 h-5" style={{ color: "var(--brand-color, #4f46e5)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-xs">{right.art}</p>
                  <p className="font-medium text-gray-900">{right.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{right.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Authentication Gate */}
        {!authed ? (
          <div className="bg-white rounded-2xl border p-4 sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Sign In to Manage Your Data</h2>
            <p className="text-sm text-gray-500 mb-4">
              Log in with your customer account to export or delete your personal data.
            </p>
            <form onSubmit={handleLogin} className="space-y-3 max-w-md">
              <input
                type="email"
                placeholder="Email address"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:input-brand-focus"
              />
              <input
                type="password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:input-brand-focus"
              />
              {loginError && <p className="text-sm text-rose-500">{loginError}</p>}
              <button
                type="submit"
                className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg"
                style={{ backgroundColor: "var(--brand-color, #4f46e5)" }}
              >
                Sign In
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Account Info */}
            <div className="bg-white rounded-2xl border p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Signed In</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {customer?.full_name} ({customer?.email})
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  Sign Out
                </button>
              </div>
            </div>

            {/* Data Export */}
            <div className="bg-white rounded-2xl border p-4 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Export Your Data</h2>
              <p className="text-sm text-gray-500 mb-4">
                Download a complete copy of your personal data in JSON format. This includes your profile,
                addresses, orders, wishlist, and reviews. (GDPR Art. 15 & Art. 20)
              </p>
              <button
                onClick={handleExport}
                disabled={exportLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
                style={{ backgroundColor: "var(--brand-color, #4f46e5)" }}
              >
                {exportLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Preparing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download My Data
                  </>
                )}
              </button>
            </div>

            {/* Account Deletion */}
            <div className="bg-white rounded-2xl border border-rose-200 p-4 sm:p-6">
              <h2 className="text-lg font-bold text-rose-900 mb-1">Delete Your Account</h2>
              <p className="text-sm text-gray-500 mb-4">
                Permanently delete your account and all associated personal data. This action cannot be undone.
                Your orders will be retained for legal/tax purposes but all personal information will be
                anonymized. (GDPR Art. 17 — Right to be Forgotten)
              </p>

              {deleteSuccess ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <p className="text-sm text-emerald-800 font-medium flex items-center gap-1.5">
                    <Check className="w-4 h-4 flex-shrink-0" strokeWidth={2.5} /> Your account has been successfully deleted. All personal data has been anonymized.
                  </p>
                </div>
              ) : !deleteConfirmOpen ? (
                <button
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition"
                >
                  Delete My Account
                </button>
              ) : (
                <div className="space-y-3 max-w-md">
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                    <p className="text-sm text-rose-800 font-medium mb-1 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Final Confirmation
                    </p>
                    <p className="text-sm text-rose-700">
                      This will permanently delete your account. Enter your password to confirm.
                    </p>
                  </div>
                  <input
                    type="password"
                    placeholder="Enter your password to confirm"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full px-3 py-2.5 border border-rose-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400"
                  />
                  {deleteError && <p className="text-sm text-rose-500">{deleteError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      disabled={!deletePassword}
                      className="px-5 py-2.5 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition disabled:opacity-50"
                    >
                      Confirm Deletion
                    </button>
                    <button
                      onClick={() => { setDeleteConfirmOpen(false); setDeletePassword(""); setDeleteError(""); }}
                      className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Cookie Consent Management */}
        <div className="bg-white rounded-2xl border p-4 sm:p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Cookie Consent</h2>
          <p className="text-sm text-gray-500 mb-4">
            Manage your cookie preferences or withdraw consent entirely. (GDPR Art. 7(3))
          </p>

          {hasGivenConsent ? (
            <>
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Consent provided on{" "}
                  <strong>{consent?.grantedAt ? new Date(consent.grantedAt).toLocaleDateString() : "N/A"}</strong>
                </p>
                <div className="space-y-1.5">
                  {COOKIE_CATEGORIES.map((cat) => (
                    <div key={cat.id} className="flex items-center gap-2 text-sm">
                      <span className={`w-2 h-2 rounded-full ${consent?.categories[cat.id] ? "bg-emerald-500" : "bg-gray-300"}`} />
                      <span className={consent?.categories[cat.id] ? "text-gray-900 font-medium" : "text-gray-400"}>
                        {cat.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowPrefs(true)}
                  className="px-4 py-2 text-sm font-medium text-white rounded-lg"
                  style={{ backgroundColor: "var(--brand-color, #4f46e5)" }}
                >
                  Change Preferences
                </button>
                <button
                  onClick={handleWithdrawConsent}
                  className="px-4 py-2 text-sm font-medium text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 transition"
                >
                  Withdraw Consent
                </button>
              </div>
              {consentWithdrawn && (
                <p className="text-sm text-emerald-600 mt-3 flex items-center gap-1.5">
                  <Check className="w-4 h-4 flex-shrink-0" strokeWidth={2.5} /> Consent withdrawn. The cookie banner will reappear on your next visit.
                </p>
              )}
            </>
          ) : (
            <button
              onClick={() => setShowPrefs(true)}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg"
              style={{ backgroundColor: "var(--brand-color, #4f46e5)" }}
            >
              Set Cookie Preferences
            </button>
          )}
        </div>

        {/* Related Links */}
        <div className="bg-white rounded-2xl border p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Related Documents</h3>
          <div className="flex flex-wrap gap-3">
            <Link href={`/privacy-policy`} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition text-gray-600">
              Privacy Policy
            </Link>
            <Link href={`/cookie-policy`} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition text-gray-600">
              Cookie Policy
            </Link>
            <Link href={`/terms`} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition text-gray-600">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 py-8 text-sm text-gray-400 flex flex-col md:flex-row justify-between gap-4">
          <p>© {new Date().getFullYear()} {bootstrapQ.data?.store_name}. Powered by TruCommerce.</p>
          <div className="flex gap-4 flex-wrap">
            <Link href={`/privacy-policy`} className="hover:text-gray-600">Privacy Policy</Link>
            <Link href={`/cookie-policy`} className="hover:text-gray-600">Cookie Policy</Link>
            <Link href={`/terms`} className="hover:text-gray-600">Terms</Link>
          </div>
        </div>
      </footer>

      {showPrefs && (
        <CookiePreferencesModal
         
          onClose={() => setShowPrefs(false)}
        />
      )}
      <ConfirmDialog {...confirmDlg.props} />
    </div>
  );
}
