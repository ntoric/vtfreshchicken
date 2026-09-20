"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { fetchBootstrap } from "@/lib/api";
import { LegalPage } from "@/components/LegalPage";
import { CookiePreferencesModal } from "@/components/CookiePreferencesModal";
import { hasConsent, withdrawConsent, getConsent, COOKIE_CATEGORIES } from "@/lib/cookies";
import { StorefrontSkeleton } from "@/components/Loaders";
import { useCurrencyLang } from "@/lib/currency-lang";

export default function CookiePolicyPage({ params }: { params: { tenant: string } }) {
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();
  const [showPrefs, setShowPrefs] = useState(false);
  const [consentWithdrawn, setConsentWithdrawn] = useState(false);

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap", params.tenant],
    queryFn: () => fetchBootstrap(params.tenant),
  });

  if (bootstrapQ.isLoading) return <StorefrontSkeleton />;
  if (bootstrapQ.error || !bootstrapQ.data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-rose-500">
        Failed to load. Please try again.
      </div>
    );
  }

  const consent = getConsent();
  const hasGivenConsent = hasConsent() && !consentWithdrawn;

  const handleWithdraw = () => {
    withdrawConsent();
    setConsentWithdrawn(true);
    setTimeout(() => setConsentWithdrawn(false), 3000);
  };

  return (
    <>
      <LegalPage
        tenant={params.tenant}
        bootstrap={bootstrapQ.data}
        currency={currency}
        setCurrency={setCurrency}
        lang={lang}
        setLang={setLang}
        title="Cookie Policy"
        lastUpdated="January 2025"
      >
        <h2>1. Introduction</h2>
        <p>
          This Cookie Policy explains how {params.tenant} ("we", "us", or "our") uses cookies and similar
          technologies on our website. We are committed to transparency and comply with the General Data
          Protection Regulation (GDPR) and the ePrivacy Directive.
        </p>
        <p>
          By using our website, you agree to the use of cookies as described in this policy. You can manage
          your cookie preferences at any time using the cookie consent tool on our site.
        </p>

        <h2>2. What Are Cookies?</h2>
        <p>
          Cookies are small text files stored on your device (computer, tablet, or mobile) when you visit a
          website. They allow the website to recognize your device and remember information about your visit,
          such as your preferences, shopping cart contents, and login status.
        </p>
        <p>
          We use both session cookies (which expire when you close your browser) and persistent cookies
          (which remain on your device for a set period or until you delete them).
        </p>

        <h2>3. Types of Cookies We Use</h2>
        <p>We categorize our cookies into four types:</p>

        <h3>3.1 Essential Cookies (Always Active)</h3>
        <p>
          These cookies are strictly necessary for the website to function. They enable core functionality
          such as:
        </p>
        <ul>
          <li>Shopping cart management and checkout</li>
          <li>User authentication and session management</li>
          <li>Security and fraud prevention</li>
          <li>Load balancing and site stability</li>
        </ul>
        <p>
          <strong>You cannot disable essential cookies</strong> as the website will not function properly
          without them. These are placed without requiring your consent under the "strictly necessary"
          exemption in the ePrivacy Directive.
        </p>

        <h3>3.2 Functional Cookies (Optional)</h3>
        <p>These cookies enhance your experience by remembering your preferences:</p>
        <ul>
          <li>Selected currency and language</li>
          <li>Recently viewed products</li>
          <li>Display preferences and layout settings</li>
        </ul>
        <p>These cookies are only set with your consent.</p>

        <h3>3.3 Analytics Cookies (Optional)</h3>
        <p>
          These cookies help us understand how visitors interact with our website so we can improve the
          shopping experience:
        </p>
        <ul>
          <li>Page views and visit duration</li>
          <li>Search terms and product clicks</li>
          <li>Conversion tracking (anonymized)</li>
          <li>Error and performance monitoring</li>
        </ul>
        <p>
          Analytics data is aggregated and anonymized. We do not use analytics cookies to identify individual
          users.
        </p>

        <h3>3.4 Marketing Cookies (Optional)</h3>
        <p>
          These cookies are used to deliver relevant advertisements and track the effectiveness of marketing
          campaigns:
        </p>
        <ul>
          <li>Personalized product recommendations</li>
          <li>Ad retargeting across third-party platforms</li>
          <li>Campaign attribution and measurement</li>
        </ul>
        <p>These cookies are only set with your explicit consent.</p>

        <h2>4. Your Consent</h2>
        <p>
          Under the GDPR and ePrivacy Directive, we require your consent before setting non-essential cookies.
          When you first visit our site, you will see a cookie consent banner allowing you to:
        </p>
        <ul>
          <li><strong>Accept All</strong> — Enable all cookie categories</li>
          <li><strong>Reject All</strong> — Only essential cookies will be used</li>
          <li><strong>Customize</strong> — Choose which categories to enable</li>
        </ul>
        <p>
          You can change your preferences at any time by using the "Cookie Preferences" tool below or by
          clearing your browser's local storage.
        </p>

        {/* Current consent status + controls */}
        <div className="not-prose bg-gray-50 rounded-2xl border p-6 my-6">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Your Current Consent</h3>
          {hasGivenConsent ? (
            <>
              <p className="text-sm text-gray-600 mb-4">
                You provided consent on <strong>{consent?.grantedAt ? new Date(consent.grantedAt).toLocaleDateString() : "N/A"}</strong>.
                The following categories are currently active:
              </p>
              <div className="space-y-2 mb-4">
                {COOKIE_CATEGORIES.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-2 text-sm">
                    <span
                      className={`w-2 h-2 rounded-full ${consent?.categories[cat.id] ? "bg-emerald-500" : "bg-gray-300"}`}
                    />
                    <span className={consent?.categories[cat.id] ? "text-gray-900 font-medium" : "text-gray-400"}>
                      {cat.label}
                    </span>
                  </div>
                ))}
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
                  onClick={handleWithdraw}
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
            <>
              <p className="text-sm text-gray-600 mb-4">
                You have not given consent for non-essential cookies. Only essential cookies are currently active.
              </p>
              <button
                onClick={() => setShowPrefs(true)}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg"
                style={{ backgroundColor: "var(--brand-color, #4f46e5)" }}
              >
                Set Preferences
              </button>
            </>
          )}
        </div>

        <h2>5. Third-Party Cookies</h2>
        <p>
          In some cases, we may use third-party services that set their own cookies. These may include:
        </p>
        <ul>
          <li>Payment processors (e.g., Razorpay) — for secure transaction processing</li>
          <li>Analytics providers — for usage statistics</li>
          <li>Advertising networks — for marketing campaigns (only with your consent)</li>
        </ul>
        <p>
          Third-party cookies are governed by the respective provider's privacy policy. We recommend reviewing
          their policies for more information.
        </p>

        <h2>6. How Long Cookies Stay on Your Device</h2>
        <ul>
          <li><strong>Session cookies:</strong> Deleted when you close your browser</li>
          <li><strong>Persistent cookies:</strong> Remain until they expire or you delete them. Typically 30–365 days, depending on the category.</li>
        </ul>

        <h2>7. Managing Cookies in Your Browser</h2>
        <p>
          In addition to our consent tool, you can control and delete cookies through your browser settings.
          Most browsers allow you to:
        </p>
        <ul>
          <li>View all cookies stored on your device</li>
          <li>Block cookies from specific sites</li>
          <li>Block all third-party cookies</li>
          <li>Delete all cookies when you close the browser</li>
        </ul>
        <p>
          Note that blocking essential cookies may prevent you from using key features such as the shopping
          cart and checkout.
        </p>

        <h2>8. Updates to This Policy</h2>
        <p>
          We may update this Cookie Policy from time to time. The "Last updated" date at the top of this page
          indicates when the policy was last revised. If we make significant changes, we will notify you
          through the website and re-prompt for consent if required.
        </p>

        <h2>9. Contact Us</h2>
        <p>
          If you have any questions about our use of cookies or this Cookie Policy, please contact us through
          our website's contact form or at the email address provided in our Privacy Policy.
        </p>
      </LegalPage>

      {showPrefs && (
        <CookiePreferencesModal
          tenant={params.tenant}
          onClose={() => setShowPrefs(false)}
        />
      )}
    </>
  );
}
