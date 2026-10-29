"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles, Droplets, Scissors, Snowflake, Leaf, ShieldCheck,
  Truck, HandHeart, ArrowRight, Quote, MapPin, Package, Grid3X3,
} from "lucide-react";
import { fetchBootstrap, fetchProducts } from "@/lib/api";
import { Header } from "@/components/Header";
import { StorefrontSkeleton } from "@/components/Loaders";
import { useCurrencyLang } from "@/lib/currency-lang";

const VALUES = [
  {
    icon: Droplets,
    title: "Purely washed",
    text: "Every bird is thoroughly cleaned in food-safe conditions before it reaches the cutting table.",
  },
  {
    icon: Scissors,
    title: "Cut fresh to order",
    text: "Precision machine cuts in the size you choose — nothing sits pre-cut losing freshness.",
  },
  {
    icon: Snowflake,
    title: "Cold-chain kept",
    text: "Chilled, never frozen, from our facility to your doorstep — freshness locked in the whole way.",
  },
  {
    icon: Leaf,
    title: "No hormones",
    text: "Naturally raised chicken from partner farms we know and audit — no hormones, no shortcuts.",
  },
];

const STEPS = [
  {
    icon: HandHeart,
    step: "01",
    title: "Sourced from trusted farms",
    text: "We partner directly with farms that share our standards for welfare and feed quality.",
  },
  {
    icon: ShieldCheck,
    step: "02",
    title: "Checked & cleaned",
    text: "Every batch passes hygiene checks and is purely washed in our own facility.",
  },
  {
    icon: Scissors,
    step: "03",
    title: "Cut to your order",
    text: "Curry cut, boneless, whole, or marinated — cut fresh only after you order.",
  },
  {
    icon: Truck,
    step: "04",
    title: "Delivered chilled",
    text: "Packed cold and dispatched fast, so it arrives the way fresh chicken should.",
  },
];

