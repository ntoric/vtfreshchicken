"use client";

import { useState, useEffect } from "react";
import { BadgePercent } from "lucide-react";
import type { Offer } from "@/types";

interface OfferBannerProps {
  offers: Offer[];
  /** Render just the ticket, without the standalone section wrapper (for embedding inside another section). */
  inline?: boolean;
}

export function OfferBanner({ offers, inline = false }: OfferBannerProps) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (offers.length <= 1) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % offers.length);
    }, 5000);
    return () => clearInterval(t);
  }, [offers.length]);

  if (!offers || offers.length === 0) return null;

  const offer = offers[idx];
  const isPercent = offer.offer_type === "percentage";
  const badge = isPercent ? `${offer.value}%` : `$${offer.value}`;

  const ticket = (
    <>
      {/* Coupon ticket */}
      <div className={`relative w-full ${inline ? "max-w-md" : "max-w-2xl"} flex items-stretch bg-white/85 backdrop-blur-sm border border-stone-200 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] overflow-hidden`}>
          {/* value medallion */}
          <div
            className="flex flex-col items-center justify-center px-4 sm:px-5 text-white flex-shrink-0"
            style={{ background: "var(--brand-color)" }}
          >
            <span className="font-display text-lg sm:text-xl font-bold leading-none">
              {badge}
            </span>
            <span className="text-[9px] sm:text-[10px] font-semibold tracking-[0.18em] uppercase mt-1 opacity-90">
              OFF
            </span>
          </div>

          {/* perforation */}
          <div className="w-px self-stretch border-l border-dashed border-stone-300" />

          {/* copy */}
          <div className="min-w-0 flex-1 px-4 sm:px-5 py-2.5 sm:py-3">
            <p className="text-[10px] sm:text-[11px] font-semibold tracking-[0.18em] uppercase text-brand">
              This week&apos;s offer
            </p>
            <p className="font-display text-sm sm:text-lg font-semibold text-stone-900 truncate mt-0.5">
              {offer.name}
            </p>
            {offer.description && (
              <p className="text-[11px] sm:text-sm text-stone-500 truncate">
                {offer.description}
              </p>
            )}
          </div>

          {/* auto-applied chip */}
          <div className="hidden sm:flex items-center pr-4">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-stone-500 border border-stone-200 rounded-full px-3 py-1.5 bg-stone-50 whitespace-nowrap">
              <BadgePercent className="w-3.5 h-3.5 text-brand" strokeWidth={1.9} />
              Auto-applied
            </span>
          </div>
        </div>

      {/* rotation dots */}
      {offers.length > 1 && (
        <div className={`flex gap-1.5 mt-2.5 ${inline ? "" : "justify-center pb-1"}`}>
          {offers.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? "w-6 bg-brand" : "w-1.5 bg-stone-300"
              }`}
              aria-label={`Offer ${i + 1}`}
            />
          ))}
        </div>
      )}
    </>
  );

  if (inline) return ticket;

  return (
    <section className="bg-[#f4efe6] border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex justify-center">
        {ticket}
      </div>
    </section>
  );
}
