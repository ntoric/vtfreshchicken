"use client";

import { useId } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Drumstick,
  Truck,
  ArrowRight,
  ArrowUpRight,
  ShoppingBag,
  ClipboardCheck,
  ChefHat,
  Sprout,
  ChevronDown,
  ShieldCheck,
  Droplets,
  Slice,
  Leaf,
  ThermometerSnowflake,
  Star,
  Quote,
} from "lucide-react";
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
import styles from "./LandingHome.module.css";

const PICKS_COUNT = 8;

const SHOP = "/shop";
const HERO_IMG = "/brand/chicken-table.jpg";
const STORY_IMG = "/brand/range-fresh.jpg";

const NOISE_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.32'/%3E%3C/svg%3E\")";

const standards = [
  { icon: Droplets, label: "Purely washed" },
  { icon: Slice, label: "Machine cut" },
  { icon: Leaf, label: "No hormones added" },
  { icon: ThermometerSnowflake, label: "Cold-chain kept" },
  { icon: Sprout, label: "Farm fresh" },
  { icon: ShieldCheck, label: "Hygiene first" },
];

const range = [
  {
    title: "Fresh chicken",
    copy: "Chilled cuts ready for tonight's pan, pot or oven — from whole birds to fillets and thighs.",
    href: "/shop?search=fresh",
    img: "/brand/range-fresh.jpg",
    alt: "Whole fresh chicken with lemon and herbs on a chopping board",
    tag: "Cook tonight",
  },
  {
    title: "Frozen favourites",
    copy: "Stock the freezer with dependable staples — easy to portion, easy to plan, ready when you are.",
    href: "/shop?search=frozen",
    img: "/brand/range-frozen.jpg",
    alt: "Crispy breaded chicken pieces with dipping sauce",
    tag: "Plan ahead",
  },
  {
    title: "Everyday cuts",
    copy: "The everyday essentials: breasts, wings, drumsticks and more for weekly cooking.",
    href: "/shop?search=chicken",
    img: "/brand/range-everyday.jpg",
    alt: "Fresh raw chicken portions on a board",
    tag: "Weekly staples",
  },
];

const testimonials = [
  {
    quote:
      "The chicken is unbelievably fresh and clean — I no longer worry about hygiene while cooking. The cuts are neat, tender, and perfect for everyday dishes.",
    name: "Kavitha R.",
    role: "Home cook, weekly customer",
  },
  {
    quote:
      "As someone who focuses on healthy eating, this is my go-to. Hormone-free, machine-cut, always perfectly packed — you can see the difference in freshness and taste.",
    name: "Rahul M.",
    role: "Nutrition coach",
  },
  {
    quote:
      "Delivery is always on time and properly chilled. Orders arrive exactly as promised — a genuinely reliable partner for our family meals.",
    name: "Mohammed S.",
    role: "Regular since day one",
  },
];

const knownFor = [
  {
    title: "Freshness you can always trust",
    text: "Pure, safe and hygienic chicken — every single order.",
  },
  {
    title: "Hygiene beyond every standard",
    text: "Cleanly processed, freshly packed, carefully delivered.",
  },
  {
    title: "Perfectly fresh, every single time",
    text: "Consistent quality you can actually taste.",
  },
  {
    title: "From farm to your table",
    text: "Short supply chains, honest sourcing, reliable delivery.",
  },
  {
    title: "A healthier choice for every home",
    text: "Hormone-free chicken, handled the way it should be.",
  },
  {
    title: "Trusted by cooks, loved by families",
    text: "The everyday staple that never lets a kitchen down.",
  },
];

const steps = [
  {
    icon: ShoppingBag,
    index: "01",
    title: "Choose your cuts",
    text: "Browse fresh and frozen chicken and add what you need to your basket.",
  },
  {
    icon: ClipboardCheck,
    index: "02",
    title: "Review delivery at checkout",
    text: "See the delivery options and timings available for your address before you pay.",
  },
  {
    icon: ChefHat,
    index: "03",
    title: "Get cooking",
    text: "Your chicken arrives ready for the fridge or freezer — dinner starts here.",
  },
];

