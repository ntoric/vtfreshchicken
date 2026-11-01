"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, ChevronDown, MapPin, Quote } from "lucide-react";
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

  return (
    <>
        {/* How it works */}
        <section aria-labelledby="how-heading" className="border-y border-neutral-100 bg-neutral-50/60">
          <div className="max-w-6xl mx-auto px-4 lg:px-8 py-14 sm:py-20">
            <SectionTitle id="how-heading" eyebrow="How it works" title="Three steps to dinner" />
            <ol className="mt-8 sm:mt-10 grid sm:grid-cols-3 gap-4 sm:gap-5">
              {steps.map(({ icon: Icon, index, title, text }) => (
                <li key={index} className="rounded-2xl bg-white border border-neutral-200 p-6">
                  <div className="flex items-center justify-between">
                    <span className="grid place-items-center w-10 h-10 rounded-full bg-brand/10 text-brand">
                      <Icon className="w-5 h-5" strokeWidth={1.8} aria-hidden />
                    </span>
                    <span className="text-sm font-semibold text-neutral-300 tabular-nums">{index}</span>
                  </div>
                  <h3 className="mt-5 font-semibold text-neutral-900">{title}</h3>
                  <p className="mt-1.5 text-sm text-neutral-500 leading-relaxed">{text}</p>
                </li>
              ))}
            </ol>
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

        {/* Testimonials */}
        <section aria-labelledby="reviews-heading" className="border-y border-neutral-100 bg-neutral-50/60">
          <div className="max-w-6xl mx-auto px-4 lg:px-8 py-14 sm:py-20">
            <SectionTitle id="reviews-heading" eyebrow="Customers" title="What our customers say" />
            <ul className="mt-8 sm:mt-10 grid md:grid-cols-3 gap-4 sm:gap-5">
              {testimonials.map((t) => (
                <li key={t.name}>
                  <figure className="h-full rounded-2xl bg-white border border-neutral-200 p-6 flex flex-col">
                    <Quote className="w-5 h-5 text-brand" aria-hidden />
                    <blockquote className="mt-4 text-sm text-neutral-700 leading-relaxed flex-1">{t.quote}</blockquote>
                    <figcaption className="mt-5 pt-4 border-t border-neutral-100">
                      <p className="text-sm font-semibold text-neutral-900">{t.name}</p>
                      <p className="text-xs text-neutral-500">{t.role}</p>
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
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
          <div className="rounded-3xl bg-neutral-900 px-6 py-12 sm:px-12 sm:py-14 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Ready to cook?</h2>
              <p className="mt-2 text-neutral-400">Fresh cuts, delivered to your door.</p>
            </div>
            <Link
              href={SHOP}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-100 transition-colors"
            >
              Start shopping <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
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
