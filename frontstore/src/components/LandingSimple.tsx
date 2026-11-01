"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
import { LandingFooter } from "./landing/LandingFooter";

/**
 * Simple homepage — the lightest landing design: a short intro, a grid of
 * products and a link into the shop. No story, image or testimonial
 * sections. Selected via Backoffice → Developer → Landing Page
 * (tenant_settings.landing_variant = "simple").
 */

const SHOP = "/shop";
const PICKS_COUNT = 8;

export function LandingSimple() {
  const bootstrap = useBootstrap();
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();
  const storeName = bootstrap?.store_name || "VT Fresh Chicken";
  const offers = bootstrap?.offers || [];
  const currencyObj = getCurrencySymbol(bootstrap?.currencies || [], currency);

  const picksQ = useQuery({
    queryKey: ["landing-picks", currency, lang],
    queryFn: () => fetchProducts({ limit: PICKS_COUNT, currency }, lang),
    enabled: !!bootstrap,
    staleTime: 60_000,
  });
  const picks = picksQ.data?.items ?? [];

  return (
    <div className={styles.page}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>
      {bootstrap && (
        <Header bootstrap={bootstrap} currency={currency} setCurrency={setCurrency} lang={lang} setLang={setLang} />
      )}

      <main id="main-content" tabIndex={-1}>
        {/* Intro */}
        <section className="border-b border-neutral-100">
          <div className="max-w-6xl mx-auto px-4 lg:px-8 pt-14 pb-8 sm:py-20">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-brand">{storeName}</p>
            <h1 className="mt-3 text-3xl sm:text-5xl font-semibold tracking-tight text-neutral-900 max-w-2xl">
              Fresh chicken, delivered to your door.
            </h1>
            <p className="mt-4 text-neutral-500 leading-relaxed max-w-xl">
              Hand-cut, hygienically packed and kept cold — order online and we bring it to you.
            </p>
            <Link
              href={SHOP}
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              Shop now <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </div>
        </section>

        {offers.length > 0 && (
          <div className="max-w-6xl mx-auto px-4 lg:px-8 pt-6">
            <OfferBanner offers={offers} inline />
          </div>
        )}

        {/* Products */}
        <section aria-labelledby="picks-heading" className="max-w-6xl mx-auto px-4 lg:px-8 pt-8 pb-12 sm:py-16">
          <div className="flex items-end justify-between gap-4">
            <h2 id="picks-heading" className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900">
              Our products
            </h2>
            <Link
              href={SHOP}
              className="inline-flex items-center gap-1 text-sm font-medium text-neutral-600 transition-colors hover:text-brand"
            >
              Shop all <ArrowRight className="w-3.5 h-3.5" aria-hidden />
            </Link>
          </div>

          <div className="mt-8">
            {picksQ.isLoading ? (
              <ProductGridSkeleton count={PICKS_COUNT} />
            ) : picksQ.isError ? (
              <p className="text-sm text-neutral-400">
                Couldn&apos;t load products right now.{" "}
                <button
                  type="button"
                  onClick={() => picksQ.refetch()}
                  className="font-medium text-neutral-600 underline underline-offset-4 transition-colors hover:text-brand"
                >
                  Retry
                </button>
              </p>
            ) : picks.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
                  {picks.map((p) => (
                    <ProductCard key={p.id} product={p} currency={currencyObj} />
                  ))}
                </div>
                <div className="mt-8 flex justify-center">
                  <Link
                    href={SHOP}
                    className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
                  >
                    Shop More <ArrowRight className="w-4 h-4" aria-hidden />
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-sm text-neutral-400">
                No products yet — check back soon, or{" "}
                <Link href={SHOP} className="font-medium text-neutral-600 underline underline-offset-4 hover:text-brand">
                  visit the shop
                </Link>
                .
              </p>
            )}
          </div>
        </section>
      </main>

      <LandingFooter bootstrap={bootstrap} storeName={storeName} shopHref={SHOP} signature={false} />
    </div>
  );
}
