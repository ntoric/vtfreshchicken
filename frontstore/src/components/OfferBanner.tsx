"use client";

import { useState, useEffect } from "react";
import type { Offer } from "@/types";

interface OfferBannerProps {
  offers: Offer[];
}

export function OfferBanner({ offers }: OfferBannerProps) {
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
  const badge = isPercent ? `${offer.value}% OFF` : `$${offer.value} OFF`;

  return (
    <section className="bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 border-b border-orange-100">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 bg-rose-500 text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide shadow-sm">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {badge}
          </span>
          <span className="font-semibold text-gray-800 text-sm md:text-base">
            {offer.name}
          </span>
          {offer.description && (
            <span className="text-gray-500 text-sm hidden sm:inline">— {offer.description}</span>
          )}
        </div>
        {offers.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {offers.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx ? "w-6 bg-rose-400" : "w-1.5 bg-rose-200"
                }`}
                aria-label={`Offer ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
