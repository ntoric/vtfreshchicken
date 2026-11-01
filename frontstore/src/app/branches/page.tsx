"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Store, MapPin, Phone, Mail, Navigation, Truck, ArrowRight, Sparkles,
} from "lucide-react";
import { fetchBootstrap } from "@/lib/api";
import { Header } from "@/components/Header";
import { StorefrontSkeleton } from "@/components/Loaders";
import { useCurrencyLang } from "@/lib/currency-lang";
import { useLocation } from "@/lib/location";
import { formatPrice } from "@/lib/format";
import type { Branch, Currency } from "@/types";

const AREA_CHIP_CAP = 12;

function branchAddress(b: Branch): string {
  return [b.line1, b.line2, b.city, b.state, b.postal_code, b.country].filter(Boolean).join(", ");
}

function zoneText(radiusKm: number, chargeType: string, charge: number, currency?: Currency): string {
  const range = `within ${radiusKm} km`;
  if (chargeType === "free" || charge <= 0) return `Free delivery ${range}`;
  if (chargeType === "per_km") return `${formatPrice(charge, currency)}/km ${range}`;
  return `${formatPrice(charge, currency)} delivery ${range}`;
}

function BranchCard({ branch, currency }: { branch: Branch; currency?: Currency }) {
  const address = branchAddress(branch);
  const areas = branch.areas ?? [];
  const zones = [...(branch.service_zones ?? [])].sort((a, b) => a.radius_km - b.radius_km);
  const hasCoords = branch.center_lat !== 0 || branch.center_lng !== 0;

  return (
    <article className="flex flex-col bg-white rounded-2xl border border-stone-200 p-6 hover:border-brand hover:shadow-sm transition-all">
      {/* Name + badges */}
      <div className="flex items-start gap-4">
        <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-brand-light text-brand flex-shrink-0">
          <Store className="w-5 h-5" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-stone-900 leading-snug">{branch.name}</h2>
          {branch.is_default && (
            <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand bg-brand-light rounded-full px-2.5 py-1">
              Main branch
            </span>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="mt-5 space-y-3 text-sm">
        {address && (
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 mt-0.5 text-stone-400 flex-shrink-0" strokeWidth={1.8} />
            <p className="text-stone-600 leading-relaxed">{address}</p>
          </div>
        )}
        {branch.phone && (
          <div className="flex items-start gap-3">
            <Phone className="w-4 h-4 mt-0.5 text-stone-400 flex-shrink-0" strokeWidth={1.8} />
            <a href={`tel:${branch.phone}`} className="text-stone-600 hover:text-brand transition-colors">
              {branch.phone}
            </a>
          </div>
        )}
        {branch.email && (
          <div className="flex items-start gap-3">
            <Mail className="w-4 h-4 mt-0.5 text-stone-400 flex-shrink-0" strokeWidth={1.8} />
            <a href={`mailto:${branch.email}`} className="text-stone-600 hover:text-brand transition-colors break-all">
              {branch.email}
            </a>
          </div>
        )}
        {(zones.length > 0 || branch.radius_km > 0) && (
          <div className="flex items-start gap-3">
            <Truck className="w-4 h-4 mt-0.5 text-stone-400 flex-shrink-0" strokeWidth={1.8} />
            <div className="text-stone-600 space-y-1">
              {zones.length > 0 ? (
                zones.map((z, i) => (
                  <p key={i}>
                    {z.label ? `${z.label} — ` : ""}
                    {zoneText(z.radius_km, z.charge_type, z.charge, currency)}
                  </p>
                ))
              ) : (
                <p>Delivers within {branch.radius_km} km</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delivery areas */}
      {areas.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400 mb-2">
            Delivery areas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {areas.slice(0, AREA_CHIP_CAP).map((a) => (
              <span
                key={a}
                className="text-xs text-stone-600 bg-stone-100 rounded-full px-3 py-1"
              >
                {a}
              </span>
            ))}
            {areas.length > AREA_CHIP_CAP && (
              <span className="text-xs font-medium text-stone-500 bg-stone-100 rounded-full px-3 py-1">
                +{areas.length - AREA_CHIP_CAP} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Directions */}
      {hasCoords && (
        <div className="mt-auto pt-5">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${branch.center_lat},${branch.center_lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark transition-colors"
          >
            <Navigation className="w-4 h-4" strokeWidth={1.8} />
            Get directions
          </a>
        </div>
      )}
    </article>
  );
}

export default function BranchesPage() {
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();
  const { openPicker } = useLocation();

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => fetchBootstrap(),
  });

  if (bootstrapQ.isLoading) return <StorefrontSkeleton />;
  if (bootstrapQ.error || !bootstrapQ.data) {
    return <div className="min-h-screen flex items-center justify-center text-rose-500">Failed to load. Please try again.</div>;
  }

  const bootstrap = bootstrapQ.data;
  const store = bootstrap.store_name || "our store";
  const branches = (bootstrap.branches ?? []).filter((b) => b.is_active);
  const currencyObj = (bootstrap.currencies || []).find((c) => c.code === currency);
  const totalAreas = new Set(branches.flatMap((b) => b.areas ?? [])).size;

  return (
    <div className="min-h-screen bg-[#FBF9F6]">
      <Header
        bootstrap={bootstrap}
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
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-12 sm:pt-20 sm:pb-16">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand">
            <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
            Our locations
          </span>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-stone-900 mt-4">
            Find a branch <em className="italic text-brand">near you.</em>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-stone-500 max-w-xl leading-relaxed">
            {branches.length > 0
              ? `${store} serves you from ${branches.length} branch${branches.length === 1 ? "" : "es"}${totalAreas > 0 ? ` across ${totalAreas}+ delivery areas` : ""}.`
              : `Find where ${store} operates and which areas we deliver to.`}
          </p>
        </div>
      </section>

      {/* Branch cards */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
        {branches.length === 0 ? (
          <div className="bg-white rounded-3xl border border-stone-200 p-10 sm:p-14 text-center">
            <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-light text-brand mb-5">
              <Store className="w-8 h-8" strokeWidth={1.6} />
            </span>
            <h2 className="font-display text-2xl font-semibold text-stone-900">No branches listed yet</h2>
            <p className="text-sm text-stone-500 mt-2 max-w-sm mx-auto leading-relaxed">
              We haven't published our branch locations yet. Reach out and we'll let you know if we
              deliver to your area.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 mt-6 px-7 py-3.5 rounded-full text-sm font-semibold text-white bg-brand hover:bg-brand-dark shadow-sm hover:shadow-md transition-all"
            >
              Contact us
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {branches.map((b) => (
              <BranchCard key={b.id} branch={b} currency={currencyObj} />
            ))}
          </div>
        )}
      </section>

      {/* Delivery check CTA */}
      {branches.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-14 lg:pb-20">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-dark p-8 sm:p-12 text-white">
            <div
              aria-hidden
              className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10 blur-2xl"
            />
            <div className="relative flex flex-col sm:flex-row sm:items-center gap-6 justify-between">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-semibold leading-snug">
                  Not sure if we deliver to you?
                </h2>
                <p className="mt-2 text-sm text-white/75 max-w-md leading-relaxed">
                  Pick your location and we'll instantly match you with the branch that covers your
                  area.
                </p>
              </div>
              <button
                onClick={openPicker}
                className="group inline-flex items-center justify-center gap-2 flex-shrink-0 px-8 py-4 rounded-full bg-white text-sm font-semibold text-stone-900 shadow-sm hover:shadow-md transition-all"
              >
                <MapPin className="w-4 h-4 text-brand" strokeWidth={2} />
                Check my location
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </section>
      )}

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
