// Lightweight placeholders for the homepage. No client JS, no images, no data —
// they paint instantly while the real sections stream in or lazy-load.

const bar = "rounded bg-neutral-100 shimmer";

/** First screen: header, hero, promise strip and range tiles. */
export function LandingSkeleton() {
  return (
    <div className="min-h-screen bg-white" aria-busy="true" aria-label="Loading">
      {/* Header */}
      <div className="h-8 bg-neutral-100" />
      <div className="border-b border-neutral-100">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center gap-6">
          <div className={`h-9 w-28 ${bar}`} />
          <div className={`hidden md:block h-8 w-32 rounded-full ${bar}`} />
          <div className="hidden lg:flex gap-5">
            <div className={`h-4 w-12 ${bar}`} />
            <div className={`h-4 w-24 ${bar}`} />
            <div className={`h-4 w-12 ${bar}`} />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className={`hidden md:block h-9 w-56 rounded-full ${bar}`} />
            <div className={`h-9 w-9 rounded-full ${bar}`} />
            <div className={`h-9 w-9 rounded-full ${bar}`} />
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 lg:px-8 pt-10 sm:pt-14 lg:pt-20 pb-12 sm:pb-16 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className="space-y-4">
          <div className={`h-3 w-28 ${bar}`} />
          <div className={`h-10 sm:h-12 w-4/5 ${bar}`} />
          <div className={`h-10 sm:h-12 w-3/5 ${bar}`} />
          <div className={`h-4 w-full max-w-md ${bar}`} />
          <div className={`h-4 w-2/3 max-w-sm ${bar}`} />
          <div className="flex gap-3 pt-4">
            <div className={`h-11 w-32 rounded-full ${bar}`} />
            <div className={`h-11 w-28 rounded-full ${bar}`} />
          </div>
        </div>
        <div className={`aspect-[4/3] lg:aspect-[5/4] rounded-3xl ${bar}`} />
      </div>

      {/* Promise strip */}
      <div className="border-y border-neutral-100 bg-neutral-50/60">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`w-9 h-9 shrink-0 rounded-full ${bar}`} />
              <div className="flex-1 space-y-2 pt-1">
                <div className={`h-3.5 w-2/3 ${bar}`} />
                <div className={`h-3 w-full ${bar}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Range tiles */}
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-14 sm:py-20">
        <div className={`h-8 w-48 ${bar}`} />
        <div className="mt-6 sm:mt-8 grid grid-cols-3 gap-2.5 sm:gap-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-3">
              <div className={`aspect-square sm:aspect-[4/3] rounded-xl sm:rounded-2xl ${bar}`} />
              <div className={`h-4 w-2/3 ${bar}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Placeholder for the lazily loaded lower half of the minimal landing. */
export function LandingMoreSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading more">
      {/* How it works */}
      <div className="border-y border-neutral-100 bg-neutral-50/60">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-14 sm:py-20">
          <div className={`h-3 w-24 ${bar}`} />
          <div className={`mt-3 h-8 w-64 ${bar}`} />
          <div className="mt-8 sm:mt-10 grid sm:grid-cols-3 gap-4 sm:gap-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl bg-white border border-neutral-200 p-6 space-y-3">
                <div className={`w-10 h-10 rounded-full ${bar}`} />
                <div className={`h-4 w-1/2 ${bar}`} />
                <div className={`h-3 w-full ${bar}`} />
                <div className={`h-3 w-4/5 ${bar}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Why us */}
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-14 sm:py-20 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className={`aspect-[4/3] rounded-3xl ${bar}`} />
        <div className="space-y-3">
          <div className={`h-3 w-16 ${bar}`} />
          <div className={`h-8 w-4/5 ${bar}`} />
          <div className={`h-4 w-full ${bar}`} />
          <div className={`h-4 w-3/4 ${bar}`} />
          <div className="grid sm:grid-cols-2 gap-4 pt-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`h-10 ${bar}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
