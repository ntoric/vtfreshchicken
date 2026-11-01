"use client";

import Image from "next/image";
import Link from "next/link";
import { Anton, Great_Vibes } from "next/font/google";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Phone, Leaf } from "lucide-react";
import type { ShopBanner, ShopBannerTheme } from "@/types";

// Display faces for the banners only: a script lead word over a heavy
// condensed headline. Scoped to this component so other routes don't pay for them.
const script = Great_Vibes({ weight: "400", subsets: ["latin"], display: "swap" });
const heavy = Anton({ weight: "400", subsets: ["latin"], display: "swap" });

interface ThemePalette {
  bg: string; // panel background
  accent: string; // headline + CTA + badge ring
  badge: string; // badge inner fill
  badgeText: string;
  ctaText: string;
}

// Keep in sync with backoffice/src/pages/ShopBanners.tsx (preview) and
// services.ShopBannerThemes (backend validation).
export const BANNER_THEMES: Record<ShopBannerTheme, ThemePalette> = {
  crimson: {
    bg: "radial-gradient(120% 140% at 30% 40%, #c8261f 0%, #8f1015 48%, #4f0709 100%)",
    accent: "#ffd23f",
    badge: "#ffd23f",
    badgeText: "#5a0a0d",
    ctaText: "#5a0a0d",
  },
  plum: {
    bg: "radial-gradient(120% 140% at 30% 40%, #6d2470 0%, #4a1450 50%, #250828 100%)",
    accent: "#f7a531",
    badge: "#f6e7d0",
    badgeText: "#4a1450",
    ctaText: "#2b0a2e",
  },
  forest: {
    bg: "radial-gradient(120% 140% at 30% 40%, #2f6b42 0%, #1b4429 50%, #0c2415 100%)",
    accent: "#f4c95d",
    badge: "#f4c95d",
    badgeText: "#123020",
    ctaText: "#123020",
  },
  charcoal: {
    bg: "radial-gradient(120% 140% at 30% 40%, #3a3a3a 0%, #222 50%, #0d0d0d 100%)",
    accent: "#ef3b33",
    badge: "#ef3b33",
    badgeText: "#ffffff",
    ctaText: "#ffffff",
  },
  saffron: {
    bg: "radial-gradient(120% 140% at 30% 40%, #f08a1c 0%, #c45f08 50%, #7a3504 100%)",
    accent: "#fff1c9",
    badge: "#7a1e0e",
    badgeText: "#fff1c9",
    ctaText: "#7a1e0e",
  },
};

const CREAM = "#f4e6d0";
// Torn-paper left edge for the photo.
const TORN =
  "polygon(9% 0, 100% 0, 100% 100%, 3% 100%, 6% 90%, 1% 80%, 5% 69%, 0 58%, 4% 47%, 1% 36%, 6% 25%, 2% 14%, 7% 6%)";
const TORN_PAPER =
  "polygon(6% 0, 100% 0, 100% 100%, 0 100%, 3% 91%, 0 81%, 2% 70%, 0 59%, 2% 48%, 0 37%, 3% 26%, 0 15%, 4% 6%)";
const HEX = "polygon(50% 0, 100% 16%, 100% 84%, 50% 100%, 0 84%, 0 16%)";

function Badge({ value, label, t }: { value: string; label: string; t: ThemePalette }) {
  if (!value && !label) return null;
  const stack = label.length > 0 && label.length <= 5;
  return (
    <div className="relative w-[58px] h-[96px] sm:w-[70px] sm:h-[116px] flex-shrink-0" aria-hidden>
      <div className="absolute inset-0" style={{ clipPath: HEX, background: t.accent }} />
      <div className="absolute inset-[3px]" style={{ clipPath: HEX, background: "rgba(0,0,0,0.35)" }} />
      <div
        className="absolute inset-[6px] flex flex-col items-center justify-center text-center px-1"
        style={{ clipPath: HEX, background: t.badge, color: t.badgeText }}
      >
        {value && (
          <span className={`font-extrabold leading-none tracking-tight ${value.length > 4 ? "text-[11px] sm:text-[13px]" : "text-[15px] sm:text-lg"}`}>
            {value}
          </span>
        )}
        {label &&
          (stack ? (
            <span className="mt-1 flex flex-col text-[9px] sm:text-[10px] font-bold leading-[1.15]">
              {label.split("").map((ch, i) => (
                <span key={i}>{ch}</span>
              ))}
            </span>
          ) : (
            <span className="mt-1 text-[8px] sm:text-[9px] font-bold tracking-wider leading-tight break-all">{label}</span>
          ))}
      </div>
    </div>
  );
}

