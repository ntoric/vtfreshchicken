"use client";

import Link from "next/link";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense, useRef, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { fetchBootstrap, fetchProducts, fetchStorePage } from "@/lib/api";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { FilterSidebar } from "@/components/FilterSidebar";
import { OfferBanner } from "@/components/OfferBanner";
import { LandingPage } from "@/components/LandingPage";
import { StorefrontSkeleton, ProductGridSkeleton, ProductListSkeleton, Spinner, LandingPageSplash } from "@/components/Loaders";
import { ProductListItem } from "@/components/ProductListItem";
import { ViewToggle, type ViewMode } from "@/components/ViewToggle";
import { BlockRenderer } from "@/components/BlockRenderer";
import { getCurrencySymbol } from "@/lib/format";
import type { Product } from "@/types";
import { useCurrencyLang } from "@/lib/currency-lang";

const PAGE_SIZE = 12;

function StorefrontContent({ tenant }: { tenant: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const category = searchParams.get("category") || undefined;
  const search = searchParams.get("search") || undefined;
  const view = searchParams.get("view") || undefined;

  const { currency, setCurrency, lang, setLang } = useCurrencyLang();
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
    queryKey: ["bootstrap", tenant],
    queryFn: () => fetchBootstrap(tenant),
  });

  const productsQ = useInfiniteQuery({
    queryKey: ["products", tenant, category, search, currency, lang, attrs, minPrice, maxPrice],
    queryFn: ({ pageParam = 0 }) =>
      fetchProducts(tenant, {
        category,
        search,
        currency,
        attrs,
        min_price: minPrice,
        max_price: maxPrice,
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

  // Compute landing/shop filter flags before conditional returns (Rules of Hooks)
  const landingEnabled = bootstrap?.settings?.landing_page_enabled;
  const hasShopFilters = !!category || !!search || view === "shop";

  // Fetch the builder "home" page — if it has blocks, render it instead of the legacy landing page
  const homePageQ = useQuery({
    queryKey: ["store-page", tenant, "home"],
    queryFn: () => fetchStorePage(tenant, "home"),
    enabled: !!landingEnabled && !hasShopFilters,
    retry: 1,
  });

  if (bootstrapQ.isLoading) {
    // Show the landing page splash when no shop filters are active (landing view),
    // otherwise show the shop skeleton (filter sidebar + product grid)
    const splashConfig = bootstrap?.settings?.landing_page_content?.splash;
    const storeName = bootstrap?.store_name || (tenant.charAt(0).toUpperCase() + tenant.slice(1));
    return hasShopFilters ? <StorefrontSkeleton /> : <LandingPageSplash storeName={storeName} config={splashConfig} />;
  }
  if (bootstrapQ.error || !bootstrap) {
    return (
      <div className="min-h-screen flex items-center justify-center text-rose-500">
        Failed to load store. Check the backend is running.
      </div>
    );
  }

  if (landingEnabled && !hasShopFilters) {
    // If the builder home page exists, has blocks, AND has been customized via
    // the page builder, render it. Otherwise fall back to the rich built-in
    // landing page so the storefront doesn't flash the sparse default builder
    // page over the curated landing design.
    if (homePageQ.data && homePageQ.data.is_customized && homePageQ.data.blocks.length > 0) {
      return (
        <div className="min-h-screen">
          <Header
            tenant={tenant}
            bootstrap={bootstrap}
            currency={currency}
            setCurrency={setCurrency}
            lang={lang}
            setLang={setLang}
          />
          {homePageQ.data.blocks.map((block) => (
            <BlockRenderer key={block.id} block={block} tenant={tenant} currency={currencyObj} />
          ))}
          <footer className="border-t mt-12">
            <div className="max-w-7xl mx-auto px-4 py-8 text-sm text-gray-400 flex flex-col md:flex-row justify-between gap-4">
              <p>© {new Date().getFullYear()} {bootstrap.store_name || tenant}. Powered by TruCommerce.</p>
              <div className="flex gap-4 flex-wrap">
                <Link href={`/${tenant}/privacy-policy`} className="hover:text-gray-600">Privacy Policy</Link>
                <Link href={`/${tenant}/terms`} className="hover:text-gray-600">Terms</Link>
                <Link href={`/${tenant}/about`} className="hover:text-gray-600">About</Link>
                <Link href={`/${tenant}/contact`} className="hover:text-gray-600">Contact</Link>
              </div>
            </div>
          </footer>
        </div>
      );
    }
    // Fallback to legacy landing page if builder page doesn't exist or has no blocks
    return (
      <LandingPage
        tenant={tenant}
        bootstrap={bootstrap}
        currency={currency}
        setCurrency={setCurrency}
        lang={lang}
        setLang={setLang}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        tenant={tenant}
        bootstrap={bootstrap}
        currency={currency}
        setCurrency={setCurrency}
        lang={lang}
        setLang={setLang}
      />

      {/* Hero */}
      <section className="bg-gradient-to-r from-brand-light to-white border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-8 sm:py-10">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">
            {activeCategory ? activeCategory.name : "Welcome to our store"}
          </h1>
          <p className="text-sm sm:text-base text-gray-500 mt-2">
            {activeCategory?.description || "Discover great products at amazing prices."}
          </p>
        </div>
      </section>

      {/* Offer banner */}
      <OfferBanner offers={bootstrap.offers || []} />

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
                  onClick={() => router.push(`/${tenant}`)}
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
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
                  {allProducts.map((p) => (
                    <ProductCard key={p.id} product={p} tenant={tenant} currency={currencyObj} />
                  ))}
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {allProducts.map((p) => (
                    <ProductListItem key={p.id} product={p} tenant={tenant} currency={currencyObj} />
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

      <footer className="border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 py-8 text-sm text-gray-400 flex flex-col md:flex-row justify-between gap-4">
          <p>© {new Date().getFullYear()} {tenant}. Powered by TruCommerce.</p>
          <div className="flex gap-4 flex-wrap">
            <Link href={`/${tenant}/privacy-policy`} className="hover:text-gray-600">Privacy Policy</Link>
            <Link href={`/${tenant}/cookie-policy`} className="hover:text-gray-600">Cookie Policy</Link>
            <Link href={`/${tenant}/terms`} className="hover:text-gray-600">Terms</Link>
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

export default function StorefrontPage({ params }: { params: { tenant: string } }) {
  return (
    <Suspense fallback={<StorefrontSkeleton />}>
      <StorefrontContent tenant={params.tenant} />
    </Suspense>
  );
}
