"use client";

import Link from "next/link";
import { Truck, Snowflake, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

const NOISE_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.32'/%3E%3C/svg%3E\")";

const PROMISES = [
  { icon: Truck, label: "Same-day dispatch" },
  { icon: Snowflake, label: "Chilled delivery" },
  { icon: ShieldCheck, label: "Secure checkout" },
];

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  panelTitle,
  panelCopy,
  storeName,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: React.ReactNode;
  panelTitle?: React.ReactNode;
  panelCopy?: string;
  storeName?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative overflow-hidden bg-stone-50 px-3 sm:px-4 py-6 sm:py-10 lg:py-16">
      {/* Soft ambient glow behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[44rem] h-[24rem] rounded-full opacity-[0.06] blur-3xl"
        style={{ background: "var(--brand-color)" }}
      />

      <div className="relative mx-auto max-w-5xl grid lg:grid-cols-[1.05fr_1fr] rounded-[28px] overflow-hidden border border-stone-200/80 bg-white shadow-[0_32px_80px_-32px_rgba(28,25,23,0.35)]">
        <div
          aria-hidden
          className="absolute top-0 inset-x-0 h-px z-10"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--brand-color), transparent)",
          }}
        />

        {/* Brand panel */}
        <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-stone-950 p-10 xl:p-12 text-stone-300">
          <div
            aria-hidden
            className="absolute inset-0 bg-cover bg-center opacity-35"
            style={{ backgroundImage: "url(/brand/chicken-table.jpg)" }}
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/75 to-stone-950/30"
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.12]"
            style={{ backgroundImage: NOISE_BG }}
          />
          <div
            aria-hidden
            className="absolute -top-32 -left-24 w-96 h-96 rounded-full opacity-[0.14] blur-3xl"
            style={{ background: "var(--brand-color)" }}
          />

          <div className="relative">
            <Link href="/" aria-label="Back to home" className="inline-flex">
              <BrandLogo inverse storeName={storeName} />
            </Link>
          </div>

          <div className="relative">
            <p className="text-[11px] font-semibold tracking-[0.24em] uppercase text-stone-500">
              Fresh &amp; frozen, delivered
            </p>
            <h2 className="mt-4 font-display text-[2.5rem] xl:text-[2.9rem] leading-[1.08] tracking-tight text-white">
              {panelTitle ?? (
                <>
                  Good chicken,{" "}
                  <em className="italic" style={{ color: "var(--brand-color)" }}>
                    worth gathering for.
                  </em>
                </>
              )}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-stone-400 max-w-sm">
              {panelCopy ??
                "Order fresh and frozen cuts online — prepared the morning your order ships and packed in insulated, food-safe chill packs."}
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {PROMISES.map(({ icon: Icon, label }) => (
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

          <p className="relative text-xs text-stone-500">
            Honest chicken, clearly labelled — from our counter to your kitchen.
          </p>
        </aside>

        {/* Form panel */}
        <div className="relative p-6 sm:p-10 lg:p-12">
          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-brand">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-display text-[2rem] sm:text-[2.4rem] leading-[1.1] tracking-tight text-stone-900">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2.5 text-sm leading-relaxed text-stone-500">
              {subtitle}
            </p>
          )}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </main>
  );
}