const faqs = [
  {
    q: "Should I choose fresh or frozen?",
    a: "Fresh chicken suits cooking within the next day or two — follow the use-by date on the pack. Frozen is ideal for planning ahead: it keeps longer in the freezer and can be thawed in the fridge when you need it.",
  },
  {
    q: "Do you deliver to my area?",
    a: "Add your items to the basket and review delivery options at checkout — available methods, timings and any fees for your address are confirmed there before you pay.",
  },
  {
    q: "How should I handle chicken at home?",
    a: "Keep chicken chilled, follow the use-by date and storage guidance on the pack, thaw frozen chicken in the fridge, and cook thoroughly until the juices run clear and there is no pink meat.",
  },
];

const marqueeItems = [
  "Purely washed",
  "Machine cut",
  "No hormones added",
  "Cold-chain kept",
  "Farm fresh daily",
  "Delivered to your door",
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] sm:text-xs font-semibold tracking-[0.22em] uppercase text-brand">
      {children}
    </p>
  );
}

// Rotating circular text stamp — a Friska-style sticker motif built from pure SVG.
function QualityStamp() {
  const circleId = `vt-stamp-${useId().replace(/:/g, "")}`;
  return (
    <div
      aria-hidden
      className="relative inline-flex items-center justify-center w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-brand shadow-[0_16px_40px_-12px_rgba(0,0,0,0.45)] border-4 border-white"
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full animate-spin-slow">
        <defs>
          <path
            id={circleId}
            d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0"
            fill="none"
          />
        </defs>
        <text className="fill-white text-[9px] font-semibold uppercase" letterSpacing="2.2">
          <textPath href={`#${circleId}`}>
            Premium quality · perfectly fresh ·
          </textPath>
        </text>
      </svg>
      <Drumstick className="w-8 h-8 sm:w-9 sm:h-9 text-white" strokeWidth={1.6} />
    </div>
  );
}

