/**
 * Cookie consent management library — GDPR compliant.
 *
 * Categories:
 * - essential:    Always on. Required for cart, auth, session. Cannot be disabled.
 * - functional:   User preferences (currency, language, theme). Optional.
 * - analytics:    Usage analytics. Optional, off by default.
 * - marketing:    Promotional/tracking cookies. Optional, off by default.
 *
 * Consent is stored in localStorage under `tc_cookie_consent` and includes:
 * - categories: which categories the user accepted
 * - grantedAt:  timestamp of consent
 * - version:    consent version (bumped when policy changes)
 * - source:     "banner" | "preferences" | "implicit"
 */

export type CookieCategory = "essential" | "functional" | "analytics" | "marketing";

export interface CookieConsent {
  categories: Record<CookieCategory, boolean>;
  grantedAt: string; // ISO timestamp
  version: number;
  source: "banner" | "preferences" | "implicit";
}

export const CONSENT_VERSION = 1;
export const CONSENT_STORAGE_KEY = "tc_cookie_consent";

export const COOKIE_CATEGORIES: { id: CookieCategory; label: string; description: string; required: boolean }[] = [
  {
    id: "essential",
    label: "Essential Cookies",
    description: "Required for the shopping cart, authentication, and secure checkout. These cannot be disabled as the site will not function without them.",
    required: true,
  },
  {
    id: "functional",
    label: "Functional Cookies",
    description: "Remember your preferences such as currency, language, and recently viewed products. These improve your experience but are not required.",
    required: false,
  },
  {
    id: "analytics",
    label: "Analytics Cookies",
    description: "Help us understand how visitors interact with our site so we can improve the shopping experience. Anonymous and aggregated only.",
    required: false,
  },
  {
    id: "marketing",
    label: "Marketing Cookies",
    description: "Used to display personalized ads and track campaign effectiveness. Only enabled with your explicit consent.",
    required: false,
  },
];

const DEFAULT_CONSENT: CookieConsent = {
  categories: {
    essential: true,
    functional: false,
    analytics: false,
    marketing: false,
  },
  grantedAt: new Date().toISOString(),
  version: CONSENT_VERSION,
  source: "implicit",
};

/** Read consent from localStorage. Returns null if no consent has been recorded. */
export function getConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsent;
    // If consent version is outdated, treat as no consent (re-prompt)
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Check if consent has been given (any version match). */
export function hasConsent(): boolean {
  return getConsent() !== null;
}

/** Check if a specific category is allowed. */
export function hasCategoryConsent(category: CookieCategory): boolean {
  const consent = getConsent();
  if (!consent) return category === "essential"; // essential always allowed
  return consent.categories[category] === true;
}

/** Save consent to localStorage. */
export function saveConsent(categories: Record<CookieCategory, boolean>, source: "banner" | "preferences" | "implicit" = "banner"): CookieConsent {
  const consent: CookieConsent = {
    categories: {
      ...categories,
      essential: true, // always on
    },
    grantedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
    source,
  };
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
    // Dispatch event so other components can react
    window.dispatchEvent(new CustomEvent("cookie-consent-change", { detail: consent }));
  } catch {
    // localStorage might be unavailable (private mode)
  }
  return consent;
}

/** Accept all categories. */
export function acceptAll(source: "banner" | "preferences" = "banner"): CookieConsent {
  return saveConsent(
    {
      essential: true,
      functional: true,
      analytics: true,
      marketing: true,
    },
    source
  );
}

/** Reject all optional categories (essential stays on). */
export function rejectAll(source: "banner" | "preferences" = "banner"): CookieConsent {
  return saveConsent(
    {
      essential: true,
      functional: false,
      analytics: false,
      marketing: false,
    },
    source
  );
}

/** Withdraw consent entirely (re-prompts the banner). */
export function withdrawConsent(): void {
  try {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("cookie-consent-change", { detail: null }));
  } catch {
    // ignore
  }
}

/** Subscribe to consent changes. Returns an unsubscribe function. */
export function onConsentChange(callback: (consent: CookieConsent | null) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail as CookieConsent | null;
    callback(detail);
  };
  window.addEventListener("cookie-consent-change", handler);
  return () => window.removeEventListener("cookie-consent-change", handler);
}