export default function AboutPage({ params }: { params: {} }) {
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => fetchBootstrap(),
  });

  // Only the total count is needed for the stats strip
  const productsQ = useQuery({
    queryKey: ["products-count"],
    queryFn: () => fetchProducts({ limit: 1 }),
  });

  if (bootstrapQ.isLoading) return <StorefrontSkeleton />;
  if (bootstrapQ.error || !bootstrapQ.data) {
    return <div className="min-h-screen flex items-center justify-center text-rose-500">Failed to load. Please try again.</div>;
  }

  const store = bootstrapQ.data.store_name || "our store";
  const categories = bootstrapQ.data.categories?.length ?? 0;
  const products = productsQ.data?.total ?? 0;
  const areas = bootstrapQ.data.settings?.service_area?.areas?.length ?? 0;

  return (
    <div className="min-h-screen bg-[#FBF9F6]">
      <Header
        bootstrap={bootstrapQ.data}
        currency={currency}
        setCurrency={setCurrency}
        lang={lang}
        setLang={setLang}
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-stone-200/70 bg-gradient-to-b from-[#FAF0EB] via-[#FBF6F2] to-[#FBF9F6]">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-[0.07] blur-3xl"
          style={{ backgroundColor: "var(--brand-color, #C9232C)" }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-14 sm:pt-20 sm:pb-20">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand">
            <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
            Our story
          </span>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-stone-900 mt-4 max-w-3xl">
            Fresh chicken, <em className="italic text-brand">done right.</em>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-stone-500 max-w-xl leading-relaxed">
            From trusted farms to your kitchen — purely washed, precision-cut, and kept at the right
            temperature all the way to your door.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400 mb-4">
              Why we started
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-stone-900 leading-tight">
              Buying fresh chicken shouldn't be a gamble.
            </h2>
            <div className="mt-5 space-y-4 text-stone-600 leading-relaxed text-[15px]">
              <p>
                {store} began with a simple frustration: it was too hard to find chicken you could
                actually trust — truly fresh, hygienically handled, and cut the way you wanted it.
              </p>
              <p>
                So we built a better way. We work directly with farms we know, process every order in
                our own facility, and hold the cold chain unbroken until it reaches your kitchen. No
                frozen-and-thawed surprises, no mystery sourcing.
              </p>
              <p>
                Every order is cut fresh after you place it — the way a good neighbourhood butcher
                would, delivered with the convenience of online shopping.
              </p>
            </div>
            <p className="mt-6 text-sm font-semibold text-stone-900">
              — The {store} team
            </p>
          </div>

          {/* Promise card */}
          <div className="relative">
            <div className="relative rounded-3xl bg-gradient-to-br from-brand to-brand-dark p-8 sm:p-12 text-white overflow-hidden">
              <div
                aria-hidden
                className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10 blur-2xl"
              />
              <Quote className="w-10 h-10 text-white/40" strokeWidth={1.5} />
              <p className="font-display text-2xl sm:text-3xl font-medium leading-snug mt-5">
                "Premium chicken your family can trust — purely washed, cut clean, delivered cold."
              </p>
              <p className="mt-7 text-xs font-semibold text-white/70 uppercase tracking-[0.22em]">
                The {store} promise
              </p>
            </div>
            {/* Floating chips */}
            <div className="absolute -bottom-5 left-6 right-6 flex flex-wrap gap-2 justify-center">
              {["Purely washed", "Cold-chain kept", "No hormones"].map((chip) => (
                <span
                  key={chip}
                  className="bg-white border border-stone-200 shadow-sm rounded-full px-4 py-2 text-xs font-semibold text-stone-700"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-14 lg:pb-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400 mb-4">
          What we stand for
        </p>
        <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-stone-900 leading-tight mb-10">
          Standards you can taste
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {VALUES.map((v) => (
            <div
              key={v.title}
              className="group bg-white rounded-2xl border border-stone-200 p-6 hover:border-brand hover:shadow-sm transition-all"
            >
              <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-brand-light text-brand mb-5 group-hover:scale-105 transition-transform">
                <v.icon className="w-5 h-5" strokeWidth={1.8} />
              </span>
              <h3 className="text-base font-semibold text-stone-900">{v.title}</h3>
              <p className="text-sm text-stone-500 mt-2 leading-relaxed">{v.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Process */}
      <section className="border-y border-stone-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 lg:py-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400 mb-4">
            How it works
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-stone-900 leading-tight mb-12">
            From farm to your door
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.step} className="relative">
                {i < STEPS.length - 1 && (
                  <div
                    aria-hidden
                    className="hidden lg:block absolute top-7 left-[calc(100%-1rem)] w-8 border-t border-dashed border-stone-300"
                  />
                )}
                <div className="flex items-center gap-3 mb-4">
                  <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-light text-brand">
                    <s.icon className="w-6 h-6" strokeWidth={1.7} />
                  </span>
                  <span className="font-display text-3xl font-semibold text-stone-200">{s.step}</span>
                </div>
                <h3 className="text-base font-semibold text-stone-900">{s.title}</h3>
                <p className="text-sm text-stone-500 mt-2 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-stone-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 lg:py-16">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            <div>
              <Package className="w-6 h-6 mx-auto mb-3 text-brand-light" strokeWidth={1.8} />
              <p className="font-display text-4xl font-semibold">{products > 0 ? `${products}+` : "—"}</p>
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400 mt-2">Fresh products</p>
            </div>
            <div>
              <Grid3X3 className="w-6 h-6 mx-auto mb-3 text-brand-light" strokeWidth={1.8} />
              <p className="font-display text-4xl font-semibold">{categories || "—"}</p>
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400 mt-2">Categories</p>
            </div>
            <div>
              <MapPin className="w-6 h-6 mx-auto mb-3 text-brand-light" strokeWidth={1.8} />
              <p className="font-display text-4xl font-semibold">{areas > 0 ? `${areas}+` : "Local"}</p>
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400 mt-2">Areas served</p>
            </div>
            <div>
              <Snowflake className="w-6 h-6 mx-auto mb-3 text-brand-light" strokeWidth={1.8} />
              <p className="font-display text-4xl font-semibold">100%</p>
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400 mt-2">Cold-chain kept</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-24 text-center">
        <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-stone-900">
          Taste the difference <em className="italic text-brand">fresh</em> makes.
        </h2>
        <p className="mt-4 text-stone-500 max-w-md mx-auto leading-relaxed">
          Order today and get purely washed, cut-to-order chicken delivered chilled to your door.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/shop"
            className="group inline-flex items-center gap-2 px-8 py-4 rounded-full text-white text-sm font-semibold bg-brand hover:bg-brand-dark shadow-sm hover:shadow-md transition-all"
          >
            Shop chicken
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-stone-300 text-sm font-semibold text-stone-700 hover:border-stone-900 hover:text-stone-900 transition-all"
          >
            Contact us
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-sm text-stone-400 flex flex-col md:flex-row justify-between gap-4">
          <p>© {new Date().getFullYear()} {store}. Powered by TruCommerce.</p>
          <div className="flex gap-5">
            <Link href="/privacy-policy" className="hover:text-stone-700 transition-colors">Privacy</Link>
            <Link href="/cookie-policy" className="hover:text-stone-700 transition-colors">Cookies</Link>
            <Link href="/terms" className="hover:text-stone-700 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
