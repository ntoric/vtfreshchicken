"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchBootstrap } from "@/lib/api";
import { LegalPage } from "@/components/LegalPage";
import { StorefrontSkeleton } from "@/components/Loaders";
import { useCurrencyLang } from "@/lib/currency-lang";

export default function PrivacyPolicyPage({ params }: { params: {} }) {
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => fetchBootstrap(),
  });

  if (bootstrapQ.isLoading) return <StorefrontSkeleton />;
  if (bootstrapQ.error || !bootstrapQ.data) {
    return <div className="min-h-screen flex items-center justify-center text-rose-500">Failed to load. Please try again.</div>;
  }

  const store = bootstrapQ.data.store_name;

  return (
    <LegalPage
      bootstrap={bootstrapQ.data}
      currency={currency}
      setCurrency={setCurrency}
      lang={lang}
      setLang={setLang}
      title="Privacy Policy"
      lastUpdated="January 2025"
    >
      <h2>1. Introduction</h2>
      <p>
        This Privacy Policy explains how {store} ("we", "us", or "our") collects, uses, and protects your
        personal information when you browse our store, create an account, or place an order. We are
        committed to handling your data transparently and in line with applicable data-protection laws,
        including the General Data Protection Regulation (GDPR).
      </p>
      <p>
        By using our website you acknowledge the practices described here. This policy works together with
        our <Link href="/terms">Terms & Conditions</Link> and{" "}
        <Link href="/cookie-policy">Cookie Policy</Link>.
      </p>

      <h2>2. Information We Collect</h2>
      <h3>Information you give us</h3>
      <ul>
        <li><strong>Account details</strong> — name, email address, phone number, and password when you register</li>
        <li><strong>Delivery details</strong> — delivery addresses, landmarks, and delivery instructions you save</li>
        <li><strong>Order information</strong> — products purchased, order notes, and delivery-slot selections</li>
        <li><strong>Payment details</strong> — processed securely by our payment partners; we never store your full card number</li>
        <li><strong>Support messages</strong> — anything you send us through the contact form or order support</li>
      </ul>
      <h3>Information collected automatically</h3>
      <ul>
        <li>Device and browser type, approximate location, and pages visited</li>
        <li>Cart contents, wishlist items, and recently viewed products</li>
        <li>Cookie and preference data — see our <Link href="/cookie-policy">Cookie Policy</Link> for details</li>
      </ul>

      <h2>3. How We Use Your Information</h2>
      <ul>
        <li>Fulfilling and delivering your orders, including order updates by email or SMS</li>
        <li>Processing payments and preventing fraud</li>
        <li>Managing your account, addresses, wishlist, and order history</li>
        <li>Handling returns, refunds, and quality concerns</li>
        <li>Improving our store — understanding which products and pages are useful</li>
        <li>Sending service messages (order confirmations, delivery alerts) and, with your consent, offers and updates</li>
      </ul>
      <p>
        We do not sell your personal information to third parties, and we do not use it for advertising
        outside our own store without your consent.
      </p>

      <h2>4. Legal Bases for Processing</h2>
      <p>We process your personal data only where we have a lawful basis:</p>
      <ul>
        <li><strong>Contract</strong> — to take your order, deliver it, and manage your account</li>
        <li><strong>Legal obligation</strong> — for tax, accounting, and food-safety record keeping</li>
        <li><strong>Legitimate interest</strong> — to keep the store secure and improve our service</li>
        <li><strong>Consent</strong> — for optional cookies and marketing messages, which you can withdraw anytime</li>
      </ul>

      <h2>5. Who We Share Your Data With</h2>
      <p>We share personal data only with the partners needed to run the store:</p>
      <ul>
        <li><strong>Payment processors</strong> (e.g., Razorpay) — to authorise and process payments securely</li>
        <li><strong>Delivery partners</strong> — your name, address, and phone number so your order can reach you</li>
        <li><strong>Service providers</strong> — hosting, email/SMS delivery, and analytics, under data-processing agreements</li>
        <li><strong>Authorities</strong> — where disclosure is required by law or to protect our legal rights</li>
      </ul>
      <p>
        Each partner receives only the minimum data needed for its role and may not use it for its own
        purposes.
      </p>

      <h2>6. Data Retention</h2>
      <ul>
        <li><strong>Order & invoice records</strong> — kept as required by tax and accounting law</li>
        <li><strong>Account data</strong> — kept while your account is active; deleted or anonymised when you close it</li>
        <li><strong>Support conversations</strong> — kept for a limited period to resolve and learn from issues</li>
        <li><strong>Analytics data</strong> — aggregated and anonymised, not tied to you personally</li>
      </ul>

      <h2>7. How We Protect Your Data</h2>
      <ul>
        <li>Encrypted connections (HTTPS) across the entire site</li>
        <li>Payments handled by PCI-compliant gateways — card details never touch our servers</li>
        <li>Passwords stored using strong one-way hashing</li>
        <li>Access to personal data restricted to staff who need it, under confidentiality obligations</li>
      </ul>
      <p>
        No system is perfectly secure, but we continuously review our safeguards and will notify you and
        the relevant authority if a breach affects your data.
      </p>

      <h2>8. Your Rights</h2>
      <p>You can exercise the following rights over your personal data:</p>
      <ul>
        <li><strong>Access & portability</strong> — download a copy of your data from{" "}
          <Link href="/account/data">Your Data & Privacy</Link></li>
        <li><strong>Correction</strong> — update your name, email, and addresses in your account settings</li>
        <li><strong>Deletion</strong> — request account deletion from the same page; we remove data we are not required to keep</li>
        <li><strong>Consent withdrawal</strong> — change cookie preferences anytime via the{" "}
          <Link href="/cookie-policy">Cookie Policy</Link> page</li>
        <li><strong>Objection & restriction</strong> — contact us to limit how we process your data</li>
      </ul>
      <p>
        If you believe we have not handled your data properly, you may also lodge a complaint with your
        local data-protection authority.
      </p>

      <h2>9. Children's Privacy</h2>
      <p>
        Our store is intended for adults. We do not knowingly collect personal data from children under 18.
        If you believe a child has provided us data, please contact us and we will delete it promptly.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy as our store or applicable law evolves. The "Last updated" date
        above shows the current version; significant changes will be announced on the website.
      </p>

      <h2>11. Contact Us</h2>
      <p>
        Questions about this policy or how we handle your data? Reach us through our{" "}
        <Link href="/contact">contact page</Link> — we typically respond within one business day.
      </p>
    </LegalPage>
  );
}
