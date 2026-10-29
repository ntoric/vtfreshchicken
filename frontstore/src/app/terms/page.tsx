"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchBootstrap } from "@/lib/api";
import { LegalPage } from "@/components/LegalPage";
import { StorefrontSkeleton } from "@/components/Loaders";
import { useCurrencyLang } from "@/lib/currency-lang";

export default function TermsPage({ params }: { params: {} }) {
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
      title="Terms & Conditions"
      lastUpdated="January 2025"
    >
      <h2>1. Introduction</h2>
      <p>
        These Terms & Conditions ("Terms") govern your use of the {store} website and the purchase of
        products from us. By browsing our store, creating an account, or placing an order, you agree to
        be bound by these Terms together with our{" "}
        <Link href="/privacy-policy">Privacy Policy</Link> and{" "}
        <Link href="/cookie-policy">Cookie Policy</Link>.
      </p>
      <p>
        If you do not agree with any part of these Terms, please do not use our website or place an
        order.
      </p>

      <h2>2. Products, Pricing & Availability</h2>
      <p>
        We make every effort to display our products — including fresh, frozen, and marinated chicken —
        accurately. However:
      </p>
      <ul>
        <li>
          Many of our products are sold by weight. The final weight of a cut may vary slightly, and your
          order total is adjusted to reflect the actual weight delivered.
        </li>
        <li>
          Product images are for illustration; natural variation in cut, size, and appearance is expected
          with fresh produce.
        </li>
        <li>
          Prices and availability may change without notice. If a product becomes unavailable after you
          order, we will contact you to offer a substitute or refund for that item.
        </li>
        <li>
          In the event of a pricing error, we reserve the right to cancel the affected order and issue a
          full refund.
        </li>
      </ul>

      <h2>3. Orders & Acceptance</h2>
      <p>
        When you place an order, you make an offer to purchase the products in your cart. An order is
        accepted — and a contract formed — only when we dispatch it for delivery. We may decline or cancel
        an order where:
      </p>
      <ul>
        <li>Payment could not be authorised or was flagged for fraud review</li>
        <li>The delivery address is outside our serviceable area</li>
        <li>Product or pricing information was displayed in error</li>
        <li>We reasonably suspect misuse of offers, accounts, or the platform</li>
      </ul>
      <p>
        You will receive an order confirmation by email or SMS once your order is placed, and updates as it
        is prepared and dispatched.
      </p>

      <h2>4. Delivery</h2>
      <p>
        We deliver fresh chicken chilled, maintaining cold-chain temperatures from our facility to your
        door. By placing an order you agree that:
      </p>
      <ul>
        <li>
          You (or someone authorised by you) will be available at the delivery address during the selected
          delivery slot to receive the order.
        </li>
        <li>
          Because our products are perishable, orders that cannot be delivered due to an incorrect address
          or nobody being available may not be eligible for refund.
        </li>
        <li>
          Delivery estimates are indicative; delays caused by traffic, weather, or other factors outside
          our control do not constitute a breach of these Terms.
        </li>
        <li>
          You are responsible for refrigerating or freezing products promptly upon receipt.
        </li>
      </ul>

      <h2>5. Freshness Guarantee & Quality Concerns</h2>
      <p>
        We stand behind the freshness of every order. If a product arrives in a condition you are not
        happy with — damaged packaging, temperature concerns, or a quality issue — please report it to us
        within <strong>24 hours of delivery</strong>, with your order number and a photo of the product
        where possible.
      </p>
      <p>
        Verified quality concerns are resolved with a replacement, store credit, or refund to your original
        payment method, at our discretion.
      </p>

      <h2>6. Returns & Refunds</h2>
      <p>
        Because our products are perishable food items, we do not accept physical returns. Instead:
      </p>
      <ul>
        <li>Quality concerns reported within 24 hours are handled under our Freshness Guarantee above.</li>
        <li>
          Refunds are issued to the original payment method and typically reflect within 5–7 business
          days, depending on your bank or payment provider.
        </li>
        <li>
          Orders cancelled before preparation begins are refunded in full; see the cancellation terms
          below.
        </li>
      </ul>

      <h2>7. Order Cancellations</h2>
      <p>
        You may cancel an order free of charge until it enters preparation. Once your order is being cut,
        packed, or has been dispatched, it can no longer be cancelled because of the perishable nature of
        the products. To cancel, contact us as early as possible through our{" "}
        <Link href="/contact">contact page</Link> or from your order details.
      </p>

      <h2>8. Your Account</h2>
      <ul>
        <li>You are responsible for keeping your account credentials confidential.</li>
        <li>
          Information you provide — including delivery addresses and contact details — must be accurate and
          kept up to date.
        </li>
        <li>
          You may request deletion of your account and personal data at any time from the{" "}
          <Link href="/account/data">Your Data & Privacy</Link> page.
        </li>
        <li>We may suspend accounts involved in fraud, abuse, or repeated violations of these Terms.</li>
      </ul>

      <h2>9. Offers & Discounts</h2>
      <ul>
        <li>Discount codes cannot be combined unless stated otherwise and have no cash value.</li>
        <li>Minimum order values and validity windows apply as communicated with each offer.</li>
        <li>
          We may withdraw or modify promotions at any time; already-placed orders are not affected.
        </li>
      </ul>

      <h2>10. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the website for any unlawful purpose or to violate applicable regulations</li>
        <li>Attempt to gain unauthorised access to our systems or other users' accounts</li>
        <li>Scrape, copy, or reproduce site content for commercial purposes without permission</li>
        <li>Interfere with the operation, security, or availability of the website</li>
      </ul>

      <h2>11. Intellectual Property</h2>
      <p>
        All content on this website — including the {store} name, logo, product photography, and text — is
        owned by or licensed to us and protected by applicable intellectual-property laws. You may not
        reuse it without our written consent.
      </p>

      <h2>12. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, {store} is not liable for indirect, incidental, or
        consequential damages arising from use of the website or purchase of products. Our total liability
        for any claim relating to an order is limited to the amount you paid for that order. Nothing in
        these Terms excludes liability that cannot be excluded by law, including for defective products
        under applicable consumer-protection regulations.
      </p>

      <h2>13. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. The version published on this page applies to orders
        placed after its "Last updated" date. Continued use of the website after changes are posted
        constitutes acceptance of the revised Terms.
      </p>

      <h2>14. Contact Us</h2>
      <p>
        Questions about these Terms? Reach us through our{" "}
        <Link href="/contact">contact page</Link> — we typically respond within one business day.
      </p>
    </LegalPage>
  );
}