export function LandingHome() {
  const bootstrap = useBootstrap();
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();
  const storeName = bootstrap?.store_name || "VT Fresh Chicken";
  const offers = bootstrap?.offers || [];
  const currencyObj = getCurrencySymbol(bootstrap?.currencies || [], currency);
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
        <Header
          bootstrap={bootstrap}
          currency={currency}
          setCurrency={setCurrency}
          lang={lang}
          setLang={setLang}
        />
      )}

      <main id="main-content" tabIndex={-1}>
      {/* ============ HERO — editorial, stickered, premium ============ */}
      <section className="relative overflow-hidden border-b border-stone-200">
        <div
          aria-hidden
          className="absolute inset-0 opacity-50"
          style={{ backgroundImage: NOISE_BG }}
        />
        <div
          aria-hidden
          className="absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full opacity-[0.12] blur-3xl"
          style={{ background: "var(--brand-color)" }}
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -right-24 w-[26rem] h-[26rem] rounded-full opacity-[0.10] blur-3xl"
          style={{ background: "var(--brand-color)" }}
        />

        <div className="relative max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-12 sm:py-16 lg:py-24 grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-14 items-center">
          <div>
            <div className="inline-flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold tracking-[0.22em] uppercase text-brand">
              <Sprout className="w-4 h-4" strokeWidth={1.8} />
              <span>Purely washed · Machine cut · Cold-chain kept</span>
              <span className="hidden sm:block h-px w-10 bg-brand opacity-50" />
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.6rem] leading-[1.04] tracking-tight text-stone-900 mt-5">
              Perfectly fresh chicken,
              <br />
              <em className="italic text-brand">cut clean &amp; delivered.</em>
            </h1>

            <p className="text-sm sm:text-base lg:text-lg text-stone-500 mt-5 max-w-lg leading-relaxed">
              From trusted farms to your kitchen — purely washed,
              precision-cut and kept at the right temperature all the way to
              your door. Premium chicken your family can trust.
            </p>

            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                href={SHOP}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-7 py-3.5 text-sm font-semibold text-white shadow-[0_14px_30px_-10px_rgba(0,0,0,0.4)] hover:bg-brand-dark hover:-translate-y-0.5 transition-all"
              >
                Shop chicken <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link
                href="#story"
                className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white/70 backdrop-blur-sm px-7 py-3.5 text-sm font-semibold text-stone-700 hover:bg-white hover:border-stone-400 transition-colors"
              >
                Our story
              </Link>
            </div>

            {/* Trust chips */}
            <div className="flex flex-wrap gap-2 sm:gap-2.5 mt-8">
              {[
                { icon: Droplets, label: "Purely washed" },
                { icon: Leaf, label: "No hormones" },
                { icon: Truck, label: "Chilled delivery" },
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

            {offers.length > 0 && (
              <div className="mt-7">
                <OfferBanner offers={offers} inline />
              </div>
            )}
          </div>

          {/* Arch image card with rotating stamp + floating stickers */}
          <div className="relative hidden lg:block">
            <div className="ml-auto w-[82%] max-w-sm">
              <div className="relative overflow-hidden rounded-t-[11rem] rounded-b-[1.75rem] border-[6px] border-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)] rotate-2">
                <div className="relative w-full h-[21rem] bg-stone-200">
                  <span className="absolute inset-0 grid place-items-center text-stone-400" aria-hidden>
                    <Drumstick className="w-16 h-16" />
                  </span>
                  <Image
                    src={HERO_IMG}
                    alt="Grilled chicken breast served with vegetables and lemon"
                    fill
                    sizes="(max-width: 1024px) 100vw, 34vw"
                    priority
                    className="object-cover"
                  />
                </div>
              </div>

              {/* Rotating quality stamp */}
              <div className="absolute -top-6 -right-7 rotate-6">
                <QualityStamp />
              </div>

              {/* Floating badge */}
              <div className="absolute -left-6 bottom-8 bg-white rounded-2xl shadow-xl border border-stone-200/80 px-4 py-3 flex items-center gap-3 -rotate-2">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand-light">
                  <ThermometerSnowflake className="w-5 h-5 text-brand" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="text-xs font-semibold text-stone-900">
                    Chilled at 4°C, door to door
                  </p>
                  <p className="text-[11px] text-stone-500">Cold-chain guaranteed</p>
                </div>
              </div>

              {/* Top sticker */}
              <div className="absolute -right-2 top-24 inline-flex items-center gap-1.5 rounded-full bg-white shadow-lg border border-stone-200/80 px-3.5 py-2 rotate-3">
                <Droplets className="w-3.5 h-3.5 text-brand" strokeWidth={1.9} />
                <span className="text-[11px] font-semibold text-stone-700 uppercase tracking-wide">
                  Purely washed
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Marquee — brand ticker ============ */}
      <div
        aria-hidden
        className="overflow-hidden py-3.5"
        style={{ background: "var(--brand-color)" }}
      >
        <div className="flex w-max animate-marquee">
          {[0, 1].map((n) => (
            <div className="flex shrink-0" key={n}>
              {marqueeItems.map((item) => (
                <span
                  className="inline-flex items-center gap-6 pr-6 font-display italic text-lg text-white whitespace-nowrap"
                  key={`${n}-${item}`}
                >
                  {item}
                  <i className="w-1.5 h-1.5 rounded-full bg-white/70 inline-block" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ============ The VT standard — Friska-style feature medallions ============ */}
      <section
        aria-label="Our standards"
        className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-12 sm:py-16"
      >
        <div className="text-center max-w-xl mx-auto">
          <Eyebrow>Our promise</Eyebrow>
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight text-stone-900 mt-3">
            The VT standard
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-8 mt-10">
          {standards.map(({ icon: Icon, label }) => (
            <div key={label} className="group flex flex-col items-center text-center">
              <span className="relative inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white border-2 border-stone-200 shadow-[0_10px_25px_-12px_rgba(0,0,0,0.18)] transition-all duration-300 group-hover:border-brand group-hover:shadow-[0_16px_35px_-12px_rgba(0,0,0,0.28)] group-hover:-translate-y-1">
                <span
                  aria-hidden
                  className="absolute inset-1.5 rounded-full border border-dashed border-stone-300/80 group-hover:border-brand transition-colors"
                />
                <Icon className="w-8 h-8 sm:w-9 sm:h-9 text-brand" strokeWidth={1.5} />
              </span>
              <span className="mt-3.5 text-[13px] sm:text-sm font-semibold text-stone-800">
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ============ Story — the most carefully handled chicken ============ */}
      <section
        id="story"
        className="scroll-mt-28 relative overflow-hidden bg-white border-y border-stone-200"
      >
        <div
          aria-hidden
          className="absolute -bottom-24 -left-16 w-[24rem] h-[24rem] rounded-full opacity-[0.07] blur-3xl"
          style={{ background: "var(--brand-color)" }}
        />
        <div className="relative max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-14 sm:py-20 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Collage */}
          <div className="relative">
            <div className="relative overflow-hidden rounded-[2rem] border-[6px] border-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.3)] -rotate-1">
              <div className="relative w-full aspect-[4/5] sm:aspect-[5/4] bg-stone-200">
                <Image
                  src={STORY_IMG}
                  alt="Whole fresh chicken with lemon and herbs ready for preparation"
                  fill
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="object-cover"
                />
              </div>
            </div>
            <div className="absolute -bottom-6 -right-4 sm:-right-8 rotate-3">
              <QualityStamp />
            </div>
            <div className="absolute -top-5 -left-3 sm:-left-6 inline-flex items-center gap-1.5 rounded-full bg-white shadow-lg border border-stone-200/80 px-3.5 py-2 -rotate-3">
              <Slice className="w-3.5 h-3.5 text-brand" strokeWidth={1.9} />
              <span className="text-[11px] font-semibold text-stone-700 uppercase tracking-wide">
                Machine cut, every time
              </span>
            </div>
          </div>

          {/* Copy */}
          <div>
            <Eyebrow>About us</Eyebrow>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.9rem] leading-[1.08] tracking-tight text-stone-900 mt-3">
              The most carefully handled
              <br />
              <em className="italic text-brand">chicken around.</em>
            </h2>
            <p className="text-stone-500 max-w-lg mt-5 leading-relaxed">
              At {storeName}, freshness and hygiene are essentials — not
              preferences. From trusted farms to careful processing, we follow
              strict hygiene standards at every stage: washing, cutting,
              packing and delivery. Our chicken is purely washed,
              machine-cut, hormone-free and kept at a constant temperature, so
              it reaches your kitchen clean, tender and perfectly fresh.
            </p>

            <dl className="grid grid-cols-3 gap-4 mt-8 max-w-md">
              {[
                { stat: "100%", label: "Traceable sourcing" },
                { stat: "0", label: "Added hormones" },
                { stat: "4°C", label: "Cold-chain kept" },
              ].map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="font-display text-2xl sm:text-3xl text-brand">{s.stat}</dd>
                  <dd className="text-[11px] sm:text-xs text-stone-500 mt-1 leading-snug">
                    {s.label}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                href="/about"
                className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-6 py-3 text-sm font-semibold text-stone-800 hover:border-brand hover:text-brand transition-colors"
              >
                Our story <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link
                href={SHOP}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-brand-dark transition-colors"
              >
                Shop chicken <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Range ============ */}
      <section
        id="range"
        className="scroll-mt-28 max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-12 sm:py-16"
      >
        <div className="flex items-end justify-between gap-6">
          <div>
            <Eyebrow>The range</Eyebrow>
            <h2 className="font-display text-3xl sm:text-4xl tracking-tight text-stone-900 mt-3">
              Your next great meal starts here.
            </h2>
            <p className="text-stone-500 max-w-xl mt-3 leading-relaxed">
              Browse the range by how you like to cook — fresh for the week
              ahead, frozen for the longer plan, or the everyday cuts that
              always earn their place.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mt-9">
          {range.map((card, i) => (
            <Link
              key={card.title}
              href={card.href}
              className="group bg-white rounded-2xl border border-stone-200 overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_50px_-24px_rgba(0,0,0,0.35)]"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-stone-200">
                <Image
                  src={card.img}
                  alt={card.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute top-3 left-3 rounded-full bg-brand text-white text-[10px] font-bold tracking-[0.14em] uppercase px-3 py-1.5">
                  {card.tag}
                </span>
                <span
                  aria-hidden
                  className="absolute right-3 bottom-1 font-display italic text-5xl leading-none text-white/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h3 className="font-display text-xl text-stone-900">
                  {card.title}
                </h3>
                <p className="text-sm text-stone-500 mt-1.5 leading-relaxed flex-1">
                  {card.copy}
                </p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand mt-4">
                  Shop {card.title.toLowerCase()}
                  <ArrowUpRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="flex justify-center mt-9">
          <Link
            href={SHOP}
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-6 py-3 text-sm font-semibold text-stone-800 hover:border-brand hover:text-brand transition-colors"
          >
            Shop chicken <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </section>

      {/* ============ From the shop — live product grid ============ */}
      {showPicks && (
        <section className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <Eyebrow>Premium quality</Eyebrow>
              <h2 className="font-display text-3xl sm:text-4xl tracking-tight text-stone-900 mt-3">
                This week&apos;s fresh picks
              </h2>
              <p className="text-stone-500 max-w-xl mt-3 leading-relaxed">
                A few favourites from the counter — the full range lives in the
                shop.
              </p>
            </div>
            <Link
              href={SHOP}
              className="hidden sm:inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-800 hover:border-brand hover:text-brand transition-colors shrink-0"
            >
              View all <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </div>

          {picksQ.isLoading ? (
            <div className="mt-8">
              <ProductGridSkeleton count={PICKS_COUNT} />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mt-8">
              {picks.map((p) => (
                <ProductCard key={p.id} product={p} currency={currencyObj} />
              ))}
            </div>
          )}

          <div className="flex justify-center mt-8 sm:hidden">
            <Link
              href={SHOP}
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-6 py-3 text-sm font-semibold text-stone-800 hover:border-brand hover:text-brand transition-colors"
            >
              View all products <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </div>
        </section>
      )}

      {/* ============ Testimonials — why people love us ============ */}
      <section
        aria-label="Testimonials"
        className="relative overflow-hidden bg-white border-y border-stone-200"
      >
        <div
          aria-hidden
          className="absolute -top-24 -right-24 w-[22rem] h-[22rem] rounded-full opacity-[0.07] blur-3xl"
          style={{ background: "var(--brand-color)" }}
        />
        <div className="relative max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-14 sm:py-20">
          <div className="text-center max-w-xl mx-auto">
            <Eyebrow>Satisfied customers</Eyebrow>
            <h2 className="font-display text-3xl sm:text-4xl tracking-tight text-stone-900 mt-3">
              Why people love <em className="italic text-brand">{storeName}</em>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mt-10">
            {testimonials.map((t) => (
              <figure
                key={t.name}
                className="relative bg-[#faf7f1] rounded-2xl border border-stone-200 p-6 sm:p-7 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_-24px_rgba(0,0,0,0.3)]"
              >
                <Quote
                  aria-hidden
                  className="w-8 h-8 text-brand opacity-30 mb-4"
                  strokeWidth={1.5}
                />
                <div className="flex gap-0.5 mb-3" aria-label="5 out of 5 stars">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-brand text-brand" aria-hidden />
                  ))}
                </div>
                <blockquote className="text-sm sm:text-[15px] text-stone-700 leading-relaxed flex-1">
                  {t.quote}
                </blockquote>
                <figcaption className="mt-5 pt-4 border-t border-stone-200/80">
                  <p className="text-sm font-semibold text-stone-900">{t.name}</p>
                  <p className="text-xs text-stone-500 mt-0.5">{t.role}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ============ We are known — why choose us ============ */}
      <section
        id="why-vt"
        className="scroll-mt-28 relative overflow-hidden"
      >
        <div
          aria-hidden
          className="absolute -bottom-28 -right-8 font-display italic text-[15rem] leading-none text-stone-200/60 select-none pointer-events-none hidden lg:block"
        >
          VT
        </div>
        <div className="relative max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-14 sm:py-20 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-16">
          <div>
            <Eyebrow>Why choose us</Eyebrow>
            <h2 className="font-display text-3xl sm:text-4xl tracking-tight text-stone-900 mt-3">
              We are known for
              <br />
              <em className="italic text-brand">doing it properly.</em>
            </h2>
            <p className="text-stone-500 max-w-md mt-4 leading-relaxed">
              We keep it simple: honest chicken, clearly labelled, in the
              formats that fit real kitchens — handled with more care than
              you&apos;d expect.
            </p>
            <div className="mt-7">
              <Link
                href={SHOP}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-brand-dark transition-colors"
              >
                Shop chicken <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
            </div>
          </div>

          <ul className="grid sm:grid-cols-2 gap-4 sm:gap-5">
            {knownFor.map((item) => (
              <li
                key={item.title}
                className="relative bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_-24px_rgba(0,0,0,0.3)]"
              >
                <span
                  aria-hidden
                  className="absolute left-0 top-5 bottom-5 w-[3px] rounded-full bg-brand"
                />
                <h3 className="font-display text-lg text-stone-900">
                  {item.title}
                </h3>
                <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">
                  {item.text}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============ Delivery — brand-gradient band ============ */}
      <section
        id="delivery"
        className="scroll-mt-28 relative overflow-hidden text-white"
        style={{
          background:
            "linear-gradient(150deg, var(--brand-color-dark) 0%, var(--brand-color) 100%)",
        }}
      >
        <div
          aria-hidden
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[36rem] h-[18rem] rounded-full bg-white/10 blur-3xl"
        />
        <div className="relative max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-14 sm:py-20 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-16 items-center">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold tracking-[0.22em] uppercase text-white/80">
              How it works
            </p>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.9rem] leading-[1.08] tracking-tight mt-3">
              From our counter to
              <br />
              <em className="italic">your kitchen</em>
            </h2>
            <p className="text-white/75 mt-5 leading-relaxed max-w-md">
              Ordering is straightforward — pick your cuts, confirm delivery at
              checkout, and get cooking. Every order travels in insulated,
              food-safe chill packs.
            </p>

            <div className="flex flex-wrap gap-2 mt-6">
              {[
                { icon: ThermometerSnowflake, label: "Chilled, never warm" },
                { icon: Truck, label: "Slots at checkout" },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm px-3.5 py-1.5 text-xs sm:text-[13px] font-medium text-white"
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.9} />
                  {label}
                </span>
              ))}
            </div>

            <div className="mt-8">
              <Link
                href={SHOP}
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-stone-900 shadow-[0_14px_30px_-10px_rgba(0,0,0,0.4)] hover:bg-stone-100 hover:-translate-y-0.5 transition-all"
              >
                Start your order <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
            </div>
          </div>

          {/* Vertical timeline */}
          <ol className="relative">
            {steps.map(({ icon: Icon, index, title, text }, i) => (
              <li key={index} className="relative pl-16 sm:pl-20 pb-6 last:pb-0">
                {i < steps.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute left-6 top-14 -bottom-2 w-px bg-white/25"
                  />
                )}
                <span
                  aria-hidden
                  className="absolute left-0 top-0 inline-flex items-center justify-center w-12 h-12 rounded-full bg-white text-brand font-display italic text-lg shadow-[0_10px_25px_-8px_rgba(0,0,0,0.4)]"
                >
                  {index}
                </span>
                <div className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm p-5 sm:p-6 transition-colors duration-300 hover:bg-white/15">
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-white/85 shrink-0" strokeWidth={1.8} />
                    <h3 className="font-display text-lg sm:text-xl">{title}</h3>
                  </div>
                  <p className="text-sm text-white/75 mt-2 leading-relaxed">
                    {text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section
        aria-label="Frequently asked questions"
        className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-14 sm:py-20"
      >
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-16 items-start">
          <div className="lg:sticky lg:top-28">
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="font-display text-3xl sm:text-4xl tracking-tight text-stone-900 mt-3">
              Good to know
            </h2>
            <p className="text-stone-500 mt-4 leading-relaxed max-w-md">
              The essentials on fresh vs. frozen, delivery and handling —
              answered plainly.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand mt-5 hover:underline"
            >
              Still have a question? <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-4">
            {faqs.map((f) => (
              <details
                key={f.q}
                className="group bg-white rounded-2xl border border-stone-200 overflow-hidden transition-shadow duration-300 open:shadow-[0_16px_35px_-20px_rgba(0,0,0,0.25)]"
              >
                <summary className="flex items-center gap-4 cursor-pointer list-none px-5 sm:px-6 py-5 font-medium text-stone-800 [&::-webkit-details-marker]:hidden">
                  <span className="flex-1">{f.q}</span>
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-stone-200 text-stone-400 shrink-0 transition-all duration-200 group-open:rotate-180 group-open:border-brand group-open:text-brand">
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </summary>
                <p className="text-sm text-stone-500 leading-relaxed pb-5 px-5 sm:px-6">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
      </main>

      {/* ============ Footer ============ */}
      <footer className="relative overflow-hidden bg-stone-950 text-stone-400">
        <div aria-hidden className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: NOISE_BG }} />
        <div
          aria-hidden
          className="absolute -top-40 left-1/4 w-[34rem] h-[34rem] rounded-full opacity-[0.08] blur-3xl"
          style={{ background: "var(--brand-color)" }}
        />
        <div
          aria-hidden
          className="absolute top-0 inset-x-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, var(--brand-color), transparent)" }}
        />
        <div className="relative max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pt-12 sm:pt-16 pb-8">
          <div className="grid gap-10 sm:gap-12 lg:grid-cols-[1.4fr_0.8fr_0.8fr_1fr]">
            <div>
              <BrandLogo inverse storeName={storeName} />
              <p className="mt-4 text-sm leading-relaxed max-w-xs">
                Purely washed, machine-cut and cold-chain kept — premium fresh
                chicken delivered to your door.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  { icon: Droplets, label: "Purely washed" },
                  { icon: ThermometerSnowflake, label: "Chilled delivery" },
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
            <div>
              <h4 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-stone-500">
                Shop
              </h4>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <Link href={SHOP} className="hover:text-white transition-colors">
                    Shop chicken
                  </Link>
                </li>
                {(bootstrap?.categories || []).slice(0, 5).map((cat) => (
                  <li key={cat.id}>
                    <Link
                      href={`/shop?category=${cat.slug}`}
                      className="hover:text-white transition-colors"
                    >
                      {cat.name}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/wishlist" className="hover:text-white transition-colors">
                    Wishlist
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-stone-500">
                Company
              </h4>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li><Link href="/about" className="hover:text-white transition-colors">About us</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><Link href="/orders" className="hover:text-white transition-colors">Track orders</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-stone-500">
                Our promise
              </h4>
              <p className="mt-4 text-sm leading-relaxed">
                Honest chicken, clearly labelled, prepared the morning your
                order ships and packed in insulated, food-safe chill packs.
              </p>
              <Link
                href="/about"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-white hover:underline underline-offset-4 decoration-brand"
              >
                Read our story<span aria-hidden>→</span>
              </Link>
            </div>
          </div>
          <div className="mt-12 pt-6 border-t border-stone-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-xs text-stone-500">
              © {year} {storeName}. All rights reserved.
            </p>
            <div className="flex gap-5 text-xs">
              <Link href="/privacy-policy" className="text-stone-500 hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/cookie-policy" className="text-stone-500 hover:text-white transition-colors">Cookie Policy</Link>
              <Link href="/terms" className="text-stone-500 hover:text-white transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
