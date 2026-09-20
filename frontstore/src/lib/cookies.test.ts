import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getConsent,
  hasConsent,
  hasCategoryConsent,
  saveConsent,
  acceptAll,
  rejectAll,
  withdrawConsent,
  onConsentChange,
  CONSENT_VERSION,
  CONSENT_STORAGE_KEY,
  type CookieCategory,
} from "@/lib/cookies";

describe("cookie consent", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getConsent returns null when no consent stored", () => {
    expect(getConsent()).toBeNull();
  });

  it("getConsent returns null for malformed JSON", () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, "not-json");
    expect(getConsent()).toBeNull();
  });

  it("getConsent returns null when version mismatches", () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        categories: { essential: true, functional: true, analytics: true, marketing: true },
        grantedAt: "2024-01-01T00:00:00Z",
        version: CONSENT_VERSION + 1,
        source: "banner",
      }),
    );
    expect(getConsent()).toBeNull();
  });

  it("getConsent returns stored consent when version matches", () => {
    const consent = {
      categories: { essential: true, functional: true, analytics: true, marketing: true },
      grantedAt: "2024-01-01T00:00:00Z",
      version: CONSENT_VERSION,
      source: "banner" as const,
    };
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
    const got = getConsent();
    expect(got).not.toBeNull();
    expect(got?.source).toBe("banner");
    expect(got?.categories.functional).toBe(true);
  });

  it("hasConsent returns false when no consent", () => {
    expect(hasConsent()).toBe(false);
  });

  it("hasConsent returns true after saving consent", () => {
    saveConsent({ essential: true, functional: false, analytics: false, marketing: false });
    expect(hasConsent()).toBe(true);
  });

  it("hasCategoryConsent returns true for essential when no consent", () => {
    expect(hasCategoryConsent("essential")).toBe(true);
  });

  it("hasCategoryConsent returns false for non-essential when no consent", () => {
    expect(hasCategoryConsent("marketing")).toBe(false);
    expect(hasCategoryConsent("analytics")).toBe(false);
    expect(hasCategoryConsent("functional")).toBe(false);
  });

  it("hasCategoryConsent respects saved categories", () => {
    saveConsent({ essential: true, functional: true, analytics: false, marketing: false });
    expect(hasCategoryConsent("essential")).toBe(true);
    expect(hasCategoryConsent("functional")).toBe(true);
    expect(hasCategoryConsent("analytics")).toBe(false);
    expect(hasCategoryConsent("marketing")).toBe(false);
  });

  it("saveConsent always forces essential to true", () => {
    const consent = saveConsent({
      essential: false,
      functional: false,
      analytics: false,
      marketing: false,
    });
    expect(consent.categories.essential).toBe(true);
  });

  it("saveConsent stores consent in localStorage", () => {
    saveConsent({ essential: true, functional: true, analytics: false, marketing: false }, "preferences");
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.source).toBe("preferences");
    expect(parsed.version).toBe(CONSENT_VERSION);
    expect(parsed.categories.functional).toBe(true);
  });

  it("saveConsent dispatches consent-change event", () => {
    const handler = vi.fn();
    window.addEventListener("cookie-consent-change", handler);
    saveConsent({ essential: true, functional: true, analytics: false, marketing: false });
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener("cookie-consent-change", handler);
  });

  it("acceptAll enables all categories", () => {
    const consent = acceptAll();
    expect(consent.categories.essential).toBe(true);
    expect(consent.categories.functional).toBe(true);
    expect(consent.categories.analytics).toBe(true);
    expect(consent.categories.marketing).toBe(true);
  });

  it("rejectAll disables optional categories but keeps essential", () => {
    const consent = rejectAll();
    expect(consent.categories.essential).toBe(true);
    expect(consent.categories.functional).toBe(false);
    expect(consent.categories.analytics).toBe(false);
    expect(consent.categories.marketing).toBe(false);
  });

  it("withdrawConsent removes consent from localStorage", () => {
    saveConsent({ essential: true, functional: true, analytics: true, marketing: true });
    expect(hasConsent()).toBe(true);
    withdrawConsent();
    expect(hasConsent()).toBe(false);
    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull();
  });

  it("withdrawConsent dispatches null event", () => {
    const handler = vi.fn();
    window.addEventListener("cookie-consent-change", handler);
    withdrawConsent();
    expect(handler).toHaveBeenCalledTimes(1);
    const detail = (handler.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toBeNull();
    window.removeEventListener("cookie-consent-change", handler);
  });

  it("onConsentChange subscribes to changes", () => {
    const cb = vi.fn();
    const unsub = onConsentChange(cb);
    saveConsent({ essential: true, functional: false, analytics: false, marketing: false });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]?.categories.essential).toBe(true);
    unsub();
  });

  it("onConsentChange unsubscribe stops callbacks", () => {
    const cb = vi.fn();
    const unsub = onConsentChange(cb);
    unsub();
    saveConsent({ essential: true, functional: false, analytics: false, marketing: false });
    expect(cb).not.toHaveBeenCalled();
  });

  it("acceptAll with source 'preferences'", () => {
    const consent = acceptAll("preferences");
    expect(consent.source).toBe("preferences");
  });

  it("rejectAll with source 'preferences'", () => {
    const consent = rejectAll("preferences");
    expect(consent.source).toBe("preferences");
  });
});
