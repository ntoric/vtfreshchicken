"use client";

// ============ Spinner ============
export function Spinner({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 rounded-full border-4 border-gray-100" />
      <div
        className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
        style={{ borderTopColor: "var(--brand-color)", borderRightColor: "var(--brand-color)" }}
      />
    </div>
  );
}

// ============ Full-page loader ============
export function FullPageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-50">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-gray-100" />
        <div
          className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
          style={{ borderTopColor: "var(--brand-color)", borderRightColor: "var(--brand-color)" }}
        />
        <div
          className="absolute inset-2 rounded-full border-4 border-transparent animate-spin"
          style={{
            animationDirection: "reverse",
            animationDuration: "1.2s",
            borderBottomColor: "var(--brand-color)",
            borderLeftColor: "var(--brand-color)",
            opacity: 0.5,
          }}
        />
      </div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full animate-bounce"
            style={{
              backgroundColor: "var(--brand-color)",
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
      <p className="text-sm font-medium text-gray-400 tracking-wide">{label}…</p>
    </div>
  );
}

// ============ Product card skeleton ============
export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border overflow-hidden">
      <div className="aspect-square bg-gray-100 shimmer" />
      <div className="p-3 sm:p-4 space-y-2.5">
        <div className="h-3 bg-gray-100 rounded shimmer w-1/3" />
        <div className="h-4 bg-gray-100 rounded shimmer w-2/3" />
        <div className="flex items-center justify-between pt-1">
          <div className="h-5 bg-gray-100 rounded shimmer w-1/4" />
          <div className="h-8 w-8 bg-gray-100 rounded-lg shimmer" />
        </div>
      </div>
    </div>
  );
}

// ============ Product grid skeleton ============
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ============ Product list skeleton (horizontal rows) ============
export function ProductListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col sm:flex-row bg-white rounded-2xl border overflow-hidden"
        >
          <div className="w-full sm:w-48 md:w-56 aspect-square sm:aspect-auto bg-gray-100 shimmer flex-shrink-0" />
          <div className="flex-1 p-4 sm:p-5 space-y-3">
            <div className="h-3 w-20 bg-gray-100 rounded shimmer" />
            <div className="h-5 w-2/3 bg-gray-100 rounded shimmer" />
            <div className="h-4 w-full bg-gray-100 rounded shimmer hidden sm:block" />
            <div className="flex items-center justify-between pt-2">
              <div className="h-6 w-24 bg-gray-100 rounded shimmer" />
              <div className="h-9 w-28 bg-gray-100 rounded-lg shimmer" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============ Product detail skeleton ============
export function ProductDetailSkeleton() {
  return (
    <div className="min-h-screen">
      {/* Header skeleton */}
      <div className="sticky top-0 z-40 bg-white border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-6">
          <div className="h-7 w-24 sm:w-32 bg-gray-100 rounded shimmer" />
          <div className="flex-1 max-w-md h-10 bg-gray-100 rounded-xl shimmer hidden sm:block" />
          <div className="flex gap-2 ml-auto">
            <div className="h-10 w-10 bg-gray-100 rounded-lg shimmer" />
            <div className="h-10 w-10 bg-gray-100 rounded-lg shimmer" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Breadcrumb skeleton */}
        <div className="flex gap-2 mb-4 sm:mb-6">
          <div className="h-4 w-16 bg-gray-100 rounded shimmer" />
          <div className="h-4 w-24 bg-gray-100 rounded shimmer" />
          <div className="h-4 w-32 bg-gray-100 rounded shimmer" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10">
          {/* Image skeleton */}
          <div className="space-y-4">
            <div className="aspect-square bg-gray-100 rounded-3xl shimmer" />
            <div className="flex gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="w-20 h-20 bg-gray-100 rounded-xl shimmer" />
              ))}
            </div>
          </div>

          {/* Info skeleton */}
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="h-4 w-20 bg-gray-100 rounded shimmer" />
              <div className="h-8 w-3/4 bg-gray-100 rounded shimmer" />
              <div className="h-4 w-32 bg-gray-100 rounded shimmer" />
            </div>
            <div className="h-9 w-40 bg-gray-100 rounded shimmer" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-gray-100 rounded shimmer" />
              <div className="h-4 w-5/6 bg-gray-100 rounded shimmer" />
              <div className="h-4 w-2/3 bg-gray-100 rounded shimmer" />
            </div>
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-11 w-16 bg-gray-100 rounded-xl shimmer" />
              ))}
            </div>
            <div className="flex gap-4 pt-4">
              <div className="h-12 w-28 bg-gray-100 rounded-xl shimmer" />
              <div className="h-12 flex-1 bg-gray-100 rounded-xl shimmer" />
              <div className="h-12 w-12 bg-gray-100 rounded-xl shimmer" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Cart skeleton ============
