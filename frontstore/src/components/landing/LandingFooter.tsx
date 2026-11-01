"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Droplets,
  Leaf,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  ThermometerSnowflake,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import type { BootstrapResponse } from "@/types";

const NOISE_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.32'/%3E%3C/svg%3E\")";

const STANDARD_ICONS = [Droplets, Leaf, ThermometerSnowflake, ShieldCheck];
const HELP_HREFS = ["/orders", "/account/dashboard", "/wishlist", "/contact"];
const COMPANY_HREFS = ["/about", "/privacy-policy", "/cookie-policy", "/terms"];

/**
 * Every user-facing string in the footer. Defaults to English; localized
 * landing pages (e.g. LandingMalayalam) pass their own. `standards`, `help`
 * and `company` are positional — they map onto the icon/href lists above.
 */
export interface LandingFooterCopy {
  signatureEyebrow: string;
  signatureLine1: string;
  signatureLine2: string;
  signatureBody: string;
  shopCta: string;
  contactCta: string;
  standards: { title: string; copy: string }[];
  about: string;
  shopTitle: string;
  allProducts: string;
  helpTitle: string;
  help: string[];
  companyTitle: string;
  company: string[];
  rights: string;
  tagline: string;
  backToTop: string;
}

export const LANDING_FOOTER_COPY_EN: LandingFooterCopy = {
  signatureEyebrow: "From our kitchen to yours",
  signatureLine1: "Honest chicken,",
  signatureLine2: "cut this morning.",
  signatureBody:
    "Purely washed, machine-cut and packed in insulated, food-safe chill packs — delivered to your door the day it's prepared.",
  shopCta: "Shop fresh cuts",
  contactCta: "Get in touch",
  standards: [
    { title: "Purely washed", copy: "Cleaned in filtered water" },
    { title: "No added hormones", copy: "Honest, clearly labelled" },
    { title: "Cold-chain kept", copy: "Chilled store to door" },
    { title: "Hygiene first", copy: "Machine-cut & sealed" },
  ],
  about:
    "Premium fresh and frozen chicken, prepared with care and delivered chilled across our service area.",
  shopTitle: "Shop",
  allProducts: "All products",
  helpTitle: "Help",
  help: ["Track an order", "My account", "Wishlist", "Contact us"],
  companyTitle: "Company",
  company: ["About us", "Privacy policy", "Cookie policy", "Terms of service"],
  rights: "All rights reserved.",
  tagline: "Prepared fresh · Delivered chilled",
  backToTop: "Back to top",
};

/** Readable label for a social URL, e.g. https://instagram.com/x → "Instagram". */
function socialLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const name = host.split(".")[0];
    if (name === "x" || name === "twitter") return "X";
    if (name === "wa" || name === "whatsapp") return "WhatsApp";
    if (name === "youtu") return "YouTube";
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return url;
  }
}

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.24em] uppercase text-stone-500">
      <span aria-hidden className="h-px w-4 bg-brand" />
      {children}
    </h4>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 text-stone-400 transition-colors hover:text-white"
    >
      <span className="relative">
        {children}
        <span
          aria-hidden
          className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-brand transition-transform duration-300 group-hover:scale-x-100"
        />
      </span>
    </Link>
  );
}

