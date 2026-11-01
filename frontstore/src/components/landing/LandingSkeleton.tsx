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
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-16 sm:py-24">
        <div className={`h-3 w-24 ${bar}`} />
        <div className={`mt-2 h-8 w-56 ${bar}`} />
        <div className={`mt-3 h-4 w-full max-w-md ${bar}`} />
        <div className="mt-10 sm:mt-12 grid grid-cols-2 lg:grid-cols-12 lg:grid-rows-2 gap-3 sm:gap-5 lg:h-[560px]">
          <div className={`col-span-2 aspect-[4/3] sm:aspect-[16/9] lg:aspect-auto lg:col-span-7 lg:row-span-2 rounded-2xl sm:rounded-[1.75rem] ${bar}`} />
          <div className={`aspect-[4/5] sm:aspect-[4/3] lg:aspect-auto lg:col-span-5 rounded-2xl sm:rounded-[1.75rem] ${bar}`} />
          <div className={`aspect-[4/5] sm:aspect-[4/3] lg:aspect-auto lg:col-span-5 rounded-2xl sm:rounded-[1.75rem] ${bar}`} />
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
      <div className="bg-neutral-950">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-20 sm:py-28">
          <div className="h-3 w-24 rounded bg-white/10" />
          <div className="mt-4 h-9 w-80 max-w-full rounded bg-white/10" />
          <div className="mt-14 sm:mt-20 grid sm:grid-cols-3 gap-x-8 lg:gap-x-12 gap-y-12">
            {[0, 1, 2].map((i) => (
              <div key={i} className="border-t border-white/10 pt-10 space-y-3">
                <div className="h-14 w-20 rounded bg-white/10" />
                <div className="h-4 w-1/2 rounded bg-white/10" />
                <div className="h-3 w-full rounded bg-white/5" />
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
