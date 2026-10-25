"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";
import { hasConsent, acceptAll, rejectAll, type CookieConsent } from "@/lib/cookies";
import { CookiePreferencesModal } from "@/components/CookiePreferencesModal";

interface CookieConsentBannerProps {
}

export function CookieConsentBanner({}: CookieConsentBannerProps) {
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
            className="w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden backdrop-blur-xl bg-white/95 border border-stone-200 shadow-[0_24px_60px_-20px_rgba(28,25,23,0.3)]"
          >
            {/* Header */}
            <div className="flex items-start gap-3 p-4 pb-2">
              <div
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "var(--brand-color-light, #FDECEE)" }}
              >
                <Cookie className="w-5 h-5 text-brand" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-sm font-semibold text-stone-900">We value your privacy</h2>
                <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                  We use cookies to enhance your browsing experience and analyze traffic.
                </p>
              </div>
              <button
                onClick={handleRejectAll}
                className="flex-shrink-0 text-stone-400 hover:text-stone-600 transition"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Links */}
            <div className="px-4 pb-2">
              <p className="text-xs text-stone-500 leading-relaxed">
                Read our{" "}
                <Link
                  href={`/cookie-policy`}
                  className="font-medium text-brand underline underline-offset-2 hover:text-brand-dark transition"
                >
                  Cookie Policy
                </Link>{" "}
                and{" "}
                <Link
                  href={`/privacy-policy`}
                  className="font-medium text-brand underline underline-offset-2 hover:text-brand-dark transition"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 p-3 bg-stone-50 border-t border-stone-200">
              <button
                onClick={() => setShowPrefs(true)}
                className="flex-1 px-3 py-2 text-xs font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-100 hover:text-stone-900 transition"
              >
                Customize
              </button>
              <button
                onClick={handleRejectAll}
                className="flex-1 px-3 py-2 text-xs font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-100 hover:text-stone-900 transition"
              >
                Reject All
              </button>
              <button
                onClick={handleAcceptAll}
                className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-brand rounded-lg hover:bg-brand-dark transition"
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

          onClose={() => setShowPrefs(false)}
          onSave={handleSavePrefs}
        />
      )}
    </>
  );
}