export function LandingFooter({
  bootstrap,
  storeName,
  shopHref = "/shop",
  signature = true,
  copy = LANDING_FOOTER_COPY_EN,
}: {
  bootstrap: BootstrapResponse | null | undefined;
  storeName: string;
  shopHref?: string;
  /** Show the headline + CTA band. Turn off when the page already ends with a CTA. */
  signature?: boolean;
  /** Footer strings; English by default. */
  copy?: LandingFooterCopy;
}) {
  const standards = copy.standards.map((s, i) => ({ ...s, icon: STANDARD_ICONS[i] ?? ShieldCheck }));
  const help = copy.help.map((label, i) => ({ label, href: HELP_HREFS[i] }));
  const company = copy.company.map((label, i) => ({ label, href: COMPANY_HREFS[i] }));
  const year = new Date().getFullYear();
  const categories = (bootstrap?.categories || [])
    .filter((c) => !c.parent_id && c.is_active)
    .slice(0, 5);
  const socials = (bootstrap?.settings?.social_links || [])
    .filter(Boolean)
    .slice(0, 5);
  const branches = (bootstrap?.branches || []).filter((b) => b.is_active);
  const branch = branches.find((b) => b.is_default) || branches[0];
  const address = branch
    ? [branch.line1, branch.city, branch.state].filter(Boolean).join(", ")
    : "";
  const hasContact = !!(branch?.phone || branch?.email || address);

  return (
    <footer className="relative overflow-hidden bg-[#0f0d0b] text-stone-400">
      {/* Atmosphere: grain, brand glows, hairline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{ backgroundImage: NOISE_BG }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-56 -left-24 h-[40rem] w-[40rem] rounded-full opacity-[0.13] blur-3xl"
        style={{ background: "var(--brand-color)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-72 right-0 h-[36rem] w-[36rem] rounded-full opacity-[0.07] blur-3xl"
        style={{ background: "#d6a65c" }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--brand-color), transparent)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 lg:px-8">
        {/* ── Signature band ── */}
        {signature && (
          <div className="grid items-end gap-8 border-b border-white/[0.07] py-14 sm:py-20 lg:grid-cols-[1.35fr_1fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brand">
                {copy.signatureEyebrow}
              </p>
              <h2 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
                {copy.signatureLine1}
                <br />
                <span className="italic text-stone-300">{copy.signatureLine2}</span>
              </h2>
            </div>
            <div className="lg:justify-self-end lg:text-right">
              <p className="max-w-sm text-sm leading-relaxed text-stone-400 lg:ml-auto">
                {copy.signatureBody}
              </p>
              <div className="mt-6 flex flex-wrap gap-3 lg:justify-end">
                <Link
                  href={shopHref}
                  className="group inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-12px_var(--brand-color)] transition-all hover:-translate-y-0.5 hover:bg-brand-dark"
                >
                  {copy.shopCta}
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/5"
                >
                  {copy.contactCta}
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── Standards strip ── */}
        <ul className="grid grid-cols-2 border-b border-white/[0.07] lg:grid-cols-4">
          {standards.map(({ icon: Icon, title, copy }, i) => (
            <li
              key={title}
              className={[
                "flex items-center gap-3.5 border-white/[0.07] py-6 pr-4 sm:py-7",
                // 2-col grid on mobile: divider left of the right column, below the top row
                i % 2 === 1 ? "border-l pl-4 sm:pl-6" : "",
                i < 2 ? "border-b lg:border-b-0" : "",
                // 4-col row on desktop: divider between every item
                i > 0 ? "lg:border-l lg:pl-6" : "",
              ].join(" ")}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-brand">
                <Icon
                  className="h-[18px] w-[18px]"
                  strokeWidth={1.6}
                  aria-hidden
                />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-100">{title}</p>
                <p className="mt-0.5 hidden text-xs text-stone-500 sm:block">
                  {copy}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/* ── Link columns ── */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 py-14 sm:gap-x-12 sm:gap-y-12 lg:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr]">
          <div className="col-span-2 lg:col-span-1">
            <BrandLogo inverse storeName={storeName} />
            <p className="mt-5 max-w-xs text-sm leading-relaxed">
              {copy.about}
            </p>

            {hasContact && (
              <ul className="mt-6 space-y-2.5 text-sm">
                {branch?.phone && (
                  <li>
                    <a
                      href={`tel:${branch.phone.replace(/\s+/g, "")}`}
                      className="inline-flex items-center gap-2.5 transition-colors hover:text-white"
                    >
                      <Phone
                        className="h-4 w-4 text-stone-500"
                        strokeWidth={1.7}
                        aria-hidden
                      />
                      {branch.phone}
                    </a>
                  </li>
                )}
                {branch?.email && (
                  <li>
                    <a
                      href={`mailto:${branch.email}`}
                      className="inline-flex items-center gap-2.5 transition-colors hover:text-white"
                    >
                      <Mail
                        className="h-4 w-4 text-stone-500"
                        strokeWidth={1.7}
                        aria-hidden
                      />
                      {branch.email}
                    </a>
                  </li>
                )}
                {address && (
                  <li className="inline-flex items-start gap-2.5">
                    <MapPin
                      className="mt-0.5 h-4 w-4 shrink-0 text-stone-500"
                      strokeWidth={1.7}
                      aria-hidden
                    />
                    <span>{address}</span>
                  </li>
                )}
              </ul>
            )}

            {socials.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {socials.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-stone-300 transition-colors hover:border-brand hover:text-white"
                  >
                    {socialLabel(url)}
                    <ArrowUpRight
                      className="h-3 w-3 text-stone-500 transition-colors group-hover:text-brand"
                      aria-hidden
                    />
                  </a>
                ))}
              </div>
            )}
          </div>

          <nav aria-label={copy.shopTitle}>
            <ColumnTitle>{copy.shopTitle}</ColumnTitle>
            <ul className="mt-5 space-y-3 text-sm">
              <li>
                <FooterLink href={shopHref}>{copy.allProducts}</FooterLink>
              </li>
              {categories.map((cat) => (
                <li key={cat.id}>
                  <FooterLink href={`/shop?category=${cat.slug}`}>
                    {cat.name}
                  </FooterLink>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={copy.helpTitle}>
            <ColumnTitle>{copy.helpTitle}</ColumnTitle>
            <ul className="mt-5 space-y-3 text-sm">
              {help.map((l) => (
                <li key={l.label}>
                  <FooterLink href={l.href}>{l.label}</FooterLink>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={copy.companyTitle}>
            <ColumnTitle>{copy.companyTitle}</ColumnTitle>
            <ul className="mt-5 space-y-3 text-sm">
              {company.map((l) => (
                <li key={l.label}>
                  <FooterLink href={l.href}>{l.label}</FooterLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      {/* ── Oversized wordmark ── */}
      <div aria-hidden className="relative select-none overflow-hidden">
        <p
          className="mx-auto max-w-7xl translate-y-[18%] whitespace-nowrap px-4 text-center font-display font-semibold leading-none tracking-tighter lg:px-8"
          style={{
            // Scale so the whole store name spans the container (~0.55em per glyph).
            fontSize: `min(13rem, calc((min(100vw, 80rem) - 4rem) / ${(Math.max(storeName.length, 6) * 0.55).toFixed(2)}))`,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0) 85%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {storeName}
        </p>
      </div>

      {/* ── Bottom bar ── */}
      <div className="relative border-t border-white/[0.07] bg-black/20">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-5 sm:flex-row sm:items-center lg:px-8">
          <p className="text-xs text-stone-500">
            © {year} {storeName}. {copy.rights}
          </p>
          <div className="flex items-center gap-5 text-xs">
            <span className="hidden text-stone-600 sm:inline">
              {copy.tagline}
            </span>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="group inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-stone-400 transition-colors hover:border-white/30 hover:text-white"
            >
              {copy.backToTop}
              <ArrowUp
                className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5"
                aria-hidden
              />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
