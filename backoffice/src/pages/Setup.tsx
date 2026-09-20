import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/Skeletons";
import { useToast } from "@/components/Toast";
import type { SetupStatus } from "@/types";

export function Setup() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [step, setStep] = useState(1); // 1 = superadmin, 2 = tenant, 3 = done
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [saName, setSaName] = useState("");
  const [saEmail, setSaEmail] = useState("");
  const [saPassword, setSaPassword] = useState("");
  const [saPasswordConfirm, setSaPasswordConfirm] = useState("");

  const [tenantSlug, setTenantSlug] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantDesc, setTenantDesc] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");
  const [brandColor, setBrandColor] = useState("#4f46e5");

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    try {
      const s = await api.getSetupStatus();
      setStatus(s);
      if (s.setup_complete) {
        navigate("/login", { replace: true });
        return;
      }
      // If superadmin exists but no tenants, skip to tenant step
      if (s.has_superadmin && !s.has_tenants) {
        setStep(2);
      }
    } catch {
      setError("Failed to check setup status. Is the backend running?");
    } finally {
      setLoadingStatus(false);
    }
  }

  function validateStep1(): boolean {
    if (!saName.trim()) return setError("Superadmin name is required"), false;
    if (!saEmail.trim()) return setError("Superadmin email is required"), false;
    if (saPassword.length < 8) return setError("Superadmin password must be at least 8 characters"), false;
    if (saPassword !== saPasswordConfirm) return setError("Passwords do not match"), false;
    return true;
  }

  function validateStep2(): boolean {
    if (!tenantSlug.trim()) return setError("Tenant slug is required"), false;
    if (!/^[a-z0-9-]+$/.test(tenantSlug)) return setError("Slug must be lowercase letters, numbers, and hyphens only"), false;
    if (!tenantName.trim()) return setError("Store name is required"), false;
    if (!adminName.trim()) return setError("Admin name is required"), false;
    if (!adminEmail.trim()) return setError("Admin email is required"), false;
    if (adminPassword.length < 6) return setError("Admin password must be at least 6 characters"), false;
    if (adminPassword !== adminPasswordConfirm) return setError("Passwords do not match"), false;
    return true;
  }

  async function handleComplete() {
    setError("");
    if (status?.has_superadmin) {
      // Only create tenant (superadmin already exists)
      if (!validateStep2()) return;
      setSubmitting(true);
      try {
        await api.createFirstTenant({
          tenant_slug: tenantSlug,
          tenant_name: tenantName,
          tenant_description: tenantDesc,
          admin_email: adminEmail,
          admin_password: adminPassword,
          admin_name: adminName,
          brand_color: brandColor,
        });
        setStep(3);
        toast.success("Tenant created", "Your store has been set up successfully.");
      } catch (err) {
        const msg = (err as Error).message;
        setError(msg);
        toast.error("Setup failed", msg);
      } finally {
        setSubmitting(false);
      }
    } else {
      // Full setup: superadmin + tenant
      if (!validateStep1() || !validateStep2()) return;
      setSubmitting(true);
      try {
        await api.completeSetup({
          superadmin_email: saEmail,
          superadmin_password: saPassword,
          superadmin_name: saName,
          tenant_slug: tenantSlug,
          tenant_name: tenantName,
          tenant_description: tenantDesc,
          admin_email: adminEmail,
          admin_password: adminPassword,
          admin_name: adminName,
          brand_color: brandColor,
        });
        setStep(3);
        toast.success("Setup complete", "Superadmin and first store have been created.");
      } catch (err) {
        const msg = (err as Error).message;
        setError(msg);
        toast.error("Setup failed", msg);
      } finally {
        setSubmitting(false);
      }
    }
  }

  function handleGoToLogin() {
    navigate("/login", { replace: true });
  }

  if (loadingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900">
        <Spinner size={32} className="text-white" />
      </div>
    );
  }

  // Step 3: Success screen
  if (step === 3) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Setup Complete!</h1>
          <p className="text-slate-500 text-sm mb-6">
            Your TruCommerce platform is ready. You can now sign in with your credentials.
          </p>
          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left text-sm space-y-2">
            <p className="font-medium text-slate-700">Your accounts:</p>
            {!status?.has_superadmin && (
              <p className="text-slate-600">
                <span className="font-medium">Superadmin:</span> {saEmail}
              </p>
            )}
            <p className="text-slate-600">
              <span className="font-medium">Store:</span> {tenantName} ({tenantSlug})
            </p>
            <p className="text-slate-600">
              <span className="font-medium">Store Admin:</span> {adminEmail}
            </p>
          </div>
          <button
            onClick={handleGoToLogin}
            className="w-full bg-brand text-white font-semibold py-2.5 rounded-lg hover:bg-brand-dark transition"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const totalSteps = status?.has_superadmin ? 1 : 2;
  const currentStep = status?.has_superadmin ? 1 : step;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand text-white font-bold text-xl mb-3">
            TC
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome to TruCommerce</h1>
          <p className="text-slate-500 text-sm mt-1">Let's set up your platform</p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {!status?.has_superadmin && (
            <>
              <div className={`flex items-center gap-2 ${currentStep >= 1 ? "text-brand" : "text-slate-300"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${currentStep >= 1 ? "bg-brand text-white" : "bg-slate-200 text-slate-400"}`}>
                  1
                </div>
                <span className="text-sm font-medium hidden sm:inline">Superadmin</span>
              </div>
              <div className={`w-8 h-0.5 ${currentStep >= 2 ? "bg-brand" : "bg-slate-200"}`} />
            </>
          )}
          <div className={`flex items-center gap-2 ${currentStep >= (status?.has_superadmin ? 1 : 2) ? "text-brand" : "text-slate-300"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${currentStep >= (status?.has_superadmin ? 1 : 2) ? "bg-brand text-white" : "bg-slate-200 text-slate-400"}`}>
              {status?.has_superadmin ? "1" : "2"}
            </div>
            <span className="text-sm font-medium hidden sm:inline">First Store</span>
          </div>
        </div>

        {/* Step 1: Superadmin */}
        {!status?.has_superadmin && step === 1 && (
          <div className="space-y-4">
            <div className="bg-indigo-50 rounded-lg p-3 text-sm text-indigo-700">
              Create the platform superadmin account. This account has full control over all stores and tenants.
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input
                value={saName}
                onChange={(e) => setSaName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand"
                placeholder="Super Admin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={saEmail}
                onChange={(e) => setSaEmail(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password <span className="text-slate-400 font-normal">(min 8 chars)</span></label>
              <input
                type="password"
                value={saPassword}
                onChange={(e) => setSaPassword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
              <input
                type="password"
                value={saPasswordConfirm}
                onChange={(e) => setSaPasswordConfirm(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>
            {error && <div className="bg-rose-50 text-rose-600 text-sm rounded-lg px-3 py-2">{error}</div>}
            <button
              onClick={() => {
                setError("");
                if (validateStep1()) setStep(2);
              }}
              className="w-full bg-brand text-white font-semibold py-2.5 rounded-lg hover:bg-brand-dark transition"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2: First Tenant */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-indigo-50 rounded-lg p-3 text-sm text-indigo-700">
              Create your first store (tenant). You'll also create a business admin who will manage this store.
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Store Slug <span className="text-slate-400 font-normal">(URL identifier)</span></label>
              <input
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value.toLowerCase())}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand"
                placeholder="my-store"
              />
              <p className="text-xs text-slate-400 mt-1">Lowercase letters, numbers, and hyphens only. Used in URLs: /t/{tenantSlug || "my-store"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Store Name</label>
              <input
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand"
                placeholder="My Store"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description <span className="text-slate-400 font-normal">(optional)</span></label>
              <input
                value={tenantDesc}
                onChange={(e) => setTenantDesc(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand"
                placeholder="A short description of your store"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Brand Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border cursor-pointer"
                />
                <input
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">Store Administrator</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Admin Name</label>
              <input
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand"
                placeholder="Store Admin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Admin Email</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand"
                placeholder="store@example.com"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password <span className="text-slate-400 font-normal">(min 6)</span></label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={adminPasswordConfirm}
                  onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>
            </div>

            {error && <div className="bg-rose-50 text-rose-600 text-sm rounded-lg px-3 py-2">{error}</div>}

            <div className="flex gap-3">
              {!status?.has_superadmin && (
                <button
                  onClick={() => {
                    setError("");
                    setStep(1);
                  }}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleComplete}
                disabled={submitting}
                className="flex-1 bg-brand text-white font-semibold py-2.5 rounded-lg hover:bg-brand-dark transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Spinner size={18} />}
                {submitting ? "Setting up…" : "Complete Setup"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