export function ShopBannerSlide({
  banner,
  brandName,
  priority = false,
  showImage = true,
}: {
  banner: ShopBanner;
  brandName?: string;
  priority?: boolean;
  showImage?: boolean;
}) {
  const t = BANNER_THEMES[banner.theme] ?? BANNER_THEMES.crimson;
  const badgeText = [banner.badge_value, banner.badge_label].filter(Boolean).join(" ");

  return (
    <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)]">
      {/* Top panel */}
      <div className="relative min-h-[210px] sm:min-h-[260px] lg:min-h-[300px]" style={{ background: t.bg }}>
        {/* subtle diagonal sheen */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 14px)" }}
        />
        {/* cream corner fold, top-right (behind the photo) */}
        <div
          aria-hidden
          className="absolute top-0 right-0 h-full w-[52%]"
          style={{ background: CREAM, clipPath: "polygon(78% 0, 100% 0, 100% 34%)" }}
        />

        {/* Photo with torn-paper edge */}
        <div className="absolute inset-y-0 right-0 w-[44%] sm:w-[42%]">
          <div className="absolute inset-y-[6%] -left-2 right-0" style={{ clipPath: TORN_PAPER, background: CREAM }} />
          <div className="absolute inset-y-[6%] left-0 right-0 overflow-hidden" style={{ clipPath: TORN }}>
            {showImage && banner.image_url && (
              <Image
                src={banner.image_url}
                alt=""
                fill
                priority={priority}
                sizes="(min-width: 1280px) 540px, 44vw"
                className="object-cover"
              />
            )}
          </div>
        </div>

        {/* Brand mark */}
        {brandName && (
          <div className="hidden sm:flex absolute top-4 left-6 lg:left-8 z-10 items-center gap-2 text-white/90">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mark-reversed.svg" alt="" className="w-6 h-6" />
            <span className="text-[11px] font-semibold tracking-[0.18em] uppercase">{brandName}</span>
          </div>
        )}

        {/* Copy */}
        <div className="relative z-10 flex items-center gap-4 sm:gap-6 lg:gap-8 h-full min-h-[inherit] pl-4 sm:pl-6 lg:pl-8 pr-[46%] sm:pr-[44%] py-6 sm:pt-12 sm:pb-8">
          <div className="hidden sm:block">
            <Badge value={banner.badge_value} label={banner.badge_label} t={t} />
          </div>
          <div className="min-w-0 flex-1 text-center">
            {banner.eyebrow && (
              <p className={`${script.className} text-white text-[26px] sm:text-5xl lg:text-6xl leading-none drop-shadow-sm`}>
                {banner.eyebrow}
              </p>
            )}
            <h2
              className={`${heavy.className} uppercase leading-[0.95] tracking-wide text-[42px] sm:text-7xl lg:text-[88px] mt-1 drop-shadow-[0_3px_0_rgba(0,0,0,0.25)] break-words`}
              style={{ color: t.accent }}
            >
              {banner.title}
            </h2>
            {banner.subtitle && (
              <p className="mt-2 sm:mt-3 text-white/85 text-[11px] sm:text-sm leading-snug max-w-md mx-auto line-clamp-3 sm:line-clamp-2">
                {banner.subtitle}
              </p>
            )}
            {badgeText && (
              <span
                className="sm:hidden inline-block mt-2 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide"
                style={{ background: t.badge, color: t.badgeText }}
              >
                {badgeText}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer strip */}
      <div
        className="flex items-center gap-3 sm:gap-6 px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5 text-[11px] sm:text-xs text-stone-700"
        style={{ background: CREAM }}
      >
        {banner.cta_text && (
          <span
            className="inline-flex items-center rounded-full px-3.5 sm:px-5 py-1 sm:py-1.5 font-bold uppercase tracking-wider text-[10px] sm:text-[11px] shadow-sm flex-shrink-0"
            style={{ background: t.accent, color: t.ctaText }}
          >
            {banner.cta_text}
          </span>
        )}
        {banner.phone && (
          <span className="inline-flex items-center gap-1.5 flex-shrink-0">
            <Phone className="w-3.5 h-3.5 text-stone-500" strokeWidth={2} />
            {banner.phone}
          </span>
        )}
        {banner.footer_note && (
          <span className="hidden sm:inline-flex items-center gap-1.5 min-w-0 truncate">
            <Leaf className="w-3.5 h-3.5 text-stone-500 flex-shrink-0" strokeWidth={2} />
            <span className="truncate">{banner.footer_note}</span>
          </span>
        )}
      </div>
    </div>
  );
}

