"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { ArrowRight, ArrowUpRight, ShieldCheck, Sprout, ThermometerSnowflake, Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { OfferBanner } from "@/components/OfferBanner";
import { ProductCard } from "@/components/ProductCard";
import { ProductGridSkeleton } from "@/components/Loaders";
import { useBootstrap } from "@/lib/bootstrap";
import { useCurrencyLang } from "@/lib/currency-lang";
import { fetchProducts } from "@/lib/api";
import { getCurrencySymbol } from "@/lib/format";
import styles from "./LandingMinimal.module.css";
import { LazyMount } from "./landing/LazyMount";
import { HeroBannerMalayalam } from "./landing/HeroBannerMalayalam";
import { LandingFooter } from "./landing/LandingFooter";
import { LandingMoreSkeleton } from "./landing/LandingSkeleton";
import { mlBody } from "./landing/malayalam-fonts";
import { footer, promises as promiseCopy, range as rangeCopy, ui } from "./landing-content-ml";

// Lower sections live in their own chunk: not in the initial JS or HTML.
const LandingMalayalamMore = dynamic(() => import("./LandingMalayalamMore").then((m) => m.LandingMalayalamMore), {
  ssr: false,
  loading: () => <LandingMoreSkeleton />,
});

/**
 * Malayalam homepage — the minimal layout with every landing string in
 * Malayalam (copy lives in landing-content-ml.ts). Selected via Backoffice →
 * Developer → Landing Page (tenant_settings.landing_variant = "malayalam").
 * The shared Header and product data keep their own language settings.
 */

const SHOP = "/shop";
const PICKS_COUNT = 8;

const PROMISE_ICONS = [Sprout, ThermometerSnowflake, ShieldCheck, Truck];
const promises = promiseCopy.map((p, i) => ({ ...p, icon: PROMISE_ICONS[i] }));

const RANGE_LINKS = [
  { href: "/shop?search=fresh", img: "/brand/range-fresh.jpg" },
  { href: "/shop?search=frozen", img: "/brand/range-frozen.jpg" },
  { href: "/shop?search=chicken", img: "/brand/range-everyday.jpg" },
];
const range = rangeCopy.map((r, i) => ({ ...r, ...RANGE_LINKS[i] }));

