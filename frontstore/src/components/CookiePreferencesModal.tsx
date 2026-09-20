"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  COOKIE_CATEGORIES,
  getConsent,
  saveConsent,
  acceptAll,
  rejectAll,
  type CookieCategory,
  type CookieConsent,
} from "@/lib/cookies";

interface CookiePreferencesModalProps {
  tenant: string;
  onClose: () => void;
  onSave?: (consent: CookieConsent) => void;
}

export function CookiePreferencesModal({ tenant, onClose, onSave }: CookiePreferencesModalProps) {
  const existing = getConsent();
  const [categories, setCategories] = useState<Record<CookieCategory, boolean>>(
    existing?.categories ?? {
      essential: true,
      functional: false,
      analytics: false,
      marketing: false,
    }
  );

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleToggle = (cat: CookieCategory, value: boolean) => {
    if (cat === "essential") return; // can't toggle essential
    setCategories((prev) => ({ ...prev, [cat]: value }));
  };

  const handleSave = () => {
    const consent = saveConsent(categories, "preferences");
    onSave?.(consent);
    onClose();
  };

  const handleAcceptAll = () => {
    const consent = acceptAll("preferences");
    onSave?.(consent);
    onClose();
  };

  const handleRejectAll = () => {
    const consent = rejectAll("preferences");
    onSave?.(consent);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Cookie preferences"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Cookie Preferences</h2>
            <p className="text-sm text-gray-500 mt-0.5">Manage how we use cookies on this site</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            We use cookies and similar technologies to operate, improve, and personalize our services.
            Essential cookies are required for the site to function. For other categories, you can choose
            what to enable. Read our{" "}
            <Link
              href={`/${tenant}/cookie-policy`}
              className="font-medium underline"
              style={{ color: "var(--brand-color, #4f46e5)" }}
            >
              Cookie Policy
            </Link>{" "}
            for details.
          </p>

          {/* Category toggles */}
          <div className="space-y-3">
            {COOKIE_CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                className={`rounded-xl border p-4 transition ${categories[cat.id] ? "border-gray-200 bg-gray-50/50" : "border-gray-100"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 text-sm">{cat.label}</h3>
                      {cat.required && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                          Required
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{cat.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle(cat.id, !categories[cat.id])}
                    disabled={cat.required}
                    className={`relative w-11 h-6 rounded-full transition flex-shrink-0 ${
                      cat.required ? "opacity-60 cursor-not-allowed" : ""
                    } ${categories[cat.id] ? "bg-emerald-500" : "bg-gray-200"}`}
                    aria-label={`Toggle ${cat.label}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        categories[cat.id] ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50/50 flex flex-wrap items-center justify-between gap-3 rounded-b-2xl">
          <div className="flex gap-2">
            <button
              onClick={handleRejectAll}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition"
            >
              Reject All
            </button>
            <button
              onClick={handleAcceptAll}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition"
            >
              Accept All
            </button>
          </div>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg shadow-sm hover:shadow transition"
            style={{ backgroundColor: "var(--brand-color, #4f46e5)" }}
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
