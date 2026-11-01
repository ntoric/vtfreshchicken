"use client";

import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Phone } from "lucide-react";
import { fetchStoreInfo } from "@/lib/api";
import { hero } from "../landing-content-ml";
import { BrushStroke, Dot, Leaves, Tomato } from "./HeroBanner";
import { mlDisplay, mlScript } from "./malayalam-fonts";

/**
 * Malayalam counterpart of HeroBanner: same promo-banner composition and
 * garnish art, with Malayalam copy set in Malayalam typefaces (the Latin
 * Oswald / Dancing Script faces have no Malayalam glyphs).
 */

const RED = "var(--brand-color, #C9232C)";

const photos = [
  {
    src: "/brand/range-fresh.jpg",
    className: "left-[4%] top-[8%] w-[44%] -rotate-6",
    priority: true,
    delay: "0ms",
  },
  {
    src: "/brand/range-frozen.jpg",
    className: "right-[6%] top-[2%] w-[38%] rotate-6",
    delay: "120ms",
  },
  {
    src: "/brand/chicken-table.jpg",
    className: "right-[14%] bottom-[2%] w-[46%] rotate-3",
    delay: "240ms",
  },
];

export function HeroBannerMalayalam({ storeName }: { storeName: string }) {
  const infoQ = useQuery({ queryKey: ["store-info"], queryFn: fetchStoreInfo, staleTime: 5 * 60_000 });
  const phone = infoQ.data?.tenant?.contact_phone;

  return (
    <section className="relative overflow-hidden bg-white border-b border-neutral-100">
      <Tomato className="absolute -top-10 left-[46%] w-28 sm:w-32 hidden md:block" />
      <Leaves className="absolute -top-6 left-[30%] w-28 opacity-90 hidden lg:block" />
      <Leaves className="absolute -top-4 -right-6 w-36 sm:w-44 rotate-[200deg]" />
      <Tomato className="absolute top-[55%] -left-12 w-24 sm:w-28" />
      <Leaves className="absolute -bottom-10 left-[52%] w-32 sm:w-40 rotate-12 hidden md:block" />
      <Tomato className="absolute bottom-[18%] -right-12 w-28 sm:w-32 hidden sm:block" />

      <div className="relative max-w-6xl mx-auto px-5 lg:px-8 pt-10 pb-12 sm:pt-14 sm:pb-16 lg:py-20 grid lg:grid-cols-[1fr_1.05fr] gap-10 lg:gap-6 items-center">
        {/* Copy */}
        <div className="relative z-10 animate-fade-in-up">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mark.svg" alt="" width={36} height={36} className="w-9 h-9" />
            <span lang="en" className="text-sm font-semibold tracking-[0.12em] uppercase text-neutral-800">
              {storeName}
            </span>
          </div>

          <h1 className="relative mt-8 sm:mt-10">
            <span
              className={`${mlScript.className} block text-[2.75rem] sm:text-6xl leading-tight -rotate-3 -mb-1 sm:-mb-2 ml-1 relative z-10`}
              style={{ color: RED }}
            >
              {hero.script}
            </span>
            <span
              className={`${mlDisplay.className} block font-extrabold text-[#2b2b2b] text-[3.25rem] sm:text-[4.75rem] lg:text-[5.25rem] leading-[1.05]`}
            >
              {hero.line1}
              <br />
              {hero.line2}
            </span>
            <Dot className="absolute right-[18%] top-0 w-4 sm:w-5" />
          </h1>

          {/* Brush-stroke tagline */}
          <div className="relative mt-6 inline-block">
            <BrushStroke className="absolute inset-0 w-full h-full scale-x-[1.12] scale-y-125" />
            <p className={`${mlDisplay.className} relative px-8 py-3 text-white font-semibold text-base sm:text-lg`}>
              {hero.tagline}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/shop"
              className={`${mlDisplay.className} group inline-flex items-center gap-2 rounded-full border-2 border-brand px-7 py-2.5 text-base font-semibold text-brand transition-colors hover:text-white hover:bg-brand`}
            >
              {hero.orderNow}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link
              href="/about"
              className="text-sm font-semibold text-neutral-500 hover:text-neutral-900 underline-offset-4 hover:underline px-2"
            >
              {hero.whyDifferent}
            </Link>
          </div>
        </div>

        {/* Photo cluster */}
        <div className="relative aspect-[10/9] w-full max-w-xl mx-auto lg:max-w-none">
          {photos.map((p, i) => (
            <div
              key={p.src}
              className={`absolute aspect-square rounded-full overflow-hidden bg-neutral-100 ring-[6px] sm:ring-8 ring-white shadow-[0_18px_40px_-12px_rgba(0,0,0,0.35)] animate-fade-in-up ${p.className}`}
              style={{ animationDelay: p.delay, animationFillMode: "both" }}
            >
              <Image
                src={p.src}
                alt={hero.photoAlts[i]}
                fill
                priority={p.priority}
                sizes="(min-width: 1024px) 280px, 45vw"
                className="object-cover"
              />
            </div>
          ))}
          <Dot className="absolute left-[50%] top-[46%] w-5" />
          <Dot className="absolute left-[10%] bottom-[22%] w-3.5" />
          <Dot className="absolute right-[2%] top-[48%] w-3" />

          {phone && (
            <a
              href={`tel:${phone}`}
              className="absolute left-0 bottom-0 sm:left-[2%] sm:bottom-[4%] z-10 flex items-center gap-2.5 rounded-2xl bg-white/95 backdrop-blur px-3.5 py-2.5 shadow-md border border-neutral-100 hover:border-brand transition-colors"
            >
              <span className="grid place-items-center w-8 h-8 rounded-full bg-brand text-white">
                <Phone className="w-4 h-4" aria-hidden />
              </span>
              <span className="leading-tight">
                <span className="block text-[11px] font-semibold text-neutral-400">{hero.callUs}</span>
                <span className="block text-base font-semibold text-neutral-900 tracking-wide">{phone}</span>
              </span>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
