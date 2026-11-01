"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { ArrowRight, Drumstick, ShieldCheck, Sprout, ThermometerSnowflake, Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { BrandLogo } from "@/components/BrandLogo";
import { OfferBanner } from "@/components/OfferBanner";
import { ProductCard } from "@/components/ProductCard";
import { ProductGridSkeleton } from "@/components/Loaders";
import { useBootstrap } from "@/lib/bootstrap";
import { useCurrencyLang } from "@/lib/currency-lang";
import { fetchProducts } from "@/lib/api";
import { getCurrencySymbol } from "@/lib/format";
import styles from "./LandingMinimal.module.css";
import { LazyMount } from "./landing/LazyMount";
import { LandingMoreSkeleton } from "./landing/LandingSkeleton";

// Lower sections live in their own chunk: not in the initial JS or HTML.
const LandingMinimalMore = dynamic(() => import("./LandingMinimalMore").then((m) => m.LandingMinimalMore), {
  ssr: false,
  loading: () => <LandingMoreSkeleton />,
});

/**
 * Minimal homepage — a clean, simple alternative to the editorial
 * LandingHome. Selected via Backoffice → Developer → Landing Page
 * (tenant_settings.landing_variant = "minimal").
 */

const SHOP = "/shop";
const HERO_IMG = "/brand/chicken-table.jpg";
const PICKS_COUNT = 8;

const promises = [
  { icon: Sprout, title: "Fresh every day", copy: "Cut the morning your order ships." },
  { icon: ThermometerSnowflake, title: "Kept cold", copy: "Chilled from our store to your door." },
  { icon: ShieldCheck, title: "Hygiene first", copy: "Washed, machine-cut, sealed." },
  { icon: Truck, title: "Fast delivery", copy: "Straight to your kitchen." },
];

const range = [
  { title: "Fresh chicken", copy: "Chilled cuts for tonight", href: "/shop?search=fresh", img: "/brand/range-fresh.jpg", alt: "Whole fresh chicken with lemon and herbs" },
  { title: "Frozen", copy: "Freezer staples, ready when you are", href: "/shop?search=frozen", img: "/brand/range-frozen.jpg", alt: "Crispy breaded chicken pieces" },
  { title: "Everyday cuts", copy: "Breasts, wings, drumsticks & more", href: "/shop?search=chicken", img: "/brand/range-everyday.jpg", alt: "Fresh raw chicken portions on a board" },
];

