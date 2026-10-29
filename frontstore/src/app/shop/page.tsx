"use client";

import Link from "next/link";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense, useRef, useEffect, useMemo } from "react";
import { ArrowLeft, Sprout, Drumstick, Snowflake, Wheat, Truck, ShieldCheck } from "lucide-react";
import { fetchBootstrap, fetchProducts } from "@/lib/api";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { FilterSidebar } from "@/components/FilterSidebar";
import { OfferBanner } from "@/components/OfferBanner";
import { StorefrontSkeleton, ProductGridSkeleton, ProductListSkeleton, Spinner } from "@/components/Loaders";
import { ProductListItem } from "@/components/ProductListItem";
import { ViewToggle, type ViewMode } from "@/components/ViewToggle";
import { getCurrencySymbol } from "@/lib/format";
import type { Product } from "@/types";
import { useCurrencyLang } from "@/lib/currency-lang";
import { useLocation } from "@/lib/location";

const PAGE_SIZE = 12;

function StorefrontContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const category = searchParams.get("category") || undefined;
  const search = searchParams.get("search") || undefined;

  const { currency, setCurrency, lang, setLang } = useCurrencyLang();
  const { area, lat, lng, coveringBranches, branchesForArea, serviceable } = useLocation();
  // Every branch that can serve the selected location — products from all of
  // them are listed (shared products deduplicate server-side by row, branch
  // exclusives appear for each covering branch).
  const branchIds = useMemo(() => {
    if (!serviceable) return undefined;
    let ids: string[] = [];
    if (lat != null && lng != null) ids = coveringBranches(lat, lng).map((b) => b.id);
    if (!ids.length && area) ids = branchesForArea(area).map((b) => b.id);
    return ids.length ? ids.join(",") : undefined;
  }, [serviceable, lat, lng, area, coveringBranches, branchesForArea]);
  const [attrs, setAttrs] = useState<Record<string, string[]>>({});
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Persist view mode preference in localStorage
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("productViewMode") : null;
    if (saved === "grid" || saved === "list") setViewMode(saved);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("productViewMode", viewMode);
  }, [viewMode]);

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => fetchBootstrap(),
  });

  const productsQ = useInfiniteQuery({
    queryKey: ["products", category, search, currency, lang, attrs, minPrice, maxPrice, branchIds],
    queryFn: ({ pageParam = 0 }) =>
      fetchProducts({
        category,
        search,
        currency,
        attrs,
        min_price: minPrice,
        max_price: maxPrice,
        branch_id: branchIds,
        limit: PAGE_SIZE,
        offset: pageParam,
      }, lang),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.limit;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    enabled: !!bootstrapQ.data,
  });

  const bootstrap = bootstrapQ.data;
  const currencyObj = getCurrencySymbol(bootstrap?.currencies || [], currency);
  const activeCategory = bootstrap?.categories?.find((c) => c.slug === category);

  const filterableAttrs = bootstrap?.attributes || [];

  // Flatten all loaded pages into a single product list (defensive against null items)
  const allProducts: Product[] = productsQ.data?.pages.flatMap((p) => p.items ?? []) ?? [];
  const totalProducts = productsQ.data?.pages[0]?.total ?? 0;
  const hasMore = !!productsQ.hasNextPage;
  const isFetchingNextPage = productsQ.isFetchingNextPage;

  // Intersection observer sentinel for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && productsQ.hasNextPage && !productsQ.isFetchingNextPage) {
          productsQ.fetchNextPage();
        }
      },
      { rootMargin: "400px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isFetchingNextPage, productsQ]);

  if (bootstrapQ.isLoading) {
    return <StorefrontSkeleton />;
  }
  if (bootstrapQ.error || !bootstrap) {
    return (
      <div className="min-h-screen flex items-center justify-center text-rose-500">
        Failed to load store. Check the backend is running.
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
       
        bootstrap={bootstrap}
        currency={currency}
        setCurrency={setCurrency}
        lang={lang}
        setLang={setLang}
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-stone-200 bg-[#faf7f1]">
        {/* paper-grain noise texture */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.32'/%3E%3C/svg%3E\")",
          }}
        />
        {/* soft brand glow */}
        <div
          aria-hidden
          className="absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full opacity-[0.12] blur-3xl"
          style={{ background: "var(--brand-color)" }}
        />

        <div className="relative max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-10 sm:py-14 lg:py-16 grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold tracking-[0.22em] uppercase text-brand">
              <Sprout className="w-4 h-4" strokeWidth={1.8} />
              <span>Farm to door · cut fresh daily</span>
              <span className="hidden sm:block h-px w-10 bg-brand/50" />
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.4rem] leading-[1.05] tracking-tight text-stone-900 mt-5">
              {activeCategory ? (
                activeCategory.name
              ) : (
                <>
                  Fresh &amp; <em className="italic text-brand">Frozen</em> Chicken
                </>
              )}
            </h1>

            <p className="text-sm sm:text-base lg:text-lg text-stone-500 mt-4 max-w-lg leading-relaxed">
              {activeCategory?.description ||
                "Farm-fresh poultry, delivered chilled to your door."}
            </p>

            {/* Trust chips */}
            <div className="flex flex-wrap gap-2 sm:gap-2.5 mt-7">
              {[
                { icon: Drumstick, label: "Cut to order" },
                { icon: Snowflake, label: "Chilled, never frozen" },
                { icon: Wheat, label: "Antibiotic-free" },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-300/80 bg-white/70 backdrop-blur-sm px-3.5 py-1.5 text-xs sm:text-[13px] font-medium text-stone-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                >
                  <Icon className="w-3.5 h-3.5 text-brand" strokeWidth={1.9} />
                  {label}
                </span>
              ))}
            </div>

            {/* Offer ticket — combined into hero */}
            <div className="mt-7">
              <OfferBanner offers={bootstrap.offers || []} inline />
            </div>
          </div>

          {/* Arch image card */}
          <div className="relative hidden lg:block">
            <div className="ml-auto w-[82%] max-w-sm">
              <div className="relative overflow-hidden rounded-t-[11rem] rounded-b-[1.75rem] border-[6px] border-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)] rotate-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80"
                  alt="Farm-fresh roast chicken"
                  className="w-full h-[21rem] object-cover"
                />
              </div>

              {/* Floating badge */}
              <div className="absolute -left-6 bottom-8 bg-white rounded-2xl shadow-xl border border-stone-200/80 px-4 py-3 flex items-center gap-3 -rotate-2">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand-light">
                  <Truck className="w-5 h-5 text-brand" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="text-xs font-semibold text-stone-900">Same-day dispatch</p>
                  <p className="text-[11px] text-stone-500">Packed chilled &amp; sealed</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 lg:gap-8">
        <div className="hidden lg:block">
          <div className="bg-white rounded-2xl border p-5 sticky top-28">
            <FilterSidebar
              attributes={filterableAttrs}
              selected={attrs}
              onChange={setAttrs}
              minPrice={minPrice}
              maxPrice={maxPrice}
              onPriceChange={(min, max) => { setMinPrice(min); setMaxPrice(max); }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
            <p className="text-sm text-gray-500">
              {productsQ.isLoading
                ? "Loading…"
                : `${allProducts.length} of ${totalProducts} products`}
            </p>
            <div className="flex items-center gap-2 sm:gap-3">
              {/* View mode toggle */}
              <ViewToggle view={viewMode} onChange={setViewMode} />
              {/* Mobile filter button */}
              <button
                onClick={() => setMobileFiltersOpen(true)}
                className="lg:hidden inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M6 12h12m-9 5.25h6" />
                </svg>
                Filters
              </button>
              {category && (
                <button
                  onClick={() => router.push(`/shop`)}
                  className="text-sm text-brand font-medium hover:underline whitespace-nowrap inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" /> All products
                </button>
              )}
            </div>
          </div>

          {productsQ.isLoading ? (
            viewMode === "grid" ? (
              <ProductGridSkeleton count={8} />
            ) : (
              <ProductListSkeleton count={4} />
            )
          ) : allProducts.length > 0 ? (
            <>
              {viewMode === "grid" ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {allProducts.map((p) => (
                    <ProductCard key={p.id} product={p} currency={currencyObj} />
                  ))}
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {allProducts.map((p) => (
                    <ProductListItem key={p.id} product={p} currency={currencyObj} />
                  ))}
                </div>
              )}

              {/* Infinite scroll sentinel + loading indicator */}
              {hasMore && (
                <div
                  ref={sentinelRef}
                  className="flex flex-col items-center justify-center py-10 gap-3"
                >
                  {isFetchingNextPage ? (
                    <>
                      <Spinner size={32} />
                      <p className="text-sm text-gray-400">Loading more products…</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">Scroll for more</p>
                  )}
                </div>
              )}

              {/* Manual "Load more" button as a fallback for keyboard/no-scroll users */}
              {hasMore && !isFetchingNextPage && (
                <div className="flex justify-center pt-4 pb-2">
                  <button
                    onClick={() => productsQ.fetchNextPage()}
                    className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    Load more products
                  </button>
                </div>
              )}

              {/* End-of-list indicator */}
              {!hasMore && totalProducts > PAGE_SIZE && (
                <div className="text-center py-10">
                  <p className="text-sm text-gray-400">You&apos;ve reached the end — {totalProducts} products shown</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20 text-gray-400">
              <p className="text-lg">No products found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          )}
        </div>
      </div>

      <footer className="relative mt-16 overflow-hidden bg-stone-950 text-stone-400">
        {/* grain texture */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E\")",
          }}
        />
        {/* soft brand glow */}
        <div
          aria-hidden
          className="absolute -top-40 left-1/4 w-[34rem] h-[34rem] rounded-full opacity-[0.08] blur-3xl"
          style={{ background: "var(--brand-color)" }}
        />
        {/* brand hairline */}
        <div
          aria-hidden
          className="absolute top-0 inset-x-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, var(--brand-color), transparent)" }}
        />

        <div className="relative max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pt-12 sm:pt-16 pb-8">
          <div className="grid gap-10 sm:gap-12 lg:grid-cols-[1.4fr_0.8fr_0.8fr_1fr]">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
                  style={{ background: "var(--brand-color)" }}
                >
                  <Drumstick className="w-5 h-5 text-white" strokeWidth={1.8} />
                </span>
                <span className="font-display text-xl font-semibold text-white tracking-tight">
                  {bootstrap.store_name}
                </span>
              </div>
              <p className="mt-4 text-sm leading-relaxed max-w-xs">
                Farm-fresh and frozen poultry, cut to order and delivered chilled — from our partner farms straight to your kitchen.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  { icon: Truck, label: "Same-day dispatch" },
                  { icon: Snowflake, label: "Chilled delivery" },
                  { icon: ShieldCheck, label: "Secure checkout" },
                ].map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-stone-800 bg-stone-900/60 px-3 py-1.5 text-[11px] font-medium text-stone-400"
                  >
                    <Icon className="w-3.5 h-3.5 text-brand" strokeWidth={1.8} />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Shop */}
            <div>
              <h4 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-stone-500">
                Shop
              </h4>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <Link href={`/shop`} className="hover:text-white transition-colors">
                    All products
                  </Link>
                </li>
                {(bootstrap.categories || []).map((cat) => (
                  <li key={cat.id}>
                    <Link
                      href={`/shop?category=${cat.slug}`}
                      className="hover:text-white transition-colors"
                    >
                      {cat.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Account */}
            <div>
              <h4 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-stone-500">
                Account
              </h4>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li><Link href={`/account/dashboard`} className="hover:text-white transition-colors">My account</Link></li>
                <li><Link href={`/orders`} className="hover:text-white transition-colors">Order history</Link></li>
                <li><Link href={`/wishlist`} className="hover:text-white transition-colors">Wishlist</Link></li>
                <li><Link href={`/about`} className="hover:text-white transition-colors">About us</Link></li>
                <li><Link href={`/contact`} className="hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>

            {/* Promise */}
            <div>
              <h4 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-stone-500">
                Our promise
              </h4>
              <p className="mt-4 text-sm leading-relaxed">
                No antibiotics. No added water. Every cut is prepared the morning your order ships and packed in insulated, food-safe chill packs.
              </p>
              <Link
                href={`/about`}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-white hover:underline underline-offset-4 decoration-brand"
              >
                Read our story
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 pt-6 border-t border-stone-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-xs text-stone-500">
              © {new Date().getFullYear()} {bootstrap.store_name}. Powered by TruCommerce.
            </p>
            <div className="flex gap-5 text-xs">
              <Link href={`/privacy-policy`} className="text-stone-500 hover:text-white transition-colors">Privacy Policy</Link>
              <Link href={`/cookie-policy`} className="text-stone-500 hover:text-white transition-colors">Cookie Policy</Link>
              <Link href={`/terms`} className="text-stone-500 hover:text-white transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile filter drawer */}
      {mobileFiltersOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-50 lg:hidden"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div className="fixed right-0 top-0 bottom-0 w-[85vw] max-w-sm bg-white z-50 shadow-2xl flex flex-col animate-slide-in lg:hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Filters</h2>
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
                aria-label="Close filters"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <FilterSidebar
                attributes={filterableAttrs}
                selected={attrs}
                onChange={setAttrs}
                minPrice={minPrice}
                maxPrice={maxPrice}
                onPriceChange={(min, max) => { setMinPrice(min); setMaxPrice(max); }}
              />
            </div>
            <div className="border-t p-4 pb-safe">
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="w-full bg-brand text-white font-semibold py-2.5 rounded-lg hover:bg-brand-dark transition"
              >
                Show {totalProducts} products
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function StorefrontPage() {
  return (
    <Suspense fallback={<StorefrontSkeleton />}>
      <StorefrontContent />
    </Suspense>
  );
}