const AUTOPLAY_MS = 6000;

export function ShopBannerCarousel({ banners, brandName }: { banners: ShopBanner[]; brandName?: string }) {
  const slides = banners.filter((b) => b.enabled);
  const n = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  // Slides whose image may load: the current one, the next one, and any already seen.
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set([0, 1]));
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const on = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (index >= n && n > 0) setIndex(0);
  }, [index, n]);

  useEffect(() => {
    setLoaded((prev) => {
      const next = (index + 1) % Math.max(n, 1);
      if (prev.has(index) && prev.has(next)) return prev;
      return new Set(prev).add(index).add(next);
    });
  }, [index, n]);

  const go = useCallback((i: number) => setIndex(((i % n) + n) % n), [n]);

  useEffect(() => {
    if (n <= 1 || paused || reducedMotion) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") setIndex((i) => (i + 1) % n);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [n, paused, reducedMotion]);

  if (n === 0) return null;

  return (
    <div
      className="group relative"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured offers"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(index - 1);
        if (e.key === "ArrowRight") go(index + 1);
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
        setPaused(true);
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        setPaused(false);
        if (start == null) return;
        const dx = e.changedTouches[0].clientX - start;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="relative">
        <div className="overflow-hidden rounded-2xl sm:rounded-3xl">
          <div
            className={`flex ${reducedMotion ? "" : "transition-transform duration-700 ease-[cubic-bezier(0.22,0.61,0.36,1)]"}`}
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((b, i) => {
              const active = i === index;
              const slide = (
                <ShopBannerSlide banner={b} brandName={brandName} priority={i === 0} showImage={loaded.has(i)} />
              );
              return (
                <div
                  key={b.id}
                  className="min-w-full"
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} of ${n}`}
                  aria-hidden={!active}
                >
                  {b.cta_link ? (
                    <Link
                      href={b.cta_link}
                      tabIndex={active ? 0 : -1}
                      aria-label={[b.eyebrow, b.title, b.cta_text].filter(Boolean).join(" — ")}
                      className="block focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/40 rounded-2xl sm:rounded-3xl"
                    >
                      {slide}
                    </Link>
                  ) : (
                    slide
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {n > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous banner"
              className="hidden sm:flex absolute right-14 bottom-[9px] w-8 h-8 items-center justify-center rounded-full bg-white text-stone-700 border border-stone-300/70 shadow-sm hover:bg-stone-50 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next banner"
              className="hidden sm:flex absolute right-4 bottom-[9px] w-8 h-8 items-center justify-center rounded-full bg-white text-stone-700 border border-stone-300/70 shadow-sm hover:bg-stone-50 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {n > 1 && (
        <>
          <div className="flex justify-center mt-3">
            {slides.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to banner ${i + 1}`}
                aria-current={i === index}
                className="group/dot flex items-center justify-center w-7 h-7"
              >
                <span
                  className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-brand" : "w-1.5 bg-stone-300 group-hover/dot:bg-stone-400"}`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
