"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";
import { hasConsent, acceptAll, rejectAll, type CookieConsent } from "@/lib/cookies";
import { CookiePreferencesModal } from "@/components/CookiePreferencesModal";

interface CookieConsentBannerProps {
  tenant: string;
}

export function CookieConsentBanner({ tenant }: CookieConsentBannerProps) {
  const [visible, setVisible] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);

  useEffect(() => {
    // Small delay so it doesn't flash during page load
    const timer = setTimeout(() => {
      if (!hasConsent()) {
        setVisible(true);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleAcceptAll = () => {
    acceptAll("banner");
    setVisible(false);
  };

  const handleRejectAll = () => {
    rejectAll("banner");
    setVisible(false);
  };

  const handleSavePrefs = (consent: CookieConsent) => {
    setVisible(false);
    setShowPrefs(false);
  };

  if (!visible && !showPrefs) return null;

  return (
    <>
      {visible && (
        <div
          className="fixed bottom-4 right-4 z-[100] animate-slide-up"
          role="dialog"
          aria-live="polite"
          aria-label="Cookie consent"
        >
          <div
            className="w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border shadow-lg shadow-slate-900/5 overflow-hidden backdrop-blur-xl bg-white/80 border-slate-200/50"
          >
            {/* Header */}
            <div className="flex items-start gap-3 p-4 pb-2">
              <div
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "color-mix(in srgb, var(--brand-color, #4f46e5) 10%, transparent)" }}
              >
                <Cookie className="w-5 h-5" style={{ color: "var(--brand-color, #4f46e5)" }} strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-gray-900">We value your privacy</h2>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  We use cookies to enhance your browsing experience and analyze traffic.
                </p>
              </div>
              <button
                onClick={handleRejectAll}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Links */}
            <div className="px-4 pb-2">
              <p className="text-xs text-gray-500 leading-relaxed">
                Read our{" "}
                <Link
                  href={`/${tenant}/cookie-policy`}
                  className="font-medium underline hover:text-gray-700"
                  style={{ color: "var(--brand-color, #4f46e5)" }}
                >
                  Cookie Policy
                </Link>{" "}
                and{" "}
                <Link
                  href={`/${tenant}/privacy-policy`}
                  className="font-medium underline hover:text-gray-700"
                  style={{ color: "var(--brand-color, #4f46e5)" }}
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 p-3 bg-slate-50/50 border-t border-slate-200/50">
              <button
                onClick={() => setShowPrefs(true)}
                className="flex-1 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white transition"
              >
                Customize
              </button>
              <button
                onClick={handleRejectAll}
                className="flex-1 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white transition"
              >
                Reject All
              </button>
              <button
                onClick={handleAcceptAll}
                className="flex-1 px-3 py-2 text-xs font-semibold text-white rounded-lg shadow-sm hover:shadow transition"
                style={{ backgroundColor: "var(--brand-color, #4f46e5)" }}
              >
                Accept All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preferences modal (can be opened from banner) */}
      {showPrefs && (
        <CookiePreferencesModal
          tenant={tenant}
          onClose={() => setShowPrefs(false)}
          onSave={handleSavePrefs}
        />
      )}
    </>
  );
}
