"use client";

import Link from "next/link";
import Image from "next/image";
import { Dancing_Script, Oswald } from "next/font/google";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Phone } from "lucide-react";
import { fetchStoreInfo } from "@/lib/api";

/**
 * Promo-banner style hero: script accent + heavy condensed headline + red
 * brush-stroke tagline on the left, round-framed product photos scattered
 * with tomato / leaf garnishes on the right. Garnishes are inline SVG so the
 * only image bytes are the three photos (served via next/image).
 */

const script = Dancing_Script({ subsets: ["latin"], weight: ["700"], display: "swap" });
const condensed = Oswald({ subsets: ["latin"], weight: ["700"], display: "swap" });

const RED = "var(--brand-color, #C9232C)";

const photos = [
  {
    src: "/brand/range-fresh.jpg",
    alt: "Whole fresh chicken with lemon and herbs",
    className: "left-[4%] top-[8%] w-[44%] -rotate-6",
    priority: true,
    delay: "0ms",
  },
  {
    src: "/brand/range-frozen.jpg",
    alt: "Crispy breaded chicken pieces",
    className: "right-[6%] top-[2%] w-[38%] rotate-6",
    delay: "120ms",
  },
  {
    src: "/brand/chicken-table.jpg",
    alt: "Grilled chicken served with vegetables",
    className: "right-[14%] bottom-[2%] w-[46%] rotate-3",
    delay: "240ms",
  },
];

export function HeroBanner({ storeName }: { storeName: string }) {
  const infoQ = useQuery({ queryKey: ["store-info"], queryFn: fetchStoreInfo, staleTime: 5 * 60_000 });
  const phone = infoQ.data?.tenant?.contact_phone;

  return (
    <section className="relative overflow-hidden bg-white border-b border-neutral-100">
      {/* Edge garnishes — cropped by the section like the print banner */}
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
            <span className={`${condensed.className} text-sm tracking-[0.12em] uppercase text-neutral-800`}>
              {storeName}
            </span>
          </div>

          <h1 className="relative mt-8 sm:mt-10">
            <span
              className={`${script.className} block text-[3.4rem] sm:text-7xl leading-none -rotate-3 -mb-3 sm:-mb-5 ml-1 relative z-10`}
              style={{ color: RED }}
            >
              Farm Fresh
            </span>
            <span
              className={`${condensed.className} block uppercase text-[#2b2b2b] text-[3.6rem] sm:text-[5.5rem] lg:text-[6.25rem] leading-[0.92] tracking-tight`}
            >
              Premium
              <br />
              Chicken
            </span>
            <Dot className="absolute right-[18%] top-0 w-4 sm:w-5" />
          </h1>

          {/* Brush-stroke tagline */}
          <div className="relative mt-6 inline-block">
            <BrushStroke className="absolute inset-0 w-full h-full scale-x-[1.12] scale-y-125" />
            <p className={`${condensed.className} relative px-8 py-3 text-white uppercase text-lg sm:text-xl tracking-wide`}>
              Cut fresh · Delivered cold
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/shop"
              className={`${condensed.className} group inline-flex items-center gap-2 rounded-full border-2 border-brand px-7 py-2.5 text-base uppercase tracking-wider text-brand transition-colors hover:text-white hover:bg-brand`}
            >
              Order now
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link
              href="/about"
              className="text-sm font-semibold text-neutral-500 hover:text-neutral-900 underline-offset-4 hover:underline px-2"
            >
              Why we&rsquo;re different
            </Link>
          </div>
        </div>

        {/* Photo cluster */}
        <div className="relative aspect-[10/9] w-full max-w-xl mx-auto lg:max-w-none">
          {photos.map((p) => (
            <div
              key={p.src}
              className={`absolute aspect-square rounded-full overflow-hidden bg-neutral-100 ring-[6px] sm:ring-8 ring-white shadow-[0_18px_40px_-12px_rgba(0,0,0,0.35)] animate-fade-in-up ${p.className}`}
              style={{ animationDelay: p.delay, animationFillMode: "both" }}
            >
              <Image
                src={p.src}
                alt={p.alt}
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
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Call us</span>
                <span className={`${condensed.className} block text-base text-neutral-900 tracking-wide`}>{phone}</span>
              </span>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- Art ---------------------------------- */

export function Dot({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <circle cx="10" cy="10" r="9" fill={RED} />
      <circle cx="7" cy="7" r="2.5" fill="#fff" opacity="0.35" />
    </svg>
  );
}

export function Tomato({ className = "" }: { className?: string }) {
  const chambers = [0, 60, 120, 180, 240, 300];
  return (
    <svg viewBox="0 0 120 120" className={`pointer-events-none drop-shadow-sm ${className}`} aria-hidden>
      <circle cx="60" cy="60" r="56" fill="#D7261E" />
      <circle cx="60" cy="60" r="49" fill="#EE4434" />
      {chambers.map((a) => (
        <g key={a} transform={`rotate(${a} 60 60)`}>
          <path d="M60 52 C50 40 48 24 60 16 C72 24 70 40 60 52Z" fill="#F8705E" />
          <ellipse cx="56" cy="30" rx="2.2" ry="3.4" fill="#FCE3A6" />
          <ellipse cx="64" cy="34" rx="2" ry="3" fill="#FCE3A6" />
        </g>
      ))}
      <circle cx="60" cy="60" r="9" fill="#F9A08F" />
      {chambers.map((a) => (
        <line key={a} x1="60" y1="60" x2="60" y2="12" stroke="#D7261E" strokeWidth="3" transform={`rotate(${a + 30} 60 60)`} />
      ))}
    </svg>
  );
}

export function Leaves({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={`pointer-events-none ${className}`} aria-hidden>
      <g>
        <path d="M18 92 C14 52 44 18 92 14 C86 40 70 84 18 92Z" fill="#5DAA3A" />
        <path d="M18 92 C40 70 62 44 92 14" stroke="#3E8A25" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>
      <g>
        <path d="M60 104 C66 66 104 40 150 46 C136 74 108 106 60 104Z" fill="#7BC24E" />
        <path d="M60 104 C88 86 116 64 150 46" stroke="#4F9A30" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>
      <g>
        <path d="M40 112 C40 84 62 64 96 66 C88 88 70 110 40 112Z" fill="#4C9A2E" />
        <path d="M40 112 C56 96 74 80 96 66" stroke="#357A1C" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function BrushStroke({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 80" preserveAspectRatio="none" className={className} aria-hidden>
      <path
        fill={RED}
        d="M14 22 C40 12 90 16 130 11 C180 6 240 12 300 9 C340 7 370 12 392 16 L384 26 L396 34 L382 42 L394 52 L378 60 C330 70 270 66 210 70 C150 74 90 69 40 72 L20 66 L30 58 L6 52 L22 44 L2 36 L20 30 Z"
      />
      <path fill={RED} opacity="0.8" d="M60 74 C120 76 200 74 250 76 L246 79 C190 80 120 79 64 78 Z" />
      <path fill={RED} opacity="0.7" d="M150 4 C200 2 250 3 290 5 L286 7 C240 6 196 6 152 7 Z" />
      <circle cx="398" cy="70" r="2" fill={RED} />
      <circle cx="4" cy="14" r="1.6" fill={RED} />
    </svg>
  );
}