export function LandingMalayalam() {
  const bootstrap = useBootstrap();
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();
  const storeName = bootstrap?.store_name || "VT Fresh Chicken";
  const offers = bootstrap?.offers || [];
  const currencyObj = getCurrencySymbol(bootstrap?.currencies || [], currency);
  const topCategories = (bootstrap?.categories || []).filter((c) => !c.parent_id && c.is_active).slice(0, 6);

  const picksQ = useQuery({
    queryKey: ["landing-picks", currency, lang],
    queryFn: () => fetchProducts({ limit: PICKS_COUNT, currency }, lang),
    enabled: !!bootstrap,
    staleTime: 60_000,
  });
  const picks = picksQ.data?.items ?? [];
  const showPicks = !!bootstrap && (picksQ.isLoading || picks.length > 0);

  return (
    <div lang="ml" className={`${styles.page} ${mlBody.className}`}>
      <a href="#main-content" className={styles.skipLink}>
        {ui.skipToContent}
      </a>
      {bootstrap && (
        <Header bootstrap={bootstrap} currency={currency} setCurrency={setCurrency} lang={lang} setLang={setLang} />
      )}

      <main id="main-content" tabIndex={-1}>
        <HeroBannerMalayalam storeName={storeName} />
        {offers.length > 0 && (
          <div className="max-w-6xl mx-auto px-4 lg:px-8 pt-6">
            <OfferBanner offers={offers} inline />
          </div>
        )}

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
                  <p className="text-xs sm:text-sm text-neutral-500 mt-0.5 leading-relaxed">{copy}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Range — editorial bento: one featured tile + two stacked */}
        <section aria-labelledby="range-heading" className="max-w-6xl mx-auto px-4 lg:px-8 py-16 sm:py-24">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
            <div className="max-w-xl">
              <p className="flex items-center gap-3 text-sm font-semibold text-brand">
                <span className="h-px w-8 bg-brand/60" aria-hidden />
                {ui.rangeEyebrow}
              </p>
              <h2 id="range-heading" className="mt-2 text-2xl sm:text-3xl font-bold leading-snug text-neutral-900">
                {ui.rangeTitle}
              </h2>
              <p className="mt-3 text-sm sm:text-base text-neutral-500 leading-relaxed">{ui.rangeIntro}</p>
            </div>
            <Link
              href={SHOP}
              className="group inline-flex items-center gap-2 self-start sm:self-auto text-sm font-medium text-neutral-900"
            >
              <span className="border-b border-neutral-300 pb-0.5 transition-colors group-hover:border-brand group-hover:text-brand">
                {ui.viewAll}
              </span>
              <span className="grid place-items-center w-8 h-8 rounded-full border border-neutral-200 transition-all group-hover:border-brand group-hover:bg-brand group-hover:text-white">
                <ArrowRight className="w-3.5 h-3.5" aria-hidden />
              </span>
            </Link>
          </div>

          <div className="mt-10 sm:mt-12 grid grid-cols-2 lg:grid-cols-12 lg:grid-rows-2 gap-3 sm:gap-5 lg:h-[560px]">
            {range.map((r, i) => {
              const featured = i === 0;
              return (
                <Link
                  key={r.href}
                  href={r.href}
                  className={`group relative isolate overflow-hidden rounded-2xl sm:rounded-[1.75rem] bg-neutral-900 ${
                    featured
                      ? "col-span-2 aspect-[4/3] sm:aspect-[16/9] lg:aspect-auto lg:col-span-7 lg:row-span-2"
                      : "aspect-[4/5] sm:aspect-[4/3] lg:aspect-auto lg:col-span-5"
                  }`}
                >
                  <Image
                    src={r.img}
                    alt={r.alt}
                    fill
                    sizes={featured ? "(min-width: 1152px) 640px, 100vw" : "(min-width: 1152px) 460px, 50vw"}
                    className="-z-10 object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
                  />
                  <div
                    className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/25 to-transparent"
                    aria-hidden
                  />
                  <div className="absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10" aria-hidden />

                  <span className="absolute top-3 left-3 sm:top-5 sm:left-5 rounded-full bg-white/15 backdrop-blur-md px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold tracking-[0.18em] text-white tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 lg:p-8 flex items-end justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] sm:text-xs font-semibold text-white/75">{r.tag}</p>
                      <h3
                        className={`mt-1.5 font-bold leading-snug text-white ${
                          featured ? "text-xl sm:text-3xl" : "text-base sm:text-xl"
                        }`}
                      >
                        {r.title}
                      </h3>
                      <p
                        className={`mt-1.5 text-sm text-white/80 leading-relaxed ${featured ? "block max-w-sm" : "hidden sm:block"}`}
                      >
                        {r.copy}
                      </p>
                    </div>
                    <span
                      className="hidden sm:grid place-items-center shrink-0 w-11 h-11 rounded-full bg-white text-neutral-900 shadow-lg transition-all duration-300 group-hover:bg-brand group-hover:text-white group-hover:-rotate-45"
                      aria-hidden
                    >
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {topCategories.length > 0 && (
            <nav
              aria-label={ui.browseByCategory}
              className="mt-10 sm:mt-12 pt-8 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6"
            >
              <p className="shrink-0 text-sm font-semibold text-neutral-400">{ui.browseByCategory}</p>
              <ul className="flex flex-wrap gap-2">
                {topCategories.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/shop?category=${c.slug}`}
                      className="group inline-flex items-center gap-1.5 rounded-full bg-neutral-50 border border-neutral-200/70 px-4 py-2 text-sm text-neutral-700 transition-colors hover:bg-white hover:border-neutral-900 hover:text-neutral-900"
                    >
                      {c.name}
                      <ArrowUpRight
                        className="w-3.5 h-3.5 text-neutral-400 transition-all group-hover:text-brand group-hover:translate-x-px group-hover:-translate-y-px"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </section>

        {/* Popular products */}
        {showPicks && (
          <section className="max-w-6xl mx-auto px-4 lg:px-8 pb-16 sm:pb-24">
            <SectionHeading title={ui.popularTitle} href={SHOP} linkLabel={ui.shopAll} />
            <div className="mt-8">
              {picksQ.isLoading ? (
                <ProductGridSkeleton count={PICKS_COUNT} />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
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
          <LandingMalayalamMore />
        </LazyMount>
      </main>

      <LandingFooter bootstrap={bootstrap} storeName={storeName} shopHref={SHOP} signature={false} copy={footer} />
    </div>
  );
}

function SectionHeading({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 className="text-2xl sm:text-3xl font-bold leading-snug text-neutral-900">{title}</h2>
      <Link
        href={href}
        className="inline-flex items-center gap-1 shrink-0 text-sm font-medium text-neutral-600 hover:text-brand transition-colors"
      >
        {linkLabel} <ArrowRight className="w-3.5 h-3.5" aria-hidden />
      </Link>
    </div>
  );
}