export function LandingMinimal() {
  const bootstrap = useBootstrap();
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();
  const storeName = bootstrap?.store_name || "VT Fresh Chicken";
  const offers = bootstrap?.offers || [];
  const currencyObj = getCurrencySymbol(bootstrap?.currencies || [], currency);
  const topCategories = (bootstrap?.categories || []).filter((c) => !c.parent_id && c.is_active).slice(0, 6);
  const year = new Date().getFullYear();

  const picksQ = useQuery({
    queryKey: ["landing-picks", currency, lang],
    queryFn: () => fetchProducts({ limit: PICKS_COUNT, currency }, lang),
    enabled: !!bootstrap,
    staleTime: 60_000,
  });
  const picks = picksQ.data?.items ?? [];
  const showPicks = !!bootstrap && (picksQ.isLoading || picks.length > 0);

  return (
    <div className={styles.page}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>
      {bootstrap && (
        <Header bootstrap={bootstrap} currency={currency} setCurrency={setCurrency} lang={lang} setLang={setLang} />
      )}

      <main id="main-content" tabIndex={-1}>
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-4 lg:px-8 pt-10 sm:pt-14 lg:pt-20 pb-12 sm:pb-16">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] uppercase text-brand">{storeName}</p>
              <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight text-neutral-900 leading-[1.08]">
                Fresh chicken,
                <br />
                delivered simply.
              </h1>
              <p className="mt-5 text-base sm:text-lg text-neutral-500 max-w-md leading-relaxed">
                Clean cuts, kept cold all the way to your door. Order in a few taps.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={SHOP}
                  className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-dark transition-colors"
                >
                  Shop now <ArrowRight className="w-4 h-4" aria-hidden />
                </Link>
                <Link
                  href="/about"
                  className="inline-flex items-center rounded-full border border-neutral-200 px-6 py-3 text-sm font-semibold text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
                >
                  About us
                </Link>
              </div>
              {offers.length > 0 && (
                <div className="mt-8">
                  <OfferBanner offers={offers} inline />
                </div>
              )}
            </div>

            <div className="relative aspect-[4/3] lg:aspect-[5/4] rounded-3xl overflow-hidden bg-neutral-100">
              <span className="absolute inset-0 grid place-items-center text-neutral-300" aria-hidden>
                <Drumstick className="w-14 h-14" />
              </span>
              <Image
                src={HERO_IMG}
                alt="Grilled chicken served with vegetables and lemon"
                fill
                priority
                sizes="(min-width: 1024px) 560px, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </section>

        {/* Promises */}
        <section className="border-y border-neutral-100 bg-neutral-50/60">
          <ul className="max-w-6xl mx-auto px-4 lg:px-8 py-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
            {promises.map(({ icon: Icon, title, copy }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="mt-0.5 grid place-items-center w-9 h-9 shrink-0 rounded-full bg-white border border-neutral-200 text-brand">
                  <Icon className="w-4 h-4" strokeWidth={1.8} aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{title}</p>
                  <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">{copy}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Range */}
        <section className="max-w-6xl mx-auto px-4 lg:px-8 py-14 sm:py-20">
          <SectionHeading title="Shop the range" href={SHOP} linkLabel="View all" />
          <div className="mt-6 sm:mt-8 grid grid-cols-3 gap-2.5 sm:gap-5">
            {range.map((r) => (
              <Link key={r.title} href={r.href} className="group block">
                <div className="relative aspect-square sm:aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden bg-neutral-100">
                  <Image
                    src={r.img}
                    alt={r.alt}
                    fill
                    sizes="(min-width: 1152px) 360px, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="mt-2 sm:mt-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm sm:text-base font-semibold text-neutral-900">{r.title}</p>
                    <p className="hidden sm:block text-sm text-neutral-500">{r.copy}</p>
                  </div>
                  <ArrowRight
                    className="hidden sm:block w-4 h-4 shrink-0 text-neutral-400 transition-all group-hover:text-brand group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </div>
              </Link>
            ))}
          </div>

          {topCategories.length > 0 && (
            <div className="mt-10 flex flex-wrap gap-2">
              {topCategories.map((c) => (
                <Link
                  key={c.id}
                  href={`/shop?category=${c.slug}`}
                  className="rounded-full border border-neutral-200 px-4 py-1.5 text-sm text-neutral-700 hover:border-brand hover:text-brand transition-colors"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Popular products */}
        {showPicks && (
          <section className="max-w-6xl mx-auto px-4 lg:px-8 pb-16 sm:pb-24">
            <SectionHeading title="Popular right now" href={SHOP} linkLabel="Shop all" />
            <div className="mt-8">
              {picksQ.isLoading ? (
                <ProductGridSkeleton count={PICKS_COUNT} />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
                  {picks.map((p) => (
                    <ProductCard key={p.id} product={p} currency={currencyObj} />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Below the fold — fetched and mounted only when scrolled near */}
        <LazyMount placeholder={<LandingMoreSkeleton />}>
          <LandingMinimalMore />
        </LazyMount>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-100">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <BrandLogo storeName={storeName} compact />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-500">
            <Link href={SHOP} className="hover:text-neutral-900 transition-colors">Shop</Link>
            <Link href="/about" className="hover:text-neutral-900 transition-colors">About</Link>
            <Link href="/contact" className="hover:text-neutral-900 transition-colors">Contact</Link>
            <Link href="/orders" className="hover:text-neutral-900 transition-colors">Orders</Link>
            <Link href="/privacy-policy" className="hover:text-neutral-900 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-neutral-900 transition-colors">Terms</Link>
            <Link href="/cookie-policy" className="hover:text-neutral-900 transition-colors">Cookies</Link>
          </nav>
        </div>
        <div className="max-w-6xl mx-auto px-4 lg:px-8 pb-8">
          <p className="text-xs text-neutral-400">
            © {year} {storeName}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}


function SectionHeading({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900">{title}</h2>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-brand transition-colors"
      >
        {linkLabel} <ArrowRight className="w-3.5 h-3.5" aria-hidden />
      </Link>
    </div>
  );
}
