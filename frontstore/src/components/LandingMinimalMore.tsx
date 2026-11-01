"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, ChevronDown, Clock, MapPin, Quote, ShieldCheck, Snowflake, Star } from "lucide-react";
import { useBootstrap } from "@/lib/bootstrap";
import { faqs, knownFor, steps, testimonials } from "./landing-content";

/**
 * Lower half of the minimal homepage (how it works → closing CTA). Loaded
 * lazily by LandingMinimal via next/dynamic + LazyMount, so none of it is in
 * the initial HTML or JS.
 */

const SHOP = "/shop";
const STORY_IMG = "/brand/range-everyday.jpg";
const AREAS_SHOWN = 8;

export function LandingMinimalMore() {
  const bootstrap = useBootstrap();
  const branches = (bootstrap?.branches || []).filter((b) => b.is_active);
  const [featured, ...others] = testimonials;

  return (
    <>
        {/* How it works */}
        <section aria-labelledby="how-heading" className="relative isolate overflow-hidden border-b border-neutral-100 bg-neutral-50/70 text-neutral-900">
          {/* Soft brand glow + hairline grain — purely decorative */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[28rem] w-[56rem] -translate-x-1/2 rounded-full opacity-[0.12] blur-3xl"
            style={{ background: "radial-gradient(closest-side, var(--brand-color), transparent)" }}
          />

          <div className="max-w-6xl mx-auto px-4 lg:px-8 py-20 sm:py-28">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 lg:gap-16 items-end">
              <div>
                <p className="text-[11px] font-medium tracking-[0.32em] uppercase text-neutral-400">How it works</p>
                <h2 id="how-heading" className="mt-4 text-3xl sm:text-[2.75rem] font-light leading-[1.1] tracking-tight">
                  From our counter to your table,
                  <span className="block text-neutral-400">in three simple steps.</span>
                </h2>
              </div>
              <p className="text-[15px] text-neutral-500 leading-relaxed max-w-md lg:justify-self-end">
                No subscriptions, no guesswork. Pick your cuts, confirm a delivery slot at checkout,
                and we take care of the rest — kept cold the whole way.
              </p>
            </div>

            <ol className="mt-14 sm:mt-20 grid sm:grid-cols-3 gap-x-8 lg:gap-x-12 gap-y-12">
              {steps.map(({ icon: Icon, index, title, text }) => (
                <li key={index} className="group relative pt-10">
                  {/* Hairline rail with a brand fill on hover */}
                  <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-neutral-200" />
                  <span
                    aria-hidden
                    className="absolute left-0 top-0 h-px w-10 bg-brand transition-[width] duration-700 ease-out group-hover:w-full"
                  />
                  <span aria-hidden className="absolute left-0 -top-[3px] h-[7px] w-[7px] rounded-full bg-brand ring-4 ring-neutral-50" />

                  <div className="flex items-start justify-between gap-4">
                    <span
                      aria-hidden
                      className="text-6xl sm:text-7xl font-extralight leading-none tracking-tighter tabular-nums bg-gradient-to-b from-neutral-900 to-neutral-900/15 bg-clip-text text-transparent"
                    >
                      {index}
                    </span>
                    <span className="grid place-items-center w-11 h-11 shrink-0 rounded-full border border-neutral-200 bg-white text-neutral-500 transition-colors duration-300 group-hover:border-neutral-400 group-hover:text-neutral-900">
                      <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} aria-hidden />
                    </span>
                  </div>
                  <h3 className="mt-8 text-lg font-medium tracking-tight text-neutral-900">{title}</h3>
                  <p className="mt-2 text-sm text-neutral-500 leading-relaxed max-w-xs">{text}</p>
                </li>
              ))}
            </ol>

            <div className="mt-16 sm:mt-20 pt-8 border-t border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <ul className="flex flex-wrap gap-x-8 gap-y-3 text-[13px] text-neutral-600">
                {[
                  { icon: Snowflake, label: "Insulated, food-safe chill packs" },
                  { icon: Clock, label: "Delivery slots confirmed at checkout" },
                  { icon: ShieldCheck, label: "Purely washed & machine-cut" },
                ].map(({ icon: I, label }) => (
                  <li key={label} className="inline-flex items-center gap-2.5">
                    <I className="w-4 h-4 text-neutral-400" strokeWidth={1.6} aria-hidden />
                    {label}
                  </li>
                ))}
              </ul>
              <Link
                href={SHOP}
                className="group/cta inline-flex items-center gap-2 self-start md:self-auto rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
              >
                Start your order
                <ArrowRight className="w-4 h-4 transition-transform group-hover/cta:translate-x-0.5" aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        {/* Why us */}
        <section aria-labelledby="why-heading" className="max-w-6xl mx-auto px-4 lg:px-8 py-14 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-neutral-100 order-last lg:order-first">
              <Image
                src={STORY_IMG}
                alt="Fresh raw chicken portions laid out on a board"
                fill
                sizes="(min-width: 1024px) 560px, 100vw"
                className="object-cover"
              />
            </div>
            <div>
              <SectionTitle id="why-heading" eyebrow="Why us" title="Chicken handled the way it should be" />
              <p className="mt-4 text-neutral-500 leading-relaxed max-w-md">
                Purely washed, machine-cut and kept cold from our counter to your kitchen — so every
                order is clean, consistent and ready to cook.
              </p>
              <ul className="mt-7 grid sm:grid-cols-2 gap-x-6 gap-y-4">
                {knownFor.map((k) => (
                  <li key={k.title} className="flex gap-3">
                    <Check className="w-4 h-4 mt-1 shrink-0 text-brand" strokeWidth={2.4} aria-hidden />
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">{k.title}</p>
                      <p className="text-sm text-neutral-500 mt-0.5">{k.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Where we deliver — live from active branches */}
        {branches.length > 0 && (
          <section aria-labelledby="areas-heading" className="max-w-6xl mx-auto px-4 lg:px-8 pb-14 sm:pb-20">
            <SectionTitle id="areas-heading" eyebrow="Delivery" title="Where we deliver" />
            <div className={`mt-8 grid gap-4 sm:gap-5 ${branches.length > 1 ? "md:grid-cols-2" : ""}`}>
              {branches.map((b) => {
                const extra = Math.max(0, b.areas.length - AREAS_SHOWN);
                const place = [b.city, b.state].filter(Boolean).join(", ");
                return (
                  <div key={b.id} className="rounded-2xl border border-neutral-200 p-6">
                    <div className="flex items-start gap-3">
                      <span className="grid place-items-center w-9 h-9 shrink-0 rounded-full bg-brand/10 text-brand">
                        <MapPin className="w-4 h-4" strokeWidth={1.9} aria-hidden />
                      </span>
                      <div>
                        <h3 className="font-semibold text-neutral-900">{b.name}</h3>
                        {place && <p className="text-sm text-neutral-500">{place}</p>}
                      </div>
                    </div>
                    {b.areas.length > 0 && (
                      <ul className="mt-4 flex flex-wrap gap-2">
                        {b.areas.slice(0, AREAS_SHOWN).map((a) => (
                          <li key={a} className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
                            {a}
                          </li>
                        ))}
                        {extra > 0 && (
                          <li className="rounded-full px-3 py-1 text-xs font-medium text-neutral-500">+{extra} more</li>
                        )}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-sm text-neutral-500">
              Not listed? Set your location at the top of the page or{" "}
              <Link href="/contact" className="font-medium text-neutral-900 underline underline-offset-4 decoration-neutral-300 hover:decoration-brand">
                get in touch
              </Link>
              .
            </p>
          </section>
        )}

        {/* Testimonials — one featured quote + two supporting voices */}
        <section aria-labelledby="reviews-heading" className="relative isolate overflow-hidden border-y border-neutral-100 bg-neutral-50/70">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-40 -left-24 -z-10 h-[26rem] w-[26rem] rounded-full opacity-[0.08] blur-3xl"
            style={{ background: "var(--brand-color)" }}
          />
          <div className="max-w-6xl mx-auto px-4 lg:px-8 py-16 sm:py-24">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 lg:gap-16 items-end">
              <div>
                <p className="text-[11px] font-medium tracking-[0.32em] uppercase text-neutral-400">Customers</p>
                <h2 id="reviews-heading" className="mt-4 text-3xl sm:text-[2.75rem] font-light leading-[1.1] tracking-tight text-neutral-900">
                  What our customers say
                  <span className="block text-neutral-400">about every order.</span>
                </h2>
              </div>
              <p className="text-[15px] text-neutral-500 leading-relaxed max-w-md lg:justify-self-end">
                Home cooks, fitness regulars and families who order with us week after week — in
                their own words.
              </p>
            </div>

            {featured && (
              <div className="mt-12 sm:mt-16 grid lg:grid-cols-[1.25fr_1fr] gap-4 sm:gap-5">
                {/* Featured quote */}
                <figure className="relative overflow-hidden rounded-3xl bg-white border border-neutral-200 p-7 sm:p-10 flex flex-col">
                  <Quote
                    aria-hidden
                    className="absolute -top-4 -right-4 w-40 h-40 text-brand opacity-[0.06] rotate-180"
                    strokeWidth={1}
                  />
                  <Stars />
                  <blockquote className="relative mt-6 flex-1 text-xl sm:text-2xl font-light leading-snug tracking-tight text-neutral-900">
                    &ldquo;{featured.quote}&rdquo;
                  </blockquote>
                  <Byline name={featured.name} role={featured.role} className="mt-8 pt-6 border-t border-neutral-100" />
                </figure>

                {/* Supporting quotes */}
                <ul className="grid gap-4 sm:gap-5">
                  {others.map((t) => (
                    <li key={t.name} className="group relative">
                      <figure className="h-full rounded-3xl bg-white border border-neutral-200 p-6 sm:p-7 flex flex-col transition-colors duration-300 group-hover:border-neutral-300">
                        <span
                          aria-hidden
                          className="absolute left-7 top-0 h-px w-10 bg-brand transition-[width] duration-700 ease-out group-hover:w-[calc(100%-3.5rem)]"
                        />
                        <Stars small />
                        <blockquote className="mt-4 flex-1 text-[15px] text-neutral-600 leading-relaxed">
                          &ldquo;{t.quote}&rdquo;
                        </blockquote>
                        <Byline name={t.name} role={t.role} className="mt-5" />
                      </figure>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-heading" className="max-w-3xl mx-auto px-4 lg:px-8 py-14 sm:py-20">
          <SectionTitle id="faq-heading" eyebrow="FAQ" title="Good to know" center />
          <div className="mt-8 divide-y divide-neutral-200 border-y border-neutral-200">
            {faqs.map((f) => (
              <details key={f.q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-medium text-neutral-900 [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown className="w-4 h-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <p className="pb-5 -mt-1 text-sm text-neutral-500 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-neutral-500">
            More questions?{" "}
            <Link href="/contact" className="font-medium text-neutral-900 underline underline-offset-4 decoration-neutral-300 hover:decoration-brand">
              Contact us
            </Link>
          </p>
        </section>

        {/* Closing CTA */}
        <section className="max-w-6xl mx-auto px-4 lg:px-8 pb-16 sm:pb-24">
          <div className="relative isolate overflow-hidden rounded-3xl border px-6 py-12 sm:px-12 sm:py-14"
            style={{
              borderColor: "color-mix(in srgb, var(--brand-color) 15%, transparent)",
              background: "linear-gradient(135deg, color-mix(in srgb, var(--brand-color) 7%, white), #fff 55%, #fffbeb)",
            }}>
            {/* Soft decorative glows */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full opacity-25 blur-3xl"
              style={{ background: "radial-gradient(closest-side, var(--brand-color), transparent)" }}
            />
            <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-20 -z-10 h-64 w-64 rounded-full bg-amber-200/40 blur-3xl" />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="max-w-xl">
                <p className="text-xs font-semibold tracking-[0.18em] uppercase text-brand">Fresh today</p>
                <h2 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900">Ready to cook?</h2>
                <p className="mt-2 text-neutral-600">Hand-cut, hygienically packed and kept cold — delivered to your door.</p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {[
                    { icon: Snowflake, label: "Kept cold" },
                    { icon: ShieldCheck, label: "Hygienically packed" },
                    { icon: Clock, label: "Reliable delivery" },
                  ].map(({ icon: Icon, label }) => (
                    <li
                      key={label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-neutral-700 backdrop-blur-sm"
                    >
                      <Icon className="w-3.5 h-3.5 text-brand" aria-hidden />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-3 shrink-0">
                <Link
                  href={SHOP}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
                >
                  Start shopping <ArrowRight className="w-4 h-4" aria-hidden />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold text-neutral-800 hover:border-neutral-400 transition-colors"
                >
                  Talk to us
                </Link>
              </div>
            </div>
          </div>
        </section>
    </>
  );
}

function SectionTitle({ id, eyebrow, title, center = false }: { id: string; eyebrow: string; title: string; center?: boolean }) {
  return (
    <div className={center ? "text-center" : undefined}>
      <p className="text-xs font-semibold tracking-[0.18em] uppercase text-brand">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900">
        {title}
      </h2>
    </div>
  );
}

function Stars({ small = false }: { small?: boolean }) {
  const size = small ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <div className="flex gap-0.5" role="img" aria-label="Rated 5 out of 5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`${size} fill-brand text-brand`} aria-hidden />
      ))}
    </div>
  );
}

function Byline({ name, role, className = "" }: { name: string; role: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 2)
    .toUpperCase();
  return (
    <figcaption className={`flex items-center gap-3 ${className}`}>
      <span aria-hidden className="grid place-items-center w-10 h-10 shrink-0 rounded-full bg-brand/10 text-xs font-semibold tracking-wide text-brand">
        {initials}
      </span>
      <span>
        <span className="block text-sm font-semibold text-neutral-900">{name}</span>
        <span className="block text-xs text-neutral-500">{role}</span>
      </span>
    </figcaption>
  );
}