export function CartSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="h-9 w-48 bg-gray-100 rounded shimmer mb-6 sm:mb-8" />
        <div className="space-y-3 sm:space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3 sm:gap-4 bg-white rounded-2xl border p-3 sm:p-5">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-xl shimmer flex-shrink-0" />
              <div className="flex-1 space-y-2.5">
                <div className="h-5 w-1/2 bg-gray-100 rounded shimmer" />
                <div className="h-4 w-1/4 bg-gray-100 rounded shimmer" />
                <div className="h-8 w-28 bg-gray-100 rounded-xl shimmer" />
              </div>
              <div className="h-6 w-20 bg-gray-100 rounded shimmer" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ Wishlist grid skeleton ============
export function WishlistSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="h-9 w-48 bg-gray-100 rounded shimmer mb-6 sm:mb-8" />
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
          {Array.from({ length: count }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ Inline loader (for drawers, small areas) ============
export function InlineLoader({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3">
      <Spinner size={32} />
      {label && <p className="text-sm text-gray-400">{label}…</p>}
    </div>
  );
}

// ============ Storefront skeleton (hero + filters + grid) ============
export function StorefrontSkeleton() {
  return (
    <div className="min-h-screen">
      {/* Header skeleton */}
      <div className="sticky top-0 z-40 bg-white border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-6">
          <div className="h-7 w-24 sm:w-32 bg-gray-100 rounded shimmer" />
          <div className="flex-1 max-w-md h-10 bg-gray-100 rounded-xl shimmer hidden sm:block" />
          <div className="flex gap-2 ml-auto">
            <div className="h-10 w-10 bg-gray-100 rounded-lg shimmer" />
            <div className="h-10 w-10 bg-gray-100 rounded-lg shimmer" />
          </div>
        </div>
      </div>

      {/* Hero skeleton */}
      <div className="bg-gradient-to-r from-gray-50 to-white border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-8 sm:py-10 space-y-3">
          <div className="h-7 sm:h-9 w-48 sm:w-72 bg-gray-100 rounded shimmer" />
          <div className="h-4 sm:h-5 w-64 sm:w-96 bg-gray-100 rounded shimmer" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 lg:gap-8">
        {/* Filter sidebar skeleton */}
        <div className="hidden lg:block">
          <div className="bg-white rounded-2xl border p-5 space-y-4">
            <div className="h-5 w-20 bg-gray-100 rounded shimmer" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-16 bg-gray-100 rounded shimmer" />
                <div className="flex gap-2">
                  <div className="h-6 w-16 bg-gray-100 rounded-lg shimmer" />
                  <div className="h-6 w-16 bg-gray-100 rounded-lg shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Product grid skeleton */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="h-4 w-24 bg-gray-100 rounded shimmer" />
          </div>
          <ProductGridSkeleton count={8} />
        </div>
      </div>
    </div>
  );
}

// ============ Landing page splash — premium configurable loader ============
type SplashStyle = "rings" | "spinner" | "pulse" | "dots" | "bars";
type SplashBackground = "waves" | "orbs" | "none";

interface SplashConfig {
  enabled?: boolean;
  style?: SplashStyle;
  background?: SplashBackground;
  subtitle?: string;
  show_logo?: boolean;
  show_progress?: boolean;
  show_dots?: boolean;
}

export function LandingPageSplash({ storeName, config }: { storeName?: string; config?: SplashConfig }) {
  const name = storeName || "Store";
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const style: SplashStyle = config?.style || "rings";
  const bg: SplashBackground = config?.background || "waves";
  const subtitle = config?.subtitle || "Loading…";
  const showLogo = config?.show_logo ?? true;
  const showProgress = config?.show_progress ?? true;
  const showDots = config?.show_dots ?? true;

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center overflow-hidden relative">
      {/* Animated background */}
      {bg === "waves" && (
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1440 900" fill="none">
          <g className="animate-wave-1">
            <path d="M-100,200 Q200,140 480,200 T960,200 T1440,200 T1920,200" stroke="currentColor" strokeWidth="1.5" className="text-brand" style={{ strokeOpacity: 0.06 }} />
            <path d="M-100,250 Q200,190 480,250 T960,250 T1440,250 T1920,250" stroke="currentColor" strokeWidth="1" className="text-brand" style={{ strokeOpacity: 0.04 }} />
          </g>
          <g className="animate-wave-2">
            <path d="M-100,450 Q260,390 540,450 T1020,450 T1500,450 T1980,450" stroke="currentColor" strokeWidth="2" className="text-brand" style={{ strokeOpacity: 0.05 }} />
            <path d="M-100,500 Q260,440 540,500 T1020,500 T1500,500 T1980,500" stroke="currentColor" strokeWidth="1" className="text-brand" style={{ strokeOpacity: 0.03 }} />
          </g>
          <g className="animate-wave-3">
            <path d="M-100,700 Q220,640 500,700 T980,700 T1460,700 T1940,700" stroke="currentColor" strokeWidth="1.5" className="text-brand" style={{ strokeOpacity: 0.05 }} />
            <path d="M-100,750 Q220,690 500,750 T980,750 T1460,750 T1940,750" stroke="currentColor" strokeWidth="1" className="text-brand" style={{ strokeOpacity: 0.03 }} />
          </g>
        </svg>
      )}
      {bg === "orbs" && (
        <>
          <div className="absolute top-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full blur-3xl animate-orb-1 bg-brand opacity-[0.06]" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full blur-3xl animate-orb-2 bg-brand opacity-[0.04]" />
        </>
      )}

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Animation — varies by style */}
        {style === "rings" && (
          <div className="relative w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "var(--brand-color)", borderRightColor: "var(--brand-color)", animationDuration: "2s" }} />
            <div className="absolute inset-2 rounded-full border-2 border-transparent animate-spin" style={{ borderBottomColor: "var(--brand-color)", borderLeftColor: "var(--brand-color)", animationDirection: "reverse", animationDuration: "1.5s", opacity: 0.5 }} />
            <div className="absolute inset-0 rounded-full animate-ping-slow" style={{ boxShadow: "0 0 0 2px var(--brand-color)" }} />
            {showLogo && (
              <div className="w-12 h-12 rounded-xl bg-brand flex items-center justify-center text-white text-xl font-bold animate-scale-pulse">
                {initials}
              </div>
            )}
          </div>
        )}

        {style === "spinner" && (
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent animate-spin" style={{ borderTopColor: "var(--brand-color)", borderRightColor: "var(--brand-color)", animationDuration: "1s" }} />
            {showLogo && (
              <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-brand">
                {initials}
              </div>
            )}
          </div>
        )}

        {style === "pulse" && (
          <div className="relative w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-brand opacity-20 animate-ping-slow" />
            <div className="absolute inset-2 rounded-full bg-brand opacity-30 animate-ping-slow" style={{ animationDelay: "0.5s" }} />
            {showLogo && (
              <div className="relative w-14 h-14 rounded-2xl bg-brand flex items-center justify-center text-white text-xl font-bold animate-scale-pulse">
                {initials}
              </div>
            )}
          </div>
        )}

        {style === "dots" && (
          <div className="flex items-center gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="rounded-full bg-brand animate-bounce"
                style={{ width: 14, height: 14, animationDelay: `${i * 0.12}s`, animationDuration: "0.8s" }}
              />
            ))}
          </div>
        )}

        {style === "bars" && (
          <div className="flex items-end gap-1.5 h-16">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-2.5 rounded-full bg-brand"
                style={{ height: "100%", animation: `scale-pulse 1s ease-in-out ${i * 0.1}s infinite` }}
              />
            ))}
          </div>
        )}

        {/* Brand name */}
        <div className="text-center">
          <div className="text-2xl font-bold tracking-tight text-gray-900 animate-fade-in-up">
            {name}
          </div>
          <div className="text-xs font-medium uppercase tracking-[0.3em] text-gray-400 mt-2 animate-fade-in-up-delay">
            {subtitle}
          </div>
        </div>

        {/* Loading dots */}
        {showDots && style !== "dots" && (
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-2 h-2 rounded-full animate-bounce"
                style={{
                  backgroundColor: "var(--brand-color)",
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: "1s",
                }}
              />
            ))}
          </div>
        )}

        {/* Shimmer progress bar */}
        {showProgress && (
          <div className="w-48 h-0.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-brand animate-progress-slide" />
          </div>
        )}
      </div>
    </div>
  );
}
