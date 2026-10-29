import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Spinner } from "@/components/Skeletons";
import { useToast } from "@/components/Toast";

export function Setup() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [storeName, setStoreName] = useState("");
  const [storeDesc, setStoreDesc] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");
  const [brandColor, setBrandColor] = useState("#dc2626");

  useEffect(() => {
    api
      .getSetupStatus()
      .then((s) => {
        if (s.setup_complete) {
          navigate("/login", { replace: true });
        }
      })
      .catch(() => {
        setError("Failed to check setup status. Is the backend running?");
      })
      .finally(() => setLoadingStatus(false));
  }, [navigate]);

  async function handleComplete(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!storeName.trim()) return setError("Store name is required");
    if (!adminName.trim()) return setError("Admin name is required");
    if (!adminEmail.trim()) return setError("Admin email is required");
    if (adminPassword.length < 6) return setError("Admin password must be at least 6 characters");
    if (adminPassword !== adminPasswordConfirm) return setError("Passwords do not match");

    setSubmitting(true);
    try {
      await api.completeSetup({
        store_name: storeName,
        store_description: storeDesc,
        admin_email: adminEmail,
        admin_password: adminPassword,
        admin_name: adminName,
        brand_color: brandColor,
      });
      setDone(true);
      toast.success("Setup complete", "Your store has been created.");
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error("Setup failed", msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-900 via-red-900 to-neutral-900">
        <Spinner size={32} className="text-white" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-900 via-red-900 to-neutral-900 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Setup Complete!</h1>
          <p className="text-neutral-500 text-sm mb-6">
            Your store is ready. You can now sign in with your admin credentials.
          </p>
          <div className="bg-neutral-50 rounded-xl p-4 mb-6 text-left text-sm space-y-2">
            <p className="text-neutral-600">
              <span className="font-medium">Store:</span> {storeName}
            </p>
            <p className="text-neutral-600">
              <span className="font-medium">Admin:</span> {adminEmail}
            </p>
          </div>
          <button
            onClick={() => navigate("/login", { replace: true })}
            className="w-full bg-brand text-white font-semibold py-2.5 rounded-lg hover:bg-brand-dark transition"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-900 via-red-900 to-neutral-900 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand text-white font-bold text-xl mb-3">
            TC
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Welcome to TruCommerce</h1>
          <p className="text-neutral-500 text-sm mt-1">Let's set up your store</p>
        </div>

        <form onSubmit={handleComplete} className="space-y-4">
          <div className="bg-red-50 rounded-lg p-3 text-sm text-red-700">
            Create your store and its administrator account.
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Store Name</label>
            <input
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand"
              placeholder="My Store"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Description <span className="text-neutral-400 font-normal">(optional)</span></label>
            <input
              value={storeDesc}
              onChange={(e) => setStoreDesc(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand"
              placeholder="A short description of your store"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Brand Color</label>
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

          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-neutral-700 mb-3">Store Administrator</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Admin Name</label>
            <input
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand"
              placeholder="Store Admin"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Admin Email</label>
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
              <label className="block text-sm font-medium text-neutral-700 mb-1">Password <span className="text-neutral-400 font-normal">(min 6)</span></label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Confirm Password</label>
              <input
                type="password"
                value={adminPasswordConfirm}
                onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>
          </div>

          {error && <div className="bg-rose-50 text-rose-600 text-sm rounded-lg px-3 py-2">{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand text-white font-semibold py-2.5 rounded-lg hover:bg-brand-dark transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Spinner size={18} />}
            {submitting ? "Setting up…" : "Complete Setup"}
          </button>
        </form>
      </div>
    </div>
  );
}
